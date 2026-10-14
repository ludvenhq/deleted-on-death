import { CLEAR_TICKS, PRUNE_TICKS, REGROW_TICKS, SCAN_TICKS } from './config.ts';
import { clearInventories, onPlayerDeath, onPlayerRespawn, showBar } from './deletion.ts';
import { gameTimeOf, isPlayer, overworldOf, read, reportInterop, stateId } from './java.ts';
import { drain, hasStats, regrowSweep, scanPlayers, takeStats } from './purger.ts';
import { knownDeleted, pruneEntries } from './world.ts';

/** How often the purge writes a line to the log while it is working: every 10 seconds. */
const LOG_TICKS = 200;

const FLUID_EVENT = 'net.neoforged.neoforge.event.level.BlockEvent$FluidPlaceBlockEvent';

/**
 * Lava meeting water makes stone or cobblestone without a placement event. NeoForge's
 * FluidPlaceBlockEvent lets the result be changed: a deleted result is replaced by what was there
 * before, so the lava and the water stay as they are. If the hook cannot be registered, the
 * regrower re-sweep removes those blocks again within a minute instead, and the log says so.
 */
function registerFluidHook(): void {
  try {
    NativeEvents.onEvent(Java.loadClass(FLUID_EVENT), (event) => {
      let result = read(event, ['newState', 'getNewState']);
      if (typeof result !== 'object' || result === null) return;
      if (!knownDeleted().has(stateId(result))) return;
      let before = read(event, ['originalState', 'getOriginalState']);
      if (typeof before === 'object' && before !== null) event.setNewState(before);
    });
    console.info('Deleted on Death: fluid hook registered');
  } catch (error) {
    console.warn(
      `Deleted on Death: fluid hook not available (${String(error)}); the regrower re-sweep covers lava and water`,
    );
  }
}

/**
 * The rules in the game. Every tick the purge drains its queue within its budget; every half
 * second the players' surroundings are scanned; every second deleted blocks are cleared from
 * inventories and the BLOCKS LEFT bar is shown to everyone; every minute the regrowers are swept
 * again; every five minutes old chunk entries are pruned.
 */
export function registerEvents(): void {
  let ticks = 0;

  ServerEvents.tick((event) => {
    const server = event.server;
    ticks++;
    if (ticks === 1) showBar(server, true);
    if (ticks % SCAN_TICKS === 0) scanPlayers(server);
    if (ticks % REGROW_TICKS === 0) regrowSweep(server);
    drain(server);
    if (ticks % CLEAR_TICKS === 0) {
      clearInventories(server);
      showBar(server, false);
      reportInterop();
    }
    if (ticks % PRUNE_TICKS === 0) {
      let overworld = overworldOf(server);
      let pruned = pruneEntries(overworld, gameTimeOf(overworld));
      if (pruned > 0) console.info(`Deleted on Death: pruned ${String(pruned)} old chunk entries`);
    }
    if (ticks % LOG_TICKS === 0 && hasStats()) {
      console.info(`Deleted on Death purge: ${takeStats()}`);
    }
  });

  EntityEvents.death('minecraft:player', (event) => {
    const entity = event.entity;
    if (isPlayer(entity)) onPlayerDeath(entity);
  });

  PlayerEvents.respawned((event) => {
    onPlayerRespawn(event.player);
  });

  BlockEvents.placed((event) => {
    if (knownDeleted().has(stateId(event.block))) event.cancel();
  });

  registerFluidHook();
}
