/**
 * The part of the KubeJS 7 server API that Deleted on Death uses, typed by hand.
 *
 * ProbeJS generates typings for the whole game, but they are written for plain JS (its own output
 * says fully TypeScript-compatible typings are not possible) and they are tens of thousands of
 * lines that only exist in a game folder, not in CI. So the game scripts see only this small,
 * strict surface. Each entry names the Java method it maps to. When you need something new, check
 * it in ProbeJS or the KubeJS source (https://github.com/kube-mods/kubejs/tree/2101) and add it.
 *
 * Only members that take arguments, and KubeJS's own properties, are typed here. Every
 * zero-argument read (a uuid, a position, a list's size, a block id) goes through read() in
 * src/java.ts, because in the game some vanilla zero-argument methods are not callable and a
 * KubeJS property can shadow a vanilla method of the same name.
 */

/** A Minecraft text component. Plain strings are converted by KubeJS. */
type TextLike = string;

/** java.util.List. Its size is read with listSize() in src/java.ts. */
interface JavaList<T> {
  get(index: number): T;
}

/**
 * net.minecraft.nbt.CompoundTag, through KubeJS's `persistentData`. Missing keys read as 0, '' or
 * a new empty tag. Its keys are read with keysOf() in src/java.ts.
 */
interface CompoundTag {
  contains(key: string): boolean;
  getInt(key: string): number;
  putInt(key: string, value: number): void;
  getString(key: string): string;
  putString(key: string, value: string): void;
  /** A new, unattached tag when the key is missing: put it back to keep it (childTag()). */
  getCompound(key: string): CompoundTag;
  put(key: string, tag: CompoundTag): void;
  remove(key: string): void;
}

/** dev.latvian.mods.kubejs.level.LevelBlock: its id is read with stateId() in src/java.ts. */
interface LevelBlock {
  readonly kind?: 'LevelBlock';
}

/**
 * ServerLevel with LevelKJS and ServerLevelKJS. Players, dimension and time: src/java.ts. Whether
 * a chunk is loaded (LevelReader#hasChunk) is checked by chunkLoaded() in src/java.ts.
 */
interface KubeLevel {
  /** kjs$getBlock(int, int, int) */
  getBlock(x: number, y: number, z: number): LevelBlock;
  /**
   * kjs$getPersistentData: KubeJS's saved data for this level, kept inside the server's data
   * under the dimension id and saved with the world.
   */
  readonly persistentData: CompoundTag;
}

/** MinecraftServer with MinecraftServerKJS. Its players and the Overworld: src/java.ts. */
interface KubeServer {
  /** kjs$runCommandSilent: runs a command as the server, without chat output. */
  runCommandSilent(command: string): void;
  /** kjs$tell: a chat message to every player. */
  tell(message: TextLike): void;
  /** kjs$getPersistentData: KubeJS's saved data for the world (kubejs_persistent_data.nbt). */
  readonly persistentData: CompoundTag;
}

/** Entity with EntityKJS. The uuid, level, position and flags are read in src/java.ts. */
interface KubeEntity {
  /** kjs$getServer */
  readonly server: KubeServer;
  /** kjs$tell */
  tell(message: TextLike): void;
}

/** LivingEntity with LivingEntityKJS. */
interface KubeLivingEntity extends KubeEntity {
  readonly kind?: 'LivingEntity';
}

/** ServerPlayer with PlayerKJS. */
interface KubePlayer extends KubeLivingEntity {
  /** kjs$getUsername */
  readonly username: string;
}

/** net.minecraft.commands.CommandSourceStack */
interface CommandSource {
  /** getPlayer: null when the command did not come from a player. */
  readonly player: KubePlayer | null;
  readonly server: KubeServer;
  hasPermission(level: number): boolean;
}

/** com.mojang.brigadier.context.CommandContext */
interface CommandContext {
  readonly source: CommandSource;
}

/** A Brigadier argument type, made by an ArgumentTypeWrapper. */
interface ArgumentType {
  readonly kind?: 'ArgumentType';
}

/** dev.latvian.mods.kubejs.command.ArgumentTypeWrappers, one constant per argument type. */
interface ArgumentTypeWrapper<T> {
  create(event: CommandRegistryEvent): ArgumentType;
  getResult(context: CommandContext, name: string): T;
}

