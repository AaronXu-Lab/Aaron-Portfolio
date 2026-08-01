const WIDTH = 640;
const HEIGHT = 480;
const FPS = 30;
const STEP_MS = 1000 / FPS;
const BUILD_VERSION = "20260801-1";
const ASSET_LOAD_CONCURRENCY = 4;

const CAT_X = 200;
const GROUND_Y = 365;
const BLOCK_WIDTH = 150;
const BLOCK_IMAGE_X = 127.5;
const BLOCK_IMAGE_Y = 30;
const GROUND_HALF_WIDTH = 100;
const ROPE_ORIGIN_X = 12.5;
const ROPE_ORIGIN_Y = -54.4;
const ROPE_BODY_ORIGIN_X = 14.3;
const ROPE_BODY_ORIGIN_Y = -55.95;
const ROPE_BODY_ANGLE_OFFSET = (70 * Math.PI) / 180;
const ROPE_RELEASE_ANGLE = (-70 * Math.PI) / 180;
const INITIAL_ROPE_BODY_ANGLE = (-45 * Math.PI) / 180;
const HOOK_ORIGIN_X = 32.75;
const HOOK_ORIGIN_Y = 15.5;
const CAUGHT_HOOK_ANGLE = (-80 * Math.PI) / 180;

// Direct exports of the child timelines placed by id_gogoon. Jump and shoot
// remain parent-space stills because those labels combine/persist siblings.
const CAT_CLIP_FRAME_COUNTS = Object.freeze({
  run: 6,
  jump: 1,
  shoot: 1,
  rope: 1,
  spin: 15,
  die: 4,
});

// Placement matrices and registration offsets recovered from sprites
// 122, 85, 107, 111, and 121. Values are pixels (SWF twips / 20).
const CAT_CLIP_DRAW = Object.freeze({
  run: { x: -55.75, y: -98.15, originX: 10.7, originY: -1, scale: 1 },
  jump: { x: 0, y: 0, originX: 97.5, originY: 132, scale: 1 },
  shoot: { x: 0, y: 0, originX: 97.5, originY: 132, scale: 1 },
  rope: { x: 14.3, y: -55.95, originX: 86, originY: 34, scale: 1, rotate: true },
  spin: { x: -2.95, y: -42.55, originX: 62.1, originY: 62.15, scale: 1 },
  die: { x: 2.6, y: -43.2, originX: 36.3, originY: 44.65, scale: 1.199997 },
});

// body.item_pos is a hidden 50x60 MovieClip. Its transform differs by the
// body child used at each id_gogoon label.
const ITEM_MARKER_HALF_WIDTH = 25;
const ITEM_MARKER_HALF_HEIGHT = 30;
const ITEM_MARKER_TRANSFORMS = Object.freeze({
  run: { x: -19.25, y: -34.7 },
  jump: { x: -19.5, y: -34.05 },
  shoot: { x: -19.5, y: -34.05 },
  spin: { x: -8.45, y: -40.1 },
  rope: {
    bodyX: ROPE_BODY_ORIGIN_X,
    bodyY: ROPE_BODY_ORIGIN_Y,
    x: -24,
    y: 30.5,
    rotate: true,
  },
});

// Frame-one bounds of id_item, including the child placement in sprite 136.
const ITEM_MOVIE_BOUNDS = Object.freeze({
  gold: { left: -20.35, right: 20.4, top: -19.85, bottom: 20.9 },
  silver: { left: -19.8, right: 21.1, top: -20.35, bottom: 19.85 },
});

const DEATH_DELAY_FRAMES = Math.round(0.3 * FPS);
const DEATH_TWEEN_FRAMES = Math.round(0.5 * FPS);
const DEATH_DISTANCE = 250;

const HUD_COIN_X = 8;
const HUD_COIN_Y = 7;
const HUD_COIN_WIDTH = 42;
const HUD_COIN_HEIGHT = 40;
const HUD_SCORE_X = 58;
const HUD_SCORE_Y = 23;
const BEST_PAW_X = 105;
const BEST_PAW_Y = 130;
const BEST_SCORE_X = BEST_PAW_X + 86.5;
const BEST_SCORE_Y = BEST_PAW_Y + 107;
const PROGRESS_X = 49;
const PROGRESS_Y = 447;
const PROGRESS_TRACK_X = 5;
const PROGRESS_TRACK_Y = 1;
const PROGRESS_LEVEL_WIDTH = 90;
const GAME_OVER_X = 194;
const GAME_OVER_Y = 42;
const HEAD_X = 239.05;
const HEAD_Y = 130;
const CLOUD_Y = 318.05;
const CLOUD_WRAP_WIDTH = 832;
const HOOK_HIT_X = 13.6;
const HOOK_HIT_Y = 3.9;
const HOOK_HIT_ROTATION = (110 * Math.PI) / 180;
const SPEED_RING_X = -143.5;
const SPEED_RING_Y = -141;

const EFFECT_FRAME_COUNTS = Object.freeze({
  bonus: 27,
  speed: 29,
  best: 27,
  pickup: 9,
  hookHit: 5,
  speedRing: 9,
});

const EFFECT_DIRECTORIES = Object.freeze({
  bonus: "bonus",
  speed: "speed",
  best: "best",
  pickup: "pickup",
  hookHit: "hook-hit",
  speedRing: "speed-ring",
});

// Exported effect canvases preserve the SWF union bounds. Bonus and speed
// begin at their registration point; Best spans -275..215px and -200..-70px.
const EFFECT_DRAW_ORIGINS = Object.freeze({
  bonus: { x: 191, y: 237 },
  speed: { x: 88, y: 363 },
  best: { x: 199, y: 128 },
});

const FADE_ALPHA = Object.freeze([
  0, 17, 36, 54, 72, 91, 109, 127, 145, 164, 182, 200, 219, 237, 255,
  255, 255, 255, 255, 255, 238, 221, 204, 187, 170, 153, 136, 118, 101, 84,
  67, 50, 33, 16, 0,
]);

// Original rope_pos trapezoid on block frame 3, converted from SWF twips.
const ROPE_TARGET_Y = 135;
const ROPE_TARGET_POINTS = [
  { x: -75.3, y: -50 },
  { x: 100, y: -50 },
  { x: 62.65, y: 0 },
  { x: -110, y: 0 },
];

const GRAVITY = 3.5;
const JUMP_SPEED = 30;
const ROPE_SPEED = 40;
const LEVEL_LIMITS = [50, 100, 150, 200, 250, 300, 1000];
const SAFE_CHANCE = [0.75, 0.5, 0.4, 0.1, 0.3, 0];

const SAFE_PATTERNS = [
  [2, 2, 2],
  [2, 2, 2, 2, 2],
];
const FINISH_PATTERN = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 2, 2, 2, 2, 2, 2];

