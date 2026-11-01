const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const gamePath = path.join(__dirname, "..", "..", "public", "tools", "flying-ninja-cat", "game.js");
const itemDataPath = path.join(__dirname, "..", "..", "public", "tools", "flying-ninja-cat", "item-data.js");
const stylePath = path.join(__dirname, "..", "..", "public", "tools", "flying-ninja-cat", "style.css");
const indexPath = path.join(__dirname, "..", "..", "public", "tools", "flying-ninja-cat", "index.html");
const itemDataSource = fs.readFileSync(itemDataPath, "utf8");
const styleSource = fs.readFileSync(stylePath, "utf8");
const indexSource = fs.readFileSync(indexPath, "utf8");
const source =
  fs.readFileSync(gamePath, "utf8").split("\nfunction drawLoading")[0] +
  "\nglobalThis.TestGame = FlyingNinjaCat;" +
  "\nglobalThis.TestData = { SAFE_PATTERNS, FINISH_PATTERN, LEVEL_PATTERNS, ITEM_PATTERNS_BY_MAP, EFFECT_FRAME_COUNTS, EFFECT_DIRECTORIES, FADE_ALPHA, CAT_CLIP_FRAME_COUNTS, CAT_CLIP_DRAW, ITEM_MARKER_TRANSFORMS, ITEM_MOVIE_BOUNDS, DEATH_DELAY_FRAMES, DEATH_TWEEN_FRAMES, DEATH_DISTANCE, CANVAS_WIDTH, CANVAS_HEIGHT, VIEW_SCALE, VIEW_OFFSET_X, VIEW_OFFSET_Y, WORLD_VISIBLE_RIGHT, WORLD_SPAWN_X, INITIAL_BLOCK_COUNT, GROUND_MARKER_TOP, GROUND_MARKER_BOTTOM };";
const drawCalls = [];
const fillRects = [];
const rotations = [];
const translations = [];
const scales = [];
const transforms = [];
const textCalls = [];
const context = new Proxy(
  {
    imageSmoothingEnabled: true,
    drawImage(...args) {
      drawCalls.push(args);
    },
    fillRect(...args) {
      fillRects.push(args);
    },
    rotate(angle) {
      rotations.push(angle);
    },
    translate(...args) {
      translations.push(args);
    },
    scale(...args) {
      scales.push(args);
    },
    setTransform(...args) {
      transforms.push(args);
    },
    strokeText(...args) {
      textCalls.push(args);
    },
    fillText(...args) {
      textCalls.push(args);
    },
  },
  {
    get(target, key) {
      return key in target ? target[key] : () => {};
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  },
);
const canvas = { dataset: {}, getContext: () => context };
const status = { textContent: "" };
const gameShell = {};
const sandbox = {
  console,
  Math,
  Date,
  Promise,
  setTimeout,
  clearTimeout,
  document: {
    querySelector: (selector) => {
      if (selector === "#game") return canvas;
      if (selector === ".game-shell") return gameShell;
      return status;
    },
  },
  window: {},
  navigator: { maxTouchPoints: 0 },
  Image: function Image() {},
  Audio: function Audio() {},
};

vm.createContext(sandbox);
vm.runInContext(itemDataSource, sandbox);
vm.runInContext(source, sandbox);

assert.match(
  styleSource,
  /-webkit-tap-highlight-color:\s*transparent/,
  "touch input should not flash the browser tap highlight",
);
assert.match(
  styleSource,
  /canvas:focus[\s\S]*box-shadow:\s*none/,
  "pointer focus should not draw the old cyan canvas border",
);
assert.match(
  styleSource,
  /\.game-shell:fullscreen[\s\S]*aspect-ratio:\s*16\s*\/\s*9/,
  "fullscreen mode should retain the 16:9 game aspect ratio",
);
assert.match(indexSource, /width="960"[\s\S]*height="540"/, "canvas should use a 16:9 backing store");
assert.match(
  indexSource,
  /apple-mobile-web-app-capable" content="yes"/,
  "installed iOS mode should opt into standalone display",
);

const fullscreenGame = Object.create(sandbox.TestGame.prototype);
fullscreenGame.mobileFullscreenAttempted = false;
let fullscreenRequests = 0;
let fullscreenOptions;
gameShell.requestFullscreen = (options) => {
  fullscreenRequests += 1;
  fullscreenOptions = options;
  return { catch() {} };
};
fullscreenGame.requestMobileFullscreen({ pointerType: "mouse" });
assert.equal(fullscreenRequests, 0, "desktop mouse input should not force fullscreen");
fullscreenGame.requestMobileFullscreen({ pointerType: "touch" });
fullscreenGame.requestMobileFullscreen({ pointerType: "touch" });
assert.equal(fullscreenRequests, 1, "mobile fullscreen should be requested only once");
assert.equal(
  fullscreenOptions.navigationUI,
  "hide",
  "mobile fullscreen should ask the browser to hide navigation UI",
);

canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 960, height: 540 });
const viewportGame = Object.create(sandbox.TestGame.prototype);
const logicalOrigin = viewportGame.canvasPoint({ clientX: 130, clientY: 20 });
assert.equal(logicalOrigin.x, 0, "the left edge of the centered viewport should map to logical x=0");
assert.equal(logicalOrigin.y, 0, "the top edge of the canvas should map to logical y=0");
const logicalCenter = viewportGame.canvasPoint({ clientX: 490, clientY: 290 });
assert.equal(logicalCenter.x, 320, "the 16:9 canvas center should map to logical x=320");
assert.equal(logicalCenter.y, 240, "the 16:9 canvas center should map to logical y=240");
assert.equal(sandbox.TestData.VIEW_SCALE, 1.125, "the 640x480 stage should scale to 720x540");
assert.equal(sandbox.TestData.VIEW_OFFSET_X, 120, "the logical stage should have 120px side extensions");

