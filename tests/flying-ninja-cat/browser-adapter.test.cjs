const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const handlers = {};
const node = () => ({
  hidden: true, dataset: {}, textContent: "", attributes: {},
  setAttribute(k, v) { this.attributes[k] = v; },
  addEventListener(k, fn) { this[k] = fn; },
});
const nodes = Object.fromEntries(["#game", ".game-shell", "#status", "#pause-button", "#mute-button", "#resume-button", "#pause-overlay", "#game-controls"].map(k => [k, node()]));
Object.assign(nodes["#game"], {
  getContext: () => ({}), focus() {}, setPointerCapture() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }),
});
class AudioStub {
  constructor() { this.paused = true; this.currentTime = 0; }
  cloneNode() { return new AudioStub(); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  addEventListener(k, fn) { this[k] = fn; }
}
let now = 0;
const storage = new Map();
const sandbox = {
  console, Audio: AudioStub, performance: { now: () => now }, requestAnimationFrame() {},
  localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
  document: { querySelector: k => nodes[k], addEventListener: (k, fn) => { handlers[k] = fn; } },
  window: {
    matchMedia: () => ({ matches: true, addEventListener: (k, fn) => { handlers.orientation = fn; } }),
    addEventListener: (k, fn) => { handlers[k] = fn; },
  }, navigator: {},
};
vm.createContext(sandbox);
const source = fs.readFileSync(path.join(__dirname, "..", "..", "public", "tools", "flying-ninja-cat", "game.js"), "utf8").split("\nfunction drawLoading")[0];
vm.runInContext(source + "\nglobalThis.Game = FlyingNinjaCat; globalThis.Sounds = SoundBank;", sandbox);
const game = new sandbox.Game({});
let ticks = 0;
let draws = 0;
game.update = () => ticks++;
game.draw = () => draws++;
for (let i = 0; i <= 120; i++) game.loop(i * 1000 / 120);
assert.ok(ticks >= 29 && ticks <= 30);
assert.ok(draws <= 31, "120 Hz rendering should not redraw identical 30 FPS frames");

game.player = { holding: true };
game.pointer.down = true;
game.spaceDown = true;
game.activePointerId = 7;
now = 1000;
handlers.blur();
assert.equal(game.paused, true);
assert.equal(game.player.holding, false);
assert.equal(game.activePointerId, null);
assert.equal(nodes["#pause-overlay"].hidden, false);
const frozenTicks = ticks;
game.loop(90000);
game.loop(95000);
assert.equal(ticks, frozenTicks, "background time must not advance physics");
now = 95000;
game.setPaused(false);
game.loop(95001);
assert.equal(ticks, frozenTicks, "resume must discard elapsed background time");
game.loop(95035);
assert.equal(ticks, frozenTicks + 1);
sandbox.document.hidden = true;
handlers.visibilitychange();
assert.equal(game.paused, true);
sandbox.document.hidden = false;
handlers.visibilitychange();
assert.equal(game.paused, true, "returning should wait for explicit resume");

game.setPaused(false);
let actions = 0;
game.onActionDown = () => actions++;
const pointer = { button: 0, isPrimary: true, pointerId: 1, clientX: 200, clientY: 200, preventDefault() {} };
nodes["#game"].pointerdown({ ...pointer, button: 2 });
nodes["#game"].pointerdown({ ...pointer, isPrimary: false });
assert.equal(actions, 0, "right click and secondary touches must not trigger actions");
nodes["#game"].pointerdown(pointer);
nodes["#game"].pointerdown({ ...pointer, pointerId: 2 });
assert.equal(actions, 1);
nodes["#game"].pointerup({ ...pointer, pointerId: 2 });
assert.equal(game.activePointerId, 1, "other fingers cannot release the active pointer");
nodes["#game"].lostpointercapture(pointer);
assert.equal(game.activePointerId, null);
let prevented = false;
const key = { code: "KeyP", preventDefault() { prevented = true; } };
handlers.keydown({ ...key, repeat: true });
assert.equal(game.paused, false);
handlers.keydown(key);
assert.equal(game.paused, true);
handlers.keydown({ code: "Space", preventDefault() {} });
assert.equal(game.paused, false);
assert.equal(actions, 1, "resume must not also jump or shoot");
assert.equal(prevented, true);

// Rotation must freeze physics and sound without clearing other pause reasons.
const beforeRotation = ticks;
handlers.orientation({ matches: false });
assert.equal(game.isLandscape, false);
assert.equal(game.sound.suspended, true);
game.loop(150000);
assert.equal(ticks, beforeRotation);
nodes["#game"].pointerdown(pointer);
assert.equal(actions, 1);
handlers.keydown({ code: "Enter", preventDefault() {} });
assert.equal(game.state, "title", "portrait keyboard input must not start play");
now = 150000;
handlers.orientation({ matches: true });
game.loop(150001);
assert.equal(ticks, beforeRotation, "rotation must not catch up time");
assert.equal(game.sound.suspended, false);
game.setPaused(true);
handlers.orientation({ matches: false });
game.setPaused(false);
assert.equal(game.paused, true, "portrait must not permit resume");
handlers.orientation({ matches: true });
assert.equal(game.paused, true, "rotation must not override manual pause");
assert.equal(game.sound.suspended, true);
game.setPaused(false);
handlers.orientation({ matches: false });
handlers.blur();
handlers.orientation({ matches: true });
assert.equal(game.paused, true, "rotation must not override background pause");
sandbox.document.hidden = true;
game.setPaused(false);
assert.equal(game.paused, true, "hidden tabs must not resume");
sandbox.document.hidden = false;
game.setPaused(false);

sandbox.window.matchMedia = () => ({ matches: false, addEventListener() {} });
const portraitGame = new sandbox.Game({});
assert.equal(portraitGame.isLandscape, false);
assert.equal(portraitGame.sound.suspended, true, "initial portrait load suspends sound");

const sounds = new sandbox.Sounds({ gameMusic: "music", run: "run", coin: "coin" });
sounds.music("gameMusic");
const run = sounds.play("run", { loop: true });
const coin = sounds.play("coin");
sounds.setMuted(true);
assert.ok(run.muted && coin.muted && sounds.currentMusic.audio.muted);
assert.equal(new sandbox.Sounds({}).muted, true, "mute preference persists");
sounds.setSuspended(true);
assert.ok(run.paused && coin.paused && sounds.currentMusic.audio.paused);
assert.equal(sounds.play("coin"), undefined);
sounds.setSuspended(false);
assert.equal(run.paused, false);
assert.equal(coin.paused, true, "resume must not replay stale one-shot effects");
sounds.stop("run");
assert.equal(sounds.active.size, 0);
const nextCoin = sounds.play("coin");
nextCoin.ended();
assert.equal(sounds.active.size, 0, "finished sounds must be released");
sandbox.localStorage.getItem = () => { throw Error("storage disabled"); };
sandbox.localStorage.setItem = () => { throw Error("storage disabled"); };
const privateSounds = new sandbox.Sounds({});
assert.equal(privateSounds.muted, false);
assert.doesNotThrow(() => privateSounds.setMuted(true));
console.log("browser adapter regression tests: PASS");
