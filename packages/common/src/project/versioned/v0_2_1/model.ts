// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {
  SubqlCustomDatasource,
  SubqlCustomHandler,
  SubqlMapping,
  SubqlNetworkFilter,
  SubqlRuntimeHandler,
} from '@subql/types';
import {plainToClass, Type} from 'class-transformer';
import {Equals, IsArray, IsObject, IsOptional, IsString, ValidateNested, validateSync} from 'class-validator';
import yaml from 'js-yaml';
import {FileType} from '..';
import {CustomDataSourceBase, Mapping, RuntimeDataSourceBase} from '../../models';
import {ProjectManifestBaseImpl} from '../base';
import {CustomDatasourceV0_2_1, ProjectManifestV0_2_1, RuntimeDataSourceV0_2_1, SubqlMappingV0_2_1} from './types';

export class ProjectNetworkDeploymentV0_2_1 {
  @IsString()
  genesisHash: string;
  @IsString()
  blockchainType: string;
  @ValidateNested()
  @Type(() => FileType)
  @IsOptional()
  chaintypes?: FileType;
}

export class ProjectNetworkV0_2_1 extends ProjectNetworkDeploymentV0_2_1 {
  @IsString()
  @IsOptional()
  endpoint?: string;
  @IsString()
  @IsOptional()
  dictionary?: string;
}

export class ProjectMappingV0_2_1 extends Mapping {
  @IsString()
  file: string;
}

export class RuntimeDataSourceV0_2_1Impl
  extends RuntimeDataSourceBase<SubqlMappingV0_2_1<SubqlRuntimeHandler>>
  implements RuntimeDataSourceV0_2_1
{
  @Type(() => ProjectMappingV0_2_1)
  @ValidateNested()
  mapping: SubqlMappingV0_2_1<SubqlRuntimeHandler>;
}

export class CustomDataSourceV0_2_1Impl<
    K extends string = string,
    T extends SubqlNetworkFilter = SubqlNetworkFilter,
    M extends SubqlMapping = SubqlMapping<SubqlCustomHandler>
  >
  extends CustomDataSourceBase<K, T, M>
  implements SubqlCustomDatasource<K, T, M> {}

export class DeploymentV0_2_1 {
  @Equals('0.2.1')
  @IsString()
  specVersion: string;
  @ValidateNested()
  @Type(() => FileType)
  schema: FileType;
  @IsArray()
  @ValidateNested()
  @Type(() => CustomDataSourceV0_2_1Impl, {
    discriminator: {
      property: 'kind',
      subTypes: [{value: RuntimeDataSourceV0_2_1Impl, name: 'substrate/Runtime'}],
    },
    keepDiscriminatorProperty: true,
  })
  dataSources: (RuntimeDataSourceV0_2_1 | CustomDatasourceV0_2_1)[];
  @ValidateNested()
  @Type(() => ProjectNetworkDeploymentV0_2_1)
  network: ProjectNetworkDeploymentV0_2_1;
}

export class ProjectManifestV0_2_1Impl extends ProjectManifestBaseImpl implements ProjectManifestV0_2_1 {
  @Equals('0.2.1')
  specVersion: string;
  @IsString()
  name: string;
  @IsString()
  version: string;
  @IsObject()
  @ValidateNested()
  @Type(() => ProjectNetworkV0_2_1)
  network: ProjectNetworkV0_2_1;
  @ValidateNested()
  @Type(() => FileType)
  schema: FileType;
  @IsArray()
  @ValidateNested()
  @Type(() => CustomDataSourceV0_2_1Impl, {
    discriminator: {
      property: 'kind',
      subTypes: [{value: RuntimeDataSourceV0_2_1Impl, name: 'substrate/Runtime'}],
    },
    keepDiscriminatorProperty: true,
  })
  dataSources: (RuntimeDataSourceV0_2_1 | CustomDatasourceV0_2_1)[];
  private _deployment: DeploymentV0_2_1;

  toDeployment(): string {
    return yaml.dump(this._deployment, {
      sortKeys: true,
      condenseFlow: true,
    });
  }

  get deployment(): DeploymentV0_2_1 {
    if (!this._deployment) {
      this._deployment = plainToClass(DeploymentV0_2_1, this);
      validateSync(this._deployment, {whitelist: true});
    }
    return this._deployment;
  }

  validate(): void {
    const errors = validateSync(this.deployment, {whitelist: true, forbidNonWhitelisted: true});
    if (errors?.length) {
      // TODO: print error details
      const errorMsgs = errors.map((e) => e.toString()).join('\n');
      throw new Error(`failed to parse project.yaml.\n${errorMsgs}`);
    }
  }
}
