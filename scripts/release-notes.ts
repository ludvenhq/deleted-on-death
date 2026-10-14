/**
 * Prints the release notes for the version in package.json and checks the release tag:
 *
 *   node scripts/release-notes.ts v0.1.0 > notes.md
 *
 * Fails when the tag does not match package.json or CHANGELOG.md has no section for the version,
 * so a release cannot go out without its changelog.
 */
import { readFileSync } from 'node:fs';
import { changelogSection } from './lib/changelog.ts';
import { readModMeta } from './lib/mod.ts';

const tag = process.argv[2];
const { id, version } = readModMeta();
if (tag !== `v${version}`) {
  console.error(
    `release-notes: tag ${String(tag)} does not match package.json version v${version}`,
  );
  process.exit(1);
}
const section = changelogSection(readFileSync('CHANGELOG.md', 'utf8'), version);
if (section === null) {
  console.error(`release-notes: CHANGELOG.md has no section for ${version}`);
  process.exit(1);
}
const install =
  'Install from CurseForge or Modrinth, or see the README. ' +
  `\`${id.replaceAll('_', '-')}-${version}.jar\` is the mod; the \`.js\` file is the same ` +
  'script for a plain `kubejs/server_scripts/` folder.';
process.stdout.write(`${section}\n\n---\n\n${install}\n`);
