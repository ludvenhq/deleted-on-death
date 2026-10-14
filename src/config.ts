/**
 * Every id and tuning number in one place. The numbers are the defaults in docs/rules.md; when one
 * changes, the rules page and the changelog change with it.
 */

/** The mod id, also the namespace of everything the scripts create in the world. */
export const MOD_ID = 'deleted_on_death';

/** The only dimension where blocks are picked and purged. */
export const OVERWORLD = 'minecraft:overworld';

/** The Overworld's build height in 1.21.1: y -64 to 319. */
export const MIN_Y = -64;
export const MAX_Y = 319;

/** A purge fills one slab of a chunk at a time: 16 by SLAB_HEIGHT by 16 blocks. */
export const SLAB_HEIGHT = 64;

/** Slabs per chunk and deleted block: (MAX_Y - MIN_Y + 1) / SLAB_HEIGHT = 6. */
export const SLABS_PER_CHUNK = (MAX_Y - MIN_Y + 1) / SLAB_HEIGHT;

/** Chunks within this many chunks of a player (a 17 by 17 square) are purged. */
export const PURGE_RADIUS = 8;

/**
 * Chunks within this many chunks of a player (a 9 by 9 square) are re-swept for the deleted
 * regrowers. Smaller than the purge radius because the re-sweep repeats every minute, and a
 * regrown block only matters where someone can see it.
 */
export const REGROW_RADIUS = 4;

/** The purge drains slabs each tick until it has used this many milliseconds of that tick. */
export const BUDGET_MS = 10;

/** Each player's surroundings are scanned for chunks to purge every this many ticks. */
export const SCAN_TICKS = 10;

/** A player who moved more than this many chunks since the last scan is travelling fast: no scan. */
export const FAST_TRAVEL_CHUNKS = 1;

/** The regrower re-sweep runs every this many ticks (one minute). */
export const REGROW_TICKS = 1200;

/** Deleted blocks are cleared from players' inventories every this many ticks. */
export const CLEAR_TICKS = 20;

/**
 * A chunk's entry is refreshed when a scan finds it up to date and the entry is older than this,
 * so chunks near players are never pruned.
 */
export const REFRESH_TICKS = 1200;

/** Entries not purged or refreshed for this long are pruned: seven Minecraft days. */
export const PRUNE_AGE_TICKS = 7 * 24000;

/** Old entries are pruned every this many ticks (five minutes). */
export const PRUNE_TICKS = 6000;

/**
 * What the scripts keep in the world's save: the deleted blocks, in the order they were deleted
 * (server data), and one entry per purged Overworld chunk (the Overworld's data).
 */
export const DATA_KEYS = {
  deleted: 'deleted_on_death_deleted',
  chunks: 'deleted_on_death_chunks',
};

/** The BLOCKS LEFT boss bar, one for everyone. */
export const BAR_ID = `${MOD_ID}:blocks_left`;

const COLORS = [
  'white',
  'orange',
  'magenta',
  'light_blue',
  'yellow',
  'lime',
  'pink',
  'gray',
  'light_gray',
  'cyan',
  'purple',
  'blue',
  'brown',
  'green',
  'red',
  'black',
];

const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry'];

function ids(names: string[]): string[] {
  return names.map((name) => `minecraft:${name}`);
}

function colored(suffix: string): string[] {
  return ids(COLORS.map((color) => `${color}_${suffix}`));
}

function wooden(suffix: string): string[] {
  return ids(WOODS.map((wood) => `${wood}_${suffix}`));
}

/**
 * The pool: the only blocks that can be deleted, 200 natural and common building blocks. BLOCKS
 * LEFT counts it. Nothing here holds items, a block entity or redstone behaviour, so a purge can
 * never destroy a chest's contents or a machine (the pool test checks every id against the 1.21.1
 * block list).
 */
