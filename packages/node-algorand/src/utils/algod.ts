// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiPromise } from '@polkadot/api';
import { Vec } from '@polkadot/types';
import {
  BlockHash,
  EventRecord,
  SignedBlock,
} from '@polkadot/types/interfaces';
import {
  SpecVersionRange,
  SubqlBlockFilter,
  SubqlCallFilter,
  SubqlEventFilter,
  SubstrateBlock,
  SubstrateEvent,
  SubstrateExtrinsic,
  AlgorandBlock,
} from '@subql/types';
import { merge, range } from 'lodash';
import { ApiService } from '../indexer/api.service';
import { getLogger } from './logger';

const logger = getLogger('fetch');

export function wrapBlock(
  signedBlock: SignedBlock,
  events: EventRecord[],
  specVersion?: number,
): SubstrateBlock {
  return merge(signedBlock, {
    timestamp: getTimestamp(signedBlock),
    specVersion: specVersion,
    events,
  });
}

function getTimestamp({ block: { extrinsics } }: SignedBlock): Date {
  for (const e of extrinsics) {
    const {
      method: { method, section },
    } = e;
    if (section === 'timestamp' && method === 'set') {
      const date = new Date(e.args[0].toJSON() as number);
      if (isNaN(date.getTime())) {
        throw new Error('timestamp args type wrong');
      }
      return date;
    }
  }
}

export function wrapExtrinsics(
  wrappedBlock: SubstrateBlock,
  allEvents: EventRecord[],
): SubstrateExtrinsic[] {
  return wrappedBlock.block.extrinsics.map((extrinsic, idx) => {
    const events = filterExtrinsicEvents(idx, allEvents);
    return {
      idx,
      extrinsic,
      block: wrappedBlock,
      events,
      success: getExtrinsicSuccess(events),
    };
  });
}

function getExtrinsicSuccess(events: EventRecord[]): boolean {
  return (
    events.findIndex((evt) => evt.event.method === 'ExtrinsicSuccess') > -1
  );
}

function filterExtrinsicEvents(
  extrinsicIdx: number,
  events: EventRecord[],
): EventRecord[] {
  return events.filter(
    ({ phase }) =>
      phase.isApplyExtrinsic && phase.asApplyExtrinsic.eqn(extrinsicIdx),
  );
}

export function wrapEvents(
  extrinsics: SubstrateExtrinsic[],
  events: EventRecord[],
  block: SubstrateBlock,
): SubstrateEvent[] {
  return events.reduce((acc, event, idx) => {
    const { phase } = event;
    const wrappedEvent: SubstrateEvent = merge(event, { idx, block });
    if (phase.isApplyExtrinsic) {
      wrappedEvent.extrinsic = extrinsics[phase.asApplyExtrinsic.toNumber()];
    }
    acc.push(wrappedEvent);
    return acc;
  }, [] as SubstrateEvent[]);
}

function checkSpecRange(
  specVersionRange: SpecVersionRange,
  specVersion: number,
) {
  const [lowerBond, upperBond] = specVersionRange;
  return (
    (lowerBond === undefined ||
      lowerBond === null ||
      specVersion >= lowerBond) &&
    (upperBond === undefined || upperBond === null || specVersion <= upperBond)
  );
}

export function filterBlock(
  block: SubstrateBlock,
  filter?: SubqlBlockFilter,
): SubstrateBlock | undefined {
  if (!filter) return block;
  return filter.specVersion === undefined ||
    block.specVersion === undefined ||
    checkSpecRange(filter.specVersion, block.specVersion)
    ? block
    : undefined;
}

export function filterExtrinsics(
  extrinsics: SubstrateExtrinsic[],
  filterOrFilters: SubqlCallFilter | SubqlCallFilter[] | undefined,
): SubstrateExtrinsic[] {
  if (
    !filterOrFilters ||
    (filterOrFilters instanceof Array && filterOrFilters.length === 0)
  ) {
    return extrinsics;
  }
  const filters =
    filterOrFilters instanceof Array ? filterOrFilters : [filterOrFilters];
  return extrinsics.filter(({ block, extrinsic, success }) =>
    filters.find(
      (filter) =>
        (filter.specVersion === undefined ||
          block.specVersion === undefined ||
          checkSpecRange(filter.specVersion, block.specVersion)) &&
        (filter.module === undefined ||
          extrinsic.method.section === filter.module) &&
        (filter.method === undefined ||
          extrinsic.method.method === filter.method) &&
        (filter.success === undefined || success === filter.success),
    ),
  );
}

