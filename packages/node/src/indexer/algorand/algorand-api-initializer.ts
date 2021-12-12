// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiPromise } from '@polkadot/api';
import { ApiOptions } from '@polkadot/api/types';
import {
  ProviderInterface,
  ProviderInterfaceCallback,
  ProviderInterfaceEmitCb,
  ProviderInterfaceEmitted,
} from '@polkadot/rpc-provider/types';
import { TypeRegistry } from '@polkadot/types/create'
import { Metadata } from '@polkadot/types/metadata';
import algosdk from 'algosdk';
import { ApiInitializer } from '../../configure/api-initializer.interface';
import { SubqueryProject } from '../../configure/project.model';

export class AlgorandApiInitializer implements ApiInitializer {
  async init(project: SubqueryProject): Promise<ApiPromise> {
    // configure for algorand
    const { network } = project;

    const provider = new AlgorandProvider(network.endpoint);

    const throwOnConnect = true;

    const apiOption: ApiOptions = {
      provider,
      throwOnConnect,
    };

    const retVal = await ApiPromise.create(apiOption);

    return retVal;
  }
}

class AlgorandProvider implements ProviderInterface {
  hasSubscriptions = true;
  registry = new TypeRegistry();
  isConnected: boolean;
  algorandApi: algosdk.Algodv2;
  roundHahes: Record<string, number> = {};

  constructor(endpoint: any) {
    const algodToken =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const algodServer = endpoint;
    const algodPort = 443;

    this.algorandApi = new algosdk.Algodv2(algodToken, algodServer, algodPort);

    this.isConnected = true;
  }

  clone(): ProviderInterface {
    return null;
  }
  async connect(): Promise<void> {
    return Promise.resolve();
  }
  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  on(type: ProviderInterfaceEmitted, sub: ProviderInterfaceEmitCb): () => void {
    return () => console.log('Yep');
  }

  // FIXME: how to delegate calls to http provider to the algosdk?
  // const algProvider = new algosdk.Algodv2(algodToken, algodServer, algodPort);

  async send<T = any>(
    method: string,
    params: unknown[],
    isCacheable?: boolean,
  ): Promise<T> {
    switch (method) {
      case "state_getRuntimeVersion":
        const version = this.registry.createType('RuntimeVersion', { specVersion: 1 });
        return Promise.resolve(version as any);

      case "state_getMetadata":
        const metadata = new Metadata(this.registry, {
          magicNumber: 1635018093,
          metadata: {
            v14: {
              lookup: {}
            }
          }
        });

        return Promise.resolve(metadata as any);

      case "system_properties":
        const properties = this.registry.createType('ChainProperties', null);
        return Promise.resolve(properties as any);

      case "system_chain":
        const chain = this.registry.createType('Text', "Algorand");
        return Promise.resolve(chain as any);

      case "rpc_methods":
        const methods = this.registry.createType('RpcMethods');
        return Promise.resolve(methods as any);

      case "chain_getBlockHash":
        try {
          const hash = await this.getBlockHash(params[0] as number);
          return Promise.resolve(hash as any);
        } catch (error) {
          console.log(`Failed to retrieve block hash: ${error.message}`);
        }

      case "chain_getFinalizedHead":
        const lastRound = await this.getLastRound();
        const finalHash = await this.getBlockHash(lastRound);
        return Promise.resolve(finalHash as any);

      case "chain_getHeader":
        let blockN: number;
        if (params.length == 0) {
          const lastRound = await this.getLastRound();
          blockN = lastRound;
        } else {
          const hashStr = params[0] as string;
          blockN = this.roundHahes[hashStr];
          // @TODO: Check result and throw error ?
          console.log(`Fetched round of block '${blockN}'.`)
          delete this.roundHahes[hashStr];
        }

        const header = this.getHeader(blockN);
        return Promise.resolve(header as any);
    }

    return Promise.resolve<T>(null);
  }

  async getLastRound() {
    const status = await this.algorandApi.status().do();
    const lastRound = status['last-round'];
    return lastRound;
  }

  async getBlockHash(n: number) {
    const blockReq = this.algorandApi.block(n);
    const block = await blockReq.do();

    let blockHash = block?.cert?.prop?.dig;
    if (blockHash == null) {
      blockHash = block.block.gh;
    }

    const hash = this.registry.createType("Hash", blockHash);
    const hashStr = hash.toString();
    console.log(`For number '${n}', returning hash: ${hashStr}.`);
    this.roundHahes[hashStr] = n;
    return hash;
  }

  async getHeader(n: number) {
    const blockReq = this.algorandApi.block(n);
    const block = await blockReq.do();

    const header = this.registry.createType('Header', {
      digest: { logs: [] },
      number: block.block.rnd,
      parentHash: block.block.prev,
      block: block.block,
      cert: block.cert,
    });

    return header;
  }

  async subscribe(
    type: string,
    method: string,
    params: unknown[],
    cb: ProviderInterfaceCallback,
  ): Promise<string | number> {
    return Promise.resolve('');
  }

  async unsubscribe(
    type: string,
    method: string,
    id: string | number,
  ): Promise<boolean> {
    return Promise.resolve(false);
  }
}
