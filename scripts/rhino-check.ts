/**
 * Runs the built bundle on real KubeJS Rhino jars: the oldest build KubeJS accepts, the release
 * most players have, and the newest beta. Two scenarios run, in one shared scope like KubeJS's:
 * test/rhino/scenario.js drives the game script's handlers with fake events, and
 * test/rhino/core-scenario.js calls the pure rules through a second bundle
 * (test/rhino/core-entry.ts). This catches what the syntax gate cannot: wrong results, scoping
 * differences, number formatting.
 *
 * Needs a Java 21+ JDK (scripts/lib/java.ts): skipped locally without one, fails in CI. The jars
 * are downloaded from the KubeJS maven once, checked against pinned SHA-256 sums, and cached in
 * .cache/rhino/.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as esbuild from 'esbuild';
import { rhinoBundleOptions } from './lib/bundle.ts';
import { requireJava } from './lib/java.ts';
import { readModMeta, scriptFileName } from './lib/mod.ts';
import { findRhinoProblems } from './lib/rhino-syntax.ts';

interface RhinoBuild {
  version: string;
  why: string;
  sha256: string;
}

const RHINO_BUILDS: RhinoBuild[] = [
  {
    version: '2101.2.7-build.81',
    why: 'oldest KubeJS 2101.7.2 accepts',
    sha256: 'a02abde402b5cea16f31dea4026d630f95a3369134d891a196c014d1daf492c3',
  },
  {
    version: '2101.2.7-build.85',
    why: 'release on CurseForge and Modrinth',
    sha256: '26b388fc1fd89d3512215a2dac99397f34b9a37faa140812e571a94080fc04d0',
  },
  {
    version: '2101.2.8-build.91',
    why: 'newest beta',
    sha256: '1d53d962aa4dac54bcbb4f998c1845980cf194318f1d6b1580ea6ac15cce5ef3',
  },
];

const MAVEN = 'https://maven.latvian.dev/releases/dev/latvian/mods/rhino';
const cacheDir = join('.cache', 'rhino');

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

async function rhinoJar(build: RhinoBuild): Promise<string> {
  const file = join(cacheDir, `rhino-${build.version}.jar`);
  if (existsSync(file) && sha256(readFileSync(file)) === build.sha256) return file;
  const url = `${MAVEN}/${build.version}/rhino-${build.version}.jar`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download failed: ${url} (${String(response.status)})`);
  const data = Buffer.from(await response.arrayBuffer());
  const actual = sha256(data);
  if (actual !== build.sha256) {
    throw new Error(`checksum mismatch for ${url}: expected ${build.sha256}, got ${actual}`);
  }
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(file, data);
  return file;
}

/** KubeJS blanks comment lines and `import` lines before Rhino sees a script; do the same. */
function asKubeJsLoadsIt(code: string): string {
  return code
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      return trimmed.startsWith('//') || trimmed.startsWith('import ') ? '' : line;
    })
    .join('\n');
}

const java = requireJava('rhino-check');

const meta = readModMeta();
const bundle = join('build', 'contentpack', 'server_scripts', scriptFileName(meta));
if (!existsSync(bundle)) {
  console.error(`rhino-check: ${bundle} is missing; run npm run build first`);
  process.exit(1);
}
const loaded = join('build', 'rhino', 'bundle.js');
mkdirSync(join('build', 'rhino'), { recursive: true });
writeFileSync(loaded, asKubeJsLoadsIt(readFileSync(bundle, 'utf8')));

// The pure rules, bundled the same way and held to the same syntax gate.
const coreResult = await esbuild.build(
  rhinoBundleOptions(meta, join('test', 'rhino', 'core-entry.ts')),
);
const coreCode = coreResult.outputFiles?.[0]?.text ?? '';
const coreProblems = findRhinoProblems(coreCode);
if (coreProblems.length > 0) {
  for (const problem of coreProblems) {
    console.error(`core bundle line ${String(problem.line)}: ${problem.message}`);
  }
  process.exit(1);
}
const core = join('build', 'rhino', 'core.js');
writeFileSync(core, asKubeJsLoadsIt(coreCode));

let failed = false;
for (const build of RHINO_BUILDS) {
  const jar = await rhinoJar(build);
  const run = spawnSync(
    java,
    [
      '-cp',
      jar,
      join('test', 'rhino', 'RhinoCheck.java'),
      join('test', 'rhino', 'kubejs-stub.js'),
      loaded,
      core,
      join('test', 'rhino', 'scenario.js'),
      join('test', 'rhino', 'core-scenario.js'),
    ],
    { encoding: 'utf8' },
  );
  const label = `Rhino ${build.version} (${build.why})`;
  if (run.status === 0 && run.stdout.trim() === 'ok') {
    console.log(`ok    ${label}`);
  } else {
    failed = true;
    console.error(`FAIL  ${label}\n${run.stdout}${run.stderr}`);
  }
}
if (failed) process.exit(1);
