// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiPromise } from '@polkadot/api';
import { SubqueryProject } from './project.model';

export interface ApiInitializer {
  init(project: SubqueryProject): Promise<ApiPromise>;
}
