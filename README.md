# Deleted on Death

**Minecraft, but when you die, the block you died on is deleted from the world forever.**

Die on grass and every grass block in the world is gone. The purge rolls out from your body as a
wave while the death screen is still up, the world unzips to the horizon, and a BLOCKS LEFT
counter ticks down. Don't die on stone.

[![CI](https://github.com/ludvenhq/deleted-on-death/actions/workflows/ci.yml/badge.svg)](https://github.com/ludvenhq/deleted-on-death/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> **Status: in development, not released yet.** The rules in [docs/rules.md](docs/rules.md) are
> written and tested off-game; the in-game timing test comes next. Releases will be on
> CurseForge, Modrinth and the [releases page](https://github.com/ludvenhq/deleted-on-death/releases).

## How it plays

- **The pick.** When you die in the Overworld, the block under your body is deleted. Died on a
  chest? The stone under it goes instead. Died in mid-air? A random block goes.
- **Forever.** Every instance is removed from the world around every player, chunk by chunk, and
  it can never be placed, carried or made again.
- **The pool.** 200 natural and common blocks can be deleted: stone, dirt, grass, sand, logs, ores,
  wool, glass and the like. Chests, machines, portals and beds never are.
- **On screen.** A `BLOCKS LEFT 199` boss bar, and the title `GRASS BLOCK · deleted forever` when
  someone dies.

The exact rules, numbers and commands are in [docs/rules.md](docs/rules.md).

## Requirements

| What           | Version                                          |
| -------------- | ------------------------------------------------ |
| Minecraft Java | 1.21.1                                           |
| NeoForge       | 21.1.199 or newer                                |
| KubeJS         | 2101.7.2-build.374 or newer (installs Rhino too) |
| KubeLoader     | 21-0.1.0-Alpha-3 or newer                        |

Deleted on Death is a set of KubeJS scripts packed as a mod with KubeLoader. It has no Java code
of its own. It does not run on Forge, Fabric or Bedrock.

**Use a new world.** Deletions are permanent, and the purge really removes blocks. Do not add it
to a world you want to keep as it is.

## Install

**CurseForge app or Modrinth App:** create a NeoForge 1.21.1 profile, search for Deleted on Death
and install it. The app installs KubeJS and KubeLoader with it.

**By hand:** put the Deleted on Death jar, KubeJS, Rhino and KubeLoader in the `mods` folder of a
NeoForge 1.21.1 instance.

**Servers:** install the same mods on the server and on every player's game.

**Modpacks that already use KubeJS:** you can skip the jar and KubeLoader. Each release also has
`deleted-on-death-<version>.js`; put it in your pack's `kubejs/server_scripts/` folder.

**Check that it works:** in a new world with cheats on, a `BLOCKS LEFT 200` bar shows at the top
of the screen. `/deleted add minecraft:grass_block` deletes grass around you.

## Commands

All commands need operator permission.

| Command                   | What it does                                         |
| ------------------------- | ---------------------------------------------------- |
| `/deleted add <block>`    | Deletes a pool block, title and wave included        |
| `/deleted random [count]` | Deletes random pool blocks                           |
| `/deleted list`           | What is deleted and how many blocks are left         |
| `/deleted purge`          | Purges every chunk near players again                |
| `/deleted reset`          | Forgets every deleted block                          |
| `/deleted stats`          | What the purge did lately and the server's tick time |
| `/deleted spike <block>`  | Times the purge fills in the chunks around you       |

## Questions

**It lags.** The purge uses at most 10 ms of each tick, so the game keeps 20 ticks a second; a
slow machine just sees a slower wave. `/deleted stats` shows what it is doing. If the game still
stutters, [open an issue](https://github.com/ludvenhq/deleted-on-death/issues/new/choose) with the
output of `/deleted stats` and `/deleted spike minecraft:stone`.

**My block came back.** Vanilla grows some blocks back on its own (grass spreading, trees, snow).
Those are removed again within about a minute near a player.

**Nothing happens.** Look for errors in `logs/kubejs/server.log` in your game folder, then
[open an issue](https://github.com/ludvenhq/deleted-on-death/issues/new/choose) with the log.

**Can I use it in my modpack or my video?** Yes. It is MIT licensed. A link back is appreciated.

**Other Minecraft versions?** 1.21.1 only for now; KubeJS 7 targets 1.21.1.

## Building from source

The scripts are written in TypeScript and compiled into one KubeJS script. You need Node.js 24 and,
for the Rhino checks, a Java 21 JDK:

```sh
npm ci
npm run verify   # lint, types, tests, build, run on real Rhino, pack the jar
```

The jar is in `dist/`. [docs/development.md](docs/development.md) covers the dev loop with a live
game, and [docs/architecture.md](docs/architecture.md) explains how it is built and why.

## Contributing

Ideas, bug reports and pull requests are welcome; read [CONTRIBUTING.md](CONTRIBUTING.md) first.
This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Security issues go to the
address in [SECURITY.md](SECURITY.md), not to public issues.

## License

[MIT](LICENSE). Made by [Ludven](https://ludven.com). Not an official Minecraft product; not
approved by or associated with Mojang or Microsoft.
