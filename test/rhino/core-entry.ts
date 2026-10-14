/**
 * Exposes the pure rules to test/rhino/core-scenario.js, so the numbers and strings the game will
 * show are checked on real Rhino, not only in Node. scripts/rhino-check.ts bundles this file the
 * same way as the game script.
 */
import { bossbarCommands } from '../../src/bossbar.ts';
import { POOL, REGROWERS } from '../../src/config.ts';
import { blockName, blocksLeftBar, deletedTitle, shatterCommands } from '../../src/hud.ts';
import { blockId, dimensionId } from '../../src/ids.ts';
import { blocksLeft, blockUnder, PICK_OFFSETS, pickBlock } from '../../src/pick.ts';
import {
  chunkKey,
  chunkOf,
  chunksAround,
  enqueue,
  entryAfter,
  formatEntry,
  newQueue,
  nextStep,
  parseEntry,
  pendingIds,
  regrowPlan,
  scanPlan,
  slabCommand,
} from '../../src/purge.ts';

declare function __registerCore(core: Record<string, unknown>): void;

__registerCore({
  POOL: POOL,
  REGROWERS: REGROWERS,
  bossbarCommands: bossbarCommands,
  blockName: blockName,
  blocksLeftBar: blocksLeftBar,
  deletedTitle: deletedTitle,
  shatterCommands: shatterCommands,
  blockId: blockId,
  dimensionId: dimensionId,
  blocksLeft: blocksLeft,
  blockUnder: blockUnder,
  PICK_OFFSETS: PICK_OFFSETS,
  pickBlock: pickBlock,
  chunkKey: chunkKey,
  chunkOf: chunkOf,
  chunksAround: chunksAround,
  enqueue: enqueue,
  entryAfter: entryAfter,
  formatEntry: formatEntry,
  newQueue: newQueue,
  nextStep: nextStep,
  parseEntry: parseEntry,
  pendingIds: pendingIds,
  regrowPlan: regrowPlan,
  scanPlan: scanPlan,
  slabCommand: slabCommand,
});
