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
            Promise.resolve(new Vec<any>(this.registry, 'EventRecord', [])),
          range: (start: any, end: any) =>
            Promise.resolve(
              new Vec<any>(this.registry, 'FrameSystemEventRecord', []),
            ),
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
  messageRouter: Record<string, (params: unknown[]) => Promise<any>> = {
    state_getRuntimeVersion: (params) => this.state_getRuntimeVersion(params),
    state_getMetadata: (params) => this.state_getMetadata(params),
    system_properties: (params) => this.system_properties(params),
    system_chain: (params) => this.system_chain(params),
    rpc_methods: (params) => this.rpc_methods(params),
    chain_getBlockHash: (params) => this.chain_getBlockHash(params),
    chain_getFinalizedHead: (params) => this.chain_getFinalizedHead(params),
    chain_getHeader: (params) => this.chain_getHeader(params),
    chain_getBlock: (params) => this.chain_getBlock(params),
    system_health: (params) => this.system_health(params),
  };

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
    if (method in this.messageRouter) {
      try {
        return this.messageRouter[method](params);
      } catch (error) {
        console.log(`Error: ${error}`);
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

  private async state_getRuntimeVersion(params: unknown[]) {
    const version = this.registry.createType('RuntimeVersion', {
      specVersion: 1,
    });
    return Promise.resolve(version as any);
  }

  private async state_getMetadata(params: unknown[]) {
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

  private async system_properties(params: unknown[]) {
    const properties = this.registry.createType('ChainProperties', null);
    return Promise.resolve(properties as any);
  }

  private async system_chain(params: unknown[]) {
    const chain = this.registry.createType('Text', 'Algorand');
    return Promise.resolve(chain as any);
  }

  private async rpc_methods(params: unknown[]) {
    const methods = this.registry.createType('RpcMethods');

    return Promise.resolve(methods as any);
  }

  private async chain_getBlockHash(params: unknown[]) {
    try {
      console.log(`**chain_getBlockHash: ${params[0]}`);
      const hash = await this.getBlockHash(params[0] as number);
      return hash as any;
    } catch (error) {
      console.log(`Failed to retrieve block hash: ${error.message}`);
      return Promise.resolve(null);
    }
  }

  private async chain_getFinalizedHead(params: unknown[]) {
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

  private async chain_getHeader(params: unknown[]) {
    console.log(`**chain_getHeader: ${params}`);

    const blockHash =
      params.length > 0 ? params[0].toString() : await this.lastRoundHash;

    const header = this.getHeader(blockHash);

    return header as any;
  }

  private async chain_getBlock(params: unknown[]) {
    console.log(`chain_getBlock: ${params}`);

    const block = this.getBlock(params[0].toString());

    return Promise.resolve(block as any);
  }

  private async system_health(params: unknown[]) {
    return Promise.resolve(null);
  }

  private async getLastRound() {
    const status = await this.algorandApi.status().do();

    const lastRound = status['last-round'];

    return lastRound;
  }

  private async getBlockHash(n: number) {
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

  private async getFirstBlockHash() {
    const blockReq = this.algorandApi.block(1);

    const block = await blockReq.do();

    return block.block.prev;
  }

  private getHeader(blockHash: string) {
    assert(blockHash, `Can't get header of block ${blockHash}`);
    assert(
      blockHash in this.hashToBlock,
      `Missing block in cache: ${blockHash}`,
    );
    const block = this.hashToBlock[blockHash];

    if (!block) {
      return null;
    }

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

  private getBlock(blockHash: string) {
    assert(blockHash, `Can't get block with number ${blockHash}`);
    assert(
      blockHash in this.hashToBlock,
      `Can't find block in hash: ${blockHash}`,
    );

    const block = this.hashToBlock[blockHash];

    if (!block) {
      return null;
    }

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
}
