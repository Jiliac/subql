// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiPromise, HttpProvider, WsProvider } from '@polkadot/api';
import { ApiInitializer } from '../../configure/api-initializer.interface';
import { SubqueryProject } from '../../configure/project.model';

export class PokadotApiInitializer implements ApiInitializer {
  async init(project: SubqueryProject): Promise<ApiPromise> {
    const { chainTypes, network } = project;
    let provider: WsProvider | HttpProvider;
    let throwOnConnect = false;
    if (network.endpoint.startsWith('ws')) {
      provider = new WsProvider(network.endpoint);
    } else if (network.endpoint.startsWith('http')) {
      provider = new HttpProvider(network.endpoint);
      throwOnConnect = true;
    }

    const apiOption = {
      provider,
      throwOnConnect,
      ...chainTypes,
    };

    return ApiPromise.create(apiOption);
  }
}
