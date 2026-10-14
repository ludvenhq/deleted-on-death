# Architecture

Deleted on Death is game logic written in TypeScript, compiled into one KubeJS server script and
shipped as a NeoForge mod jar through KubeLoader. This page explains each step and why it is
built that way.

## The pipeline

```
src/*.ts
   │  esbuild: bundle into one function-wrapped script, target ES2019
   │  (lowers ?. ?? ||=, replaces __VERSION__)
   ▼
Rhino syntax gate (scripts/lib/rhino-syntax.ts)
   │  refuses to write a bundle release Rhino would reject
   ▼
build/contentpack/
   ├── contentpack.json
   └── server_scripts/deleted-on-death.js ──▶ linked into a game instance for development
   │
   ├──▶ npm run check:rhino   the bundle on Rhino 81, 85 and 91: test/rhino/scenario.js drives the
   │                          handlers, test/rhino/core-scenario.js calls the pure rules
   ▼
npm run pack
   ▼
dist/
   ├── deleted-on-death-<version>.jar   the mod
   ├── deleted-on-death-<version>.js    the same script, for a plain kubejs/server_scripts/ folder
   └── SHA256SUMS
   │
   └──▶ npm run check:jar   the jar read with Java's jar and zip readers, as the game reads it
```

## How the game runs it

- **KubeJS** loads every server script when a world opens and on every `/reload`. All server
  scripts share one scope, so a top-level `const` in one script clashes with the same name in
  another. The bundle is one function call, so it declares nothing at the top level; the syntax
  gate enforces that.
- **Event handlers** can only be registered while scripts load. `main.ts` calls each
  `register...` function once per load, and `/reload` drops the old handlers before the new load.
- **KubeLoader** finds the pack in two places: inside a mod jar (`contentpacks/contentpack.json`
  plus `contentpacks/server_scripts/`), and as a folder in `kubejs/contentpacks/<id>/` for
  development. Both run the same script.
- **KubeLoader's script transformer** (`useModernJS`, on by default) rewrites modern syntax in
  every script it loads. The bundle contains none, so there is nothing for it to rewrite; the
  bundle is built to run with the transformer off too.

## Rhino

