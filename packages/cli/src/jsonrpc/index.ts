// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {HttpJsonRpcClient, SimpleHttpClient, WsJsonRpcClient} from './client';

export async function getGenesisHash(endpoint: string): Promise<string> {
  const client = endpoint.startsWith('ws') ? new WsJsonRpcClient(endpoint) : new HttpJsonRpcClient(endpoint);
  const genesisBlock = await client.send<string>('chain_getBlockHash', [0]);
  (client as WsJsonRpcClient).destroy?.();
  return genesisBlock;
}

export async function getAlgorandGenesisHash(endpoint: string): Promise<string> {
  const client = new SimpleHttpClient(endpoint);
  const genesisBlock = await client.get<{block: {gh: string}}>('v2/blocks', ['0']);

  return genesisBlock.block.gh;
}
