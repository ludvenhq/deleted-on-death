// A stand-in for the KubeJS globals the bundle uses. It records what the bundle registers, so
// scenario.js can call the handlers with fake events. It runs on Rhino itself, so it sticks to
// the syntax release Rhino supports (no shorthand, spread, rest or classes).
var __kjs = {
  commandHandlers: [],
  tickHandlers: [],
  deathHandlers: [],
  respawnHandlers: [],
  placedHandlers: [],
  nativeHandlers: [],
  loadedClasses: [],
  log: [],
};

function __kjsLog(level, args) {
  __kjs.log.push(level + ': ' + Array.prototype.join.call(args, ' '));
}

var console = {
  info: function () {
    __kjsLog('info', arguments);
  },
  warn: function () {
    __kjsLog('warn', arguments);
  },
  error: function () {
    __kjsLog('error', arguments);
  },
};

var ServerEvents = {
  commandRegistry: function (handler) {
    __kjs.commandHandlers.push(handler);
  },
  tick: function (handler) {
    __kjs.tickHandlers.push(handler);
  },
};

var EntityEvents = {
  death: function (type, handler) {
    __kjs.deathHandlers.push({ type: type, handler: handler });
  },
};

var PlayerEvents = {
  respawned: function (handler) {
    __kjs.respawnHandlers.push(handler);
  },
};

var BlockEvents = {
  placed: function (handler) {
    __kjs.placedHandlers.push(handler);
  },
};

// A Java class as Java.loadClass hands it over: here just its name.
function FakeClass(name) {
  this.name = name;
}

var NativeEvents = {
  onEvent: function (eventClass, handler) {
    if (!(eventClass instanceof FakeClass)) throw new Error('onEvent needs a class');
    __kjs.nativeHandlers.push({ eventClass: eventClass.name, handler: handler });
  },
};

var Java = {
  loadClass: function (name) {
    __kjs.loadedClasses.push(name);
    if (name === 'net.neoforged.neoforge.event.level.BlockEvent$FluidPlaceBlockEvent') {
      return new FakeClass(name);
    }
    throw new Error('class not available in the stub: ' + name);
  },
};

// A Brigadier builder (literal or argument) that keeps the tree so the scenario can walk it.
function FakeLiteral(name, type) {
  this.name = name;
  this.type = type || null;
  this.children = [];
  this.predicate = null;
  this.run = null;
}
FakeLiteral.prototype.requires = function (predicate) {
  this.predicate = predicate;
  return this;
};
FakeLiteral.prototype.then = function (child) {
  this.children.push(child);
  return this;
};
FakeLiteral.prototype.executes = function (run) {
  this.run = run;
  return this;
};
FakeLiteral.prototype.child = function (name) {
  for (var i = 0; i < this.children.length; i++) {
    if (this.children[i].name === name) return this.children[i];
  }
  throw new Error('no subcommand ' + name + ' under ' + this.name);
};

// The pure rules, handed over by the core bundle (test/rhino/core-entry.ts).
var __core = null;
function __registerCore(core) {
  __core = core;
}
