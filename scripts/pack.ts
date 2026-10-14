/**
 * Packs the built content pack into the release files in dist/:
 *
 *   deleted-on-death-<version>.jar   the mod: a KubeLoader content pack inside a NeoForge mod jar
 *   deleted-on-death-<version>.js    the same script for a plain kubejs/server_scripts/ folder
 *   SHA256SUMS
 *
 * The jar layout is the one KubeLoader reads from mod jars (contentpacks/contentpack.json and
 * contentpacks/server_scripts/), with the metadata from package.json. The zip is reproducible:
 * the same source gives the same bytes.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentPackJson, modsToml, packMcmeta, readModMeta, scriptFileName } from './lib/mod.ts';
import { createZip, withDirectories } from './lib/zip.ts';

const meta = readModMeta();
const script = scriptFileName(meta);
const builtScript = join('build', 'contentpack', 'server_scripts', script);
if (!existsSync(builtScript)) {
  console.error(`pack: ${builtScript} is missing; run npm run build first`);
  process.exit(1);
}
const code = readFileSync(builtScript);
const baseName = `${meta.id.replaceAll('_', '-')}-${meta.version}`;

const jar = createZip(
  withDirectories([
    { name: 'META-INF/neoforge.mods.toml', data: Buffer.from(modsToml(meta)) },
    { name: 'pack.mcmeta', data: Buffer.from(packMcmeta(meta)) },
    { name: 'LICENSE', data: readFileSync('LICENSE') },
    { name: 'contentpacks/contentpack.json', data: Buffer.from(contentPackJson(meta)) },
    { name: `contentpacks/server_scripts/${script}`, data: code },
  ]),
);

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
const files: [string, Buffer][] = [
  [`${baseName}.jar`, jar],
  [`${baseName}.js`, code],
];
const sums: string[] = [];
for (const [name, data] of files) {
  writeFileSync(join('dist', name), data);
  sums.push(`${createHash('sha256').update(data).digest('hex')}  ${name}`);
  console.log(`packed dist/${name} (${String(data.length)} bytes)`);
}
writeFileSync(join('dist', 'SHA256SUMS'), `${sums.join('\n')}\n`);
