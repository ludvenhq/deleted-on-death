import type { Bossbar, BossbarColor } from './bossbar.ts';
import { BAR_ID, POOL } from './config.ts';

/** A place in a level: the dimension id and the coordinates. */
export interface At {
  dimension: string;
  x: number;
  y: number;
  z: number;
}

function coords(at: At): string {
  return `${at.x.toFixed(2)} ${at.y.toFixed(2)} ${at.z.toFixed(2)}`;
}

/** `minecraft:grass_block` reads `GRASS BLOCK` on screen. */
export function blockName(id: string): string {
  const colon = id.indexOf(':');
  return id
    .slice(colon + 1)
    .split('_')
    .join(' ')
    .toUpperCase();
}

/** White while most of the pool is left, yellow below two thirds, red below one third. */
export function blocksLeftColor(left: number, total: number): BossbarColor {
  if (left * 3 < total) return 'red';
  if (left * 3 < total * 2) return 'yellow';
  return 'white';
}

/** The BLOCKS LEFT boss bar: what is left of the pool, out of the whole pool. */
export function blocksLeftBar(left: number): Bossbar {
  return {
    id: BAR_ID,
    title: `BLOCKS LEFT ${String(left)}`,
    color: blocksLeftColor(left, POOL.length),
    notches: 20,
    max: POOL.length,
    value: left,
  };
}

function titleCommands(players: string, title: string, color: string, subtitle: string): string[] {
  return [
    `title ${players} times 10 70 20`,
    `title ${players} subtitle ${JSON.stringify({ text: subtitle, color: 'gray' })}`,
    `title ${players} title ${JSON.stringify({ text: title, color: color })}`,
  ];
}

/** `GRASS BLOCK`, `deleted forever`: the death moment, for everyone. */
export function deletedTitle(players: string, id: string): string[] {
  return titleCommands(players, blockName(id), 'red', 'deleted forever');
}

/** A death once the pool is exhausted. */
export function nothingLeftTitle(players: string): string[] {
  return titleCommands(players, 'NOTHING LEFT', 'dark_red', 'every block is gone');
}

/** A death outside the Overworld deletes nothing. */
export function safeHereTitle(players: string): string[] {
  return titleCommands(players, 'SAFE HERE', 'green', 'nothing is deleted outside the Overworld');
}

/** Glass breaking low and the wither's spawn, each player hearing it where they stand. */
export function deletedSounds(): string[] {
  return [
    'execute as @a at @s run playsound minecraft:block.glass.break master @s ~ ~ ~ 1 0.5',
    'execute as @a at @s run playsound minecraft:entity.wither.spawn master @s ~ ~ ~ 0.7 1',
  ];
}

/** The wave reaching a player: the deleted block shattering around them. */
export function shatterCommands(at: At, id: string, player: string): string[] {
  const particle = `minecraft:block{block_state:{Name:${JSON.stringify(id)}}}`;
  return [
    `execute in ${at.dimension} run particle ${particle} ${coords(at)} 1.5 1 1.5 0.2 120 normal`,
    `execute in ${at.dimension} positioned ${coords(at)} run playsound minecraft:block.glass.break master ${player} ~ ~ ~ 1 0.7`,
  ];
}
