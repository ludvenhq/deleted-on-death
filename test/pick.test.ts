import { describe, expect, it } from 'vitest';
import { POOL } from '../src/config.ts';
import {
  blocksLeft,
  blockUnder,
  isDeletable,
  PICK_OFFSETS,
  pickBlock,
  remainingPool,
} from '../src/pick.ts';

const AIR = 'minecraft:air';
const NONE = new Set<string>();

/** The 27 ids around a body: `under` at the block under it, `rest` at every other offset. */
function around(under: string, rest: string, at: Record<string, string> = {}): string[] {
  return PICK_OFFSETS.map((offset, index) => {
    const key = `${String(offset.x)},${String(offset.y)},${String(offset.z)}`;
    return at[key] ?? (index === 0 ? under : rest);
  });
}

describe('the block under the body', () => {
  it('is the block a player stands on', () => {
    expect(blockUnder(0.5, 64, 0.5)).toEqual({ x: 0, y: 63, z: 0 });
    expect(blockUnder(-0.5, 64, -10.2)).toEqual({ x: -1, y: 63, z: -11 });
  });

  it('is the carpet, the snow layer or the slab under a player standing on one', () => {
    expect(blockUnder(0.5, 64.0625, 0.5).y).toBe(64);
    expect(blockUnder(0.5, 64.125, 0.5).y).toBe(64);
    expect(blockUnder(0.5, 64.5, 0.5).y).toBe(64);
  });
});

describe('where the pick looks', () => {
  it('starts under the body and then goes straight down', () => {
    expect(PICK_OFFSETS).toHaveLength(27);
    expect(PICK_OFFSETS[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(PICK_OFFSETS[1]).toEqual({ x: 0, y: -1, z: 0 });
  });

  it('covers the 3 by 3 by 3 under the body once each', () => {
    const keys = new Set(PICK_OFFSETS.map((o) => `${String(o.x)},${String(o.y)},${String(o.z)}`));
    expect(keys.size).toBe(27);
    expect(PICK_OFFSETS.every((o) => o.y <= 0 && o.y >= -2)).toBe(true);
  });
});

describe('the pick', () => {
  it('deletes the block under the body', () => {
    expect(pickBlock(around('minecraft:grass_block', 'minecraft:dirt'), NONE, 0)).toBe(
      'minecraft:grass_block',
    );
  });

  it('skips a chest under the body for the nearest pool block', () => {
    const ids = around('minecraft:chest', AIR, { '0,-1,0': 'minecraft:stone' });
    expect(pickBlock(ids, NONE, 0)).toBe('minecraft:stone');
  });

  it('skips a crafting table for an ore next to it', () => {
    const ids = around('minecraft:crafting_table', 'minecraft:bedrock', {
      '1,0,0': 'minecraft:deepslate_diamond_ore',
    });
    expect(pickBlock(ids, NONE, 0)).toBe('minecraft:deepslate_diamond_ore');
  });

  it('prefers the block below to one beside at the same distance', () => {
    const ids = around(AIR, AIR, { '1,0,0': 'minecraft:oak_log', '0,-1,0': 'minecraft:dirt' });
    expect(pickBlock(ids, NONE, 0)).toBe('minecraft:dirt');
  });

  it('skips a block that is already deleted', () => {
    const ids = around('minecraft:grass_block', AIR, { '0,-1,0': 'minecraft:dirt' });
    expect(pickBlock(ids, new Set(['minecraft:grass_block']), 0)).toBe('minecraft:dirt');
  });

  it('falls back to a random pool block when nothing around is in the pool', () => {
    const ids = around('minecraft:water', 'minecraft:water');
    expect(pickBlock(ids, NONE, 0)).toBe(POOL[0]);
    expect(pickBlock(ids, NONE, 0.9999)).toBe(POOL[POOL.length - 1]);
  });

  it('never picks air, fluids or bedrock, and nothing once the pool is exhausted', () => {
    const all = new Set(POOL);
    expect(pickBlock(around('minecraft:bedrock', 'minecraft:lava'), all, 0.5)).toBeNull();
    expect(pickBlock(around('minecraft:stone', 'minecraft:stone'), all, 0)).toBeNull();
  });
});

describe('the pool count', () => {
  it('counts what is left', () => {
    expect(blocksLeft(NONE)).toBe(200);
    const deleted = new Set(['minecraft:stone', 'minecraft:dirt', 'minecraft:chest']);
    expect(blocksLeft(deleted)).toBe(198);
    expect(remainingPool(deleted)).toHaveLength(198);
    expect(isDeletable('minecraft:stone', deleted)).toBe(false);
    expect(isDeletable('minecraft:chest', NONE)).toBe(false);
  });
});
