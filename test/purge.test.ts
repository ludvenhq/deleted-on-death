import { describe, expect, it } from 'vitest';
import { PRUNE_AGE_TICKS, REFRESH_TICKS } from '../src/config.ts';
import {
  type ChunkEntry,
  type ChunkPos,
  chunkKey,
  chunkOf,
  chunksAround,
  dropTask,
  enqueue,
  entryAfter,
  formatEntry,
  isFastTravel,
  isStale,
  needsRefresh,
  newQueue,
  nextStep,
  parseChunkKey,
  parseEntry,
  pendingIds,
  regrowerIds,
  regrowPlan,
  scanPlan,
  slabCommand,
  type Step,
} from '../src/purge.ts';

const STONE = 'minecraft:stone';
const GRASS = 'minecraft:grass_block';
const GRANITE = 'minecraft:granite';
const loaded = (): boolean => true;

/** Runs the queue to the end for these origins, returning every step. */
function drainAll(queue: ReturnType<typeof newQueue>, origins: { x: number; z: number }[]): Step[] {
  const steps: Step[] = [];
  for (let step = nextStep(queue, origins, 8); step !== null; step = nextStep(queue, origins, 8)) {
    steps.push(step);
  }
  return steps;
}

describe('chunks', () => {
  it('round block coordinates down, also below zero', () => {
    expect(chunkOf(0, 15)).toEqual({ x: 0, z: 0 });
    expect(chunkOf(-1, -16)).toEqual({ x: -1, z: -1 });
    expect(chunkOf(-17, 32)).toEqual({ x: -2, z: 2 });
  });

  it('have keys that read back', () => {
    expect(chunkKey({ x: -3, z: 12 })).toBe('-3,12');
    expect(parseChunkKey('-3,12')).toEqual({ x: -3, z: 12 });
    expect(parseChunkKey('nope')).toBeNull();
  });

  it('come nearest first around a position', () => {
    const chunks = chunksAround({ x: 8, z: 8 }, 2);
    expect(chunks).toHaveLength(25);
    expect(chunks[0]).toEqual({ x: 0, z: 0 });
    expect(chunks.slice(1, 5).map(chunkKey).sort()).toEqual(['-1,0', '0,-1', '0,1', '1,0']);
    expect(chunks[24]).toEqual({ x: 2, z: 2 });
  });

  it('are fast travel when the player crossed more than one chunk since the last scan', () => {
    expect(isFastTravel(undefined, { x: 5, z: 5 })).toBe(false);
    expect(isFastTravel({ x: 4, z: 4 }, { x: 5, z: 5 })).toBe(false);
    expect(isFastTravel({ x: 3, z: 5 }, { x: 5, z: 5 })).toBe(true);
  });
});

describe('the fill', () => {
  it('removes one block from a 16 by 64 by 16 slab of a chunk in the Overworld', () => {
    expect(slabCommand({ x: -1, z: 2 }, 0, STONE)).toBe(
      'execute in minecraft:overworld run fill -16 -64 32 -1 -1 47 minecraft:air replace minecraft:stone',
    );
    expect(slabCommand({ x: 0, z: 0 }, 5, GRASS)).toBe(
      'execute in minecraft:overworld run fill 0 256 0 15 319 15 minecraft:air replace minecraft:grass_block',
    );
  });
});

