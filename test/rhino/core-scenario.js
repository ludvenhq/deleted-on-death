// The pure rules on real Rhino: the same cases the unit tests check in Node, chosen where Rhino
// could differ (number formatting, string conversion, Map and Set, sorting, regular expressions).
// Runs after the core bundle has called __registerCore.
var core = __core;

function same(actual, expected, what) {
  if (actual !== expected) {
    throw new Error('rhino-check core: ' + what + ': expected ' + expected + ', got ' + actual);
  }
}

// The pool and the regrowers.
same(core.POOL.length, 200, 'pool size');
same(core.REGROWERS.has('minecraft:grass_block'), true, 'grass regrows');
same(core.blocksLeft(new Set(['minecraft:stone', 'minecraft:chest'])), 199, 'blocks left');

// The pick.
var under = core.blockUnder(-0.5, 64.0625, 10.2);
same(under.x + ',' + under.y + ',' + under.z, '-1,64,10', 'the carpet under the body');
same(core.PICK_OFFSETS.length, 27, 'the cube');
same(core.PICK_OFFSETS[1].y, -1, 'straight down second');
var ids = [];
for (var i = 0; i < 27; i++) ids.push(i === 0 ? 'minecraft:chest' : 'minecraft:air');
ids[1] = 'minecraft:deepslate_iron_ore';
same(core.pickBlock(ids, new Set(), 0), 'minecraft:deepslate_iron_ore', 'the ore under a chest');
same(core.pickBlock(ids, new Set(core.POOL), 0), null, 'nothing once the pool is gone');
same(core.pickBlock(['minecraft:water'], new Set(), 0.9999), core.POOL[199], 'the random fallback');

// Chunks, fills and entries.
var chunk = core.chunkOf(-17, 31);
same(core.chunkKey(chunk), '-2,1', 'chunk of a negative position');
same(core.chunksAround({ x: 8, z: 8 }, 8).length, 289, 'the purge square');
same(core.chunkKey(core.chunksAround({ x: 8, z: 8 }, 8)[0]), '0,0', 'nearest first');
same(
  core.slabCommand(chunk, 2, 'minecraft:stone'),
  'execute in minecraft:overworld run fill -32 64 16 -17 127 31 minecraft:air replace minecraft:stone',
  'a slab fill',
);
same(core.formatEntry({ count: 2, tick: 123456 }), '2:123456', 'an entry');
same(core.parseEntry('2:123456').tick, 123456, 'an entry read back');
same(core.pendingIds({ count: 1, tick: 0 }, ['a', 'b', 'c']).join(), 'b,c', 'pending blocks');
same(core.entryAfter({ count: 2, tick: 1 }, -1, 99).count, 2, 'a re-sweep keeps the count');

// The queue: six fills per block, nearest chunk first, the last one done.
var queue = core.newQueue();
core.enqueue(queue, { x: 2, z: 0 }, ['minecraft:stone'], 1);
core.enqueue(queue, { x: 0, z: 0 }, ['minecraft:grass_block', 'minecraft:stone'], 2);
var steps = [];
var step = core.nextStep(queue, [{ x: 8, z: 8 }], 8);
while (step !== null) {
  steps.push(step);
  step = core.nextStep(queue, [{ x: 8, z: 8 }], 8);
}
same(steps.length, 18, 'fills in all');
same(steps[0].task.key, '0,0', 'the nearest chunk first');
same(steps[11].done, true, 'its last fill');
same(steps[17].task.key, '2,0', 'then the next');
same(queue.tasks.size, 0, 'nothing left');

// Plans.
var plan = core.scanPlan(
  { x: 8, z: 8 },
  1,
  ['minecraft:grass_block'],
  function (key) {
    return key === '0,0' ? { count: 1, tick: 0 } : undefined;
  },
  function () {
    return true;
  },
);
same(plan.length, 8, 'the scan skips the clean chunk');
same(
  core
    .regrowPlan({ x: 0, z: 0 }, 4, ['minecraft:granite', 'minecraft:dirt'], function () {
      return true;
    })[0]
    .ids.join(),
  'minecraft:dirt',
  'only regrowers',
);

// On screen.
same(core.blockName('minecraft:deepslate_diamond_ore'), 'DEEPSLATE DIAMOND ORE', 'block name');
var bar = core.bossbarCommands(core.blocksLeftBar(42), '@a');
same(bar[0], 'bossbar add deleted_on_death:blocks_left {"text":"BLOCKS LEFT 42"}', 'bar title');
same(bar[2], 'bossbar set deleted_on_death:blocks_left color red', 'red when few are left');
same(
  core.deletedTitle('@a', 'minecraft:oak_log')[2],
  'title @a title {"text":"OAK LOG","color":"red"}',
  'the title',
);
same(
  core.shatterCommands(
    { dimension: 'minecraft:overworld', x: 0.5, y: 64, z: -3 },
    'minecraft:sand',
    'Alex',
  )[0],
  'execute in minecraft:overworld run particle minecraft:block{block_state:{Name:"minecraft:sand"}} 0.50 64.00 -3.00 1.5 1 1.5 0.2 120 normal',
  'the shatter',
);
same(core.blockId('Block{minecraft:oak_log}[axis=y]'), 'minecraft:oak_log', 'a block id');
same(
  core.dimensionId('ResourceKey[minecraft:dimension / minecraft:overworld]'),
  'minecraft:overworld',
  'a dimension id',
);
