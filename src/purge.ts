import {
  FAST_TRAVEL_CHUNKS,
  MIN_Y,
  OVERWORLD,
  PRUNE_AGE_TICKS,
  REFRESH_TICKS,
  REGROWERS,
  SLAB_HEIGHT,
  SLABS_PER_CHUNK,
} from './config.ts';

/**
 * The purge, as pure functions: which chunks need which deleted blocks removed, the queue that
 * orders the work nearest first, and the fill commands that do it. The game glue in purger.ts
 * reads the world, calls these and runs the commands.
 */

/** A chunk position: block coordinates divided by 16, rounded down. */
export interface ChunkPos {
  x: number;
  z: number;
}

/** A horizontal block position, where a player stands. */
export interface Origin {
  x: number;
  z: number;
}

/**
 * What the world's save keeps per purged chunk: `count`, how many of the deleted blocks (in the
 * order they were deleted) are purged from it, and `tick`, the game time it was last purged or
 * last found up to date by a scan.
 */
export interface ChunkEntry {
  count: number;
  tick: number;
}

export function chunkOf(blockX: number, blockZ: number): ChunkPos {
  return { x: Math.floor(blockX / 16), z: Math.floor(blockZ / 16) };
}

export function chunkKey(chunk: ChunkPos): string {
  return `${String(chunk.x)},${String(chunk.z)}`;
}

export function parseChunkKey(key: string): ChunkPos | null {
  const match = /^(-?\d+),(-?\d+)$/.exec(key);
  if (match === null) return null;
  return { x: Number(match[1]), z: Number(match[2]) };
}

/** Chebyshev distance in chunks: 1 for every chunk around a chunk, corners included. */
export function chunkDistance(a: ChunkPos, b: ChunkPos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}

/** Squared distance in blocks from a position to a chunk's centre. */
function distanceToChunk(origin: Origin, chunk: ChunkPos): number {
  const dx = chunk.x * 16 + 8 - origin.x;
  const dz = chunk.z * 16 + 8 - origin.z;
  return dx * dx + dz * dz;
}

/** The square of chunks within `radius` of the origin's chunk, nearest to the origin first. */
export function chunksAround(origin: Origin, radius: number): ChunkPos[] {
  const center = chunkOf(origin.x, origin.z);
  const chunks: ChunkPos[] = [];
  for (let x = center.x - radius; x <= center.x + radius; x++) {
    for (let z = center.z - radius; z <= center.z + radius; z++) {
      chunks.push({ x: x, z: z });
    }
  }
  return chunks.sort(
    (a, b) => distanceToChunk(origin, a) - distanceToChunk(origin, b) || a.x - b.x || a.z - b.z,
  );
}

/** A player who moved more than FAST_TRAVEL_CHUNKS since the last scan is not scanned. */
export function isFastTravel(last: ChunkPos | undefined, now: ChunkPos): boolean {
  return last !== undefined && chunkDistance(last, now) > FAST_TRAVEL_CHUNKS;
}

// ---- Chunk entries ----

/** `3:120000`: the count and the tick, as the save keeps them. */
export function formatEntry(entry: ChunkEntry): string {
  return `${String(entry.count)}:${String(entry.tick)}`;
}

export function parseEntry(raw: string): ChunkEntry | null {
  const match = /^(\d+):(-?\d+)$/.exec(raw);
  if (match === null) return null;
  return { count: Number(match[1]), tick: Number(match[2]) };
}

/** The deleted blocks not yet purged from a chunk: everything deleted after its count. */
export function pendingIds(entry: ChunkEntry | undefined, deleted: readonly string[]): string[] {
  return deleted.slice(entry === undefined ? 0 : Math.min(entry.count, deleted.length));
}

/** The deleted blocks the re-sweep removes again: the regrowers, in the order they were deleted. */
export function regrowerIds(deleted: readonly string[]): string[] {
  return deleted.filter((id) => REGROWERS.has(id));
}

/** A scan that finds a chunk up to date refreshes its entry once it is older than REFRESH_TICKS. */
export function needsRefresh(entry: ChunkEntry, deletedCount: number, now: number): boolean {
  return entry.count >= deletedCount && now - entry.tick >= REFRESH_TICKS;
}

/** Entries untouched for PRUNE_AGE_TICKS are dropped; the chunk is purged in full if met again. */
export function isStale(entry: ChunkEntry, now: number): boolean {
  return now - entry.tick > PRUNE_AGE_TICKS;
}

/**
 * The entry a chunk gets when its task completes. A purge raises the count to what the task
 * covered; a re-sweep (upTo -1) leaves the count and only moves the tick.
 */
export function entryAfter(entry: ChunkEntry | undefined, upTo: number, now: number): ChunkEntry {
  const count = entry === undefined ? 0 : entry.count;
  return { count: Math.max(count, upTo), tick: now };
}

// ---- Commands ----

/** The y of a slab's floor: slab 0 is the bottom of the world. */
export function slabFloor(slab: number): number {
  return MIN_Y + slab * SLAB_HEIGHT;
}

/**
 * The fill that removes one deleted block from one slab of a chunk: 16 by 64 by 16 blocks, under
 * the default limit of 32,768 a fill may touch. Block updates stay on, so sand falls and water
 * flows into the gaps.
 */
export function slabCommand(chunk: ChunkPos, slab: number, id: string): string {
  const x = chunk.x * 16;
  const z = chunk.z * 16;
  const y = slabFloor(slab);
  return `execute in ${OVERWORLD} run fill ${String(x)} ${String(y)} ${String(z)} ${String(x + 15)} ${String(y + SLAB_HEIGHT - 1)} ${String(z + 15)} minecraft:air replace ${id}`;
}