describe('chunk entries', () => {
  it('are saved as count and tick', () => {
    expect(formatEntry({ count: 3, tick: 120000 })).toBe('3:120000');
    expect(parseEntry('3:120000')).toEqual({ count: 3, tick: 120000 });
    expect(parseEntry('x')).toBeNull();
  });

  it('say which deleted blocks a chunk still holds', () => {
    const deleted = [GRASS, STONE, GRANITE];
    expect(pendingIds(undefined, deleted)).toEqual(deleted);
    expect(pendingIds({ count: 1, tick: 0 }, deleted)).toEqual([STONE, GRANITE]);
    expect(pendingIds({ count: 3, tick: 0 }, deleted)).toEqual([]);
    expect(pendingIds({ count: 9, tick: 0 }, deleted)).toEqual([]);
  });

  it('get the count a purge covered, while a re-sweep only moves the tick', () => {
    expect(entryAfter(undefined, 2, 500)).toEqual({ count: 2, tick: 500 });
    expect(entryAfter({ count: 2, tick: 100 }, -1, 900)).toEqual({ count: 2, tick: 900 });
    expect(entryAfter({ count: 3, tick: 100 }, 2, 900)).toEqual({ count: 3, tick: 900 });
  });

  it('are refreshed when found up to date, and pruned when nobody came near for long', () => {
    const entry: ChunkEntry = { count: 2, tick: 1000 };
    expect(needsRefresh(entry, 2, 1000 + REFRESH_TICKS - 1)).toBe(false);
    expect(needsRefresh(entry, 2, 1000 + REFRESH_TICKS)).toBe(true);
    expect(needsRefresh(entry, 3, 1000 + REFRESH_TICKS)).toBe(false);
    expect(isStale(entry, 1000 + PRUNE_AGE_TICKS)).toBe(false);
    expect(isStale(entry, 1001 + PRUNE_AGE_TICKS)).toBe(true);
  });
});

describe('the queue', () => {
  it('runs six fills per block, the entry written only after the last one', () => {
    const queue = newQueue();
    enqueue(queue, { x: 0, z: 0 }, [GRASS, STONE], 2);
    const steps = drainAll(queue, [{ x: 8, z: 8 }]);
    expect(steps).toHaveLength(12);
    expect(steps.filter((step) => step.done)).toHaveLength(1);
    expect(steps[11]?.done).toBe(true);
    expect(steps[0]?.command).toContain(
      'fill 0 -64 0 15 -1 15 minecraft:air replace minecraft:grass_block',
    );
    expect(steps[6]?.command).toContain('replace minecraft:stone');
    expect(steps[11]?.task.upTo).toBe(2);
    expect(queue.tasks.size).toBe(0);
  });

  it('purges the chunks nearest a player first', () => {
    const queue = newQueue();
    for (const chunk of [
      { x: 3, z: 0 },
      { x: 0, z: 0 },
      { x: -1, z: 0 },
      { x: 0, z: 2 },
    ]) {
      enqueue(queue, chunk, [STONE], 1);
    }
    const done = drainAll(queue, [{ x: 8, z: 8 }])
      .filter((step) => step.done)
      .map((step) => step.task.key);
    expect(done).toEqual(['0,0', '-1,0', '0,2', '3,0']);
  });

  it('follows whichever player is nearest', () => {
    const queue = newQueue();
    enqueue(queue, { x: 0, z: 0 }, [STONE], 1);
    enqueue(queue, { x: 5, z: 0 }, [STONE], 1);
    const first = nextStep(
      queue,
      [
        { x: 88, z: 8 },
        { x: 40, z: 8 },
      ],
      8,
    );
    expect(first?.task.key).toBe('5,0');
  });

  it('finishes a started chunk before moving on, even when a nearer one arrives', () => {
    const queue = newQueue();
    enqueue(queue, { x: 2, z: 0 }, [STONE], 1);
    nextStep(queue, [{ x: 8, z: 8 }], 8);
    enqueue(queue, { x: 0, z: 0 }, [STONE], 1);
    const rest = drainAll(queue, [{ x: 8, z: 8 }]).filter((step) => step.done);
    expect(rest.map((step) => step.task.key)).toEqual(['2,0', '0,0']);
  });

  it('adds blocks deleted meanwhile to a queued chunk', () => {
    const queue = newQueue();
    enqueue(queue, { x: 0, z: 0 }, [GRASS], 1);
    nextStep(queue, [{ x: 8, z: 8 }], 8);
    enqueue(queue, { x: 0, z: 0 }, [GRASS, STONE], 2);
    const steps = drainAll(queue, [{ x: 8, z: 8 }]);
    expect(steps).toHaveLength(11);
    expect(steps[10]?.task.ids).toEqual([GRASS, STONE]);
    expect(steps[10]?.task.upTo).toBe(2);
  });

  it('drops chunks every player has left behind', () => {
    const queue = newQueue();
    enqueue(queue, { x: 0, z: 0 }, [STONE], 1);
    enqueue(queue, { x: 30, z: 0 }, [STONE], 1);
    const steps = drainAll(queue, [{ x: 8, z: 8 }]);
    expect(new Set(steps.map((step) => step.task.key))).toEqual(new Set(['0,0']));
    expect(queue.tasks.size).toBe(0);
  });

  it('does nothing with nobody in the Overworld, and forgets dropped chunks', () => {
    const queue = newQueue();
    enqueue(queue, { x: 0, z: 0 }, [STONE], 1);
    expect(nextStep(queue, [], 8)).toBeNull();
    enqueue(queue, { x: 0, z: 0 }, [STONE], 1);
    nextStep(queue, [{ x: 8, z: 8 }], 8);
    dropTask(queue, '0,0');
    expect(queue.current).toBeNull();
    expect(nextStep(queue, [{ x: 8, z: 8 }], 8)).toBeNull();
  });
});

