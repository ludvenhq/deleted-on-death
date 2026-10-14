import { describe, expect, it } from 'vitest';
import { bossbarCommands } from '../src/bossbar.ts';
import {
  blockName,
  blocksLeftBar,
  blocksLeftColor,
  deletedSounds,
  deletedTitle,
  nothingLeftTitle,
  safeHereTitle,
  shatterCommands,
} from '../src/hud.ts';

describe('on screen', () => {
  it('names a block in capitals', () => {
    expect(blockName('minecraft:grass_block')).toBe('GRASS BLOCK');
    expect(blockName('minecraft:deepslate_diamond_ore')).toBe('DEEPSLATE DIAMOND ORE');
    expect(blockName('stone')).toBe('STONE');
  });

  it('shows BLOCKS LEFT out of the whole pool', () => {
    const bar = blocksLeftBar(199);
    expect(bar.title).toBe('BLOCKS LEFT 199');
    expect(bar.max).toBe(200);
    expect(bar.value).toBe(199);
    expect(bar.color).toBe('white');
    expect(bossbarCommands(bar, '@a')).toContain(
      'bossbar set deleted_on_death:blocks_left players @a',
    );
  });

  it('turns the bar yellow below two thirds and red below one third', () => {
    expect(blocksLeftColor(134, 200)).toBe('white');
    expect(blocksLeftColor(133, 200)).toBe('yellow');
    expect(blocksLeftColor(66, 200)).toBe('red');
    expect(blocksLeftBar(0).title).toBe('BLOCKS LEFT 0');
  });

  it('titles the deleted block for everyone', () => {
    expect(deletedTitle('@a', 'minecraft:grass_block')).toEqual([
      'title @a times 10 70 20',
      'title @a subtitle {"text":"deleted forever","color":"gray"}',
      'title @a title {"text":"GRASS BLOCK","color":"red"}',
    ]);
    expect(nothingLeftTitle('@a')[2]).toBe(
      'title @a title {"text":"NOTHING LEFT","color":"dark_red"}',
    );
    expect(safeHereTitle('Alex')[2]).toBe('title Alex title {"text":"SAFE HERE","color":"green"}');
  });

  it('plays glass and the wither for every player where they stand', () => {
    expect(deletedSounds()).toEqual([
      'execute as @a at @s run playsound minecraft:block.glass.break master @s ~ ~ ~ 1 0.5',
      'execute as @a at @s run playsound minecraft:entity.wither.spawn master @s ~ ~ ~ 0.7 1',
    ]);
  });

  it('shatters the deleted block around a player', () => {
    const commands = shatterCommands(
      { dimension: 'minecraft:overworld', x: 1, y: 65, z: -2.5 },
      'minecraft:stone',
      'Alex',
    );
    expect(commands[0]).toBe(
      'execute in minecraft:overworld run particle minecraft:block{block_state:{Name:"minecraft:stone"}} 1.00 65.00 -2.50 1.5 1 1.5 0.2 120 normal',
    );
    expect(commands[1]).toContain('playsound minecraft:block.glass.break master Alex');
  });
});
