/**
 * Links the build into a game instance for development:
 *
 *   npm run link -- "<instance folder>"            create the link
 *   npm run link -- "<instance folder>" --unlink   remove it
 *
 * Creates <instance>/kubejs/contentpacks/deleted_on_death as a link to build/contentpack/, so
 * KubeLoader loads the latest build and `/reload` in the game picks up every rebuild. On Windows
 * it is a directory junction, which needs no admin rights.
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { readModMeta } from './lib/mod.ts';

const args = process.argv.slice(2);
const instance = args.find((arg) => !arg.startsWith('--'));
const unlink = args.includes('--unlink');
if (instance === undefined) {
  console.error('usage: npm run link -- "<instance folder>" [--unlink]');
  console.error(
    'The instance folder is the one that holds mods/ and kubejs/; see docs/development.md.',
  );
  process.exit(1);
}

const meta = readModMeta();
const kubejs = resolve(instance, 'kubejs');
if (!existsSync(kubejs)) {
  console.error(
    `${kubejs} does not exist. Start the game once with KubeJS installed, then run this again.`,
  );
  process.exit(1);
}

const link = join(kubejs, 'contentpacks', meta.id);
const target = resolve('build', 'contentpack');

if (existsSync(link) || lstatExists(link)) {
  if (!lstatSync(link).isSymbolicLink()) {
    console.error(`${link} is a real folder, not a link. Move it out of the way first.`);
    process.exit(1);
  }
  unlinkSync(link);
}

if (unlink) {
  console.log(`removed ${link}`);
  process.exit(0);
}

mkdirSync(dirname(link), { recursive: true });
symlinkSync(target, link, 'junction');
console.log(`linked ${link}\n    -> ${target}`);

const modsDir = resolve(instance, 'mods');
const jarPrefix = `${meta.id.replaceAll('_', '-')}-`;
if (existsSync(modsDir) && readdirSync(modsDir).some((file) => file.startsWith(jarPrefix))) {
  console.warn(
    `warning: ${modsDir} also has a ${meta.name} jar. Remove it, or the pack loads twice.`,
  );
}
if (!existsSync(target)) {
  console.warn('warning: build/contentpack does not exist yet. Run npm run build or npm run dev.');
}

function lstatExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}
