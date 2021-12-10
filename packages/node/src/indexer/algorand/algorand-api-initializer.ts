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
      // rpc: {
      //   chain: {
      //     getBlock: {
      //       alias: ['blocks'],
      //       aliasSection: 'blocks',
      //       description: 'Get blocks',
      //       endpoint: 'v2/blocks',
      //       isSigned: false,
      //       params: [{ name: 'blockNum', type: 'number' }],
      //       type: 'string',
      //     },
      //     getTransaction: {
      //       alias: ['transactions'],
      //       aliasSection: 'transactions',
      //       description: 'Get transactions',
      //       endpoint: 'v2/transactions',
      //       isSigned: false,
      //       params: [{ name: 'transactionNum', type: 'number' }],
      //       type: 'string',
      //     },
      //   },
      // },
    };

    const retVal = await ApiPromise.create(apiOption);

    return retVal;
  }
}

class AlgorandProvider implements ProviderInterface {
  hasSubscriptions = true;
  isConnected: boolean;
  algorandApi: algosdk.Algodv2;

  constructor(endpoint: any) {
    const algodToken =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const algodServer = endpoint;
    const algodPort = 80;

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
    const methodTokens = method.split('_');
    const category = methodTokens[0];
    const methodName = methodTokens[1];

    if (category === 'chain' && methodName === 'getBlockHash') {
      try {
        const blockHash = this.algorandApi.block(params[0] as number);
        const block = await blockHash.do();

        return Promise.resolve(block as any);
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
