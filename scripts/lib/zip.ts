/**
 * A minimal, reproducible zip writer for the release jar: deflated files, explicit directory
 * entries, one fixed timestamp, entries in the order given. The same inputs always give the same
 * bytes, so a jar's SHA-256 identifies its contents. Uses only node:zlib (deflateRawSync, crc32).
 */
import { crc32, deflateRawSync } from 'node:zlib';

export interface ZipEntry {
  /** Forward slashes; a trailing slash makes a directory entry. */
  name: string;
  data?: Buffer;
}

// 1980-01-01 00:00:00, the earliest DOS date: the usual fixed time for reproducible archives.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

const VERSION_NEEDED = 20;
const FLAG_UTF8 = 0x0800;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

export function createZip(entries: ZipEntry[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const isDirectory = entry.name.endsWith('/');
    const raw = isDirectory ? Buffer.alloc(0) : (entry.data ?? Buffer.alloc(0));
    const method = isDirectory ? METHOD_STORE : METHOD_DEFLATE;
    const stored = method === METHOD_DEFLATE ? deflateRawSync(raw, { level: 9 }) : raw;
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(VERSION_NEEDED, 4);
    local.writeUInt16LE(FLAG_UTF8, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, stored);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(VERSION_NEEDED, 4);
    header.writeUInt16LE(VERSION_NEEDED, 6);
    header.writeUInt16LE(FLAG_UTF8, 8);
    header.writeUInt16LE(method, 10);
    header.writeUInt16LE(DOS_TIME, 12);
    header.writeUInt16LE(DOS_DATE, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(stored.length, 20);
    header.writeUInt32LE(raw.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(0, 30); // extra field length
    header.writeUInt16LE(0, 32); // comment length
    header.writeUInt16LE(0, 34); // disk number
    header.writeUInt16LE(0, 36); // internal attributes
    header.writeUInt32LE(isDirectory ? 0x10 : 0, 38); // external attributes: MS-DOS directory bit
    header.writeUInt32LE(offset, 42);
    central.push(header, name);

    offset += local.length + name.length + stored.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, ...central, end]);
}

/** Directory entries for every parent folder of the given file names, parents first. */
export function withDirectories(files: ZipEntry[]): ZipEntry[] {
  const seen = new Set<string>();
  const result: ZipEntry[] = [];
  for (const file of files) {
    const segments = file.name.split('/');
    for (let i = 1; i < segments.length; i++) {
      const directory = `${segments.slice(0, i).join('/')}/`;
      if (!seen.has(directory)) {
        seen.add(directory);
        result.push({ name: directory });
      }
    }
    result.push(file);
  }
  return result;
}