interface ArgumentTypes {
  /** IntegerArgumentType.integer(); the result is a java.lang.Integer, read it with Number(). */
  readonly INTEGER: ArgumentTypeWrapper<unknown>;
  /**
   * BlockStateArgument.block(), with block ids suggested as you type; the result is a BlockInput,
   * read its state with read() and its id with stateId().
   */
  readonly BLOCK_STATE: ArgumentTypeWrapper<unknown>;
}

/** com.mojang.brigadier.builder.ArgumentBuilder: a literal or an argument node. */
interface CommandBuilder {
  requires(predicate: (source: CommandSource) => boolean): CommandBuilder;
  then(child: CommandBuilder): CommandBuilder;
  /** The callback returns the command's result count; 1 means success. */
  executes(run: (context: CommandContext) => number): CommandBuilder;
}

/** net.minecraft.commands.Commands, wrapped by KubeJS. */
interface Commands {
  literal(name: string): CommandBuilder;
  argument(name: string, type: ArgumentType): CommandBuilder;
}

/** dev.latvian.mods.kubejs.command.CommandRegistryKubeEvent */
interface CommandRegistryEvent {
  readonly commands: Commands;
  readonly arguments: ArgumentTypes;
  register(command: CommandBuilder): void;
}

/** dev.latvian.mods.kubejs.entity.LivingEntityDeathKubeEvent (LivingDeathEvent) */
interface EntityDeathEvent {
  readonly entity: KubeLivingEntity;
}

/** dev.latvian.mods.kubejs.player.PlayerRespawnedKubeEvent (PlayerEvent.PlayerRespawnEvent) */
interface PlayerRespawnedEvent {
  readonly player: KubePlayer;
}

/** dev.latvian.mods.kubejs.block.BlockPlacedKubeEvent (BlockEvent.EntityPlaceEvent) */
interface BlockPlacedEvent {
  /** The block as placed. */
  readonly block: LevelBlock;
  /** Stops the placement. Works by throwing, so never call it inside try/catch. */
  cancel(): void;
}

/** dev.latvian.mods.kubejs.server.ServerKubeEvent */
interface ServerTickEvent {
  readonly server: KubeServer;
}

/** A Java class loaded with Java.loadClass. */
interface JavaClass {
  readonly kind?: 'JavaClass';
}

/**
 * net.neoforged.neoforge.event.level.BlockEvent.FluidPlaceBlockEvent. Its states are read with
 * read() in src/java.ts.
 */
interface FluidPlaceBlockEvent {
  /** Replaces the block the fluid would make. */
  setNewState(state: object): void;
}

declare const ServerEvents: {
  commandRegistry(handler: (event: CommandRegistryEvent) => void): void;
  /** Once per server tick, 20 times a second. */
  tick(handler: (event: ServerTickEvent) => void): void;
};

declare const EntityEvents: {
  /** Fires before a living entity of the given type dies. */
  death(type: string, handler: (event: EntityDeathEvent) => void): void;
};

declare const PlayerEvents: {
  /** Fires after a player respawns, in the new player entity. */
  respawned(handler: (event: PlayerRespawnedEvent) => void): void;
};

declare const BlockEvents: {
  /** Fires before an entity (a player, an enderman) places a block; cancelling stops it. */
  placed(handler: (event: BlockPlacedEvent) => void): void;
};

/**
 * KubeJS's NativeEventWrapper: a listener for any NeoForge event, dropped again on `/reload`.
 * Throws when the class is not an event.
 */
declare const NativeEvents: {
  onEvent(eventClass: JavaClass, handler: (event: FluidPlaceBlockEvent) => void): void;
};

/** KubeJS's Java access. Refuses classes on its deny list by throwing. */
declare const Java: {
  loadClass(name: string): JavaClass;
};

/** KubeJS's ConsoleJS; output goes to logs/kubejs/server.log. */
declare const console: {
  info(...values: unknown[]): void;
  warn(...values: unknown[]): void;
  error(...values: unknown[]): void;
};

/** Replaced at build time with the version from package.json. */
declare const __VERSION__: string;
