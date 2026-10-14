import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NEVER_DELETED, POOL, REGROWERS } from '../src/config.ts';

/** Every block in 1.21.1 with its block type, from Mojang's block report (scripts/block-list.ts). */
const BLOCKS = new Map(
  readFileSync('test/data/blocks-1.21.1.txt', 'utf8')
    .split('\n')
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => {
      const [id = '', type = ''] = line.split(' ');
      return [id, type] as const;
    }),
);

/**
 * Block types that are plain matter: no block entity (no items, no sign text, no spawner), no
 * redstone behaviour, nothing that grows or burns. Reviewed by hand against the 1.21.1 block
 * classes; a pool block of any other type fails the test below.
 */
const PLAIN_TYPES = new Set([
  'minecraft:block',
  'minecraft:rotated_pillar',
  'minecraft:drop_experience',
  'minecraft:redstone_ore',
  'minecraft:colored_falling',
  'minecraft:leaves',
  'minecraft:cherry_leaves',
  'minecraft:mangrove_leaves',
  'minecraft:mangrove_roots',
  'minecraft:grass',
  'minecraft:snowy_dirt',
  'minecraft:mycelium',
  'minecraft:rooted_dirt',
  'minecraft:mud',
  'minecraft:moss',
  'minecraft:snow_layer',
  'minecraft:powder_snow',
  'minecraft:ice',
  'minecraft:half_transparent',
  'minecraft:magma',
  'minecraft:sculk',
  'minecraft:amethyst',
  'minecraft:sponge',
  'minecraft:wet_sponge',
  'minecraft:coral',
  'minecraft:transparent',
  'minecraft:stained_glass',
]);

describe('the pool', () => {
  it('has 200 blocks, each once', () => {
    expect(POOL).toHaveLength(200);
    expect(new Set(POOL).size).toBe(POOL.length);
  });

  it('holds only real 1.21.1 block ids', () => {
    expect(BLOCKS.size).toBe(1060);
    expect(POOL.filter((id) => !BLOCKS.has(id))).toEqual([]);
  });

  it('holds no container, block entity or redstone component', () => {
    const odd = POOL.filter((id) => !PLAIN_TYPES.has(BLOCKS.get(id) ?? ''));
    expect(odd).toEqual([]);
    for (const id of ['minecraft:chest', 'minecraft:barrel', 'minecraft:crafting_table']) {
      expect(POOL).not.toContain(id);
    }
  });

  it('never holds the blocks that would break the game', () => {
    expect(NEVER_DELETED.has('minecraft:obsidian')).toBe(true);
    expect(NEVER_DELETED.has('minecraft:red_bed')).toBe(true);
    expect(POOL.filter((id) => NEVER_DELETED.has(id))).toEqual([]);
    expect([...NEVER_DELETED].filter((id) => !BLOCKS.has(id))).toEqual([]);
  });

  it('has its regrowers inside it', () => {
    expect([...REGROWERS].filter((id) => !POOL.includes(id))).toEqual([]);
    expect(REGROWERS.has('minecraft:grass_block')).toBe(true);
    expect(REGROWERS.has('minecraft:oak_log')).toBe(true);
    expect(REGROWERS.has('minecraft:granite')).toBe(false);
  });
});