export function filterEvents(
  events: SubstrateEvent[],
  filterOrFilters?: SubqlEventFilter | SubqlEventFilter[] | undefined,
): SubstrateEvent[] {
  if (
    !filterOrFilters ||
    (filterOrFilters instanceof Array && filterOrFilters.length === 0)
  ) {
    return events;
  }
  const filters =
    filterOrFilters instanceof Array ? filterOrFilters : [filterOrFilters];
  return events.filter(({ block, event }) =>
    filters.find(
      (filter) =>
        (filter.specVersion === undefined ||
          block.specVersion === undefined ||
          checkSpecRange(filter.specVersion, block.specVersion)) &&
        (filter.module ? event.section === filter.module : true) &&
        (filter.method ? event.method === filter.method : true),
    ),
  );
}

/**
 *
 * @param api
 * @param startHeight
 * @param endHeight
 */
export async function fetchBlocks(
  api: ApiService,
  startHeight: number,
  endHeight: number,
): Promise<AlgorandBlock[]> {
  const blocks = await fetchBlocksRange(api, startHeight, endHeight);
  return blocks;
  //return blocks.map((block, idx) => {
  //  const events = blockEvents[idx];
  //  const parentSpecVersion = overallSpecVer
  //    ? overallSpecVer
  //    : runtimeVersions[idx].specVersion.toNumber();

  //  const wrappedBlock = wrapBlock(block, events.toArray(), parentSpecVersion);
  //  const wrappedExtrinsics = wrapExtrinsics(wrappedBlock, events);
  //  const wrappedEvents = wrapEvents(wrappedExtrinsics, events, wrappedBlock);
  //  return {
  //    block: wrappedBlock,
  //    extrinsics: wrappedExtrinsics,
  //    events: wrappedEvents,
  //  };
  //});
}

async function getBlockByHeight(
  api: ApiService,
  height: number,
): Promise<AlgorandBlock> {
  return api.getBlock(height).catch((e) => {
    logger.error(`failed to fetch Block at height ${height}.`);
    throw e;
  });
}

export async function fetchBlocksRange(
  api: ApiService,
  startHeight: number,
  endHeight: number,
): Promise<AlgorandBlock[]> {
  return Promise.all(
    range(startHeight, endHeight + 1).map(async (height) =>
      getBlockByHeight(api, height),
    ),
  );
}

export async function fetchBlocksArray(
  api: ApiService,
  blockArray: number[],
): Promise<AlgorandBlock[]> {
  return Promise.all(
    blockArray.map(async (height) => getBlockByHeight(api, height)),
  );
}

export async function fetchEventsRange(
  api: ApiPromise,
  hashs: BlockHash[],
): Promise<Vec<EventRecord>[]> {
  return Promise.all(
    hashs.map((hash) =>
      api.query.system.events.at(hash).catch((e) => {
        logger.error(`failed to fetch events at block ${hash}`);
        throw e;
      }),
    ),
  );
}

export async function fetchBlocksBatches(
  api: ApiService,
  blockArray: number[],
): Promise<AlgorandBlock[]> {
  const blocks = await fetchBlocksArray(api, blockArray);
  return blocks;
  //return blocks.map((block, idx) => {
  //  const events = blockEvents[idx];
  //  const parentSpecVersion = overallSpecVer
  //    ? overallSpecVer
  //    : runtimeVersions[idx].specVersion.toNumber();
  //  const wrappedBlock = wrapBlock(block, events.toArray(), parentSpecVersion);
  //  const wrappedExtrinsics = wrapExtrinsics(wrappedBlock, events);
  //  const wrappedEvents = wrapEvents(wrappedExtrinsics, events, wrappedBlock);
  //  return {
  //    block: wrappedBlock,
  //    extrinsics: wrappedExtrinsics,
  //    events: wrappedEvents,
  //  };
  //});
}
