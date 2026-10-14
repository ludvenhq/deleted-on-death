import { describe, expect, it } from 'vitest';
import { blockId, dimensionId } from '../src/ids.ts';

describe('ids from the game', () => {
  it('reads a dimension from its id or a ResourceKey', () => {
    expect(dimensionId('minecraft:overworld')).toBe('minecraft:overworld');
    expect(dimensionId('ResourceKey[minecraft:dimension / minecraft:the_nether]')).toBe(
      'minecraft:the_nether',
    );
  });

  it('reads a block from its id, a Block or a BlockState', () => {
    expect(blockId('minecraft:stone')).toBe('minecraft:stone');
    expect(blockId('Block{minecraft:stone}')).toBe('minecraft:stone');
    expect(blockId('Block{minecraft:oak_log}[axis=y]')).toBe('minecraft:oak_log');
    expect(blockId('minecraft:oak_log[axis=y]')).toBe('minecraft:oak_log');
  });
});
