import { describe, expect, it } from 'vitest';
import { createZip, withDirectories } from '../scripts/lib/zip.ts';

describe('zip', () => {
  it('adds each parent folder once, before its files', () => {
    const names = withDirectories([
      { name: 'META-INF/neoforge.mods.toml' },
      { name: 'contentpacks/contentpack.json' },
      { name: 'contentpacks/server_scripts/a.js' },
    ]).map((entry) => entry.name);
    expect(names).toEqual([
      'META-INF/',
      'META-INF/neoforge.mods.toml',
      'contentpacks/',
      'contentpacks/contentpack.json',
      'contentpacks/server_scripts/',
      'contentpacks/server_scripts/a.js',
    ]);
  });

  it('gives the same bytes for the same input', () => {
    const entries = [{ name: 'a.txt', data: Buffer.from('hello') }];
    expect(createZip(entries).equals(createZip(entries))).toBe(true);
  });

  it('ends with an end-of-central-directory record that counts the entries', () => {
    const zip = createZip(withDirectories([{ name: 'x/a.txt', data: Buffer.from('a') }]));
    const end = zip.subarray(zip.length - 22);
    expect(end.readUInt32LE(0)).toBe(0x06054b50);
    expect(end.readUInt16LE(10)).toBe(2);
  });
});