const effectDimensions = {
  bonus: [490, 130],
  speed: [490, 130],
  best: [490, 130],
  pickup: [53, 50],
  hookHit: [40, 31],
  speedRing: [263, 222],
};
const effectRoot = path.join(__dirname, "..", "..", "public", "tools", "flying-ninja-cat", "assets", "effects");
for (const [kind, count] of Object.entries(sandbox.TestData.EFFECT_FRAME_COUNTS)) {
  const directory = sandbox.TestData.EFFECT_DIRECTORIES[kind];
  const frameDirectory = path.join(effectRoot, directory);
  const files = fs
    .readdirSync(frameDirectory)
    .filter((file) => file.endsWith(".png"))
    .sort((left, right) => Number.parseInt(left, 10) - Number.parseInt(right, 10));
  assert.deepEqual(
    files,
    Array.from({ length: count }, (_, index) => `${index + 1}.png`),
    `${kind} should retain every exported SWF frame in order`,
  );
  for (const file of files) {
    const png = fs.readFileSync(path.join(frameDirectory, file));
    assert.deepEqual(
      [png.readUInt32BE(16), png.readUInt32BE(20)],
      effectDimensions[kind],
      `${kind}/${file} should retain its exported canvas size`,
    );
  }
}

const catDimensions = {
  run: [125, 113],
  jump: [169, 169],
  shoot: [169, 169],
  rope: [119, 119],
  spin: [124, 124],
  die: [68, 89],
};
const catRoot = path.join(__dirname, "..", "..", "public", "tools", "flying-ninja-cat", "assets", "cat");
for (const [clip, count] of Object.entries(sandbox.TestData.CAT_CLIP_FRAME_COUNTS)) {
  const frameDirectory = path.join(catRoot, clip);
  const files = fs
    .readdirSync(frameDirectory)
    .filter((file) => file.endsWith(".png"))
    .sort((left, right) => Number.parseInt(left, 10) - Number.parseInt(right, 10));
  assert.deepEqual(
    files,
    Array.from({ length: count }, (_, index) => `${index + 1}.png`),
    `${clip} should use every frame from its original child timeline`,
  );
  for (const file of files) {
    const png = fs.readFileSync(path.join(frameDirectory, file));
    assert.deepEqual(
      [png.readUInt32BE(16), png.readUInt32BE(20)],
      catDimensions[clip],
      `${clip}/${file} should retain its direct-export canvas size`,
    );
  }
}

