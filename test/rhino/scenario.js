// Drives the bundle's handlers with fake events in a small fake world and checks what they did,
// on real Rhino. This is where Rhino-only behaviour shows up: number formatting, string
// conversion, scoping, Map and Set. It runs after kubejs-stub.js and the bundle, in the same scope.
function check(condition, message) {
  if (!condition) throw new Error('rhino-check: ' + message);
}

// ---- Java-like values ----

function javaList(items) {
  return {
    size: function () {
      return items.length;
    },
    get: function (index) {
      return items[index];
    },
  };
}

function javaIterable(items) {
  return {
    iterator: function () {
      var index = 0;
      return {
        hasNext: function () {
          return index < items.length;
        },
        next: function () {
          index++;
          return items[index - 1];
        },
      };
    },
  };
}

// The fakes look like KubeJS from a script, not like vanilla Minecraft: KubeJS hides vanilla
// members (Entity#level() and ServerLevel#players() behind `level` and `players`,
// Entity#getStringUUID as `stringUuid`, Level#getGameTime as `time`). The vanilla names are
// deliberately missing here, so code that calls them fails this check the way it fails in game.
function getter(target, name, read) {
  Object.defineProperty(target, name, { get: read, enumerable: true, configurable: true });
}

// A CompoundTag: getCompound hands out a new, unattached tag for a missing key, as vanilla does.
function fakeData() {
  var values = new Map();
  var data = {
    contains: function (key) {
      return values.has(key);
    },
    getInt: function (key) {
      return values.has(key) ? values.get(key) : 0;
    },
    putInt: function (key, value) {
      values.set(key, value);
    },
    getString: function (key) {
      return values.has(key) ? values.get(key) : '';
    },
    putString: function (key, value) {
      values.set(key, String(value));
    },
    getCompound: function (key) {
      return values.has(key) ? values.get(key) : fakeData();
    },
    put: function (key, tag) {
      values.set(key, tag);
    },
    remove: function (key) {
      values.delete(key);
    },
  };
  getter(data, 'allKeys', function () {
    var keys = [];
    values.forEach(function (_value, key) {
      keys.push(key);
    });
    return javaIterable(keys);
  });
  return data;
}

// ---- The world ----

function fakeLevel(dimension) {
  var level = {
    dimension: dimension,
    time: 1000,
    blocks: new Map(),
    playerList: [],
    persistentData: fakeData(),
    unloaded: new Set(),
  };
  level.getBlock = function (x, y, z) {
    var id = level.blocks.get(x + ',' + y + ',' + z);
    return { id: id === undefined ? 'minecraft:air' : id };
  };
  level.hasChunk = function (x, z) {
    return !level.unloaded.has(x + ',' + z);
  };
  getter(level, 'players', function () {
    return javaList(level.playerList);
  });
  return level;
}

function fakeServer(overworld) {
  var server = { commands: [], playerArray: [], persistentData: fakeData(), messages: [] };
  server.runCommandSilent = function (command) {
    server.commands.push(String(command));
  };
  server.tell = function (message) {
    server.messages.push(String(message));
  };
  getter(server, 'players', function () {
    return javaList(server.playerArray);
  });
  getter(server, 'overworld', function () {
    return overworld;
  });
  return server;
}

function fakePlayer(server, level, name, uuid, x, y, z) {
  var player = {
    username: name,
    stringUuid: uuid,
    server: server,
    x: x,
    y: y,
    z: z,
    player: true,
    alive: true,
    messages: [],
  };
  getter(player, 'level', function () {
    return level;
  });
  player.tell = function (message) {
    player.messages.push(String(message));
  };
  level.playerList.push(player);
  server.playerArray.push(player);
  return player;
}

function remove(list, item) {
  var index = list.indexOf(item);
  if (index >= 0) list.splice(index, 1);
}

function commandsLike(server, pattern) {
  var found = [];
  for (var i = 0; i < server.commands.length; i++) {
    if (pattern.test(server.commands[i])) found.push(server.commands[i]);
  }
  return found;
}

var overworld = fakeLevel('minecraft:overworld');
var nether = fakeLevel('minecraft:the_nether');
var server = fakeServer(overworld);

