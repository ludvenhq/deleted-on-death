/**
 * Checks the packed jar with Java's own jar and zip readers, the way KubeLoader reads it in the
 * game (test/jar/JarCheck.java). Run after npm run pack.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { requireJava } from './lib/java.ts';
import { readModMeta, scriptFileName } from './lib/mod.ts';

const meta = readModMeta();
const jar = join('dist', `${meta.id.replaceAll('_', '-')}-${meta.version}.jar`);
const built = join('build', 'contentpack', 'server_scripts', scriptFileName(meta));
if (!existsSync(jar)) {
  console.error(`jar-check: ${jar} is missing; run npm run pack first`);
  process.exit(1);
}
const java = requireJava('jar-check');
const run = spawnSync(java, [join('test', 'jar', 'JarCheck.java'), jar, built], {
  encoding: 'utf8',
});
if (run.status !== 0 || run.stdout.trim() !== 'ok') {
  console.error(`FAIL  ${jar}\n${run.stdout}${run.stderr}`);
  process.exit(1);
}
console.log(`ok    ${jar} reads the way KubeLoader reads it`);
