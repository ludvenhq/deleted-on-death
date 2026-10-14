import { bossbarCommands } from './bossbar.ts';
import { BAR_ID, OVERWORLD } from './config.ts';
import {
  blocksLeftBar,
  deletedSounds,
  deletedTitle,
  nothingLeftTitle,
  safeHereTitle,
} from './hud.ts';
import { blockIdAt, dimensionOf, levelOf, overworldOf, positionOf, uuidOf } from './java.ts';
import { blocksLeft, blockUnder, PICK_OFFSETS, pickBlock } from './pick.ts';
import { scanAround, waitForWave } from './purger.ts';
import { addDeleted, deletedIds, deletedList } from './world.ts';

/**
 * Deleting a block: the pick on a death, the death moment on screen, and the first scan around
 * the body so the wave starts while the death screen is still up.
 */

/** What each dead player sees again when they respawn: uuid to the title commands. */
const onRespawn = new Map<string, { titles: string[]; wave: string | null }>();

function run(server: KubeServer, commands: string[]): void {
  for (const command of commands) server.runCommandSilent(command);
}

/** The count the bar shows, so it is only rewritten when it changes. */
let shownLeft = -1;

/**
 * Shows BLOCKS LEFT to everyone: in full when the count changed or `full` is set, otherwise only
 * to whoever joined since.
 */
export function showBar(server: KubeServer, full: boolean): void {
  const left = blocksLeft(deletedIds(server));
  if (full || left !== shownLeft) {
    shownLeft = left;
    run(server, bossbarCommands(blocksLeftBar(left), '@a'));
  } else {
    server.runCommandSilent(`bossbar set ${BAR_ID} players @a`);
  }
}

/**
 * Deletes a block: saves it, tells everyone, and queues the chunks around `origin` (where the
 * player died, or where the command was run) so the wave starts there. `show` is off when a
 * command deletes several blocks at once and only the last one gets the title.
 */
export function deleteBlock(
  server: KubeServer,
  id: string,
  origin: { x: number; z: number } | null,
  show: boolean,
): void {
  addDeleted(server, id);
  showBar(server, false);
  if (show) {
    run(server, deletedTitle('@a', id));
    run(server, deletedSounds());
  }
  if (origin !== null) scanAround(overworldOf(server), origin, deletedList(server));
  console.info(`Deleted on Death: deleted ${id} (${String(deletedList(server).length)} so far)`);
}

/** The ids at PICK_OFFSETS around the block under the body. */
function aroundBody(level: KubeLevel, x: number, y: number, z: number): string[] {
  const under = blockUnder(x, y, z);
  return PICK_OFFSETS.map((offset) =>
    blockIdAt(level, under.x + offset.x, under.y + offset.y, under.z + offset.z),
  );
}

/**
 * A player died. In the Overworld the block under the body (or the nearest pool block below it,
 * or a random one) is deleted; elsewhere nothing is, and the player is told so.
 */
export function onPlayerDeath(player: KubePlayer): void {
  const server = player.server;
  const level = levelOf(player);
  const uuid = uuidOf(player);
  if (dimensionOf(level) !== OVERWORLD) {
    let titles = safeHereTitle(player.username);
    run(server, titles);
    onRespawn.set(uuid, { titles: titles, wave: null });
    return;
  }
  const at = positionOf(player);
  const id = pickBlock(aroundBody(level, at.x, at.y, at.z), deletedIds(server), Math.random());
  if (id === null) {
    let titles = nothingLeftTitle('@a');
    run(server, titles);
    onRespawn.set(uuid, { titles: nothingLeftTitle(player.username), wave: null });
    return;
  }
  deleteBlock(server, id, { x: at.x, z: at.z }, true);
  onRespawn.set(uuid, { titles: deletedTitle(player.username, id), wave: id });
}

/** The respawn shot: the title again, and the shatter when the wave reaches the player. */
export function onPlayerRespawn(player: KubePlayer): void {
  const uuid = uuidOf(player);
  const pending = onRespawn.get(uuid);
  if (pending === undefined) return;
  onRespawn.delete(uuid);
  run(player.server, pending.titles);
  if (pending.wave !== null && dimensionOf(levelOf(player)) === OVERWORLD) {
    waitForWave(player.server, player, pending.wave);
  }
}

/** Deleted blocks never stay in an inventory: cleared from every player. */
export function clearInventories(server: KubeServer): void {
  for (const id of deletedList(server)) server.runCommandSilent(`clear @a ${id}`);
}