assert.equal(sandbox.NINJA_ITEM_PATTERNS.length, 159, "all ItemData.as templates should load");
for (const [mapSignature, ...layout] of sandbox.NINJA_ITEM_PATTERNS) {
  assert.equal(
    layout.length,
    mapSignature.length,
    `item layout should align with map ${Array.from(mapSignature).join(",")}`,
  );
  for (const code of layout.flat()) {
    assert.ok(Number.isInteger(code) && code >= 0, `coin code ${code} should be valid`);
  }
}
for (const pattern of [
  ...sandbox.TestData.SAFE_PATTERNS,
  ...sandbox.TestData.LEVEL_PATTERNS.flat(),
]) {
  assert.ok(
    sandbox.TestData.ITEM_PATTERNS_BY_MAP.has(Array.from(pattern).join(",")),
    `ItemData should cover map ${Array.from(pattern).join(",")}`,
  );
}
assert.ok(
  sandbox.TestData.LEVEL_PATTERNS[2].some(
    (pattern) => Array.from(pattern).join(",") === "2,2,1,1,3,1,1,1,2,2",
  ),
  "level three should retain the MapData.as pattern omitted by the old port",
);

const game = Object.create(sandbox.TestGame.prototype);
const audioEvents = [];
game.sound = {
  play(name, options) { audioEvents.push(`play:${name}:${Boolean(options?.loop)}`); },
  stop(name) { audioEvents.push(`stop:${name}`); },
  music(name) { audioEvents.push(`music:${name}`); },
  stopMusic() { audioEvents.push("music:stop"); },
};
game.setStatus = () => {};

game.startGame();
assert.equal(game.state, "playing", "start should enter play without a Ready/Go transition");
assert.equal(game.blocks.length, 7, "the 16:9 view should preload one additional safe roof");
assert.equal(game.blocks.at(-1).x, 900, "the final initial roof should cover the wider lookahead");
assert.equal(game.player.status, "run", "the cat should run immediately after starting");
assert.equal(game.player.clip, "run", "run should select the original six-frame child timeline");
assert.equal(game.catFrame(), 1, "a newly selected child timeline should begin on frame one");
game.player.animationTick = 5;
assert.equal(game.catFrame(), 6, "run should reach its sixth frame at the SWF frame rate");
game.player.animationTick = 6;
assert.equal(game.catFrame(), 1, "run should loop after all six original frames");
game.player.clip = "spin";
game.player.animationTick = 14;
assert.equal(game.catFrame(), 15, "spin should retain all fifteen original child frames");
game.player.animationTick = 15;
assert.equal(game.catFrame(), 1, "spin should loop on the next 30 FPS tick");
game.player.clip = "die";
game.player.animationTick = 3;
assert.equal(game.catFrame(), 4, "die should retain its fourth child frame");
assert.deepEqual(
  audioEvents,
  ["stop:run", "stop:spin", "music:gameMusic", "play:run:true"],
  "start should restore the original looping run channel",
);
audioEvents.length = 0;
game.startJump();
assert.equal(game.player.clip, "jump", "jump should switch the stopped parent label");
assert.equal(game.player.animationTick, 0, "changing labels should restart the child timeline");
assert.deepEqual(
  audioEvents,
  ["stop:run", "play:jump:false"],
  "jump should stop the original looping run channel",
);

game.score = 0;
game.bestScore = 100;
game.effects = [];
game.addScore(5);
assert.equal(game.score, 5, "coin points should still update the score");
assert.deepEqual(game.effects, [], "ordinary coin points should not create floating score text");