KubeJS 7 runs scripts on its own fork of [Rhino](https://github.com/kube-mods/rhino). In October
2026 the release on CurseForge and Modrinth is `2101.2.7-build.85`, KubeJS accepts builds from
`2101.2.7-build.81`, and `2101.2.8-build.91` is a beta. The release builds support much less
syntax than the beta. Results from running test cases on each build:

| Syntax or feature                                                            |            81 and 85 (release)            | 91 (beta) |
| ---------------------------------------------------------------------------- | :---------------------------------------: | :-------: |
| `let`, `const`, arrow functions, template literals                           |                    yes                    |    yes    |
| Destructuring without defaults, including shorthand `{ a } = o`              |                    yes                    |    yes    |
| `for...of` over arrays and Java lists and sets                               |                    yes                    |    yes    |
| `Map`, `Set`, generators, `Symbol`, getters and setters, `**`                |                    yes                    |    yes    |
| `Object.assign`, `Array.prototype.includes` and `find`                       |                    yes                    |    yes    |
| Shorthand properties in objects `{ a }`, computed keys                       |                    no                     |    yes    |
| Default parameters, defaults in destructuring, rest parameters               |                    no                     |    yes    |
| `?.`                                                                         | broken (does not short-circuit the chain) |    yes    |
| `??`                                                                         |        broken (`null ?? 5` is `0`)        |    yes    |
| `Promise`, `globalThis`, `Object.fromEntries`, `.at`, `.flat`                |                    no                     |    yes    |
| Spread, rest in destructuring, `class`, `async`, `Proxy`, `Reflect`, `\|\|=` |                    no                     |    no     |

Also on every build: `var` is block-scoped, reassigning a `const` is silently ignored, closures
made in a `for (let ...)` loop all see the last value, and `JSON.stringify({ a: 1 })` gives
`{"a":1.0}`.

A `const` is only safe at the top of a function body and in a loop's head
(`for (const x of xs)`). Inside any other block it breaks on every build (found 2026-10-13, when
the game glue first ran on Rhino): in a loop body it keeps its first value on every pass, so a
loop over 41 inventory slots counted the first slot 41 times, and in an `if` block that also
makes a closure, the function's second call throws `redeclaration of var`. `let` works in both
places, so `src/` uses `let` inside blocks, and the lint rule and the syntax gate both refuse a
`const` there.

So the code targets the release builds. Four layers keep it inside that subset:

1. **Types:** `tsconfig.json` gives `src/` only the ES2015 library plus `Array.prototype.includes`,
   so `Object.fromEntries` or `.at()` do not type-check.
2. **Lint:** `eslint.config.mjs` bans the unsupported syntax in `src/` with a message at the line.
3. **esbuild** lowers `?.`, `??` and logical assignment, which it can. It cannot lower the rest,
   and it is told (`supported` in `scripts/lib/bundle.ts`) never to generate it: left alone, it
   prints `{ id: id }` as the shorthand `{ id }`, which release Rhino rejects.
4. **The syntax gate** parses the built bundle and refuses anything on the list, whatever wrote
   it. Then the Rhino check runs the bundle on the real builds.

### Why not compile TypeScript to ES5

ES5 output would sidestep most of this, but every route is closed: TypeScript 6 deprecates the
ES5 target and TypeScript 7 removes it; esbuild cannot lower to ES5; and TypeScript's own ES5
helpers (`__spreadArray` and the `downlevelIteration` helpers) fail on Rhino, because of the
block-scoped `var`. Writing in the supported subset is simpler and the output stays readable.

## The KubeJS API

`src/kubejs/kubejs.d.ts` types, by hand, only the part of the KubeJS API the scripts use. ProbeJS
generates typings for the whole game, but they are written for plain JavaScript (its own output
says fully TypeScript-compatible typings are not possible), they are very large, and they only
exist inside a game folder, so CI could not use them. KubeJS exposes its `kjs$getFoo()` extension
methods and Java bean getters as properties: `entity.type`, `entity.persistentData`,
`source.player`.

KubeJS also renames and hides vanilla methods for scripts, with `@RemapForJS` and `@HideFromJS`
on its mixins (`dev.latvian.mods.kubejs.core.mixin`). In KubeJS 2101.7.2, `Entity#getStringUUID`
is `getStringUuid`, `Entity#level()` and `Level#players()` are hidden behind KubeJS's `level` and
`players` properties, and `Level#getGameTime` is `getTime`. A plain Rhino has no mixins and sees the
vanilla names, which is how Diamond Threat's first in-game run (2026-10-13) failed with "Cannot
find function getStringUUID" after every check had passed. So every zero-argument read goes through `read()` in
`src/java.ts`, which takes candidate names, KubeJS's first, and logs once per load which name
answered (`Deleted on Death interop:` lines in `logs/kubejs/server.log`). The typings in
`src/kubejs/kubejs.d.ts` leave those members out, so a direct call does not compile, and the
Rhino check's fakes use KubeJS's names, not vanilla's.

## The jar

```
META-INF/neoforge.mods.toml       modLoader "lowcodefml": a mod with no Java code
pack.mcmeta                       pack format 34 (1.21.1), accepted up to 48
LICENSE
contentpacks/contentpack.json     KubeLoader's pack metadata
contentpacks/server_scripts/deleted-on-death.js
```

All metadata comes from `package.json`: the version, the description, and the `mod` section with
the mod id and the dependency ranges. Every dependency is declared required, so the CurseForge app
and the Modrinth App install KubeJS and KubeLoader with it. The jar is written by
`scripts/lib/zip.ts` with a fixed timestamp and order, so the same source always gives the same
bytes and `SHA256SUMS` identifies a build.

KubeLoader can export a jar from inside the game (`/kl mod`), but its generated metadata uses the
legacy `mandatory` key, so this project writes its own.

## The purge

Removing a block from the world is the expensive part, so it is built around one vanilla command
and a time budget.

- **One fill per slab.** A chunk is cleared in six slabs of 16 by 64 by 16 blocks, each with
  `execute in minecraft:overworld run fill ... minecraft:air replace <block>`. The fill runs in
  native code, so no script loops over blocks. A slab is 16,384 blocks, under the 32,768 a fill
  may touch by default, so the mod changes no game rule. Block updates stay on.
- **A queue, nearest first.** `src/purge.ts` keeps one task per chunk (the blocks to remove from
  it and the next slab). The next task is the one nearest to any player in the Overworld; a
  started task finishes first. Tasks no player is within 8 chunks of are dropped and queued again
  when someone comes back. A dead player stays where they died until they respawn, so the wave
  starts at the body.
- **A time budget.** `drain()` in `src/purger.ts` runs fills each tick until it has used 10 ms of
  that tick. `Date.now()` has millisecond resolution, so the budget is approximate; one heavy fill
  can overrun it, never by more than that fill.
- **Scans, not chunk events.** Every 10 ticks the loaded chunks within 8 chunks of each player are
  checked against the deleted list. No chunk-load event is needed, and chunks nobody comes near
  cost nothing.
- **Chunk entries.** The Overworld's KubeJS data (`level.persistentData`, saved in the world's
  `kubejs_persistent_data.nbt`) keeps one string per purged chunk, `count:tick`: how many of the
  deleted blocks, in the order they were deleted, the chunk is clean of, and when it was last
  purged or found clean. An entry is written only after the chunk's last fill. Entries only save
  work: a chunk without one is purged again and the fills find nothing, so a lost entry costs time,
  never correctness. Entries untouched for seven Minecraft days are pruned to keep the save small.
- **The deleted list** is the game's state: one comma-separated string in the server's KubeJS data,
  written the moment a block is deleted.
- **Regrowers.** Blocks vanilla can bring back without an event are swept again every minute
  within 4 chunks of each player, for the deleted regrowers only, so the steady cost grows with
  the handful of deleted regrowers, not with the number of deaths.
- **The lava rule** uses KubeJS's `NativeEvents` to listen to NeoForge's
  `BlockEvent.FluidPlaceBlockEvent` from the server script; KubeJS drops those listeners on
  `/reload`. If the class cannot be loaded, the log says so and the regrower sweep covers stone
  and cobblestone.

`/deleted spike <block>` and `/deleted stats` measure all of this in a real game; the purge also
writes a `Deleted on Death purge:` line to `logs/kubejs/server.log` every 10 seconds while it works.

## Known limits

- The Rhino check runs a plain Rhino context, not KubeJS's. Java interop (a string id turned into
  an attribute holder, Java collections) is only proven in the game.
- KubeLoader is an alpha, and Modrinth carries an older build of it (Alpha-3) than CurseForge
  (Alpha-7). The jar declares `[21-0.1.0-Alpha-3,)` so both platforms resolve.
- Minecraft 1.21.1 only. The Overworld's height (y -64 to 319) is in `src/config.ts`; a data pack
  that changes it needs those two numbers changed.
- Proven only in the game, not by the Rhino check: `LevelReader#hasChunk`, the `BLOCK_STATE`
  command argument, `NativeEvents` with a class from `Java.loadClass`, and reading a saved tag's
  keys. Each read logs which member answered on first use (`Deleted on Death interop:` lines).