export const POOL: readonly string[] = ([] as string[]).concat(
  // Stone and its natural neighbours.
  ids([
    'stone',
    'cobblestone',
    'mossy_cobblestone',
    'granite',
    'diorite',
    'andesite',
    'deepslate',
    'cobbled_deepslate',
    'tuff',
    'calcite',
    'dripstone_block',
    'smooth_basalt',
  ]),
  // Stone building blocks.
  ids([
    'stone_bricks',
    'mossy_stone_bricks',
    'cracked_stone_bricks',
    'chiseled_stone_bricks',
    'smooth_stone',
    'polished_granite',
    'polished_diorite',
    'polished_andesite',
    'polished_deepslate',
    'deepslate_bricks',
    'cracked_deepslate_bricks',
    'deepslate_tiles',
    'cracked_deepslate_tiles',
    'chiseled_deepslate',
    'polished_tuff',
    'tuff_bricks',
    'chiseled_tuff',
    'chiseled_tuff_bricks',
    'bricks',
    'mud_bricks',
    'packed_mud',
  ]),
  ids([
    'sandstone',
    'cut_sandstone',
    'chiseled_sandstone',
    'smooth_sandstone',
    'red_sandstone',
    'cut_red_sandstone',
    'chiseled_red_sandstone',
    'smooth_red_sandstone',
  ]),
  // The ocean.
  ids([
    'prismarine',
    'prismarine_bricks',
    'dark_prismarine',
    'sea_lantern',
    'sponge',
    'wet_sponge',
    'tube_coral_block',
    'brain_coral_block',
    'bubble_coral_block',
    'fire_coral_block',
    'horn_coral_block',
    'dead_tube_coral_block',
    'dead_brain_coral_block',
    'dead_bubble_coral_block',
    'dead_fire_coral_block',
    'dead_horn_coral_block',
  ]),
  // The ground.
  ids([
    'dirt',
    'coarse_dirt',
    'rooted_dirt',
    'grass_block',
    'podzol',
    'mycelium',
    'mud',
    'clay',
    'moss_block',
    'sand',
    'red_sand',
    'gravel',
    'snow_block',
    'snow',
    'powder_snow',
    'ice',
    'packed_ice',
    'blue_ice',
    'magma_block',
    'bone_block',
    'sculk',
  ]),
  // Ores and what is made of them.
  ids([
    'coal_ore',
    'deepslate_coal_ore',
    'iron_ore',
    'deepslate_iron_ore',
    'copper_ore',
    'deepslate_copper_ore',
    'gold_ore',
    'deepslate_gold_ore',
    'redstone_ore',
    'deepslate_redstone_ore',
    'emerald_ore',
    'deepslate_emerald_ore',
    'lapis_ore',
    'deepslate_lapis_ore',
    'diamond_ore',
    'deepslate_diamond_ore',
    'raw_iron_block',
    'raw_copper_block',
    'raw_gold_block',
    'coal_block',
    'iron_block',
    'gold_block',
    'diamond_block',
    'emerald_block',
    'lapis_block',
    'amethyst_block',
  ]),
  // Trees.
  wooden('log'),
  wooden('planks'),
  'minecraft:bamboo_planks',
  wooden('leaves'),
  ids(['azalea_leaves', 'flowering_azalea_leaves', 'mangrove_roots', 'muddy_mangrove_roots']),
  'minecraft:bamboo_block',
  // Colours.
  colored('wool'),
  'minecraft:terracotta',
  colored('terracotta'),
  colored('concrete'),
  'minecraft:glass',
  colored('stained_glass'),
);

/**
 * Pool blocks that vanilla can bring back without an event the scripts can cancel: grass and
 * mycelium spread, dirt returns under covered grass and from farmland, trees grow logs, leaves and
 * roots, snow falls, water freezes, moss and sculk spread, coral dies, mud dries into clay,
 * concrete powder sets, and lava meets water. A deleted regrower near a player is removed again
 * by the re-sweep every minute.
 */
export const REGROWERS: ReadonlySet<string> = new Set(
  ids([
    'stone',
    'cobblestone',
    'dirt',
    'grass_block',
    'mycelium',
    'podzol',
    'rooted_dirt',
    'mud',
    'clay',
    'moss_block',
    'snow',
    'ice',
    'sculk',
    'mangrove_roots',
    'muddy_mangrove_roots',
    'azalea_leaves',
    'flowering_azalea_leaves',
    'dead_tube_coral_block',
    'dead_brain_coral_block',
    'dead_bubble_coral_block',
    'dead_fire_coral_block',
    'dead_horn_coral_block',
  ]).concat(wooden('log'), wooden('leaves'), colored('concrete')),
);

/**
 * Blocks kept out of the pool by name because deleting them breaks the game: every Nether portal
 * frame, the portals themselves, the End's way in and out, and every way to set a respawn point.
 * The pool test checks that none of them is in the pool.
 */
export const NEVER_DELETED: ReadonlySet<string> = new Set(
  ids([
    'air',
    'cave_air',
    'void_air',
    'water',
    'lava',
    'bedrock',
    'obsidian',
    'crying_obsidian',
    'nether_portal',
    'end_portal_frame',
    'end_portal',
    'end_gateway',
    'respawn_anchor',
  ]).concat(colored('bed')),
);