// Directly transcribed from MapData.as. 1 = gap, 2 = roof, 3 = tall
// rope tower, 4 = finish.
const LEVEL_PATTERNS = [
  [[2, 2, 1, 2, 2]],
  [
    [2, 2, 1, 1, 2, 2],
    [2, 2, 1, 3, 1, 2, 2],
    [2, 2, 2, 1, 1, 3, 1, 2, 2, 2],
    [2, 2, 2, 1, 3, 1, 1, 2, 2, 2],
  ],
  [
    [2, 2, 1, 1, 2, 2],
    [2, 2, 1, 1, 3, 1, 1, 2, 2, 2],
    [2, 2, 1, 1, 1, 3, 1, 1, 2, 2],
    [2, 2, 1, 1, 3, 1, 1, 1, 2, 2],
    [2, 2, 1, 3, 1, 3, 1, 2, 2, 2],
  ],
  [
    [2, 2, 1, 1, 2, 2],
    [2, 2, 1, 1, 1, 3, 1, 1, 2, 2],
    [2, 2, 1, 1, 3, 1, 1, 1, 2, 2],
    [2, 2, 1, 3, 1, 3, 1, 2, 2, 2],
    [2, 1, 3, 1, 3, 1, 3, 1, 2, 2],
  ],
  [
    [2, 1, 3, 1, 3, 1, 3, 1, 2, 2],
    [2, 2, 2, 2, 1, 1, 1, 2, 2, 2],
    [2, 1, 3, 1, 3, 1, 3, 1, 3, 1],
    [1, 3, 1, 3, 1, 3, 1, 3, 1, 3],
    [2, 2, 1, 3, 1, 3, 1, 1, 2, 2],
  ],
  [
    [2, 2, 2, 2, 1, 1, 1, 2, 2, 2],
    [2, 1, 3, 1, 3, 1, 3, 1, 3, 1],
    [1, 3, 1, 3, 1, 3, 1, 3, 1, 3],
    [1, 3, 1, 3, 1, 1, 3, 1, 3, 1],
  ],
];

const ITEM_PATTERNS_BY_MAP = new Map();
for (const [mapSignature, ...layout] of globalThis.NINJA_ITEM_PATTERNS || []) {
  const key = mapSignature.join(",");
  if (!ITEM_PATTERNS_BY_MAP.has(key)) ITEM_PATTERNS_BY_MAP.set(key, []);
  ITEM_PATTERNS_BY_MAP.get(key).push(layout);
}

const IMAGE_MANIFEST = {
  title: "assets/backgrounds/title.jpg",
  game: "assets/backgrounds/game-base.png",
  clouds: "assets/backgrounds/clouds.png",
  ending: "assets/backgrounds/ending.jpg",
  headSleep: "assets/head/sleep.png",
  headSmile: "assets/head/smile.png",
  headSurprise: "assets/head/surprise.png",
  headEyes: "assets/head/eyes.png",
  block2Failed: "assets/blocks/2-failed.png",
  block3Failed: "assets/blocks/3-failed.png",
  bestPaw: "assets/ui/best-paw.png",
  fish: "assets/ui/fish.png",
  fishHover: "assets/ui/fish-hover.png",
  startLabel: "assets/ui/start-label.png",
  helpLabel: "assets/ui/help-label.png",
  replayLabel: "assets/ui/replay-label.png",
  progressTrack: "assets/ui/progress-track.png?v=20260731-13",
  progressFace: "assets/ui/progress-face.png?v=20260731-13",
  gameOver: "assets/ui/game-over.png",
  mouseUp: "assets/ui/mouse-up.png",
  mouseDown: "assets/ui/mouse-down.png",
};

const AUDIO_MANIFEST = {
  bonus: "assets/audio/1_snd_coinbonus.mp3",
  fade: "assets/audio/3_snd_fadeinout.mp3",
  gold: "assets/audio/4_snd_goldcoin.mp3",
  land: "assets/audio/5_snd_jumpdown.mp3",
  run: "assets/audio/6_snd_run.mp3",
  shoot: "assets/audio/7_snd_shoot.mp3",
  speed: "assets/audio/8_snd_speedup.mp3",
  finish: "assets/audio/9_snd_allclear.mp3",
  gameMusic: "assets/audio/10_snd_gamebg.mp3",
  titleMusic: "assets/audio/11_snd_titlebg.mp3",
  gameOver: "assets/audio/12_snd_gameover.mp3",
  ropeCatch: "assets/audio/13_snd_ropecatch.mp3",
  silver: "assets/audio/15_snd_silvercoin.mp3",
  spin: "assets/audio/16_snd_spin.mp3",
  jump: "assets/audio/17_snd_ropeup.mp3",
  best: "assets/audio/18_snd_best.mp3",
  button: "assets/audio/19_snd_btn.mp3",
};

const canvas = document.querySelector("#game");
const context = canvas.getContext("2d", { alpha: false });
const statusNode = document.querySelector("#status");
context.imageSmoothingEnabled = true;
canvas.dataset.buildVersion = BUILD_VERSION;

function pointIn(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function rotatedRectBounds(centerX, centerY, halfWidth, halfHeight, angle = 0) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const extentX = Math.abs(cosine) * halfWidth + Math.abs(sine) * halfHeight;
  const extentY = Math.abs(sine) * halfWidth + Math.abs(cosine) * halfHeight;
  return {
    left: centerX - extentX,
    right: centerX + extentX,
    top: centerY - extentY,
    bottom: centerY + extentY,
  };
}

function boundsIntersect(left, right) {
  return !(
    left.right < right.left ||
    left.left > right.right ||
    left.bottom < right.top ||
    left.top > right.bottom
  );
}