function ticks(count) {
  for (var i = 0; i < count; i++) {
    overworld.time++;
    __kjs.tickHandlers[0]({ server: server });
  }
}

/** Ticks until the purge has nothing left to do (at most `limit` ticks), returning the fills. */
function purge(limit) {
  var start = server.commands.length;
  for (var i = 0; i < limit; i++) {
    var before = server.commands.length;
    ticks(1);
    if (
      i >= 10 &&
      commandsLike({ commands: server.commands.slice(before) }, / fill /).length === 0
    ) {
      break;
    }
  }
  return commandsLike({ commands: server.commands.slice(start) }, / fill /);
}

// ---- Loading ----

check(
  __kjs.log[__kjs.log.length - 1].indexOf('info: Deleted on Death ') === 0 &&
    / loaded$/.test(__kjs.log[__kjs.log.length - 1]),
  'load message, got ' + __kjs.log.join(' | '),
);
check(
  __kjs.log.indexOf('info: Deleted on Death: fluid hook registered') >= 0,
  'fluid hook registered, got ' + __kjs.log.join(' | '),
);
check(__kjs.tickHandlers.length === 1, 'one tick handler');
check(
  __kjs.deathHandlers.length === 1 && __kjs.deathHandlers[0].type === 'minecraft:player',
  'one death handler, for players',
);
check(__kjs.respawnHandlers.length === 1, 'one respawned handler');
check(__kjs.placedHandlers.length === 1, 'one placed handler');
check(
  __kjs.nativeHandlers.length === 1 &&
    __kjs.nativeHandlers[0].eventClass ===
      'net.neoforged.neoforge.event.level.BlockEvent$FluidPlaceBlockEvent',
  'one fluid hook',
);

// ---- Commands ----

check(__kjs.commandHandlers.length === 1, 'one commandRegistry handler');
var registered = [];
var commandEvent = {
  commands: {
    literal: function (name) {
      return new FakeLiteral(name);
    },
    argument: function (name, type) {
      return new FakeLiteral(name, type);
    },
  },
  register: function (command) {
    registered.push(command);
  },
};
// A BlockInput: KubeJS reads its state; the state's id is KubeJS's `id`.
function blockInput(id) {
  return {
    getState: function () {
      return { id: id };
    },
  };
}
commandEvent.arguments = {
  BLOCK_STATE: {
    create: function (event) {
      check(event === commandEvent, 'BLOCK_STATE argument made from the event');
      return 'block-argument';
    },
    getResult: function (context, name) {
      return blockInput(context.args[name]);
    },
  },
  INTEGER: {
    create: function () {
      return 'integer-argument';
    },
    getResult: function (context, name) {
      return context.args[name];
    },
  },
};
__kjs.commandHandlers[0](commandEvent);
check(registered.length === 1 && registered[0].name === 'deleted', '/deleted registered');
var deletedCommand = registered[0];
check(
  deletedCommand.predicate({
    hasPermission: function (level) {
      return level <= 2;
    },
  }) === true,
  'ops may run /deleted',
);
check(
  deletedCommand.predicate({
    hasPermission: function (level) {
      return level <= 0;
    },
  }) === false,
  'players may not',
);
check(deletedCommand.child('add').child('block').type === 'block-argument', '/deleted add <block>');
check(
  deletedCommand.child('random').child('count').type === 'integer-argument',
  '/deleted random <count>',
);

// ---- The first tick: the bar for everyone ----

var alex = fakePlayer(
  server,
  overworld,
  'Alex',
  'aaaaaaaa-0000-0000-0000-000000000001',
  8.5,
  64,
  8.5,
);
ticks(1);
check(
  server.commands.join(' | ') ===
    [
      'bossbar add deleted_on_death:blocks_left {"text":"BLOCKS LEFT 200"}',
      'bossbar set deleted_on_death:blocks_left name {"text":"BLOCKS LEFT 200"}',
      'bossbar set deleted_on_death:blocks_left color white',
      'bossbar set deleted_on_death:blocks_left style notched_20',
      'bossbar set deleted_on_death:blocks_left max 200',
      'bossbar set deleted_on_death:blocks_left value 200',
      'bossbar set deleted_on_death:blocks_left players @a',
    ].join(' | '),
  'first tick shows the bar, got ' + server.commands.join(' | '),
);
ticks(40);
check(commandsLike(server, / fill /).length === 0, 'nothing to purge before the first death');
check(commandsLike(server, /^clear /).length === 0, 'nothing to clear before the first death');