describe('the scan', () => {
  const deleted = [GRASS, STONE];

  it('queues every loaded chunk with blocks it was not purged of, nearest first', () => {
    const entries = new Map<string, ChunkEntry>([
      ['0,0', { count: 2, tick: 0 }],
      ['1,0', { count: 1, tick: 0 }],
    ]);
    const unloaded = (chunk: ChunkPos): boolean => chunk.x !== -1 || chunk.z !== 0;
    const plan = scanPlan({ x: 8, z: 8 }, 1, deleted, (key) => entries.get(key), unloaded);
    expect(plan.map((planned) => chunkKey(planned.chunk))).not.toContain('0,0');
    expect(plan.map((planned) => chunkKey(planned.chunk))).not.toContain('-1,0');
    expect(plan).toHaveLength(7);
    expect(plan[0]).toEqual({ chunk: { x: 0, z: -1 }, ids: deleted, upTo: 2 });
    expect(plan.find((planned) => chunkKey(planned.chunk) === '1,0')?.ids).toEqual([STONE]);
  });

  it('queues nothing before the first death', () => {
    expect(scanPlan({ x: 0, z: 0 }, 8, [], () => undefined, loaded)).toEqual([]);
  });
});

describe('the regrower re-sweep', () => {
  it('queues only the deleted regrowers, without changing the count', () => {
    const deleted = [GRANITE, GRASS, STONE];
    expect(regrowerIds(deleted)).toEqual([GRASS, STONE]);
    const plan = regrowPlan({ x: 8, z: 8 }, 4, deleted, loaded);
    expect(plan).toHaveLength(81);
    expect(plan.every((planned) => planned.upTo === -1)).toBe(true);
    expect(plan[0]?.ids).toEqual([GRASS, STONE]);
  });

  it('after a minute sweeps a purged chunk again and keeps its count', () => {
    const queue = newQueue();
    for (const planned of regrowPlan({ x: 8, z: 8 }, 0, [GRANITE, GRASS], loaded)) {
      enqueue(queue, planned.chunk, planned.ids, planned.upTo);
    }
    const steps = drainAll(queue, [{ x: 8, z: 8 }]);
    expect(steps).toHaveLength(6);
    expect(steps.every((step) => step.command.endsWith(GRASS))).toBe(true);
    const last = steps[5];
    expect(last?.done).toBe(true);
    expect(entryAfter({ count: 2, tick: 0 }, last?.task.upTo ?? 0, 1200)).toEqual({
      count: 2,
      tick: 1200,
    });
  });

  it('has nothing to do when no regrower is deleted', () => {
    expect(regrowPlan({ x: 0, z: 0 }, 4, [GRANITE], loaded)).toEqual([]);
  });
});
