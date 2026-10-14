import { BUDGET_MS, OVERWORLD, PURGE_RADIUS, REGROW_RADIUS, SLABS_PER_CHUNK } from './config.ts';
import { shatterCommands } from './hud.ts';
import {
  chunkLoaded,
  dimensionOf,
  gameTimeOf,
  levelOf,
  listSize,
  originOf,
  overworldOf,
  positionOf,
  serverPlayers,
  uuidOf,
} from './java.ts';
import {
  type ChunkPos,
  chunkKey,
  chunkOf,
  dropTask,
  entryAfter,
  enqueue,
  isFastTravel,
  needsRefresh,
  newQueue,
  nextStep,
  type Origin,
  type Planned,
  queuedChunks,
  regrowPlan,
  scanPlan,
  type Task,
} from './purge.ts';
import { deletedList, entryOf, writeEntry } from './world.ts';

/**
 * The purge in the game: scans around each Overworld player for chunks that still hold deleted
 * blocks, queues them nearest first, and drains the queue every tick until the purge has used
 * BUDGET_MS of that tick. A chunk's entry is written only when its last fill has run.
 */

const queue = newQueue();

/** Each player's chunk at their last scan, for the fast-travel rule. */
const lastScan = new Map<string, ChunkPos>();

/** Players waiting for the wave to reach them after a respawn: uuid to the deleted block. */
const waiting = new Map<string, string>();

/** Counters for `/deleted stats` and the log: since the last report. */
const stats = { slabs: 0, chunks: 0, ms: 0, ticks: 0 };

/** The Overworld players, as a plain list. */
function overworldPlayers(server: KubeServer): KubePlayer[] {
  const players = serverPlayers(server);
  const size = listSize(players);
  const result: KubePlayer[] = [];
  for (let i = 0; i < size; i++) {
    let player = players.get(i);
    if (dimensionOf(levelOf(player)) === OVERWORLD) result.push(player);
  }
  return result;
}

function queuePlan(plan: Planned[]): void {
  for (const planned of plan) {
    enqueue(queue, planned.chunk, planned.ids, planned.upTo);
  }
}

/**
 * Queues every loaded chunk around `origin` that still holds deleted blocks. Chunks found up to
 * date get their entry refreshed now and then, so the chunks people live in are never pruned.
 */
export function scanAround(overworld: KubeLevel, origin: Origin, deleted: readonly string[]): void {
  const now = gameTimeOf(overworld);
  const plan = scanPlan(
    origin,
    PURGE_RADIUS,
    deleted,
    (key) => {
      let entry = entryOf(overworld, key);
      if (entry !== undefined && needsRefresh(entry, deleted.length, now)) {
        writeEntry(overworld, key, { count: entry.count, tick: now });
      }
      return entry;
    },
    (chunk) => chunkLoaded(overworld, chunk),
  );
  queuePlan(plan);
}

/** The scan for every Overworld player who is not travelling fast. */
export function scanPlayers(server: KubeServer): void {
  const deleted = deletedList(server);
  if (deleted.length === 0) return;
  const overworld = overworldOf(server);
  for (const player of overworldPlayers(server)) {
    let origin = originOf(player);
    let chunk = chunkOf(origin.x, origin.z);
    let uuid = uuidOf(player);
    let fast = isFastTravel(lastScan.get(uuid), chunk);
    lastScan.set(uuid, chunk);
    if (!fast) scanAround(overworld, origin, deleted);
  }
}

/** The regrower re-sweep: every loaded chunk near a player, for the deleted regrowers only. */
export function regrowSweep(server: KubeServer): void {
  const deleted = deletedList(server);
  if (deleted.length === 0) return;
  const overworld = overworldOf(server);
  for (const player of overworldPlayers(server)) {
    queuePlan(
      regrowPlan(originOf(player), REGROW_RADIUS, deleted, (chunk) =>
        chunkLoaded(overworld, chunk),
      ),
    );
  }
}

function shatter(server: KubeServer, player: KubePlayer, id: string): void {
  const at = positionOf(player);
  const commands = shatterCommands(
    { dimension: OVERWORLD, x: at.x, y: at.y + 1, z: at.z },
    id,
    player.username,
  );
  for (const command of commands) server.runCommandSilent(command);
}

/**
 * After a respawn in the Overworld: the deleted block shatters around the player when the wave
 * reaches their chunk, or at once if it already has.
 */
export function waitForWave(server: KubeServer, player: KubePlayer, id: string): void {
  const overworld = overworldOf(server);
  const origin = originOf(player);
  const entry = entryOf(overworld, chunkKey(chunkOf(origin.x, origin.z)));
  if (entry !== undefined && entry.count > deletedList(server).indexOf(id)) {
    shatter(server, player, id);
  } else {
    waiting.set(uuidOf(player), id);
  }
}

/** A finished task: its entry, and the shatter for anyone waiting in that chunk for its block. */
function finish(server: KubeServer, overworld: KubeLevel, task: Task): void {
  const now = gameTimeOf(overworld);
  writeEntry(overworld, task.key, entryAfter(entryOf(overworld, task.key), task.upTo, now));
  stats.chunks++;
  if (waiting.size === 0) return;
  for (const player of overworldPlayers(server)) {
    let uuid = uuidOf(player);
    let id = waiting.get(uuid);
    if (id === undefined || !task.ids.includes(id)) continue;
    let origin = originOf(player);
    if (chunkKey(chunkOf(origin.x, origin.z)) !== task.key) continue;
    waiting.delete(uuid);
    shatter(server, player, id);
  }
}

/**
 * Runs fills until the purge has used BUDGET_MS of this tick or the queue is empty. Work for a
 * chunk that is no longer loaded is dropped; the next scan near it queues it again.
 */
export function drain(server: KubeServer): void {
  if (queue.tasks.size === 0) return;
  const overworld = overworldOf(server);
  const origins = overworldPlayers(server).map(originOf);
  const start = Date.now();
  let ran = 0;
  while (Date.now() - start < BUDGET_MS) {
    let step = nextStep(queue, origins, PURGE_RADIUS);
    if (step === null) break;
    if (!chunkLoaded(overworld, step.task.chunk)) {
      dropTask(queue, step.task.key);
      continue;
    }
    server.runCommandSilent(step.command);
    ran++;
    if (step.done) finish(server, overworld, step.task);
  }
  stats.slabs += ran;
  stats.ms += Date.now() - start;
  stats.ticks++;
}

/** Forgets the queue and the scan positions: after `/deleted reset` and `/deleted purge`. */
export function clearQueue(): void {
  queue.tasks.clear();
  queue.current = null;
  lastScan.clear();
}

/** A one-line report of the purge since the last call, then the counters start again. */
export function takeStats(): string {
  const line = `queue ${String(queuedChunks(queue))} chunks, ${String(stats.slabs)} fills (${String(Math.round(stats.slabs / SLABS_PER_CHUNK))} chunk-blocks) and ${String(stats.chunks)} chunks done in ${String(stats.ms)} ms over ${String(stats.ticks)} ticks`;
  stats.slabs = 0;
  stats.chunks = 0;
  stats.ms = 0;
  stats.ticks = 0;
  return line;
}

/** Whether the purge did anything since the last report. */
export function hasStats(): boolean {
  return stats.slabs > 0 || queue.tasks.size > 0;
}