// ---- The queue ----

/**
 * One chunk's work: the deleted blocks to remove from it, slab by slab. `upTo` is the count its
 * entry gets when the work is done, or -1 for a re-sweep that does not change the count. `next`
 * is the next slab: block index * SLABS_PER_CHUNK + slab.
 */
export interface Task {
  key: string;
  chunk: ChunkPos;
  ids: string[];
  upTo: number;
  next: number;
}

export interface PurgeQueue {
  tasks: Map<string, Task>;
  current: Task | null;
}

/** One fill to run. `done` is set on the last fill of a task; its entry is written after it runs. */
export interface Step {
  task: Task;
  command: string;
  done: boolean;
}

export function newQueue(): PurgeQueue {
  return { tasks: new Map<string, Task>(), current: null };
}

/**
 * Adds work for a chunk. If the chunk is already queued, the new blocks are added after the ones
 * it has, so a chunk that is half done finishes the old blocks and then does the new ones.
 */
export function enqueue(
  queue: PurgeQueue,
  chunk: ChunkPos,
  ids: readonly string[],
  upTo: number,
): void {
  if (ids.length === 0) return;
  const key = chunkKey(chunk);
  const task = queue.tasks.get(key);
  if (task === undefined) {
    queue.tasks.set(key, { key: key, chunk: chunk, ids: ids.slice(), upTo: upTo, next: 0 });
    return;
  }
  for (const id of ids) {
    if (!task.ids.includes(id)) task.ids.push(id);
  }
  task.upTo = Math.max(task.upTo, upTo);
}

/** Removes a chunk's work, for a chunk that is not loaded any more. */
export function dropTask(queue: PurgeQueue, key: string): void {
  queue.tasks.delete(key);
  if (queue.current !== null && queue.current.key === key) queue.current = null;
}

/** The nearest task to any origin, after dropping tasks out of `radius` chunks of every origin. */
function pickTask(queue: PurgeQueue, origins: readonly Origin[], radius: number): Task | null {
  let best: Task | null = null;
  let bestDistance = Infinity;
  const far: string[] = [];
  queue.tasks.forEach((task) => {
    let nearest = Infinity;
    let inReach = false;
    for (const origin of origins) {
      if (chunkDistance(chunkOf(origin.x, origin.z), task.chunk) <= radius) inReach = true;
      nearest = Math.min(nearest, distanceToChunk(origin, task.chunk));
    }
    if (!inReach) {
      far.push(task.key);
    } else if (
      nearest < bestDistance ||
      (best !== null && nearest === bestDistance && task.key < best.key)
    ) {
      best = task;
      bestDistance = nearest;
    }
  });
  for (const key of far) queue.tasks.delete(key);
  return best;
}

/**
 * The next fill. A task runs to its end once started; then the nearest task to any origin (the
 * players' positions; a dead player stands where they died) goes next, so the wave spreads out
 * from each player. Tasks that every origin left behind are dropped and come back when someone
 * returns. Null when there is nothing to do.
 */
export function nextStep(
  queue: PurgeQueue,
  origins: readonly Origin[],
  radius: number,
): Step | null {
  queue.current ??= pickTask(queue, origins, radius);
  const task = queue.current;
  if (task === null) return null;
  const index = Math.floor(task.next / SLABS_PER_CHUNK);
  const id = task.ids[index] ?? '';
  const command = slabCommand(task.chunk, task.next % SLABS_PER_CHUNK, id);
  task.next++;
  const done = task.next >= task.ids.length * SLABS_PER_CHUNK;
  if (done) {
    queue.tasks.delete(task.key);
    queue.current = null;
  }
  return { task: task, command: command, done: done };
}

/** The chunks waiting, for `/deleted stats`. */
export function queuedChunks(queue: PurgeQueue): number {
  return queue.tasks.size;
}

// ---- Plans ----

/** Work for one chunk, before it is queued. */
export interface Planned {
  chunk: ChunkPos;
  ids: string[];
  upTo: number;
}

/**
 * The scan around one origin: every loaded chunk in `radius` with deleted blocks it has not been
 * purged of, nearest first. `entryOf` reads a chunk's entry by key, `loaded` says whether the
 * game has the chunk loaded (a fill on an unloaded chunk does nothing).
 */
export function scanPlan(
  origin: Origin,
  radius: number,
  deleted: readonly string[],
  entryOf: (key: string) => ChunkEntry | undefined,
  loaded: (chunk: ChunkPos) => boolean,
): Planned[] {
  const plan: Planned[] = [];
  if (deleted.length === 0) return plan;
  for (const chunk of chunksAround(origin, radius)) {
    let ids = pendingIds(entryOf(chunkKey(chunk)), deleted);
    if (ids.length > 0 && loaded(chunk)) {
      plan.push({ chunk: chunk, ids: ids, upTo: deleted.length });
    }
  }
  return plan;
}

/** The regrower re-sweep around one origin: every loaded chunk in `radius`, regrowers only. */
export function regrowPlan(
  origin: Origin,
  radius: number,
  deleted: readonly string[],
  loaded: (chunk: ChunkPos) => boolean,
): Planned[] {
  const plan: Planned[] = [];
  const ids = regrowerIds(deleted);
  if (ids.length === 0) return plan;
  for (const chunk of chunksAround(origin, radius)) {
    if (loaded(chunk)) plan.push({ chunk: chunk, ids: ids, upTo: -1 });
  }
  return plan;
}
