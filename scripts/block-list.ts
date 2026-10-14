/**
 * Writes test/data/blocks-1.21.1.txt, the checked-in list of every block in Minecraft 1.21.1 with
 * its block type, from the block report that Mojang's server jar generates:
 *
 *   java -DbundlerMainClass=net.minecraft.data.Main -jar server.jar --reports
 *   node scripts/block-list.ts generated/reports/blocks.json
 *
 * The server jar is the one the 1.21.1 version manifest names (sha1
 * 59353fb40c36d304f2035d51e7d6e6baa98dc05c). The pool test reads the list, so a typo in the pool
 * or a block that holds items or state fails a test instead of a game.
 */
import { readFileSync, writeFileSync } from 'node:fs';

interface BlockReport {
  definition?: { type?: string };
}

const report = process.argv[2];
if (report === undefined) {
  console.error('usage: node scripts/block-list.ts <generated/reports/blocks.json>');
  process.exit(1);
}

const blocks = JSON.parse(readFileSync(report, 'utf8')) as Record<string, BlockReport>;
const lines = Object.entries(blocks)
  .map(([id, block]) => `${id} ${block.definition?.type ?? '?'}`)
  .sort();
const header = [
  '# Every block in Minecraft 1.21.1 and its block type, from the server jar block report.',
  '# Regenerate with scripts/block-list.ts.',
];
writeFileSync('test/data/blocks-1.21.1.txt', `${[...header, ...lines].join('\n')}\n`);
console.log(`wrote ${String(lines.length)} blocks`);