// ---- A death on grass ----

overworld.blocks.set('8,63,8', 'minecraft:grass_block');
overworld.blocks.set('8,62,8', 'minecraft:dirt');
server.commands = [];
__kjs.deathHandlers[0].handler({ entity: alex });
check(
  server.persistentData.getString('deleted_on_death_deleted') === 'minecraft:grass_block',
  'grass deleted and saved, got ' + server.persistentData.getString('deleted_on_death_deleted'),
);
check(
  server.commands.indexOf(
    'bossbar set deleted_on_death:blocks_left name {"text":"BLOCKS LEFT 199"}',
  ) >= 0,
  'bar at 199, got ' + server.commands.join(' | '),
);
check(
  server.commands.indexOf('title @a title {"text":"GRASS BLOCK","color":"red"}') >= 0 &&
    server.commands.indexOf('title @a subtitle {"text":"deleted forever","color":"gray"}') >= 0,
  'GRASS BLOCK title for everyone',
);
check(
  commandsLike(server, /playsound minecraft:entity\.wither\.spawn/).length === 1,
  'the wither sound',
);
check(
  __kjs.log.indexOf('info: Deleted on Death: deleted minecraft:grass_block (1 so far)') >= 0,
  'logged',
);

// The wave: every chunk within 8 of the body, nearest first, six fills each, then an entry.
alex.alive = false;
server.commands = [];
var fills = purge(400);
check(fills.length === 289 * 6, '289 chunks of 6 fills, got ' + fills.length);
check(
  fills[0] ===
    'execute in minecraft:overworld run fill 0 -64 0 15 -1 15 minecraft:air replace minecraft:grass_block',
  'starts under the body, got ' + fills[0],
);
check(
  fills[5] ===
    'execute in minecraft:overworld run fill 0 256 0 15 319 15 minecraft:air replace minecraft:grass_block',
  'six slabs up to the build limit, got ' + fills[5],
);
check(
  / fill (128|-128) /.test(fills[fills.length - 1]),
  'ends at the edge, got ' + fills[fills.length - 1],
);
var chunkTag = overworld.persistentData.getCompound('deleted_on_death_chunks');
check(/^1:\d+$/.test(chunkTag.getString('0,0')), 'entry for 0,0, got ' + chunkTag.getString('0,0'));
check(/^1:\d+$/.test(chunkTag.getString('-8,8')), 'entry for the corner -8,8');
check(chunkTag.getString('9,0') === '', 'no entry outside the radius');

// Scans find everything up to date: no more fills.
server.commands = [];
ticks(30);
check(commandsLike(server, / fill /).length === 0, 'nothing purged twice');

// Every second the deleted blocks leave every inventory.
server.commands = [];
ticks(20);
check(
  server.commands.indexOf('clear @a minecraft:grass_block') >= 0,
  'grass cleared from inventories',
);

// The respawn: the title again, and the wave has already passed, so the shatter comes at once.
remove(server.playerArray, alex);
remove(overworld.playerList, alex);
var alexAgain = fakePlayer(server, overworld, 'Alex', alex.stringUuid, 8.5, 70, 8.5);
server.commands = [];
__kjs.respawnHandlers[0]({ player: alexAgain });
check(
  server.commands.indexOf('title Alex title {"text":"GRASS BLOCK","color":"red"}') >= 0,
  'title again on respawn, got ' + server.commands.join(' | '),
);
check(
  server.commands.indexOf(
    'execute in minecraft:overworld run particle minecraft:block{block_state:{Name:"minecraft:grass_block"}} 8.50 71.00 8.50 1.5 1 1.5 0.2 120 normal',
  ) >= 0,
  'grass shatters around the player, got ' + server.commands.join(' | '),
);
server.commands = [];
__kjs.respawnHandlers[0]({ player: alexAgain });
check(server.commands.length === 0, 'only once');

