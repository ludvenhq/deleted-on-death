import { blockId, dimensionId } from './ids.ts';
import type { ChunkPos, Origin } from './purge.ts';

/**
 * Reading Java values in the game, the one place the scripts touch zero-argument members.
 *
 * KubeJS renames and hides vanilla methods for scripts with @RemapForJS and @HideFromJS on its
 * mixins (dev.latvian.mods.kubejs.core.mixin), so the vanilla name often is not there: in
 * KubeJS 2101.7.2, Entity#getStringUUID is `getStringUuid`, Entity#level() and
 * ServerLevel#players() are hidden in favour of KubeJS's `level` and `players` properties, and
 * Level#getGameTime is `getTime`. A plain Rhino outside the game has no mixins and sees the
 * vanilla names. So read() takes the candidate names in order, KubeJS's first, and calls a
 * candidate when it is a method; each read is logged once per load with the name that answered
 * (reportInterop), so the log shows what the game did.
 */
const resolved = new Map<string, string>();
const logged = new Set<string>();

type Getter = (this: object) => unknown;

/** The first candidate the target has: its value, or its result when it is a method. */
export function read(target: object, names: string[]): unknown {
  const members = target as Record<string, unknown>;
  for (const name of names) {
    let value = members[name];
    if (value === undefined || value === null) continue;
    let first = names[0] ?? name;
    if (!resolved.has(first)) resolved.set(first, typeof value === 'function' ? `${name}()` : name);
    return typeof value === 'function' ? (value as Getter).call(target) : value;
  }
  const first = names[0] ?? '?';
  if (!resolved.has(first)) resolved.set(first, 'missing');
  return undefined;
}

/** Logs the members resolved since the last report, once each. */
export function reportInterop(): void {
  const fresh: string[] = [];
  resolved.forEach((how, member) => {
    if (!logged.has(member)) {
      logged.add(member);
      fresh.push(`${member}=${how}`);
    }
  });
  if (fresh.length > 0) console.info(`Deleted on Death interop: ${fresh.join(', ')}`);
}

function num(value: unknown): number {
  return Number(value);
}

/** A Java object's toString(), or a JavaScript value as a string. */
function javaString(value: unknown): string {
  return typeof value === 'object' && value !== null
    ? (value as { toString(): string }).toString()
    : String(value);
}

function object(value: unknown, what: string): object {
  if (typeof value !== 'object' || value === null) {
    throw new Error(
      `Deleted on Death: cannot read ${what} (got ${value === null ? 'null' : typeof value})`,
    );
  }
  return value;
}

// ---- Collections ----

export function listSize(list: JavaList<unknown>): number {
  return num(read(list, ['size']));
}

/** Calls visit for each element of a Java Iterable. */
function forEachOf(iterable: object, visit: (value: unknown) => void): void {
  const iterator = object(read(iterable, ['iterator']), 'an iterator');
  while (read(iterator, ['hasNext']) === true) {
    visit(read(iterator, ['next']));
  }
}

// ---- Saved data ----

/**
 * The compound under `key` in a saved tag, created if missing. CompoundTag#getCompound returns a
 * new, unattached tag for a missing key, so it is put back, the way KubeJS keeps each level's
 * data inside the server's.
 */
export function childTag(data: CompoundTag, key: string): CompoundTag {
  const tag = data.getCompound(key);
  data.put(key, tag);
  return tag;
}

/** The keys of a compound tag. */
export function keysOf(tag: CompoundTag): string[] {
  const keys: string[] = [];
  forEachOf(object(read(tag, ['allKeys', 'getAllKeys']), 'the keys of a tag'), (key) => {
    keys.push(String(key));
  });
  return keys;
}

// ---- Entities ----

export function uuidOf(entity: KubeEntity): string {
  return String(read(entity, ['stringUuid', 'getStringUuid', 'stringUUID', 'getStringUUID']));
}

export function levelOf(entity: KubeEntity): KubeLevel {
  return object(read(entity, ['level']), 'a level') as KubeLevel;
}

export function positionOf(entity: KubeEntity): { x: number; y: number; z: number } {
  return {
    x: num(read(entity, ['x', 'getX'])),
    y: num(read(entity, ['y', 'getY'])),
    z: num(read(entity, ['z', 'getZ'])),
  };
}

export function originOf(entity: KubeEntity): Origin {
  const at = positionOf(entity);
  return { x: at.x, z: at.z };
}

export function isPlayer(entity: KubeEntity): entity is KubePlayer {
  return read(entity, ['player', 'isPlayer']) === true;
}

export function isAlive(entity: KubeEntity): boolean {
  return read(entity, ['alive', 'isAlive']) === true;
}

// ---- Levels and blocks ----

export function dimensionOf(level: KubeLevel): string {
  return dimensionId(String(read(level, ['dimension', 'getDimension'])));
}

export function gameTimeOf(level: KubeLevel): number {
  return num(read(level, ['time', 'getTime', 'gameTime', 'getGameTime']));
}

export function playersIn(level: KubeLevel): JavaList<KubePlayer> {
  return object(read(level, ['players']), 'the players in a level') as JavaList<KubePlayer>;
}

/** A block state's or a block's id: KubeJS's `id`, or parsed from the vanilla string. */
export function stateId(state: object): string {
  const id = read(state, ['id', 'getId']);
  return blockId(javaString(id === undefined ? state : id));
}

/** The id of the block at these coordinates. */
export function blockIdAt(level: KubeLevel, x: number, y: number, z: number): string {
  return stateId(level.getBlock(x, y, z));
}

let chunkCheckWarned = false;

/**
 * Whether the chunk is loaded, so a fill on it works (a fill on an unloaded chunk fails with
 * nothing done). LevelReader#hasChunk takes chunk coordinates, hasChunkAt block coordinates. If
 * neither can be called, chunks are treated as loaded and the log says so once.
 */
export function chunkLoaded(level: KubeLevel, chunk: ChunkPos): boolean {
  const members = level as unknown as Record<string, unknown>;
  const hasChunk = members.hasChunk;
  if (typeof hasChunk === 'function') {
    return (hasChunk as (x: number, z: number) => unknown).call(level, chunk.x, chunk.z) === true;
  }
  const hasChunkAt = members.hasChunkAt;
  if (typeof hasChunkAt === 'function') {
    return (
      (hasChunkAt as (x: number, z: number) => unknown).call(level, chunk.x * 16, chunk.z * 16) ===
      true
    );
  }
  if (!chunkCheckWarned) {
    chunkCheckWarned = true;
    console.warn('Deleted on Death: cannot check whether chunks are loaded; assuming they are');
  }
  return true;
}

// ---- The server ----

export function serverPlayers(server: KubeServer): JavaList<KubePlayer> {
  return object(read(server, ['players']), 'the players') as JavaList<KubePlayer>;
}

export function overworldOf(server: KubeServer): KubeLevel {
  return object(read(server, ['overworld', 'getOverworld']), 'the Overworld') as KubeLevel;
}

/** The server's average tick in milliseconds, or NaN when it cannot be read. */
export function averageTickMs(server: KubeServer): number {
  const nanos = read(server, ['averageTickTimeNanos', 'getAverageTickTimeNanos']);
  return nanos === undefined ? NaN : num(nanos) / 1e6;
}
