// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { PokadotApiInitializer } from './pokadot-api-initializer';

describe('PokadotApiInitializer', () => {
  it('should be defined', () => {
    expect(new PokadotApiInitializer()).toBeDefined();
  });
});