game.choosePattern = () => [2, 2, 1, 2, 2];
game.random = () => 0;
game.mapQueue = [];
game.goldGroups = new Map();
game.groupSequence = 0;
game.enqueuePattern();
assert.deepEqual(
  game.mapQueue.map((entry) => Array.from(entry.codes)),
  [
    [132, 133, 134, 135],
    [27, 30, 132, 33],
    [20, 21, 22, 23],
    [24, 29, 34, 135],
    [132, 133, 134, 135],
  ],
  "map should use the first exact ItemData.as layout when random() is zero",
);
assert.equal(game.goldGroups.get(1), 10, "bonus should count only sub-100 gold codes");

game.blocks = [];
game.items = [];
game.count = 0;
game.level = 0;
game.spawnBlock({ type: 1, codes: [20, 123], groupId: 9 }, 750);
assert.deepEqual(
  game.items.map(({ x, y, kind }) => ({ x, y, kind })),
  [
    { x: 691.5, y: 225, kind: "gold" },
    { x: 804, y: 225, kind: "silver" },
  ],
  "coin codes should use the original 4-column 37.5×37px grid",
);

const finishGame = Object.create(sandbox.TestGame.prototype);
finishGame.sound = { play() {} };
finishGame.level = 5;
finishGame.speed = 25;
finishGame.count = 300;
finishGame.mapQueue = [];
finishGame.groupSequence = 20;
finishGame.levelUp();
assert.equal(finishGame.level, 6, "level six should enqueue the finish run");
assert.deepEqual(
  Array.from(finishGame.mapQueue, (entry) => entry.type),
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 2],
  "finish run should retain the full SetGame.as sequence",
);
assert.ok(
  finishGame.mapQueue.every((entry) => entry.codes.length === 0),
  "the original finish run should not invent roof coins",
);

const gateGame = Object.create(sandbox.TestGame.prototype);
gateGame.state = "playing";
gateGame.blocks = [];
gateGame.player = { x: 200 };
gateGame.speed = 25;
gateGame.sound = { stopMusic() {}, stop() {}, play() {} };
gateGame.saveBestScore = () => {};
gateGame.setStatus = () => {};
gateGame.spawnBlock({ type: 4, codes: [], groupId: 1 }, 750);
assert.equal(gateGame.state, "finishing", "finish gate should start the fade transition");
assert.equal(gateGame.blocks[0].type, 4, "finish gate artwork should remain visible during fade-in");
gateGame.update();
assert.equal(gateGame.player.x, 230, "cat should run 30px per frame into the finish transition");

const effectGame = Object.create(sandbox.TestGame.prototype);
const playedEffects = [];
effectGame.sound = { play(name) { playedEffects.push(name); } };
effectGame.effects = [];
effectGame.headState = "sleep";
effectGame.headTimer = 0;
effectGame.triggerGameEffect("bonus");
assert.equal(effectGame.headState, "eyes", "bonus should use the original eyes expression");
assert.equal(effectGame.effects[0].kind, "bonus", "bonus should use the exported sprite sequence");
effectGame.triggerGameEffect("speed");
assert.equal(effectGame.headState, "surprise", "speed-up should use the surprise expression");
assert.equal(effectGame.headTimer, 150, "temporary head expressions should last five seconds");
assert.deepEqual(playedEffects, ["bonus", "speed"], "restored effects should keep original audio cues");
effectGame.hookHitFrame = -1;
effectGame.updateEffects();
assert.equal(effectGame.effects[0].frame, 0, "new sprite effects should begin at frame one");
assert.equal(effectGame.hookHitFrame, 0, "hook hit animation should begin at frame one");

