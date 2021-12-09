// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { PolkadotApiInitializer } from './polkadot-api-initializer';

describe('PolkadotApiInitializer', () => {
  it('should be defined', () => {
    expect(new PolkadotApiInitializer()).toBeDefined();
  });
});