// Placing a deleted block is cancelled; any other block is not.
function place(id) {
  var cancelled = false;
  __kjs.placedHandlers[0]({
    block: { id: id },
    cancel: function () {
      cancelled = true;
    },
  });
  return cancelled;
}
check(place('minecraft:grass_block') === true, 'grass cannot be placed');
check(place('minecraft:stone') === false, 'stone can');

// Lava meeting water: a deleted result is replaced by what was there.
function fluid(id) {
  var set = [];
  var before = { id: 'minecraft:lava' };
  __kjs.nativeHandlers[0].handler({
    getNewState: function () {
      return { id: id };
    },
    getOriginalState: function () {
      return before;
    },
    setNewState: function (state) {
      set.push(state);
    },
  });
  return set.length === 1 && set[0] === before;
}
check(fluid('minecraft:grass_block') === true, 'a deleted fluid result is undone');
check(fluid('minecraft:cobblestone') === false, 'cobblestone forms while it is not deleted');

// ---- A death in the Nether deletes nothing ----

var steve = fakePlayer(
  server,
  nether,
  'Steve',
  'bbbbbbbb-0000-0000-0000-000000000002',
  0.5,
  70,
  0.5,
);
nether.blocks.set('0,69,0', 'minecraft:stone');
server.commands = [];
__kjs.deathHandlers[0].handler({ entity: steve });
check(
  server.commands.indexOf('title Steve title {"text":"SAFE HERE","color":"green"}') >= 0,
  'SAFE HERE for Steve, got ' + server.commands.join(' | '),
);
check(
  server.persistentData.getString('deleted_on_death_deleted') === 'minecraft:grass_block',
  'nothing deleted in the Nether',
);
remove(server.playerArray, steve);

// ---- Commands in the game ----

var source = { player: alexAgain, server: server };
var addStone = deletedCommand.child('add').child('block');
server.commands = [];
check(
  addStone.run({ source: source, args: { block: 'minecraft:stone' } }) === 1,
  '/deleted add stone',
);
check(
  server.persistentData.getString('deleted_on_death_deleted') ===
    'minecraft:grass_block,minecraft:stone',
  'stone deleted second',
);
check(server.commands.indexOf('title @a title {"text":"STONE","color":"red"}') >= 0, 'STONE title');
fills = purge(400);
check(fills.length === 289 * 6, 'stone purged from 289 chunks, got ' + fills.length);
check(/replace minecraft:stone$/.test(fills[0]), 'only stone this time, got ' + fills[0]);
check(/^2:\d+$/.test(chunkTag.getString('0,0')), 'entries at 2, got ' + chunkTag.getString('0,0'));

check(addStone.run({ source: source, args: { block: 'minecraft:stone' } }) === 0, 'not twice');
check(/already deleted/.test(alexAgain.messages[alexAgain.messages.length - 1]), 'says so');
check(
  addStone.run({ source: source, args: { block: 'minecraft:chest' } }) === 0,
  'a chest cannot be deleted',
);
check(/not in the pool/.test(alexAgain.messages[alexAgain.messages.length - 1]), 'says why');

deletedCommand.child('list').run({ source: source });
check(
  alexAgain.messages[alexAgain.messages.length - 1] ===
    'Deleted on Death: BLOCKS LEFT 198 of 200. Deleted: GRASS BLOCK, STONE.',
  '/deleted list, got ' + alexAgain.messages[alexAgain.messages.length - 1],
);

// The regrower re-sweep: a minute in, both deleted blocks are regrowers, 81 chunks each.
var sweepAt = 1200 - (overworld.time - 1000);
check(sweepAt > 1, 'the re-sweep is still ahead, ticks so far ' + (overworld.time - 1000));
ticks(sweepAt - 1);
server.commands = [];
fills = purge(400);
check(fills.length === 81 * 6 * 2, 'regrowers swept in 81 chunks, got ' + fills.length);
check(/^2:\d+$/.test(chunkTag.getString('0,0')), 'the count stays 2 after a re-sweep');
check(
  __kjs.log.some(function (line) {
    return /^info: Deleted on Death purge: queue \d+ chunks, \d+ fills/.test(line);
  }),
  'the purge reports to the log, got ' + __kjs.log.join(' | '),
);