const worldGame = Object.create(sandbox.TestGame.prototype);
worldGame.blocks = [];
worldGame.items = [];
worldGame.mapQueue = [];
worldGame.nextWay = 0;
worldGame.speed = 20;
worldGame.cloudX = 0;
worldGame.moveWorld();
assert.equal(worldGame.cloudX, -5, "clouds should move at one quarter of world speed");
worldGame.cloudX = -831;
worldGame.speed = 8;
worldGame.moveWorld();
assert.equal(worldGame.cloudX, -1, "clouds should wrap at the original 832px seam");

const preloadGame = Object.create(sandbox.TestGame.prototype);
preloadGame.blocks = [];
preloadGame.items = [];
preloadGame.mapQueue = [{ type: 2, codes: [], groupId: 1 }];
preloadGame.nextWay = 135;
preloadGame.speed = 15;
preloadGame.cloudX = 0;
preloadGame.count = 0;
preloadGame.level = 0;
preloadGame.moveWorld();
assert.equal(preloadGame.blocks[0].x, 900, "new roofs should spawn one full block beyond the old boundary");
assert.ok(
  preloadGame.blocks[0].x - 127.5 > sandbox.TestData.WORLD_VISIBLE_RIGHT,
  "a new roof texture should be fully outside the 16:9 canvas before scrolling into view",
);

const spinFallGame = Object.create(sandbox.TestGame.prototype);
spinFallGame.player = {
  x: 200,
  y: 200,
  dy: 0,
  status: "spin",
  clip: "spin",
  animationTick: 7,
  rope: null,
};
spinFallGame.updateAirborne(3.5 * 1.5);
assert.equal(spinFallGame.player.status, "jump", "falling spin should restore jump input state");
assert.equal(
  spinFallGame.player.clip,
  "spin",
  "changing gameplay status must not replace the still-playing spin child timeline",
);

assert.ok(
  Math.abs(sandbox.TestData.GROUND_MARKER_TOP - 353.3) < 1e-9,
  "ground marker top should retain the block y and SWF twip offset",
);
assert.ok(
  Math.abs(sandbox.TestData.GROUND_MARKER_BOTTOM - 403.3) < 1e-9,
  "ground marker should retain its original 50px depth",
);

function makeFallingGroundGame(y, dy = -5) {
  const fallingGame = Object.create(sandbox.TestGame.prototype);
  fallingGame.blocks = [{ type: 2, x: 200 }];
  fallingGame.player = {
    x: 200,
    y,
    dy,
    status: "jump",
    clip: "jump",
    animationTick: 0,
    rotation: 0,
    rope: null,
  };
  fallingGame.sound = { play() {}, stop() {} };
  fallingGame.setStatus = () => {};
  return fallingGame;
}

const markerLandingGame = makeFallingGroundGame(397);
markerLandingGame.startShoot();
markerLandingGame.updateAirborne(0);
assert.equal(
  markerLandingGame.player.status,
  "run",
  "a falling shot still lands while the player point is inside ground_pos",
);
assert.equal(markerLandingGame.player.y, 365, "a valid ground_pos hit should restore ground y");

const pitShotGame = makeFallingGroundGame(415);
pitShotGame.startShoot();
pitShotGame.updateAirborne(0);
assert.equal(
  pitShotGame.player.status,
  "shoot",
  "shooting below ground_pos must not pull a falling cat back onto a later roof",
);
assert.equal(pitShotGame.player.y, 420, "a missed ground marker should keep falling");
assert.ok(pitShotGame.player.rope, "the shot itself should remain available after the ground miss");

const edgeMissGame = makeFallingGroundGame(380);
edgeMissGame.player.x = 300.01;
edgeMissGame.updateAirborne(0);
assert.equal(
  edgeMissGame.player.status,
  "jump",
  "a falling point just beyond the original 100px ground edge should miss",
);

