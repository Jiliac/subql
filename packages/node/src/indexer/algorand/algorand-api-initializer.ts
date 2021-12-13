// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { assert } from 'console';
import { ApiPromise } from '@polkadot/api';
import { ApiOptions } from '@polkadot/api/types';
import {
  ProviderInterface,
  ProviderInterfaceCallback,
  ProviderInterfaceEmitCb,
  ProviderInterfaceEmitted,
} from '@polkadot/rpc-provider/types';
import { Vec } from '@polkadot/types/codec/Vec';
import { TypeRegistry } from '@polkadot/types/create';
import { Metadata } from '@polkadot/types/metadata';
import algosdk from 'algosdk';
import { ApiInitializer } from '../../configure/api-initializer.interface';
import { SubqueryProject } from '../../configure/project.model';

export class AlgorandApiInitializer implements ApiInitializer {
  private registry = new TypeRegistry();

  async init(project: SubqueryProject): Promise<ApiPromise> {
    // configure for algorand
    const { network } = project;

    const provider = new AlgorandProvider(this.registry, network.endpoint);

    const throwOnConnect = true;

    const apiOption: ApiOptions = {
      provider,
      throwOnConnect,
    };

    const retVal = await ApiPromise.create(apiOption);

    // hack to get api.query.system.events to work properly
    Object.defineProperty(retVal.query, 'system', {
      writable: true,
      value: {
        events: {
          at: (hash: any) =>
            Promise.resolve(new Vec<any>(this.registry, 'Event', [])),
        },
      },
    });

    return retVal;
  }
}

class AlgorandProvider implements ProviderInterface {
  hasSubscriptions = true;
  isConnected: boolean;
  algorandApi: algosdk.Algodv2;
  hashToBlock: Record<string, any> = {};
  lastRoundHash: Promise<any> = null;
  lastHash: string = null;

  listeners: { [key: string]: ProviderInterfaceEmitCb[] } = {
    connected: [],
    disconnected: [],
    error: [],
  };

  constructor(private registry: TypeRegistry, private endpoint: any) {
    const algodToken =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const algodPort = 443;

    this.algorandApi = new algosdk.Algodv2(
      algodToken,
      this.endpoint,
      algodPort,
    );

    this.isConnected = true;
  }

  clone(): ProviderInterface {
    return null;
  }

  async connect(): Promise<void> {
    this.listeners.connected.forEach((listener) => listener());

    return Promise.resolve();
  }
  async disconnect(): Promise<void> {
    this.isConnected = false;

    this.listeners.disconnected.forEach((listener) => listener());

    return Promise.resolve();
  }

  on(type: ProviderInterfaceEmitted, sub: ProviderInterfaceEmitCb): () => void {
    this.listeners[type].push(sub);

    return () => sub();
  }

  async send<T = any>(
    method: string,
    params: unknown[],
    isCacheable?: boolean,
  ): Promise<T> {
    try {
      switch (method) {
        case 'state_getRuntimeVersion': {
          const version = this.registry.createType('RuntimeVersion', {
            specVersion: 1,
          });
          return Promise.resolve(version as any);
        }

        case 'state_getMetadata': {
          const metadata = new Metadata(this.registry, {
            magicNumber: 1635018093,
            metadata: {
              v14: {
                lookup: {},
                modules: [
                  {
                    name: 'system',
                    events: [],
                  },
                ],
              },
            },
          });

          return Promise.resolve(metadata as any);
        }

        case 'system_properties': {
          const properties = this.registry.createType('ChainProperties', null);
          return Promise.resolve(properties as any);
        }

        case 'system_chain': {
          const chain = this.registry.createType('Text', 'Algorand');
          return Promise.resolve(chain as any);
        }

        case 'rpc_methods': {
          const methods = this.registry.createType('RpcMethods');

          return Promise.resolve(methods as any);
        }

        case 'chain_getBlockHash': {
          try {
            console.log(`**chain_getBlockHash: ${params[0]}`);
            const hash = await this.getBlockHash(params[0] as number);
            return hash as any;
          } catch (error) {
            console.log(`Failed to retrieve block hash: ${error.message}`);
            return Promise.resolve<T>(null);
          }
        }

        case 'chain_getFinalizedHead': {
          console.log('**chain_getFinalizedHead**');

          this.lastRoundHash = this.getLastRound()
            .then((lastRound) => this.getBlockHash(lastRound))
            .then((hashValue) => {
              if (this.lastHash) {
                console.log(`Deleting last round hash ${this.lastHash}`);
                // delete the reference to the old last has block
                delete this.hashToBlock[this.lastHash];
              }

              this.lastHash = hashValue;

              return this.lastHash;
            });

          return this.lastRoundHash;
        }

        case 'chain_getHeader': {
          console.log(`**chain_getHeader: ${params}`);

          const blockHash =
            params.length > 0 ? params[0].toString() : await this.lastRoundHash;

          const header = this.getHeader(blockHash);

          return header as any;
        }

        case 'chain_getBlock': {
          console.log(`chain_getBlock: ${params}`);

          const block = this.getBlock(params[0].toString());

          return block as any;
        }

        case 'system_health': {
          // @TODO: Implement
          return Promise.resolve<T>(null);
        }

        default:
          return Promise.resolve<T>(null);
      }
    } catch (error) {
      console.log(`Error: ${error}`);
    }
  }

  async getLastRound() {
    const status = await this.algorandApi.status().do();

    const lastRound = status['last-round'];

    return lastRound;
  }

  async getBlockHash(n: number) {
    assert(!(n === undefined || n === null), `Can't get block hash of ${n}`);

    const blockReq = this.algorandApi.block(n);

    const block = await blockReq.do();

    let blockHash = block?.cert?.prop?.dig;

    if (!blockHash) {
      blockHash = await this.getFirstBlockHash();
    }

    const hash = this.registry.createType('Hash', blockHash);

    const hashStr = hash.toString();

    this.hashToBlock[hashStr] = block;

    console.log(`Blockhash for block ${n} = ${hashStr}`);

    return hashStr;
  }

  async getFirstBlockHash() {
    const blockReq = this.algorandApi.block(1);

    const block = await blockReq.do();

    let blockHash = block.block.prev;

    return blockHash;
  }

  getHeader(blockHash: string) {
    assert(blockHash, `Can't get header of block ${blockHash}`);

    const block = this.hashToBlock[blockHash];

    const header = this.registry.createType('Header', {
      digest: { logs: [] },
      number: block.block.rnd,
      parentHash: block.block.prev,
      block: block.block,
      cert: block.cert,
    });

    console.log(`Parent hash for block ${blockHash} = ${header.parentHash}`);

    return header;
  }

  getBlock(blockHash: string) {
    assert(blockHash, `Can't get block with number ${blockHash}`);

    const block = this.hashToBlock[blockHash];

    // delete the block from the cache if it is not the lastRoundHash
    if (blockHash !== this.lastHash) {
      console.log(`Deleting from cache: ${blockHash}`);
      delete this.hashToBlock[blockHash];
    }

    const subBlock = this.registry.createType('SignedBlock', {
      block: {
        header: {
          digest: { logs: [] },
          number: block.block.rnd,
          parentHash: block.block.prev,
          block: block.block,
          cert: block.cert,
        },
        extrinsics: [],
      },
    });

    return subBlock;
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