// /deleted stats reports the purge.
deletedCommand.child('stats').run({ source: source });
check(
  /^Deleted on Death: 2 deleted, queue 0 chunks, .*; server tick n\/a\.$/.test(
    alexAgain.messages[alexAgain.messages.length - 1],
  ),
  '/deleted stats, got ' + alexAgain.messages[alexAgain.messages.length - 1],
);

// /deleted spike times the purge fills in the 3 by 3 chunks around the player, twice.
server.commands = [];
deletedCommand
  .child('spike')
  .child('block')
  .run({ source: source, args: { block: 'minecraft:sand' } });
check(commandsLike(server, /replace minecraft:sand$/).length === 108, '54 fills twice');
check(
  /^Deleted on Death spike: minecraft:sand, 54 fills of 16x64x16 in 9 chunks\. Removing: \d+\.\d\d ms per fill/.test(
    alexAgain.messages[alexAgain.messages.length - 1],
  ),
  'spike result, got ' + alexAgain.messages[alexAgain.messages.length - 1],
);
check(
  server.persistentData.getString('deleted_on_death_deleted') ===
    'minecraft:grass_block,minecraft:stone',
  'the spike deletes nothing',
);

// /deleted purge forgets the entries and purges everything near players again.
deletedCommand.child('purge').run({ source: source });
fills = purge(800);
check(fills.length === 289 * 6 * 2, 'both blocks purged again, got ' + fills.length);

// A chunk that unloads is dropped from the queue and comes back when it loads.
overworld.unloaded.add('8,8');
deletedCommand.child('purge').run({ source: source });
fills = purge(800);
check(fills.length === 288 * 6 * 2, 'unloaded chunk skipped, got ' + fills.length);
overworld.unloaded.delete('8,8');
fills = purge(50);
check(fills.length === 6 * 2, 'and purged when it loads, got ' + fills.length);

// /deleted reset forgets everything; /deleted random deletes from what is left.
server.commands = [];
deletedCommand.child('reset').run({ source: source });
check(server.persistentData.getString('deleted_on_death_deleted') === '', 'reset');
check(
  server.commands.indexOf('bossbar set deleted_on_death:blocks_left value 200') >= 0,
  'bar back to 200',
);
server.commands = [];
deletedCommand
  .child('random')
  .child('count')
  .run({ source: source, args: { count: 3 } });
check(
  server.persistentData.getString('deleted_on_death_deleted').split(',').length === 3,
  'three random blocks',
);
check(commandsLike(server, /^title @a title /).length === 1, 'one title for the three');

// ---- The end: an exhausted pool ----

deletedCommand
  .child('random')
  .child('count')
  .run({ source: source, args: { count: 500 } });
check(
  server.persistentData.getString('deleted_on_death_deleted').split(',').length === 200,
  'the whole pool deleted',
);
check(
  server.commands.indexOf(
    'bossbar set deleted_on_death:blocks_left name {"text":"BLOCKS LEFT 0"}',
  ) >= 0,
  'bar at 0',
);
server.commands = [];
overworld.blocks.set('8,69,8', 'minecraft:oak_planks');
__kjs.deathHandlers[0].handler({ entity: alexAgain });
check(
  server.commands.indexOf('title @a title {"text":"NOTHING LEFT","color":"dark_red"}') >= 0,
  'NOTHING LEFT, got ' + server.commands.join(' | '),
);
check(
  server.persistentData.getString('deleted_on_death_deleted').split(',').length === 200,
  'still 200',
);

// The members the game resolved were logged once.
check(
  __kjs.log.some(function (line) {
    return /^info: Deleted on Death interop: .*stringUuid=stringUuid/.test(line);
  }),
  'interop logged, got ' + __kjs.log.join(' | '),
);