const resultGame = Object.create(sandbox.TestGame.prototype);
resultGame.state = "playing";
resultGame.player = {
  x: 200,
  y: 300,
  dy: 0,
  status: "run",
  clip: "run",
  animationTick: 3,
  rotation: 0,
  rope: {},
  holding: true,
};
resultGame.score = 321;
resultGame.blocks = [{ type: 2 }, { type: 3 }];
resultGame.effects = [{ kind: "best", frame: 3 }];
resultGame.hookHitFrame = 2;
resultGame.sound = { stopMusic() {}, stop() {}, play() {} };
resultGame.saveBestScore = () => {};
resultGame.setStatus = () => {};
resultGame.gameOver();
assert.equal(resultGame.headState, "smile", "game over should use the original smile expression");
assert.equal(resultGame.player.clip, "die", "game over should select the four-frame die child");
assert.equal(resultGame.player.animationTick, 0, "die should begin on its first child frame");
assert.ok(resultGame.blocks.every((block) => block.failed), "game over should swap all roofs to failed frames");
assert.equal(resultGame.effects.length, 0, "timeline effects should not freeze behind the result panel");
assert.equal(resultGame.hookHitFrame, null, "hook effects should stop with gameplay");
for (let tick = 0; tick < sandbox.TestData.DEATH_DELAY_FRAMES; tick += 1) {
  resultGame.update();
}
assert.equal(resultGame.player.y, 300, "death should remain still for the original 0.3 seconds");
assert.equal(resultGame.state, "dying", "the tween should not finish during the delay");
resultGame.update();
assert.ok(
  Math.abs(resultGame.player.y - (300 + 250 * (1 / 15) ** 2)) < 1e-9,
  "the first falling frame should use Regular.easeIn rather than invented acceleration",
);
for (let tick = 1; tick < sandbox.TestData.DEATH_TWEEN_FRAMES; tick += 1) {
  resultGame.update();
}
assert.equal(resultGame.player.y, 550, "death tween should move exactly 250px");
assert.equal(resultGame.state, "gameover", "the result should appear after 0.3s + 0.5s");

game.player = {
  x: 200,
  y: 240,
  status: "jump",
  clip: "jump",
  animationTick: 0,
  rotation: 0,
};
game.score = 0;
game.bestScore = 100;
game.items = [{ x: 180.5, y: 206, kind: "silver", bob: 0 }];
game.collectItems();
assert.equal(game.items.length, 0, "coin should hit the recovered SWF item_pos anchor");
game.items = [{ x: 225.29, y: 256.29, kind: "silver", bob: 0 }];
game.collectItems();
assert.equal(
  game.items.length,
  0,
  "overlapping MovieClip corners should hit even outside the old radius-34 circle",
);
game.items = [{ x: 225.31, y: 256.31, kind: "silver", bob: 0 }];
game.collectItems();
assert.equal(game.items.length, 1, "a coin 0.01px beyond both MovieClip bounds should miss");

game.player = { x: 200, y: 365, status: "jump", rope: null };
game.startShoot();
assert.equal(game.player.clip, "shoot", "shoot should preserve its stopped parent composition");
assert.equal(game.player.animationTick, 0, "shoot should restart on its only frame");
assert.equal(game.player.rope.x, 212.5, "rope should start at the SWF ropepos x");
assert.equal(game.player.rope.y, 310.6, "rope should start at the SWF ropepos y");

game.blocks = [];
game.player.status = "shoot";
game.player.rope = { mode: "shoot", x: 300, y: 130 };
game.updateRopeShot();
assert.equal(game.player.status, "shoot", "rope must not attach in empty air");
assert.equal(game.player.rope.mode, "shoot", "empty-air rope should keep flying");

game.blocks = Array.from({ length: 6 }, (_, index) => ({
  type: 2,
  x: index * 150,
}));
for (let x = 0; x <= 640; x += 20) {
  for (let y = 0; y <= 480; y += 20) {
    assert.equal(
      game.ropeHitsTarget(x, y),
      false,
      `ordinary level-zero roofs must not catch at ${x},${y}`,
    );
  }
}

