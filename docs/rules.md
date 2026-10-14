# The rules

Deleted on Death has one idea: **when you die, the block you died on is deleted from the world
forever.** Every instance of it, everywhere. This page is the exact rule set. The numbers are the
current defaults; they are tuned in playtests and can change before 1.0, and every change is
listed in the [changelog](../CHANGELOG.md).

## The pool

Only the blocks in the **pool** can be deleted: 200 natural and common building blocks. The list
is `POOL` in [`src/config.ts`](../src/config.ts):

| Group          | Blocks                                                                                                                                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stone          | stone, cobblestone, mossy cobblestone, granite, diorite, andesite, deepslate, cobbled deepslate, tuff, calcite, dripstone block, smooth basalt                                                                                                                              |
| Stone building | stone bricks (plain, mossy, cracked, chiseled), smooth stone, polished granite, diorite, andesite, deepslate and tuff, deepslate bricks and tiles (plain and cracked), chiseled deepslate, tuff bricks, chiseled tuff, chiseled tuff bricks, bricks, mud bricks, packed mud |
| Sandstone      | sandstone and red sandstone, plain, cut, chiseled and smooth                                                                                                                                                                                                                |
| Ocean          | prismarine, prismarine bricks, dark prismarine, sea lantern, sponge, wet sponge, the five coral blocks and the five dead ones                                                                                                                                               |
| Ground         | dirt, coarse dirt, rooted dirt, grass block, podzol, mycelium, mud, clay, moss block, sand, red sand, gravel, snow block, snow, powder snow, ice, packed ice, blue ice, magma block, bone block, sculk                                                                      |
| Ores           | the 16 ores, the three raw ore blocks, and the blocks of coal, iron, gold, diamond, emerald, lapis and amethyst                                                                                                                                                             |
| Trees          | the eight logs, nine planks, ten leaves, mangrove roots, muddy mangrove roots, block of bamboo                                                                                                                                                                              |
| Colours        | 16 wools, terracotta and its 16 colours, 16 concretes, glass and its 16 stained colours                                                                                                                                                                                     |

**BLOCKS LEFT** counts what is left of the pool.

Nothing in the pool holds items, a block entity or redstone behaviour, so a deletion can never
empty a chest or break a machine. Some blocks stay out of the pool by name because deleting them
would break the game: obsidian and crying obsidian (every Nether portal), the Nether portal, the
End portal and its frame, the End gateway, beds and the respawn anchor. Air, water, lava and
bedrock are never deleted either.

## The pick

When you die in the Overworld, one block is picked:

1. **The block under your body**, if it is in the pool and not deleted yet. Standing on a carpet,
   a snow layer or a slab counts as dying on it.
2. Otherwise **the nearest pool block** in the 3 by 3 by 3 blocks below your body, straight down
   first. Dying on a chest deletes the stone under it, not the chest.
3. Otherwise **a random block** from what is left of the pool. Dying in the air over the ocean
   still costs you something.

When the whole pool is gone (BLOCKS LEFT 0), a death picks nothing and shows `NOTHING LEFT`.

## Overworld only

Picks and purges happen in the Overworld only. A death in the Nether or the End deletes nothing
and shows `SAFE HERE`. Blocks in the Nether and the End are never removed, but a deleted block
cannot be placed or carried anywhere.

## Forever

A deleted block:

- **is removed from the world** by the purge, around every player in the Overworld (below);
- **cannot be placed**, by a player or by an enderman;
- **cannot be carried:** it is cleared from every player's inventory every second (chests keep
  what is in them, but anything you take out disappears);
- **does not form from lava and water:** stone and cobblestone that lava and water would make are
  not made when they are deleted. The lava and the water just stay.

Vanilla can bring a few deleted blocks back by ways no event reports: grass and mycelium spread,
dirt returns under covered grass and from farmland, saplings grow logs, leaves and roots, snow
falls, water freezes, moss and sculk spread, coral dies into dead coral, mud dries into clay and
concrete powder sets. These **regrowers** are `REGROWERS` in [`src/config.ts`](../src/config.ts),
and stone and cobblestone are among them in case the lava rule above cannot run. Every minute,
the chunks within 4 chunks of each player are swept again for the deleted regrowers, so a block
that grows back near you is gone again within about a minute.

## The purge

The purge removes deleted blocks chunk by chunk, around every player in the Overworld:

- **Where:** every loaded chunk within 8 chunks of a player (a 17 by 17 square). Chunks nobody
  approaches are not touched until someone does. A dead player stands where they died until they
  respawn, so the wave starts at the body.
- **Order:** nearest chunk to any player first, so the purge spreads out from you as a wave. A
  chunk that has started is finished first.
- **How:** each chunk is cleared in six slabs of 16 by 64 by 16 blocks with
  `fill ... minecraft:air replace <block>`, one slab per fill. Block updates stay on: sand above a
  deleted block falls, water flows into the gap.
- **Budget:** every tick the purge runs fills until it has used 10 ms of that tick, then waits for
  the next tick. The game keeps 20 ticks a second; the wave is as fast as the machine allows.
- **Fast travel:** while you move more than one chunk between two scans (an elytra, a boat on
  ice), chunks you pass are not queued; when you slow down, everything around you is.
- **Remembered:** the world's save keeps, for each purged chunk, how many of the deleted blocks
  it is clean of. A chunk is only purged for blocks deleted since its last purge. A chunk nobody
  has been near for seven Minecraft days is forgotten and purged in full when someone comes back,
  which finds nothing to remove.

## On screen

- **Boss bar:** `BLOCKS LEFT 199`, the pool left out of 200, for every player. It is white, yellow
  below two thirds and red below one third.
- **On a death:** the title `GRASS BLOCK`, subtitle `deleted forever`, for everyone, with glass
  breaking low and the wither's spawn sound.
- **On the respawn:** the title again, and the deleted block shatters around you when the wave
  reaches your chunk.

## Multiplayer

Deletions are for everyone: anyone's death deletes a block for the whole world. The purge runs
around every player in the Overworld. Built for a few friends on a server, not for dozens.

## Commands

For testing and filming; they need operator permission (level 2).

| Command                   | What it does                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `/deleted add <block>`    | Deletes a pool block as if someone died on it, title and wave included               |
| `/deleted random [count]` | Deletes random pool blocks; only the last one gets the title                         |
| `/deleted list`           | The deleted blocks, oldest first, and BLOCKS LEFT                                    |
| `/deleted purge`          | Forgets which chunks are clean and purges everything near players again              |
| `/deleted reset`          | Forgets every deleted block (blocks already removed stay removed)                    |
| `/deleted stats`          | What the purge did since the last report, and the server's tick time                 |
| `/deleted spike <block>`  | The timing test: removes a block from the 3 by 3 chunks around you, timing each fill |
