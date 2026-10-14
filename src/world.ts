import { DATA_KEYS } from './config.ts';
import { childTag, keysOf } from './java.ts';
import { type ChunkEntry, formatEntry, isStale, parseEntry } from './purge.ts';

/**
 * What the world remembers, kept in KubeJS's saved data and cached here for the current load.
 *
 * - The deleted blocks, in the order they were deleted, in the server's data (one string). This
 *   is the game's state: it is written the moment a block is deleted.
 * - One entry per purged Overworld chunk, in the Overworld's data. Entries only save work: a
 *   chunk without one is purged again, which removes nothing new. So losing an entry is safe.
 */

let deletedOrder: string[] | null = null;
let deletedSet: Set<string> = new Set<string>();

function load(server: KubeServer): string[] {
  if (deletedOrder === null) {
    let raw = server.persistentData.getString(DATA_KEYS.deleted);
    deletedOrder = raw === '' ? [] : raw.split(',');
    deletedSet = new Set(deletedOrder);
  }
  return deletedOrder;
}

/** The deleted blocks in the order they were deleted. */
export function deletedList(server: KubeServer): readonly string[] {
  return load(server);
}

/** The deleted blocks as a set. */
export function deletedIds(server: KubeServer): ReadonlySet<string> {
  load(server);
  return deletedSet;
}

/** The deleted set once it is loaded, for handlers that have no server at hand; empty before. */
export function knownDeleted(): ReadonlySet<string> {
  return deletedSet;
}

/** Adds a block to the deleted list and saves it. */
export function addDeleted(server: KubeServer, id: string): void {
  const order = load(server);
  if (deletedSet.has(id)) return;
  order.push(id);
  deletedSet.add(id);
  server.persistentData.putString(DATA_KEYS.deleted, order.join(','));
}

/** `/deleted reset`: forgets every deleted block. Blocks already purged stay gone. */
export function resetDeleted(server: KubeServer): void {
  deletedOrder = [];
  deletedSet = new Set<string>();
  server.persistentData.remove(DATA_KEYS.deleted);
}

// ---- Chunk entries ----

let entries: Map<string, ChunkEntry> | null = null;

function chunkTag(overworld: KubeLevel): CompoundTag {
  return childTag(overworld.persistentData, DATA_KEYS.chunks);
}

function loadEntries(overworld: KubeLevel): Map<string, ChunkEntry> {
  if (entries === null) {
    let loaded = new Map<string, ChunkEntry>();
    let tag = chunkTag(overworld);
    for (const key of keysOf(tag)) {
      let entry = parseEntry(tag.getString(key));
      if (entry !== null) loaded.set(key, entry);
    }
    entries = loaded;
  }
  return entries;
}

export function entryOf(overworld: KubeLevel, key: string): ChunkEntry | undefined {
  return loadEntries(overworld).get(key);
}

export function writeEntry(overworld: KubeLevel, key: string, entry: ChunkEntry): void {
  loadEntries(overworld).set(key, entry);
  chunkTag(overworld).putString(key, formatEntry(entry));
}

/** Drops the entries nobody has been near for a long time. Returns how many. */
export function pruneEntries(overworld: KubeLevel, now: number): number {
  const all = loadEntries(overworld);
  const stale: string[] = [];
  all.forEach((entry, key) => {
    if (isStale(entry, now)) stale.push(key);
  });
  if (stale.length === 0) return 0;
  const tag = chunkTag(overworld);
  for (const key of stale) {
    all.delete(key);
    tag.remove(key);
  }
  return stale.length;
}

/** Forgets every chunk entry, so every chunk near a player is purged again. */
export function resetEntries(overworld: KubeLevel): void {
  entries = new Map<string, ChunkEntry>();
  overworld.persistentData.remove(DATA_KEYS.chunks);
}
