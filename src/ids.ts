/**
 * Turns what the game hands a script into plain ids. Depending on which member Rhino resolves, a
 * level's dimension reads as KubeJS's id (`minecraft:overworld`) or as a vanilla ResourceKey
 * (`ResourceKey[minecraft:dimension / minecraft:overworld]`), and a block reads as KubeJS's id
 * (`minecraft:stone`) or as a vanilla BlockState or Block (`Block{minecraft:oak_log}[axis=y]`).
 */

/** `minecraft:overworld` from either the id or a ResourceKey's string. */
export function dimensionId(raw: string): string {
  const match = /^ResourceKey\[[^/\]]+\/\s*([^\]\s]+)\s*\]$/.exec(raw);
  return match?.[1] ?? raw;
}

/** `minecraft:oak_log` from `minecraft:oak_log`, `Block{minecraft:oak_log}` or `Block{minecraft:oak_log}[axis=y]`. */
export function blockId(raw: string): string {
  const match = /^Block\{([^}]+)\}/.exec(raw);
  if (match?.[1] !== undefined) return match[1];
  const bracket = raw.indexOf('[');
  return bracket < 0 ? raw : raw.slice(0, bracket);
}
