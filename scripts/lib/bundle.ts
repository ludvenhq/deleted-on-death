import type { BuildOptions } from 'esbuild';
import type { ModMeta } from './mod.ts';

/**
 * The esbuild options for anything that runs on KubeJS's Rhino: one function-wrapped script, no
 * modules. Target ES2019 makes esbuild lower `?.`, `??` and logical assignment, which release
 * Rhino gets wrong. `supported` lists what release Rhino lacks, so esbuild never generates it:
 * without it, esbuild prints `{ id: id }` as the shorthand `{ id }`, which release Rhino rejects.
 * Source that uses these features fails the build (lint keeps them out first).
 */
export function rhinoBundleOptions(meta: ModMeta, entry: string): BuildOptions {
  return {
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    platform: 'neutral',
    target: 'es2019',
    supported: {
      'object-extensions': false,
      'default-argument': false,
      'rest-argument': false,
      'array-spread': false,
      'object-rest-spread': false,
      class: false,
      'async-await': false,
      'async-generator': false,
    },
    write: false,
    legalComments: 'none',
    define: { __VERSION__: JSON.stringify(meta.version) },
    logLevel: 'warning',
  };
}
