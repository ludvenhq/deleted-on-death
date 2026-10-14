# Development

How to build Deleted on Death, run it in a live game, and change it.

## What you need

- **Node.js 24** (the version is in `.nvmrc`) and npm.
- **A Java 21 JDK** for the Rhino and jar checks. Any JDK works, Temurin for example. Point
  `JAVA_HOME` at it if `java` is not on your `PATH`. Without Java, `npm run verify` skips those
  two checks with a warning; CI always runs them.
- **A Minecraft Java instance** with NeoForge 1.21.1, KubeJS 7 and KubeLoader, made in the
  CurseForge app, the Modrinth App or any launcher. ProbeJS is useful for exploring the KubeJS API
  in the game (it is a client mod: run `/probejs` and press Dump), but the build does not use it.

## Set up

```sh
npm ci
npm run verify
```

`verify` runs everything CI runs: lint and formatting, type checks, unit tests, the build, the
bundle on three real Rhino builds, the pack, and the jar check. It must be green before a commit.

## Run it in the game

1. **Start the instance once** with KubeJS installed, so it creates its `kubejs` folder. Then
   close the game.
2. **Find the instance folder,** the one that holds `mods/` and `kubejs/`. In the CurseForge app:
   the instance's menu, Open Folder (by default `%USERPROFILE%\curseforge\minecraft\Instances\<name>`).
   In the Modrinth App: the profile's menu, Open folder (by default
   `%APPDATA%\ModrinthApp\profiles\<name>`).
3. **Link the build into it:**

   ```sh
   npm run link -- "<instance folder>"
   ```

   This makes `kubejs/contentpacks/deleted_on_death` in the instance a link to `build/contentpack/`
   here. Do not also put the Deleted on Death jar in that instance's `mods` folder, or the pack
   loads twice. `npm run link -- "<instance folder>" --unlink` removes the link.

4. **Start the watcher and the game:**

   ```sh
   npm run dev
   ```

   Every save in `src/` rebuilds the script in about a second. In the game, `/reload` loads the
   new build. A build that release Rhino could not run is not written, and the watcher prints why,
   so the game keeps the last good one.

5. **Check it in a throwaway world** (deletions are permanent): a `BLOCKS LEFT 200` bar shows at
   the top. `/deleted add minecraft:grass_block` shows the title, the bar drops to 199 and the
   grass around you disappears chunk by chunk. `/deleted reset` forgets the deletion (the removed
   grass stays removed).

**Logs:** `logs/kubejs/server.log` in the instance folder has every script error and every
`console.info` line. KubeJS also reports script errors in chat when you `/reload`.

## Writing code

### Where things go

| Path                       | What                                                                  |
| -------------------------- | --------------------------------------------------------------------- |
| `src/main.ts`              | The entry point: registers everything                                 |
| `src/config.ts`            | Every id and tuning number: the pool, the regrowers, radii, budget    |
| `src/pick.ts`              | Pure: the block a death deletes, BLOCKS LEFT                          |
| `src/purge.ts`             | Pure: chunks, fill commands, chunk entries, the queue, the scan plans |
| `src/hud.ts`, `bossbar.ts` | Pure: the boss bar, titles, sounds and particles                      |
| `src/world.ts`             | The saved state: the deleted list and the chunk entries               |
| `src/purger.ts`            | The purge in the game: scans, the queue drain, the regrower sweep     |
| `src/commands.ts`, ...     | Game glue: event handlers and commands that call the pure functions   |
| `src/kubejs/kubejs.d.ts`   | The KubeJS API the scripts use, typed by hand                         |
| `scripts/`                 | Build, checks, pack and link (Node, not Rhino)                        |
| `test/*.test.ts`           | Unit tests (Vitest)                                                   |
| `test/rhino/`              | The Rhino check: a KubeJS stub, the game scenario, the rules scenario |
| `test/data/`               | Every 1.21.1 block id and type, for the pool test                     |

