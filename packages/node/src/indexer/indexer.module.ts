// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SubqueryProject } from '../configure/project.model';
import { DbModule } from '../db/db.module';
import { AlgorandApiInitializer } from './algorand/algorand-api-initializer';
import { ApiService } from './api.service';
import { BenchmarkService } from './benchmark.service';
import { DictionaryService } from './dictionary.service';
import { DsProcessorService } from './ds-processor.service';
import { FetchService } from './fetch.service';
import { IndexerManager } from './indexer.manager';
import { MmrService } from './mmr.service';
import { PoiService } from './poi.service';
import { PokadotApiInitializer } from './polkadot/pokadot-api-initializer';
import { SandboxService } from './sandbox.service';
import { StoreService } from './store.service';

function apiServiceFactory(
  project: SubqueryProject,
  eventEmitter: EventEmitter2,
) {
  if (
    project.projectManifest.isV0_2_1 &&
    project.projectManifest.asV0_2_1.network.blockchainType === 'algorand'
  ) {
    return new ApiService(project, eventEmitter, new AlgorandApiInitializer());
  }

  return new ApiService(project, eventEmitter, new PokadotApiInitializer());
}

@Module({
  imports: [DbModule.forFeature(['Subquery'])],
  providers: [
    IndexerManager,
    StoreService,
    {
      provide: ApiService,
      useFactory: async (
        project: SubqueryProject,
        eventEmitter: EventEmitter2,
      ) => {
        const apiService = apiServiceFactory(project, eventEmitter);
        await apiService.init();
        return apiService;
      },
      inject: [SubqueryProject, EventEmitter2],
    },
    FetchService,
    BenchmarkService,
    DictionaryService,
    SandboxService,
    DsProcessorService,
    PoiService,
    MmrService,
  ],
  exports: [StoreService],
})
export class IndexerModule {}
