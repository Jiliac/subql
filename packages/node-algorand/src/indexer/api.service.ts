// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { assert } from 'console';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RpcMethodResult } from '@polkadot/api/types';
import { RuntimeVersion } from '@polkadot/types/interfaces';
import { AnyFunction } from '@polkadot/types/types';
import algosdk from 'algosdk';
import { AlgorandBlock } from '@subql/types';
import { SubqueryProject } from '../configure/project.model';
import { getLogger } from '../utils/logger';

const NOT_SUPPORT = (name: string) => () => {
  throw new Error(`${name}() is not supported`);
};

const logger = getLogger('api');

function toHexString(byteArray: Uint8Array) {
  if (byteArray === null) {
    return byteArray;
  }
  let s = '0x';
  byteArray.forEach(function (byte: number) {
    s += `0${(byte & 0xff).toString(16)}`.slice(-2);
  });
  return s;
}

@Injectable()
export class ApiService implements OnApplicationShutdown {
  private api: algosdk.Algodv2;
  private currentBlockHash: string;
  private currentRuntimeVersion: RuntimeVersion;

  genesisHash;
  chain: string = 'algorand';
  specName: string = 'mainnet-1.0';
  specVersion: number = 1;

  constructor(
    protected project: SubqueryProject,
    private eventEmitter: EventEmitter2,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.resolve();
  }

  async init(): Promise<ApiService> {
    const algodToken =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const algodPort = 443;
    const { network } = this.project;

    this.api = new algosdk.Algodv2(algodToken, network.endpoint, algodPort);

    this.genesisHash = toHexString(await this.getFirstBlockHash());

    if (network.genesisHash && network.genesisHash !== this.genesisHash) {
      const err = new Error(
        `Network genesisHash doesn't match expected genesisHash. expected="${network.genesisHash}" actual="${this.genesisHash}`,
      );
      logger.error(err, err.message);
      throw err;
    }

    return this;
  }

  getApi(): algosdk.Algodv2 {
    return this.api;
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

  private async getFirstBlockHash() {
    const blockReq = this.api.block(1);
    const block = await blockReq.do();

    return block.block.prev;
  }

  async getLastRound(): Promise<number> {
    const status = await this.api.status().do();
    const lastRound = status['last-round'];

    return Promise.resolve(lastRound);
  }

  async getBlock(n: number): Promise<AlgorandBlock> {
    assert(!(n === undefined || n === null), `Can't get block hash of ${n}`);

    const blockReq = this.api.block(n);
    const rawBlock = await blockReq.do();

    let blockHash = rawBlock?.cert?.prop?.dig;
    if (!blockHash) {
      blockHash = await this.getFirstBlockHash();
    }

    const block = {
      header: {
        hash: blockHash,
        round: rawBlock.block.round,
      },
      transactions: [
      ],
    };

    return Promise.resolve(block);
  }
}
