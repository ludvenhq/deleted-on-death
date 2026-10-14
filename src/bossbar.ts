export type BossbarColor = 'white' | 'green' | 'yellow' | 'red';

export interface Bossbar {
  /** A namespaced id, for example `deleted_on_death:blocks_left`. */
  id: string;
  title: string;
  color: BossbarColor;
  /** The bar is drawn in this many notches. */
  notches: 6 | 10 | 12 | 20;
  max: number;
  value: number;
}

/**
 * The vanilla `/bossbar` commands that create or update a boss bar and show it to `players`, a
 * player name or a selector such as `@a`. The first command fails silently when the bar exists,
 * and the rest update it, so the same list works for both.
 */
export function bossbarCommands(bar: Bossbar, players: string): string[] {
  const name = JSON.stringify({ text: bar.title });
  return [
    `bossbar add ${bar.id} ${name}`,
    `bossbar set ${bar.id} name ${name}`,
    `bossbar set ${bar.id} color ${bar.color}`,
    `bossbar set ${bar.id} style notched_${String(bar.notches)}`,
    `bossbar set ${bar.id} max ${String(Math.max(1, Math.round(bar.max)))}`,
    `bossbar set ${bar.id} value ${String(Math.round(bar.value))}`,
    `bossbar set ${bar.id} players ${players}`,
  ];
}
