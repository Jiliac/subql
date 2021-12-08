// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiPromise } from '@polkadot/api';
import { RpcMethodResult } from '@polkadot/api/types';
import { BlockHash, RuntimeVersion } from '@polkadot/types/interfaces';
import { AnyFunction } from '@polkadot/types/types';
import { ApiInitializer } from '../configure/api-initializer.interface';
import { SubqueryProject } from '../configure/project.model';
import { getLogger } from '../utils/logger';
import { IndexerEvent, NetworkMetadataPayload } from './events';
import { ApiAt } from './types';

const NOT_SUPPORT = (name: string) => () => {
  throw new Error(`${name}() is not supported`);
};

const logger = getLogger('api');

@Injectable()
export class ApiService implements OnApplicationShutdown {
  private api: ApiPromise;
  private currentBlockHash: string;
  private currentRuntimeVersion: RuntimeVersion;
  networkMeta: NetworkMetadataPayload;

  constructor(
    protected project: SubqueryProject,
    private eventEmitter: EventEmitter2,
    private initializer: ApiInitializer,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.api?.disconnect()]);
  }

  async init(): Promise<ApiService> {
    const network = this.project.network;

    this.api = await this.initializer.init(this.project);

    this.eventEmitter.emit(IndexerEvent.ApiConnected, { value: 1 });
    this.api.on('connected', () => {
      this.eventEmitter.emit(IndexerEvent.ApiConnected, { value: 1 });
    });
    this.api.on('disconnected', () => {
      this.eventEmitter.emit(IndexerEvent.ApiConnected, { value: 0 });
    });

    this.networkMeta = {
      chain: this.api.runtimeChain.toString(),
      specName: this.api.runtimeVersion.specName.toString(),
      genesisHash: this.api.genesisHash.toString(),
    };

    if (
      network.genesisHash &&
      network.genesisHash !== this.networkMeta.genesisHash
    ) {
      const err = new Error(
        `Network genesisHash doesn't match expected genesisHash. expected="${network.genesisHash}" actual="${this.networkMeta.genesisHash}`,
      );
      logger.error(err, err.message);
      throw err;
    }

    return this;
  }

  getApi(): ApiPromise {
    return this.api;
  }

  async getPatchedApi(
    blockHash: string | BlockHash,
    parentBlockHash?: string | BlockHash,
  ): Promise<ApiAt> {
    this.currentBlockHash = blockHash.toString();
    if (parentBlockHash) {
      this.currentRuntimeVersion = await this.api.rpc.state.getRuntimeVersion(
        parentBlockHash,
      );
    }
    const apiAt = (await this.api.at(
      blockHash,
      this.currentRuntimeVersion,
    )) as ApiAt;
    this.patchApiRpc(this.api, apiAt);
    return apiAt;
  }

  private redecorateRpcFunction<T extends 'promise' | 'rxjs'>(
    original: RpcMethodResult<T, AnyFunction>,
  ): RpcMethodResult<T, AnyFunction> {
    if (original.meta.params) {
      const hashIndex = original.meta.params.findIndex(
        ({ isHistoric, name }) => isHistoric,
      );
      if (hashIndex > -1) {
        const ret = ((...args: any[]) => {
          const argsClone = [...args];
          argsClone[hashIndex] = this.currentBlockHash;
          return original(...argsClone);
        }) as RpcMethodResult<T, AnyFunction>;
        ret.raw = NOT_SUPPORT('api.rpc.*.*.raw');
        ret.meta = original.meta;
        return ret;
      }
    }
    const ret = NOT_SUPPORT('api.rpc.*.*') as unknown as RpcMethodResult<
      T,
      AnyFunction
    >;
    ret.raw = NOT_SUPPORT('api.rpc.*.*.raw');
    ret.meta = original.meta;
    return ret;
  }

  private patchApiRpc(api: ApiPromise, apiAt: ApiAt): void {
    apiAt.rpc = Object.entries(api.rpc).reduce((acc, [module, rpcMethods]) => {
      acc[module] = Object.entries(rpcMethods).reduce(
        (accInner, [name, rpcPromiseResult]) => {
          accInner[name] = this.redecorateRpcFunction(rpcPromiseResult);
          return accInner;
        },
        {},
      );
      return acc;
    }, {} as ApiPromise['rpc']);
  }
}
