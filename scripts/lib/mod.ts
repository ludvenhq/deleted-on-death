/**
 * The mod's metadata, read from package.json (the single source of truth), and the three
 * metadata files built from it: KubeLoader's contentpack.json, NeoForge's neoforge.mods.toml and
 * the resource pack's pack.mcmeta.
 */
import { readFileSync } from 'node:fs';

export interface ModMeta {
  id: string;
  name: string;
  version: string;
  description: string;
  authors: string;
  license: string;
  homepage: string;
  issues: string;
  /** A NeoForge version range for Minecraft, for example `[1.21.1]`. */
  minecraft: string;
  /** Mod id to NeoForge version range. */
  dependencies: Record<string, string>;
}

interface PackageJson {
  version: string;
  description: string;
  license: string;
  homepage: string;
  bugs: string;
  mod: {
    id: string;
    name: string;
    authors: string;
    minecraft: string;
    dependencies: Record<string, string>;
  };
}

export function readModMeta(packageJsonPath = 'package.json'): ModMeta {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
  return {
    id: pkg.mod.id,
    name: pkg.mod.name,
    version: pkg.version,
    description: pkg.description,
    authors: pkg.mod.authors,
    license: pkg.license,
    homepage: pkg.homepage,
    issues: pkg.bugs,
    minecraft: pkg.mod.minecraft,
    dependencies: pkg.mod.dependencies,
  };
}

/** The bundled script's file name inside `server_scripts/`. */
export function scriptFileName(meta: ModMeta): string {
  return `${meta.id.replaceAll('_', '-')}.js`;
}

/** KubeLoader's pack metadata (`contentpack.json`). */
export function contentPackJson(meta: ModMeta): string {
  const pack = {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    version: meta.version,
    authors: [meta.authors],
  };
  return `${JSON.stringify(pack, null, 2)}\n`;
}

const tomlString = (value: string): string => JSON.stringify(value);

/**
 * NeoForge's mod metadata. The jar has no Java code, so it uses the `lowcodefml` loader, the same
 * way KubeLoader's own generator does; the dependency entries use the 1.21.1 `type` key, not the
 * legacy `mandatory` one that generator still writes.
 */
export function modsToml(meta: ModMeta): string {
  const lines = [
    'modLoader = "lowcodefml"',
    'loaderVersion = "[1,)"',
    `license = ${tomlString(meta.license)}`,
    `issueTrackerURL = ${tomlString(meta.issues)}`,
    '',
    '[[mods]]',
    `modId = ${tomlString(meta.id)}`,
    `version = ${tomlString(meta.version)}`,
    `displayName = ${tomlString(meta.name)}`,
    `authors = ${tomlString(meta.authors)}`,
    `displayURL = ${tomlString(meta.homepage)}`,
    `description = ${tomlString(meta.description)}`,
  ];
  const dependencies: [string, string][] = [
    ['minecraft', meta.minecraft],
    ...Object.entries(meta.dependencies),
  ];
  for (const [modId, versionRange] of dependencies) {
    const isPlatform = modId === 'minecraft' || modId === 'neoforge';
    lines.push(
      '',
      `[[dependencies.${meta.id}]]`,
      `modId = ${tomlString(modId)}`,
      'type = "required"',
      `versionRange = ${tomlString(versionRange)}`,
      `ordering = ${isPlatform ? '"NONE"' : '"AFTER"'}`,
      'side = "BOTH"',
    );
  }
  return `${lines.join('\n')}\n`;
}

/** Resource pack metadata for 1.21.1 (pack format 34), as KubeLoader generates it. */
export function packMcmeta(meta: ModMeta): string {
  const mcmeta = {
    pack: {
      description: `${meta.name} resources`,
      pack_format: 34,
      supported_formats: { min_inclusive: 34, max_inclusive: 48 },
    },
  };
  return `${JSON.stringify(mcmeta, null, 2)}\n`;
}
