/**
 * Builds the content pack folder the game loads:
 *
 *   build/contentpack/contentpack.json
 *   build/contentpack/server_scripts/deleted-on-death.js
 *
 * esbuild bundles src/ into one function-wrapped script (scripts/lib/bundle.ts has the Rhino
 * settings). The Rhino syntax gate then checks the output; a bundle that fails it is never
 * written, so the game keeps the last good one. `--watch` rebuilds on every save for the
 * edit, `/reload`, play loop (docs/development.md).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as esbuild from 'esbuild';
import { rhinoBundleOptions } from './lib/bundle.ts';
import { contentPackJson, readModMeta, scriptFileName } from './lib/mod.ts';
import { findRhinoProblems } from './lib/rhino-syntax.ts';

const watch = process.argv.includes('--watch');
const meta = readModMeta();
const packDir = join('build', 'contentpack');
const outfile = join(packDir, 'server_scripts', scriptFileName(meta));

const banner = [
  `// ${meta.name} ${meta.version} | ${meta.license} | ${meta.homepage.replace('#readme', '')}`,
  '// Generated from TypeScript: the source is in src/ of the repository.',
].join('\n');

function writeOutput(code: string): boolean {
  const problems = findRhinoProblems(code);
  if (problems.length > 0) {
    console.error(`\n${outfile} was NOT written. Release Rhino cannot run:`);
    for (const problem of problems) {
      console.error(
        `  bundle line ${String(problem.line)}:${String(problem.column)}  ${problem.message}`,
      );
    }
    return false;
  }
  mkdirSync(dirname(outfile), { recursive: true });
  writeFileSync(outfile, code);
  writeFileSync(join(packDir, 'contentpack.json'), contentPackJson(meta));
  console.log(`built ${outfile} (${String(code.length)} bytes)`);
  return true;
}

const options: esbuild.BuildOptions = {
  ...rhinoBundleOptions(meta, 'src/main.ts'),
  banner: { js: banner },
};

if (watch) {
  const context = await esbuild.context({
    ...options,
    plugins: [
      {
        name: 'rhino-gate',
        setup(build) {
          build.onEnd((result) => {
            const output = result.outputFiles?.[0];
            if (output !== undefined) writeOutput(output.text);
          });
        },
      },
    ],
  });
  await context.watch();
  console.log('watching src/ (Ctrl+C to stop)');
} else {
  const result = await esbuild.build(options);
  const output = result.outputFiles?.[0];
  if (output === undefined || !writeOutput(output.text)) process.exit(1);
}
