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
        const version = this.registry.createType('RuntimeVersion', {specVersion: 1});
        return Promise.resolve(version as any);

      case "state_getMetadata":
        const metadata = this.registry.createType('MetadataV14', {
          magicNumber: 2133742,
          metadata: {
            index: 3,
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
          const blockReq = this.algorandApi.block(params[0] as number);
          const block = await blockReq.do();

          let blockHash = block?.cert?.prop?.dig;
          if (blockHash == null) {
            blockHash = block.block.gh;
          }

          const hash = this.registry.createType("Hash", blockHash);
          return Promise.resolve(hash as any);
        } catch (error) {
          console.log(`Failed to retrieve block hash: ${error.message}`);
        }
    }

    return Promise.resolve<T>(null);
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
