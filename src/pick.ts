import { POOL } from './config.ts';

/** A block position. */
export interface BlockPoint {
  x: number;
  y: number;
  z: number;
}

const POOL_SET: ReadonlySet<string> = new Set(POOL);

/** Whether the block is in the pool, the only blocks that can be deleted. */
export function isInPool(id: string): boolean {
  return POOL_SET.has(id);
}

/** Whether the block can still be deleted: in the pool and not deleted yet. */
export function isDeletable(id: string, deleted: ReadonlySet<string>): boolean {
  return POOL_SET.has(id) && !deleted.has(id);
}

/** The pool blocks not deleted yet, in pool order. */
export function remainingPool(deleted: ReadonlySet<string>): string[] {
  return POOL.filter((id) => !deleted.has(id));
}

/** BLOCKS LEFT: how many pool blocks are not deleted yet. */
export function blocksLeft(deleted: ReadonlySet<string>): number {
  let left = 0;
  for (const id of POOL) {
    if (!deleted.has(id)) left++;
  }
  return left;
}

/**
 * The block under a body at these coordinates. The small step down puts a player standing on a
 * full block on that block, and a player on a carpet, a snow layer or a slab on that block.
 */
export function blockUnder(x: number, y: number, z: number): BlockPoint {
  return { x: Math.floor(x), y: Math.floor(y - 0.05), z: Math.floor(z) };
}

function offsets(): BlockPoint[] {
  const cube: BlockPoint[] = [];
  for (let dy = 0; dy >= -2; dy--) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        cube.push({ x: dx, y: dy, z: dz });
      }
    }
  }
  const distance = (p: BlockPoint): number => p.x * p.x + p.y * p.y + p.z * p.z;
  return cube.sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x || a.z - b.z);
}

/**
 * Where the pick looks, as offsets from the block under the body, in the order it looks: that
 * block first, then the rest of the 3 by 3 by 3 below it, nearest first, lower before higher at
 * the same distance. The glue reads the block at each offset and hands the ids to pickBlock().
 */
export const PICK_OFFSETS: readonly BlockPoint[] = offsets();

/**
 * The block a death deletes. `around` holds the ids at PICK_OFFSETS, the block under the body
 * first. The first one that is still deletable wins; if none is, a random block from what is left
 * of the pool (`random` is in [0, 1)); if the pool is exhausted, nothing. Air, fluids, bedrock,
 * chests and everything else outside the pool are never picked, because only pool blocks are.
 */
export function pickBlock(
  around: readonly string[],
  deleted: ReadonlySet<string>,
  random: number,
): string | null {
  for (const id of around) {
    if (isDeletable(id, deleted)) return id;
  }
  const left = remainingPool(deleted);
  if (left.length === 0) return null;
  const index = Math.min(left.length - 1, Math.max(0, Math.floor(random * left.length)));
  return left[index] ?? null;
}
