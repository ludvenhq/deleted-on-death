import { OVERWORLD, POOL, SLABS_PER_CHUNK } from './config.ts';
import { blockName } from './hud.ts';
import { deleteBlock, showBar } from './deletion.ts';
import {
  averageTickMs,
  dimensionOf,
  levelOf,
  originOf,
  overworldOf,
  read,
  stateId,
} from './java.ts';
import { blocksLeft, isDeletable, isInPool, remainingPool } from './pick.ts';
import { chunksAround, slabCommand } from './purge.ts';
import { clearQueue, scanPlayers, takeStats } from './purger.ts';
import { deletedIds, deletedList, resetDeleted, resetEntries } from './world.ts';

function tell(source: CommandSource, message: string): void {
  if (source.player === null) {
    console.info(message);
  } else {
    source.player.tell(message);
  }
}

function originOfSource(source: CommandSource): { x: number; z: number } | null {
  const player = source.player;
  if (player === null || dimensionOf(levelOf(player)) !== OVERWORLD) return null;
  return originOf(player);
}

/** `/deleted add <block>`: deletes one pool block, with the title, as if someone died on it. */
function add(source: CommandSource, id: string): number {
  const server = source.server;
  if (!isInPool(id)) {
    tell(source, `Deleted on Death: ${id} is not in the pool, so it can never be deleted.`);
    return 0;
  }
  if (!isDeletable(id, deletedIds(server))) {
    tell(source, `Deleted on Death: ${id} is already deleted.`);
    return 0;
  }
  deleteBlock(server, id, originOfSource(source), true);
  return 1;
}

/**
 * `/deleted random <count>`: deletes random pool blocks. Only the last one gets the title and
 * starts the wave, which then carries all of them.
 */
function addRandom(source: CommandSource, count: number): number {
  const server = source.server;
  const origin = originOfSource(source);
  const total = Math.min(count, remainingPool(deletedIds(server)).length);
  let done = 0;
  while (done < total) {
    let left = remainingPool(deletedIds(server));
    let id = left[Math.floor(Math.random() * left.length)] ?? '';
    let last = done === total - 1;
    deleteBlock(server, id, last ? origin : null, last);
    done++;
  }
  tell(source, `Deleted on Death: ${String(done)} random blocks deleted.`);
  return done > 0 ? 1 : 0;
}

/** `/deleted list`: the deleted blocks, oldest first, and how many are left. */
function list(source: CommandSource): number {
  const deleted = deletedList(source.server);
  const names = deleted.map(blockName).join(', ');
  tell(
    source,
    `Deleted on Death: BLOCKS LEFT ${String(blocksLeft(deletedIds(source.server)))} of ${String(POOL.length)}. Deleted: ${names === '' ? 'nothing yet' : names}.`,
  );
  return 1;
}

/** `/deleted purge`: forgets which chunks are clean, so every chunk near a player is purged again. */
function purgeAgain(source: CommandSource): number {
  resetEntries(overworldOf(source.server));
  clearQueue();
  scanPlayers(source.server);
  tell(source, 'Deleted on Death: purging every chunk near a player again.');
  return 1;
}

/** `/deleted reset`: forgets every deleted block. Blocks already removed from the world stay gone. */
function reset(source: CommandSource): number {
  const server = source.server;
  resetDeleted(server);
  resetEntries(overworldOf(server));
  clearQueue();
  showBar(server, true);
  tell(source, 'Deleted on Death: nothing is deleted any more. Blocks already removed stay gone.');
  return 1;
}

/** `/deleted stats`: what the purge did since the last report, and the server's tick time. */
function stats(source: CommandSource): number {
  const tick = averageTickMs(source.server);
  tell(
    source,
    `Deleted on Death: ${String(deletedList(source.server).length)} deleted, ${takeStats()}; server tick ${Number.isNaN(tick) ? 'n/a' : `${tick.toFixed(1)} ms`}.`,
  );
  return 1;
}

/**
 * `/deleted spike <block>`: the purge timing test. It removes the block from the 3 by 3 chunks
 * around the player with the same fills the purge uses, timing each, then runs the same fills
 * again, which now find nothing to remove. The block is really removed from those chunks, but it
 * is not added to the deleted list. The result goes to chat and to the log.
 */
function spike(source: CommandSource, id: string): number {
  const player = source.player;
  if (player === null || dimensionOf(levelOf(player)) !== OVERWORLD) {
    tell(source, 'Deleted on Death: run /deleted spike as a player in the Overworld.');
    return 0;
  }
  const commands: string[] = [];
  for (const chunk of chunksAround(originOf(player), 1)) {
    for (let slab = 0; slab < SLABS_PER_CHUNK; slab++) commands.push(slabCommand(chunk, slab, id));
  }
  const server = source.server;
  const timeAll = (): { total: number; slowest: number } => {
    let total = 0;
    let slowest = 0;
    for (const command of commands) {
      let start = Date.now();
      server.runCommandSilent(command);
      let took = Date.now() - start;
      total += took;
      slowest = Math.max(slowest, took);
    }
    return { total: total, slowest: slowest };
  };
  const heavy = timeAll();
  const empty = timeAll();
  const fills = commands.length;
  const line = `Deleted on Death spike: ${id}, ${String(fills)} fills of 16x64x16 in 9 chunks. Removing: ${(heavy.total / fills).toFixed(2)} ms per fill, slowest ${String(heavy.slowest)} ms, ${String(heavy.total)} ms in all. Nothing left to remove: ${(empty.total / fills).toFixed(2)} ms per fill, ${String(empty.total)} ms in all.`;
  console.info(line);
  player.tell(line);
  return 1;
}

/** The block id a BLOCK_STATE argument holds. */
function blockArgument(input: unknown): string {
  if (typeof input !== 'object' || input === null) return String(input);
  const state = read(input, ['state', 'getState']);
  return stateId(typeof state === 'object' && state !== null ? state : input);
}

export function registerCommands(): void {
  ServerEvents.commandRegistry((event) => {
    const commands = event.commands;
    const args = event.arguments;
    event.register(
      commands
        .literal('deleted')
        .requires((source) => source.hasPermission(2))
        .then(
          commands
            .literal('add')
            .then(
              commands
                .argument('block', args.BLOCK_STATE.create(event))
                .executes((context) =>
                  add(context.source, blockArgument(args.BLOCK_STATE.getResult(context, 'block'))),
                ),
            ),
        )
        .then(
          commands
            .literal('random')
            .executes((context) => addRandom(context.source, 1))
            .then(
              commands
                .argument('count', args.INTEGER.create(event))
                .executes((context) =>
                  addRandom(context.source, Number(args.INTEGER.getResult(context, 'count'))),
                ),
            ),
        )
        .then(commands.literal('list').executes((context) => list(context.source)))
        .then(commands.literal('purge').executes((context) => purgeAgain(context.source)))
        .then(commands.literal('reset').executes((context) => reset(context.source)))
        .then(commands.literal('stats').executes((context) => stats(context.source)))
        .then(
          commands
            .literal('spike')
            .then(
              commands
                .argument('block', args.BLOCK_STATE.create(event))
                .executes((context) =>
                  spike(
                    context.source,
                    blockArgument(args.BLOCK_STATE.getResult(context, 'block')),
                  ),
                ),
            ),
        ),
    );
  });
}