game.blocks = [{ type: 3, x: 345 }];
game.player.status = "shoot";
game.player.rope = { mode: "shoot", x: 300, y: 130 };
game.updateRopeShot();
assert.equal(game.player.status, "rope", "rope should attach inside a tower target");
assert.equal(game.player.rope.mode, "caught", "tower hit should catch the rope");
assert.equal(game.player.clip, "rope", "catching should select the original rope child");
assert.ok(
  Math.abs(game.player.rotation - (-45 * Math.PI) / 180) < 1e-12,
  "rope should begin with the -45 degree placement from id_gogoon",
);

function makeSwingGame(player) {
  const swingGame = Object.create(sandbox.TestGame.prototype);
  swingGame.state = "playing";
  swingGame.speed = 0;
  swingGame.player = player;
  swingGame.sound = { play() {}, stop() {}, stopMusic() {} };
  swingGame.setStatus = () => {};
  return swingGame;
}

const angleGame = makeSwingGame({
  x: 200,
  y: 100,
  dy: 0,
  status: "rope",
  clip: "rope",
  animationTick: 0,
  rotation: 0,
  holding: false,
  rope: { mode: "caught", x: 300, y: 125 },
});
const expectedRopeAngle =
  Math.atan2(125 - (100 - 55.95), 300 - (200 + 14.3)) + (70 * Math.PI) / 180;
angleGame.updateRopeSwing();
assert.ok(
  Math.abs(angleGame.player.rotation - expectedRopeAngle) < 1e-12,
  "rope angle should use the body registration point, +70 degrees, and the pre-motion y",
);
assert.ok(angleGame.player.rotation > 0.4, "rope angle should no longer use the H5 clamp");
assert.equal(angleGame.player.y, 103.5, "released rope gravity should apply after angle calculation");

const heightReleaseGame = makeSwingGame({
  x: 200,
  y: 174,
  dy: 15,
  status: "rope",
  clip: "rope",
  animationTick: 0,
  rotation: 0,
  holding: true,
  rope: { mode: "caught", x: 300, y: 125 },
});
heightReleaseGame.updateRopeSwing();
assert.equal(heightReleaseGame.player.status, "spin", "holding above rope y+50 should release");
assert.equal(
  heightReleaseGame.player.y,
  219,
  "height release should set spin dy=45 before the same frame updates y",
);

const rotationReleaseGame = makeSwingGame({
  x: 200,
  y: 231,
  dy: 0,
  status: "rope",
  clip: "rope",
  animationTick: 0,
  rotation: 0,
  holding: false,
  rope: { mode: "caught", x: 120, y: 125 },
});
rotationReleaseGame.updateRopeSwing();
assert.equal(
  rotationReleaseGame.player.status,
  "spin",
  "body rotation below -70 degrees should restore the missing release branch",
);
assert.equal(
  rotationReleaseGame.player.y,
  234.5,
  "rotation release should occur after the current rope dy updates y",
);

const deathOrderGame = makeSwingGame({
  x: 200,
  y: 550,
  dy: 30,
  status: "rope",
  clip: "rope",
  animationTick: 0,
  rotation: 0,
  holding: false,
  rope: { mode: "caught", x: 300, y: 125 },
});
let ropeDeaths = 0;
deathOrderGame.gameOver = () => {
  ropeDeaths += 1;
};
deathOrderGame.updateRopeSwing();
assert.equal(ropeDeaths, 0, "y=550 should survive the original strict frame-start check");
const ropeXAfterSurvivingFrame = deathOrderGame.player.rope.x;
deathOrderGame.updateRopeSwing();
assert.equal(ropeDeaths, 1, "the next frame should die after the prior frame crossed 550");
assert.equal(
  deathOrderGame.player.rope.x,
  ropeXAfterSurvivingFrame,
  "frame-start death should happen before the rope moves",
);

