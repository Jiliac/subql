// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {
  SubqlCustomDatasource,
  SubqlCustomHandler,
  SubqlDatasource,
  SubqlDatasourceKind,
  SubqlHandler,
  SubqlMapping,
  SubqlNetworkFilter,
  SubqlRuntimeDatasource,
  SubqlRuntimeHandler,
} from '@subql/types';
import {IProjectManifest} from '../../types';

export interface SubqlMappingV0_2_1<T extends SubqlHandler> extends SubqlMapping<T> {
  file: string;
}

export type RuntimeDataSourceV0_2_1 = SubqlRuntimeDatasource<SubqlMappingV0_2_1<SubqlRuntimeHandler>>;
export type CustomDatasourceV0_2_1 = SubqlCustomDatasource<
  string,
  SubqlNetworkFilter,
  SubqlMappingV0_2_1<SubqlCustomHandler>
>;

export interface ProjectManifestV0_2_1 extends IProjectManifest {
  name: string;
  version: string;
  schema: {
    file: string;
  };

  network: {
    genesisHash: string;
    blockchainType: string;
    endpoint?: string;
    dictionary?: string;
    chaintypes?: {
      file: string;
    };
  };

  dataSources: (RuntimeDataSourceV0_2_1 | CustomDatasourceV0_2_1)[];
}

export function isRuntimeDataSourceV0_2_1(dataSource: SubqlDatasource): dataSource is RuntimeDataSourceV0_2_1 {
  return dataSource.kind === SubqlDatasourceKind.Runtime && !!(dataSource as RuntimeDataSourceV0_2_1).mapping.file;
}