function padScore(value, digits = 7) {
  return String(Math.max(0, Math.floor(value))).padStart(digits, "0");
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法载入素材：${source}`));
    image.src = source;
  });
}

async function loadAssets(onProgress) {
  const flatManifest = [
    ...Object.entries(IMAGE_MANIFEST),
    ...Array.from({ length: 4 }, (_, index) => [
      `block${index + 1}`,
      `assets/blocks/${index + 1}.png`,
    ]),
    ...Object.entries(CAT_CLIP_FRAME_COUNTS).flatMap(([clip, count]) =>
      Array.from({ length: count }, (_, index) => [
        `cat-${clip}-${index + 1}`,
        `assets/cat/${clip}/${index + 1}.png?v=${BUILD_VERSION}`,
      ]),
    ),
    ...Array.from({ length: 2 }, (_, index) => [
      `coin${index + 1}`,
      `assets/coins/${index + 1}.png`,
    ]),
    ...Array.from({ length: 2 }, (_, index) => [
      `hook${index + 1}`,
      `assets/hook/${index + 1}.png`,
    ]),
    ...Object.entries(EFFECT_FRAME_COUNTS).flatMap(([name, count]) =>
      Array.from({ length: count }, (_, index) => [
        `effect-${name}-${index + 1}`,
        `assets/effects/${EFFECT_DIRECTORIES[name]}/${index + 1}.png`,
      ]),
    ),
    ...Array.from({ length: 6 }, (_, index) => [
      `help${index + 1}`,
      `assets/ui/help-${index + 1}.png`,
    ]),
  ];

  const loaded = {};
  let completed = 0;
  let cursor = 0;
  async function loadNext() {
    while (cursor < flatManifest.length) {
      const [key, source] = flatManifest[cursor];
      cursor += 1;
      loaded[key] = await loadImage(source);
      completed += 1;
      onProgress(completed / flatManifest.length);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(ASSET_LOAD_CONCURRENCY, flatManifest.length) },
      () => loadNext(),
    ),
  );

  loaded.blocks = Array.from({ length: 4 }, (_, index) => loaded[`block${index + 1}`]);
  loaded.cat = Object.fromEntries(
    Object.entries(CAT_CLIP_FRAME_COUNTS).map(([clip, count]) => [
      clip,
      Array.from({ length: count }, (_, index) => loaded[`cat-${clip}-${index + 1}`]),
    ]),
  );
  loaded.coins = Array.from({ length: 2 }, (_, index) => loaded[`coin${index + 1}`]);
  loaded.hooks = Array.from({ length: 2 }, (_, index) => loaded[`hook${index + 1}`]);
  loaded.help = Array.from({ length: 6 }, (_, index) => loaded[`help${index + 1}`]);
  loaded.head = {
    sleep: loaded.headSleep,
    smile: loaded.headSmile,
    surprise: loaded.headSurprise,
    eyes: loaded.headEyes,
  };
  loaded.failedBlocks = {
    2: loaded.block2Failed,
    3: loaded.block3Failed,
  };
  loaded.effects = Object.fromEntries(
    Object.entries(EFFECT_FRAME_COUNTS).map(([name, count]) => [
      name,
      Array.from({ length: count }, (_, index) => loaded[`effect-${name}-${index + 1}`]),
    ]),
  );
  return loaded;
}

class SoundBank {
  constructor(manifest) {
    this.sounds = new Map();
    this.loops = new Map();
    this.currentMusic = null;

    for (const [name, source] of Object.entries(manifest)) {
      const audio = new Audio(source);
      audio.preload = "auto";
      audio.volume = name.endsWith("Music") ? 0.34 : 0.62;
      this.sounds.set(name, audio);
    }
  }

  play(name, { loop = false, volume } = {}) {
    const source = this.sounds.get(name);
    if (!source) return;
    if (loop) this.stop(name);

    const audio = source.cloneNode();
    audio.loop = loop;
    audio.volume = volume ?? source.volume;
    audio.play().catch(() => {});
    if (loop) this.loops.set(name, audio);
    return audio;
  }

  stop(name) {
    const audio = this.loops.get(name);
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    this.loops.delete(name);
  }

  music(name) {
    if (this.currentMusic?.name === name) return;
    this.stopMusic();

    const source = this.sounds.get(name);
    if (!source) return;
    source.loop = true;
    source.currentTime = 0;
    source.play().catch(() => {});
    this.currentMusic = { name, audio: source };
  }

  stopMusic() {
    if (!this.currentMusic) return;
    this.currentMusic.audio.pause();
    this.currentMusic.audio.currentTime = 0;
    this.currentMusic = null;
  }
}

class FlyingNinjaCat {
  constructor(assets) {
    this.assets = assets;
    this.sound = new SoundBank(AUDIO_MANIFEST);
    this.state = "title";
    this.helpPage = 0;
    this.helpReturn = "title";
    this.hover = "";
    this.pointer = { x: 0, y: 0, down: false };
    this.spaceDown = false;
    this.accumulator = 0;
    this.previousTime = performance.now();
    this.bestScore = this.readBestScore();
    this.seed = (Date.now() >>> 0) || 0x12345678;
    this.orientationQuery = window.matchMedia("(orientation: landscape)");
    this.isLandscape = this.orientationQuery.matches;
    this.bindInput();
    this.orientationQuery.addEventListener("change", (event) => {
      this.isLandscape = event.matches;
      this.pointer.down = false;
      this.spaceDown = false;
      if (this.player) this.player.holding = false;
      this.previousTime = performance.now();
      this.accumulator = 0;
      if (!this.isLandscape) this.sound.stopMusic();
      this.setStatus(
        this.isLandscape
          ? "已切换为横屏，可以继续游玩。"
          : "请将设备旋转为横屏后继续游玩。",
      );
    });
    this.setStatus("标题画面。选择开始游戏或游戏方法。");
    requestAnimationFrame((time) => this.loop(time));
  }

  readBestScore() {
    try {
      return Number.parseInt(localStorage.getItem("flying-ninja-cat-best") || "0", 10) || 0;
    } catch {
      return 0;
    }
  }

  saveBestScore() {
    try {
      localStorage.setItem("flying-ninja-cat-best", String(this.bestScore));
    } catch {
      // The game still works when storage is disabled.
    }
  }

  random() {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 0x100000000;
  }

  choose(list) {
    return list[Math.floor(this.random() * list.length)];
  }

  bindInput() {
    canvas.addEventListener("pointermove", (event) => {
      this.pointer = { ...this.canvasPoint(event), down: this.pointer.down };
      this.updateHover();
    });

    canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      canvas.focus();
      canvas.setPointerCapture?.(event.pointerId);
      this.pointer = { ...this.canvasPoint(event), down: true };
      this.onActionDown();
    });

    const releasePointer = (event) => {
      event.preventDefault();
      this.pointer = { ...this.canvasPoint(event), down: false };
      this.onActionUp();
    };
    canvas.addEventListener("pointerup", releasePointer);
    canvas.addEventListener("pointercancel", releasePointer);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    window.addEventListener("keydown", (event) => {
      if (!this.isLandscape) return;

      if (event.code === "Space") {
        event.preventDefault();
        if (!this.spaceDown) {
          this.spaceDown = true;
          this.onActionDown();
        }
      } else if (event.code === "Enter") {
        event.preventDefault();
        if (this.state === "title") this.startGame();
        else if (this.state === "gameover") this.startGame();
      } else if (event.code === "Escape" && this.state === "help") {
        this.closeHelp();
      } else if (event.code === "ArrowRight" && this.state === "help") {
        this.nextHelpPage();
      } else if (event.code === "ArrowLeft" && this.state === "help") {
        this.previousHelpPage();
      }
    });

    window.addEventListener("keyup", (event) => {
      if (event.code === "Space") {
        event.preventDefault();
        this.spaceDown = false;
        this.onActionUp();
      }
    });

    window.addEventListener("blur", () => {
      this.pointer.down = false;
      this.spaceDown = false;
      if (this.player) this.player.holding = false;
    });
  }

  canvasPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * WIDTH,
      y: ((event.clientY - bounds.top) / bounds.height) * HEIGHT,
    };
  }

  updateHover() {
    const start = { x: 355, y: 332, width: 112, height: 72 };
    const help = { x: 470, y: 332, width: 112, height: 72 };
    if (this.state === "title" && pointIn(this.pointer, start)) this.hover = "start";
    else if (this.state === "title" && pointIn(this.pointer, help)) this.hover = "help";
    else this.hover = "";
  }

  onActionDown() {
    if (!this.isLandscape) return;

    if (this.state === "title") {
      const start = { x: 355, y: 332, width: 112, height: 72 };
      const help = { x: 470, y: 332, width: 112, height: 72 };
      if (pointIn(this.pointer, start) || this.spaceDown) {
        this.sound.play("button");
        this.startGame();
      } else if (pointIn(this.pointer, help)) {
        this.sound.play("button");
        this.openHelp("title");
      }
      return;
    }

    if (this.state === "help") {
      if (pointIn(this.pointer, { x: 541, y: 65, width: 38, height: 38 })) {
        this.closeHelp();
      } else if (pointIn(this.pointer, { x: 83, y: 372, width: 130, height: 56 })) {
        this.previousHelpPage();
      } else if (pointIn(this.pointer, { x: 427, y: 372, width: 130, height: 56 })) {
        this.nextHelpPage();
      } else if (pointIn(this.pointer, { x: 75, y: 105, width: 490, height: 250 })) {
        this.nextHelpPage();
      }
      return;
    }

    if (this.state === "gameover") {
      if (pointIn(this.pointer, { x: 286, y: 373, width: 106, height: 46 })) {
        this.sound.play("button");
        this.startGame();
      }
      return;
    }

    if (this.state !== "playing") return;
    this.player.holding = true;

    if (this.player.status === "run") {
      this.startJump();
    } else if (this.player.status === "jump") {
      this.startShoot();
    }
  }

  onActionUp() {
    if (!this.isLandscape) return;

    if (this.player) this.player.holding = false;
  }

  openHelp(returnState) {
    this.helpPage = 0;
    this.helpReturn = returnState;
    this.state = "help";
    this.sound.music("titleMusic");
    this.setStatus("游戏方法，第 1 页，共 6 页。");
  }

  closeHelp() {
    this.sound.play("button");
    this.state = this.helpReturn;
    if (this.state === "gameover") {
      this.sound.stopMusic();
      this.setStatus(`游戏结束，得分 ${this.score}。中央按钮可重新开始。`);
    } else {
      this.sound.music("titleMusic");
      this.setStatus("标题画面。选择开始游戏或游戏方法。");
    }
  }

  nextHelpPage() {
    this.sound.play("button", { volume: 0.42 });
    if (this.helpPage < this.assets.help.length - 1) {
      this.helpPage += 1;
      this.setStatus(`游戏方法，第 ${this.helpPage + 1} 页，共 6 页。`);
    } else {
      this.closeHelp();
    }
  }

  previousHelpPage() {
    this.sound.play("button", { volume: 0.42 });
    this.helpPage = Math.max(0, this.helpPage - 1);
    this.setStatus(`游戏方法，第 ${this.helpPage + 1} 页，共 6 页。`);
  }

  startGame() {
    this.sound.stop("run");
    this.sound.stop("spin");
    this.state = "playing";
    this.score = 0;
    this.level = 0;
    this.count = 0;
    this.speed = 15;
    this.nextWay = 0;
    this.blocks = [];
    this.items = [];
    this.mapQueue = [];
    this.goldGroups = new Map();
    this.groupSequence = 0;
    this.effects = [];
    this.trails = [];
    this.newBestAnnounced = false;
    this.cloudX = 0;
    this.headState = "sleep";
    this.headTimer = 0;
    this.hookHitFrame = null;
    this.fadeFrame = null;
    this.player = {
      x: CAT_X,
      y: GROUND_Y,
      dy: 0,
      status: "run",
      clip: "run",
      animationTick: 0,
      holding: false,
      rope: null,
      rotation: 0,
    };

    for (let index = 0; index < 6; index += 1) {
      this.blocks.push({ type: 2, x: index * BLOCK_WIDTH });
    }

    this.sound.music("gameMusic");
    this.sound.play("run", { loop: true });
    this.setStatus("游戏开始。点击跳跃，空中再次点击发射绳索。");
  }

  startJump() {
    this.player.status = "jump";
    this.player.clip = "jump";
    this.player.animationTick = 0;
    this.player.rotation = 0;
    this.player.dy = JUMP_SPEED;
    this.player.rope = null;
    this.sound.stop("run");
    this.sound.play("jump");
    this.setStatus("跳跃中。再次点击可发射绳索。");
  }

  startShoot() {
    this.player.status = "shoot";
    this.player.clip = "shoot";
    this.player.animationTick = 0;
    this.player.rotation = 0;
    this.player.rope = {
      mode: "shoot",
      x: this.player.x + ROPE_ORIGIN_X,
      y: this.player.y + ROPE_ORIGIN_Y,
    };
    this.sound.stop("spin");
    this.sound.play("shoot");
    this.setStatus("绳索发射中。命中后按住可向上摆动。");
  }

  catchRope() {
    const rope = this.player.rope;
    if (!rope) return;
    if (rope.y < 125) rope.x -= 125 - rope.y - 5;
    rope.y = 125;
    rope.mode = "caught";
    this.player.status = "rope";
    this.player.clip = "rope";
    this.player.animationTick = 0;
    this.player.rotation = INITIAL_ROPE_BODY_ANGLE;
    this.player.dy = 15;
    this.hookHitFrame = -1;
    this.sound.play("ropeCatch");
    this.setStatus("绳索已固定。按住上摆，松开下摆。");
  }

  startSpin() {
    this.player.rope = null;
    this.player.status = "spin";
    this.player.clip = "spin";
    this.player.animationTick = 0;
    this.player.rotation = 0;
    this.player.dy = JUMP_SPEED + 15;
    this.sound.play("spin", { loop: true, volume: 0.45 });
    this.setStatus("飞跃中。落到屋顶后继续奔跑。");
  }

  choosePattern() {
    const difficulty = clamp(this.level, 0, LEVEL_PATTERNS.length - 1);
    if (this.random() < SAFE_CHANCE[difficulty]) return [...this.choose(SAFE_PATTERNS)];
    return [...this.choose(LEVEL_PATTERNS[difficulty])];
  }

  chooseItemLayout(pattern) {
    const layouts = ITEM_PATTERNS_BY_MAP.get(pattern.join(","));
    if (!layouts?.length) return pattern.map(() => []);
    return this.choose(layouts);
  }

  enqueuePattern() {
    const pattern = this.choosePattern();
    const layout = this.chooseItemLayout(pattern);
    const groupId = ++this.groupSequence;
    const goldCount = layout.flat().filter((code) => code < 100).length;

    for (let index = 0; index < pattern.length; index += 1) {
      this.mapQueue.push({
        type: pattern[index],
        codes: [...(layout[index] || [])],
        groupId,
      });
    }

    if (goldCount > 0) this.goldGroups.set(groupId, goldCount);
  }

  spawnBlock(entry, x) {
    if (entry.type === 4) {
      this.blocks.push({ type: 4, x });
      this.finishGame();
      return;
    }

    this.blocks.push({ type: entry.type, x });
    for (const rawCode of entry.codes) {
      const silver = rawCode >= 100;
      const code = silver ? rawCode - 100 : rawCode;
      this.items.push({
        x: x - 58.5 + (code % 4) * 37.5,
        y: 40 + Math.floor(code / 4) * 37,
        kind: silver ? "silver" : "gold",
        groupId: entry.groupId,
      });
    }

    this.count += 1;
    const limit = LEVEL_LIMITS[Math.min(this.level, LEVEL_LIMITS.length - 1)];
    if (this.count >= limit) this.levelUp();
  }

  levelUp() {
    this.level += 1;
    this.count = 0;
    if (this.level <= 5) {
      this.speed += this.level < 3 ? 3 : 2;
      this.triggerGameEffect("speed");
    } else {
      this.mapQueue.push(
        ...FINISH_PATTERN.map((type) => ({
          type,
          codes: [],
          groupId: ++this.groupSequence,
        })),
      );
    }
  }

  moveWorld() {
    for (const block of this.blocks) block.x -= this.speed;
    for (const item of this.items) item.x -= this.speed;
    this.cloudX -= this.speed / 4;
    if (this.cloudX < -CLOUD_WRAP_WIDTH) this.cloudX += CLOUD_WRAP_WIDTH;
    this.nextWay += this.speed;

    while (this.nextWay >= BLOCK_WIDTH) {
      if (this.mapQueue.length === 0) this.enqueuePattern();
      const entry = this.mapQueue.shift();
      const x = BLOCK_WIDTH * 5 - (this.nextWay - BLOCK_WIDTH);
      this.spawnBlock(entry, x);
      this.nextWay -= BLOCK_WIDTH;
    }

    this.blocks = this.blocks.filter((block) => block.x > -BLOCK_WIDTH * 1.1);
    this.items = this.items.filter((item) => item.x > -70);
  }

  hasGroundAt(x) {
    return this.blocks.some(
      (block) =>
        (block.type === 2 || block.type === 4) &&
        x >= block.x - GROUND_HALF_WIDTH &&
        x <= block.x + GROUND_HALF_WIDTH,
    );
  }

  ropeHitsTarget(x, y) {
    return this.blocks.some((block) => {
      if (block.type !== 3) return false;
      const localX = x - block.x;
      const localY = y - ROPE_TARGET_Y;
      let inside = false;

      for (
        let current = 0, previous = ROPE_TARGET_POINTS.length - 1;
        current < ROPE_TARGET_POINTS.length;
        previous = current, current += 1
      ) {
        const a = ROPE_TARGET_POINTS[current];
        const b = ROPE_TARGET_POINTS[previous];
        const crossesY = (a.y > localY) !== (b.y > localY);
        if (
          crossesY &&
          localX < ((b.x - a.x) * (localY - a.y)) / (b.y - a.y) + a.x
        ) {
          inside = !inside;
        }
      }

      return inside;
    });
  }

  updateAirborne(gravity) {
    if (this.player.dy > -20) this.player.dy -= gravity;
    this.player.y -= this.player.dy;

    if (this.player.dy < 0) {
      if (this.player.status !== "shoot") this.player.status = "jump";

      if (this.player.y >= GROUND_Y && this.hasGroundAt(this.player.x)) {
        this.player.y = GROUND_Y;
        this.player.dy = 0;
        this.player.rope = null;
        this.player.status = "run";
        this.player.clip = "run";
        this.player.animationTick = 0;
        this.player.rotation = 0;
        this.sound.stop("spin");
        this.sound.play("run", { loop: true });
        this.sound.play("land", { volume: 0.34 });
        this.setStatus("奔跑中。点击或按空格跳跃。");
      } else if (this.player.y > 470) {
        this.gameOver();
      }
    }
  }

  updateRopeShot() {
    const rope = this.player.rope;
    if (!rope || rope.mode !== "shoot") return;
    rope.x += ROPE_SPEED + 5;
    rope.y -= ROPE_SPEED - 5;

    if (this.ropeHitsTarget(rope.x, rope.y)) {
      this.catchRope();
    } else if (rope.y <= 0 || rope.x > WIDTH + 80) {
      this.player.rope = null;
      this.player.status = "jump";
    }
  }

  updateRopeSwing() {
    const rope = this.player.rope;
    if (!rope || rope.mode !== "caught") return;

    // SetGame.gRope_EnterFrame checks death before moving the rope or player.
    if (this.player.y > 550) {
      this.gameOver();
      return;
    }

    rope.x -= this.speed;

    this.player.rotation =
      Math.atan2(
        rope.y - (this.player.y + ROPE_BODY_ORIGIN_Y),
        rope.x - (this.player.x + ROPE_BODY_ORIGIN_X),
      ) + ROPE_BODY_ANGLE_OFFSET;

    if (this.player.holding) {
      if (this.player.dy > -30) this.player.dy -= GRAVITY;
      if (this.player.y < rope.y + 50) this.startSpin();
    } else if (this.player.dy < 30) {
      this.player.dy += GRAVITY;
    }

    this.player.y += this.player.dy;
    if (this.player.rotation < ROPE_RELEASE_ANGLE) this.startSpin();
    if (rope.x < 70) this.startSpin();
  }

  itemMarkerBounds() {
    const clip = this.player.clip || this.player.status || "jump";
    const marker = ITEM_MARKER_TRANSFORMS[clip] || ITEM_MARKER_TRANSFORMS.jump;

    if (!marker.rotate) {
      return rotatedRectBounds(
        this.player.x + marker.x,
        this.player.y + marker.y,
        ITEM_MARKER_HALF_WIDTH,
        ITEM_MARKER_HALF_HEIGHT,
      );
    }

    const angle = this.player.rotation || 0;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const centerX =
      this.player.x + marker.bodyX + cosine * marker.x - sine * marker.y;
    const centerY =
      this.player.y + marker.bodyY + sine * marker.x + cosine * marker.y;
    return rotatedRectBounds(
      centerX,
      centerY,
      ITEM_MARKER_HALF_WIDTH,
      ITEM_MARKER_HALF_HEIGHT,
      angle,
    );
  }

  itemMovieBounds(item) {
    const bounds = ITEM_MOVIE_BOUNDS[item.kind] || ITEM_MOVIE_BOUNDS.silver;
    return {
      left: item.x + bounds.left,
      right: item.x + bounds.right,
      top: item.y + bounds.top,
      bottom: item.y + bounds.bottom,
    };
  }

  collectItems() {
    const markerBounds = this.itemMarkerBounds();
    const remaining = [];

    for (const item of this.items) {
      // MovieClip.hitTest(otherMovieClip) compares transformed bounds.
      if (!boundsIntersect(markerBounds, this.itemMovieBounds(item))) {
        remaining.push(item);
        continue;
      }

      this.addSpriteEffect("pickup", item.x - 26.5, item.y - 25);

      if (item.kind === "gold") {
        const points = 50 - this.level * 5;
        this.addScore(points);
        this.sound.play("gold", { volume: 0.5 });
        const count = (this.goldGroups.get(item.groupId) || 1) - 1;
        this.goldGroups.set(item.groupId, count);
        if (count === 0) {
          this.addScore(100 + this.level * 20);
          this.triggerGameEffect("bonus");
        }
      } else {
        this.addScore(5);
        this.sound.play("silver", { volume: 0.38 });
      }
    }

    this.items = remaining;
  }

  addScore(points) {
    this.score += Math.max(0, points);

    if (this.score > this.bestScore) {
      const hadRecord = this.bestScore > 0;
      this.bestScore = this.score;
      this.saveBestScore();
      if (hadRecord && !this.newBestAnnounced) {
        this.newBestAnnounced = true;
        this.triggerGameEffect("best");
      }
    }
  }

  setHeadState(state, duration = 0) {
    this.headState = state;
    this.headTimer = duration;
  }

  addSpriteEffect(kind, x = 0, y = 0) {
    this.effects.push({ kind, x, y, frame: -1 });
  }

  triggerGameEffect(kind) {
    const origin = EFFECT_DRAW_ORIGINS[kind];
    if (origin) this.addSpriteEffect(kind, origin.x, origin.y);

    if (kind === "bonus") {
      this.setHeadState("eyes");
      this.sound.play("bonus");
    } else if (kind === "speed") {
      this.setHeadState("surprise", FPS * 5);
      this.addSpriteEffect("speedRing");
      this.sound.play("speed");
    } else if (kind === "best") {
      this.setHeadState("surprise", FPS * 5);
      this.sound.play("best");
    }
  }

  updateEffects() {
    for (const effect of this.effects) effect.frame += 1;
    this.effects = this.effects.filter(
      (effect) => effect.frame < EFFECT_FRAME_COUNTS[effect.kind],
    );

    if (this.hookHitFrame !== null) {
      this.hookHitFrame += 1;
      if (this.hookHitFrame >= EFFECT_FRAME_COUNTS.hookHit) this.hookHitFrame = null;
    }

    if (this.headTimer > 0) {
      this.headTimer -= 1;
      if (this.headTimer === 0) this.headState = "sleep";
    }
  }

  updatePlaying() {
    this.player.animationTick = (this.player.animationTick || 0) + 1;
    this.moveWorld();

    this.trails.push({
      x: this.player.x,
      y: this.player.y,
      pose: this.catPose(),
    });
    if (this.trails.length > 3) this.trails.shift();

    if (this.player.status === "run") {
      this.player.rotation = 0;
      if (!this.hasGroundAt(this.player.x)) this.gameOver();
    } else if (
      this.player.status === "jump" ||
      this.player.status === "shoot" ||
      this.player.status === "spin"
    ) {
      const gravity = this.player.clip === "spin" ? GRAVITY * 1.5 : GRAVITY;
      this.updateAirborne(gravity);
      if (this.player.status === "shoot") this.updateRopeShot();
    } else if (this.player.status === "rope") {
      this.updateRopeSwing();
    }

    if (this.state !== "playing") return;
    this.collectItems();
    this.updateEffects();
  }

  gameOver() {
    if (this.state !== "playing") return;
    this.state = "dying";
    this.deathTick = 0;
    this.deathStartY = this.player.y;
    this.player.status = "die";
    this.player.clip = "die";
    this.player.animationTick = 0;
    this.player.rotation = 0;
    this.player.rope = null;
    this.player.holding = false;
    this.sound.stopMusic();
    this.sound.stop("run");
    this.sound.stop("spin");
    this.sound.play("gameOver");
    this.saveBestScore();
    // Timeline effects should not freeze behind the deliberately simplified
    // result panel when play stops.
    this.effects = [];
    this.hookHitFrame = null;
    this.setHeadState("smile");
    for (const block of this.blocks) block.failed = true;
    this.setStatus(`坠落，游戏结束。得分 ${this.score}。`);
  }

  finishGame() {
    if (this.state !== "playing") return;
    this.state = "finishing";
    this.fadeFrame = 0;
    this.speed = 0;
    this.sound.stopMusic();
    this.sound.stop("run");
    this.sound.stop("spin");
    this.sound.play("fade");
    this.saveBestScore();
    this.setStatus(`抵达终点。正在显示最终成绩 ${this.score}。`);
  }

  update() {
    if (this.state === "playing") {
      this.updatePlaying();
    } else if (this.state === "dying") {
      this.player.animationTick += 1;
      this.deathTick += 1;

      if (this.deathTick > DEATH_DELAY_FRAMES) {
        const tweenFrame = Math.min(
          this.deathTick - DEATH_DELAY_FRAMES,
          DEATH_TWEEN_FRAMES,
        );
        const progress = tweenFrame / DEATH_TWEEN_FRAMES;
        this.player.y = this.deathStartY + DEATH_DISTANCE * progress * progress;
      }

      if (this.deathTick >= DEATH_DELAY_FRAMES + DEATH_TWEEN_FRAMES) {
        this.state = "gameover";
        this.setStatus(`游戏结束，得分 ${this.score}。中央按钮可重新开始。`);
      }
    } else if (this.state === "finishing" || this.state === "endingTransition") {
      if (this.state === "finishing" && this.player) this.player.x += 30;
      this.fadeFrame += 1;
      if (this.state === "finishing" && this.fadeFrame >= 14) {
        this.state = "endingTransition";
        this.sound.play("finish");
      }
      if (this.fadeFrame >= FADE_ALPHA.length - 1) {
        this.state = "ending";
        this.fadeFrame = null;
        this.setStatus(`抵达终点。最终得分 ${this.score}。`);
      }
    }
  }

  loop(time) {
    const elapsed = Math.min(250, time - this.previousTime);
    this.previousTime = time;

    if (!this.isLandscape) {
      this.accumulator = 0;
      requestAnimationFrame((nextTime) => this.loop(nextTime));
      return;
    }

    this.accumulator += elapsed;

    while (this.accumulator >= STEP_MS) {
      this.update();
      this.accumulator -= STEP_MS;
    }

    this.draw();
    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  catFrame(clip = this.player?.clip || this.player?.status || "run") {
    const count = CAT_CLIP_FRAME_COUNTS[clip] || 1;
    return 1 + ((this.player?.animationTick || 0) % count);
  }

  catPose() {
    const clip = this.player?.clip || this.player?.status || "run";
    return {
      clip,
      frame: this.catFrame(clip),
      rotation: clip === "rope" ? this.player.rotation || 0 : 0,
    };
  }

  draw() {
    context.clearRect(0, 0, WIDTH, HEIGHT);
    if (this.state === "title") this.drawTitle();
    else if (this.state === "help") this.drawHelp();
    else if (this.state === "ending") this.drawEnding();
    else if (this.state === "endingTransition") {
      this.drawEnding();
      this.drawFade();
    }
    else this.drawGame();
  }

  drawTitle() {
    context.drawImage(this.assets.title, 0, 0);
    this.drawTitleButton("start", 360, 337, this.assets.startLabel);
    this.drawTitleButton("help", 472, 337, this.assets.helpLabel);

    context.save();
    context.font = 'bold 25px "Arial Rounded MT Bold", "PingFang SC", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#c9ec65";
    context.shadowColor = "rgba(0,0,0,.55)";
    context.shadowBlur = 2;
    context.fillText("Flash 游戏乐园", 320, 435);
    context.restore();
  }

  drawTitleButton(name, x, y, label) {
    const active = this.hover === name;
    const fish = active ? this.assets.fishHover : this.assets.fish;
    context.save();
    if (active) {
      context.shadowColor = "#fff28a";
      context.shadowBlur = 12;
      context.translate(0, -2);
    }
    context.drawImage(fish, x, y);
    context.drawImage(label, x + (fish.width - label.width) / 2, y + 24);
    context.restore();
  }

  drawHelp() {
    context.drawImage(this.assets.title, 0, 0);
    context.fillStyle = "rgba(2, 12, 25, 0.78)";
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.save();
    roundedRect(context, 55, 55, 530, 380, 18);
    context.fillStyle = "rgba(5, 28, 42, 0.96)";
    context.fill();
    context.lineWidth = 3;
    context.strokeStyle = "#e8be56";
    context.stroke();

    context.fillStyle = "#ffd45c";
    context.font = 'bold 30px "PingFang SC", "Microsoft YaHei", sans-serif';
    context.textAlign = "center";
    context.fillText("游戏方法", 320, 94);

    context.fillStyle = "#8feef0";
    context.font = 'bold 14px "PingFang SC", sans-serif';
    context.fillText(`${this.helpPage + 1} / 6`, 320, 119);

    const page = this.assets.help[this.helpPage];
    const scale = Math.min(1.25, 455 / page.width, 190 / page.height);
    const pageWidth = page.width * scale;
    const pageHeight = page.height * scale;
    context.drawImage(
      page,
      320 - pageWidth / 2,
      205 - pageHeight / 2,
      pageWidth,
      pageHeight,
    );

    if (this.helpPage === 1 || this.helpPage === 2) {
      const mouse = this.helpPage === 1 ? this.assets.mouseUp : this.assets.mouseDown;
      const mouseScale = Math.min(0.72, 100 / mouse.width);
      context.drawImage(
        mouse,
        320 - (mouse.width * mouseScale) / 2,
        246,
        mouse.width * mouseScale,
        mouse.height * mouseScale,
      );
    }

    this.drawPanelButton(86, 370, "上一页", this.helpPage === 0);
    this.drawPanelButton(424, 370, this.helpPage === 5 ? "返回" : "下一页", false);

    context.fillStyle = "#d7f8f4";
    context.font = 'bold 25px "PingFang SC", sans-serif';
    context.textAlign = "center";
    context.fillText("×", 560, 90);
    context.restore();
  }

  drawPanelButton(x, y, text, disabled) {
    context.save();
    context.globalAlpha = disabled ? 0.35 : 1;
    context.drawImage(this.assets.fish, x, y, 126, 58);
    context.fillStyle = "#452400";
    context.font = 'bold 17px "PingFang SC", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, x + 64, y + 29);
    context.restore();
  }

  drawGame() {
    context.drawImage(this.assets.game, 0, 0);
    context.save();
    context.globalAlpha = 0.5;
    context.drawImage(this.assets.clouds, this.cloudX || 0, CLOUD_Y);
    context.restore();
    context.drawImage(this.assets.head[this.headState || "sleep"], HEAD_X, HEAD_Y);
    context.drawImage(this.assets.bestPaw, BEST_PAW_X, BEST_PAW_Y);
    this.drawBestScore();

    for (const block of this.blocks) {
      if (block.type === 1) continue;
      const failed = block.failed && this.assets.failedBlocks[block.type];
      if (failed) {
        if (block.type === 2) context.drawImage(failed, block.x - 116.5, 362);
        else context.drawImage(failed, block.x - BLOCK_IMAGE_X, BLOCK_IMAGE_Y);
        continue;
      }
      const image = this.assets.blocks[block.type - 1];
      if (image) context.drawImage(image, block.x - BLOCK_IMAGE_X, BLOCK_IMAGE_Y);
    }

    this.drawRope();
    this.drawItems();

    if (this.state !== "gameover") {
      this.drawTrails();
      this.drawCat();
    }

    this.drawScore();
    this.drawProgress();
    this.drawEffects();

    if (this.state === "gameover") {
      this.drawGameOver();
    }

    if (this.state === "finishing") this.drawFade();
  }

  drawFade() {
    if (this.fadeFrame === null) return;
    context.save();
    context.globalAlpha = FADE_ALPHA[clamp(this.fadeFrame, 0, FADE_ALPHA.length - 1)] / 255;
    context.fillStyle = "#000";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.restore();
  }

  drawBestScore() {
    context.save();
    context.font = 'bold 22px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = 4;
    context.strokeStyle = "#315868";
    context.fillStyle = "#70e9ff";
    const value = padScore(this.bestScore);
    context.strokeText(value, BEST_SCORE_X, BEST_SCORE_Y);
    context.fillText(value, BEST_SCORE_X, BEST_SCORE_Y);
    context.restore();
  }

  drawRope() {
    const rope = this.player?.rope;
    if (!rope) return;
    const startX = this.player.x + ROPE_ORIGIN_X;
    const startY = this.player.y + ROPE_ORIGIN_Y;

    context.save();
    context.lineWidth = 2;
    context.strokeStyle = "#96bdc4";
    context.shadowColor = "rgba(255,255,255,.55)";
    context.shadowBlur = 2;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(rope.x, rope.y);
    context.stroke();

    const angle =
      rope.mode === "caught"
        ? CAUGHT_HOOK_ANGLE
        : Math.atan2(rope.y - startY, rope.x - startX);
    context.translate(rope.x, rope.y);
    context.rotate(angle);
    const hook = this.assets.hooks[0];
    context.drawImage(hook, -HOOK_ORIGIN_X, -HOOK_ORIGIN_Y);

    if (
      rope.mode === "caught" &&
      Number.isInteger(this.hookHitFrame) &&
      this.hookHitFrame >= 0
    ) {
      const frame = this.assets.effects?.hookHit?.[this.hookHitFrame];
      if (frame) {
        context.translate(HOOK_HIT_X, HOOK_HIT_Y);
        context.rotate(HOOK_HIT_ROTATION);
        context.drawImage(frame, -12, -32);
      }
    }
    context.restore();
  }

  drawItems() {
    for (const item of this.items) {
      const image = this.assets.coins[item.kind === "gold" ? 0 : 1];
      context.drawImage(image, item.x - 28, item.y - 26);
    }
  }

  drawTrails() {
    if (!this.trails || this.trails.length < 2) return;
    const visible = this.trails.slice(0, -1);
    visible.forEach((trail, index) => {
      context.save();
      context.globalAlpha = 0.08 + index * 0.07;
      this.drawCatAt(trail.x, trail.y, trail.pose);
      context.restore();
    });
  }

  drawCat() {
    if (!this.player) return;
    this.drawCatAt(this.player.x, this.player.y, this.catPose());
  }

  drawCatAt(x, y, pose) {
    const clip = pose?.clip || "run";
    const frames = this.assets.cat[clip];
    const image = frames[clamp((pose?.frame || 1) - 1, 0, frames.length - 1)];
    const draw = CAT_CLIP_DRAW[clip] || CAT_CLIP_DRAW.run;

    context.save();
    context.translate(x, y);
    context.translate(draw.x, draw.y);
    if (draw.rotate) context.rotate(pose?.rotation || 0);
    if (draw.scale !== 1) context.scale(draw.scale, draw.scale);
    context.drawImage(image, -draw.originX, -draw.originY);
    context.restore();
  }

  drawScore() {
    const coin = this.assets.coins[0];
    context.save();
    context.drawImage(coin, HUD_COIN_X, HUD_COIN_Y, HUD_COIN_WIDTH, HUD_COIN_HEIGHT);
    context.font = 'italic bold 27px "Trebuchet MS", Arial, sans-serif';
    context.textBaseline = "middle";
    context.lineWidth = 5;
    context.strokeStyle = "rgba(91, 53, 5, .75)";
    context.fillStyle = "#ffd752";
    context.strokeText(String(this.score), HUD_SCORE_X, HUD_SCORE_Y);
    context.fillText(String(this.score), HUD_SCORE_X, HUD_SCORE_Y);
    context.restore();
  }

  drawProgress() {
    const level = clamp(this.level, 0, LEVEL_LIMITS.length - 1);
    const limit = LEVEL_LIMITS[level];
    const faceX =
      level * PROGRESS_LEVEL_WIDTH +
      (clamp(this.count, 0, limit) / limit) * PROGRESS_LEVEL_WIDTH;

    context.drawImage(
      this.assets.progressTrack,
      PROGRESS_X + PROGRESS_TRACK_X,
      PROGRESS_Y + PROGRESS_TRACK_Y,
    );
    context.drawImage(this.assets.progressFace, PROGRESS_X + faceX, PROGRESS_Y);
  }

  drawEffects() {
    for (const effect of this.effects) {
      const frames = this.assets.effects[effect.kind];
      const frame = frames?.[clamp(effect.frame, 0, frames.length - 1)];
      if (!frame) continue;

      if (effect.kind === "speedRing") {
        context.save();
        context.translate(this.player.x, this.player.y);
        context.rotate(this.player.rotation || 0);
        context.drawImage(frame, SPEED_RING_X, SPEED_RING_Y);
        context.restore();
      } else {
        context.drawImage(frame, effect.x, effect.y);
      }
    }
  }

  drawGameOver() {
    context.save();
    context.fillStyle = "rgba(2, 8, 18, .12)";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    // Keep the Chinese game-over title, score panel, and replay button. The
    // English title/fish artwork above it and the submit/rank buttons are not
    // part of the standalone H5 result screen.
    context.drawImage(
      this.assets.gameOver,
      0,
      148,
      295,
      181,
      GAME_OVER_X,
      GAME_OVER_Y + 148,
      295,
      181,
    );
    context.drawImage(
      this.assets.gameOver,
      91,
      331,
      113,
      46,
      GAME_OVER_X + 91,
      GAME_OVER_Y + 331,
      113,
      46,
    );

    context.font = 'bold 21px "Trebuchet MS", "PingFang SC", sans-serif';
    context.textBaseline = "middle";
    context.fillStyle = "#ffdc4f";
    context.strokeStyle = "#7d3900";
    context.lineWidth = 3;
    context.strokeText(String(this.score), 344, 293);
    context.fillText(String(this.score), 344, 293);
    context.restore();
  }

  drawEnding() {
    context.drawImage(this.assets.ending, 0, 0);
    context.save();
    context.textAlign = "center";
    context.font = 'bold 24px "PingFang SC", sans-serif';
    context.fillStyle = "#ffe069";
    context.strokeStyle = "#6b2e00";
    context.lineWidth = 4;
    context.strokeText(`最终得分 ${this.score}`, 320, 404);
    context.fillText(`最终得分 ${this.score}`, 320, 404);
    context.restore();
  }

  setStatus(message) {
    statusNode.textContent = message;
  }

  debugSnapshot() {
    return {
      buildVersion: BUILD_VERSION,
      state: this.state,
      score: this.score,
      bestScore: this.bestScore,
      level: this.level,
      speed: this.speed,
      blocks: this.blocks?.map(({ type, x }) => ({ type, x: Math.round(x) })) || [],
      items: this.items?.length || 0,
      player: this.player
        ? {
            x: Math.round(this.player.x),
            y: Math.round(this.player.y),
            dy: Number(this.player.dy.toFixed(1)),
            status: this.player.status,
            clip: this.player.clip,
            frame: this.catFrame(),
            rotation: Number(((this.player.rotation * 180) / Math.PI).toFixed(1)),
            rope: this.player.rope
              ? {
                  mode: this.player.rope.mode,
                  x: Math.round(this.player.rope.x),
                  y: Math.round(this.player.rope.y),
                }
              : null,
          }
        : null,
    };
  }
}

function drawLoading(progress, error) {
  const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#061426");
  gradient.addColorStop(1, "#0a5361");
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.textAlign = "center";
  context.fillStyle = error ? "#ff8b71" : "#f7d85b";
  context.font = 'bold 25px "PingFang SC", sans-serif';
  context.fillText(error ? "素材载入失败" : "飞天忍者猫", WIDTH / 2, 207);

  context.fillStyle = "rgba(0,0,0,.45)";
  roundedRect(context, 170, 231, 300, 22, 11);
  context.fill();
  if (!error) {
    context.fillStyle = "#47d7d1";
    roundedRect(context, 173, 234, 294 * progress, 16, 8);
    context.fill();
  }

  context.fillStyle = "#d7f8f4";
  context.font = '16px "PingFang SC", sans-serif';
  context.fillText(
    error ? error.message : `载入素材 ${Math.round(progress * 100)}%`,
    WIDTH / 2,
    280,
  );
}

drawLoading(0);

loadAssets((progress) => drawLoading(progress))
  .then((assets) => {
    const game = new FlyingNinjaCat(assets);
    window.__ninjaGame = {
      get state() {
        return game.state;
      },
      snapshot: () => game.debugSnapshot(),
      start: () => game.startGame(),
      instance: game,
    };
  })
  .catch((error) => {
    console.error(error);
    drawLoading(0, error);
    statusNode.textContent = error.message;
  });
