// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { AlgorandApiInitializer } from './algorand-api-initializer';

describe('AlgorandApiInitializer', () => {
  it('should be defined', () => {
    expect(new AlgorandApiInitializer()).toBeDefined();
  });
});