Keep the rules pure: a function that takes numbers and returns numbers can be tested in Node and
reasoned about. The glue only reads from the game, calls the rules and writes the result back.

### The Rhino rules

KubeJS runs JavaScript on Rhino, and most players have a release build that lacks a lot of modern
syntax. Write normal strict TypeScript, minus this list. ESLint flags it at the line, and the build
refuses to write a bundle that contains it.

| Do not write                         | Write instead                                              |
| ------------------------------------ | ---------------------------------------------------------- |
| `{ a }` (shorthand in an object)     | `{ a: a }` (`npm run format` fixes it)                     |
| `f(...args)`, `[...a]`, `{ ...o }`   | `f.apply(null, args)`, `a.slice()`, `Object.assign({}, o)` |
| `function f(...rest)`                | an array parameter                                         |
| `function f(a = 1)`, `{ a = 1 } = o` | `const value = a === undefined ? 1 : a`                    |
| `{ [key]: value }`                   | `const o = {}; o[key] = value;`                            |
| `class`                              | functions and plain objects                                |
| `async`, `await`, `Promise`          | events and ticks                                           |
| `enum`                               | a union of string literals                                 |
| `const` inside a loop, `if` or `try` | `let` (`const` only at the top of a function)              |

`?.`, `??` and `||=` are fine to write: the build lowers them. Destructuring without defaults,
arrow functions, template literals, `let`/`const`, `for...of` over arrays, `Map` and `Set` all run.
[architecture.md](architecture.md#rhino) has the full table and the reasons.

Three Rhino behaviours to keep in mind: `var` is block-scoped (lint bans `var`), a closure
created in a `for (let ...)` loop sees the last value (lint bans functions in loops), and a
`const` inside a block keeps its first value or throws a redeclaration error (lint and the build
refuse it; use `let`). The lint rule `prefer-const` is off in `src/` for that reason.

### Using more of the KubeJS API

`src/kubejs/kubejs.d.ts` declares only what the scripts use. To use something new, find it in
ProbeJS or in the [KubeJS source](https://github.com/kube-mods/kubejs/tree/2101), add it to the
declarations with a comment naming the Java method, and add a fake for it in
`test/rhino/kubejs-stub.js` or the scenario.

Event handlers can only be registered while scripts load, so register them at the top level of a
`register...` function called from `main.ts`, never inside another handler. `event.cancel()`
works by throwing, so never wrap it in `try`/`catch`.

## Tests

| Layer       | Command               | What it proves                                                                                  |
| ----------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| Unit        | `npm test`            | The rules and the build tools, in Node                                                          |
| Syntax gate | `npm run build`       | The bundle has no syntax release Rhino rejects                                                  |
| Rhino check | `npm run check:rhino` | The bundle loads, its handlers and the pure rules give the right results on Rhino 81, 85 and 91 |
| Jar check   | `npm run check:jar`   | The jar opens the way NeoForge and KubeLoader open it                                           |
| In the game | `/deleted spike`      | Real fills, their cost on this machine, real events and the real HUD                            |

When you add a handler, add its case to `test/rhino/scenario.js`. The Rhino check uses a plain
Rhino context, not KubeJS's, so Java interop (string ids turned into registry objects, Java
collections) is only proven in the game.

## npm scripts

| Script                | What it does                                                |
| --------------------- | ----------------------------------------------------------- |
| `npm run dev`         | Rebuild on every save                                       |
| `npm run build`       | Build `build/contentpack/` once                             |
| `npm run check:rhino` | Run the bundle on three Rhino builds                        |
| `npm run pack`        | Write the jar, the plain script and `SHA256SUMS` to `dist/` |
| `npm run check:jar`   | Open the jar the way the game does                          |
| `npm run link`        | Link the build into a game instance                         |
| `npm run lint`        | ESLint and Prettier                                         |
| `npm run format`      | Fix formatting and auto-fixable lint                        |
| `npm test`            | Unit tests                                                  |
| `npm run verify`      | All of the above that CI runs                               |