game.assets = { hooks: [{}, {}] };
game.player = {
  x: 200,
  y: 365,
  rope: { mode: "caught", x: 300, y: 125 },
};
drawCalls.length = 0;
rotations.length = 0;
game.drawRope();
const hookDraw = drawCalls.at(-1);
assert.equal(hookDraw[1], -32.75, "hook should use the SWF registration point x");
assert.equal(hookDraw[2], -15.5, "hook should use the SWF registration point y");
assert.ok(
  Math.abs(rotations.at(-1) - (-80 * Math.PI) / 180) < 1e-12,
  "caught hook should stay at the original -80 degree angle",
);

game.assets = { cat: { run: [{}], rope: [{}], die: [{}] } };
game.player = { x: 200, y: 365, clip: "run", animationTick: 0, rotation: 0 };
drawCalls.length = 0;
translations.length = 0;
game.drawCat();
assert.deepEqual(
  translations,
  [
    [200, 365],
    [-55.75, -98.15],
  ],
  "run should use the child-85 placement from id_gogoon",
);
assert.deepEqual(
  drawCalls[0].slice(1),
  [-10.7, 1],
  "run should draw around the direct child registration point",
);

game.player = { x: 200, y: 365, clip: "rope", animationTick: 0, rotation: 0.75 };
drawCalls.length = 0;
translations.length = 0;
rotations.length = 0;
game.drawCat();
assert.deepEqual(
  translations,
  [
    [200, 365],
    [14.3, -55.95],
  ],
  "rope art should rotate around the actual body registration point",
);
assert.equal(rotations[0], 0.75, "only the rope body child should receive swing rotation");
assert.deepEqual(drawCalls[0].slice(1), [-86, -34], "rope should use child-107 bounds");

game.player = { x: 200, y: 365, clip: "die", animationTick: 0, rotation: 0 };
drawCalls.length = 0;
scales.length = 0;
game.drawCat();
assert.deepEqual(scales[0], [1.199997, 1.199997], "die should retain the parent 120% scale");
assert.deepEqual(drawCalls[0].slice(1), [-36.3, -44.65], "die should use child-121 bounds");

game.assets = { progressTrack: {}, progressFace: {} };
game.level = 2;
game.count = 75;
drawCalls.length = 0;
game.drawProgress();
assert.equal(drawCalls.length, 2, "progress should draw the original track and face layers");
assert.deepEqual(
  drawCalls.map((call) => [call[1], call[2]]),
  [
    [54, 448],
    [274, 447],
  ],
  "progress face should advance 90px per level plus the current-level fraction",
);

game.level = 0;
game.count = 0;
drawCalls.length = 0;
game.drawProgress();
assert.equal(drawCalls[1][1], 49, "progress face should start at the original left edge");

game.assets = { bestPaw: {}, coins: [{}], gameOver: {} };
game.bestScore = 123;
textCalls.length = 0;
game.drawBestScore();
assert.equal(textCalls[0][1], 191.5, "best score should be centered in the paw slot");
assert.equal(textCalls[0][2], 237, "best score should be vertically centered in the paw slot");

game.score = 0;
textCalls.length = 0;
drawCalls.length = 0;
game.drawScore();
assert.equal(drawCalls[0][1], 8, "HUD coin should use the original inset");
assert.equal(textCalls[0][1], 58, "HUD score should not overlap the coin");

drawCalls.length = 0;
fillRects.length = 0;
transforms.length = 0;
game.drawGameOver();
assert.equal(drawCalls.length, 2, "result screen should only draw its main panel and replay button");
assert.deepEqual(transforms[0], [1, 0, 0, 1, 0, 0], "result dimmer should switch to canvas coordinates");
assert.deepEqual(fillRects[0], [0, 0, 960, 540], "result dimmer should cover the full 16:9 canvas");
assert.deepEqual(
  drawCalls.map((call) => [call[1], call[2], call[3], call[4]]),
  [
    [0, 148, 295, 181],
    [91, 331, 113, 46],
  ],
  "result screen should omit the top artwork and submit/rank buttons",
);

console.log("rope regression tests: PASS");
