/**
 * 糖果漫游 · 纯逻辑核
 *
 * 不碰 DOM / localStorage，供页面与 tests/candy-match-core.test.mjs 共用。
 * 棋盘格保存 0～5 的糖果类型；果冻层单独保存，便于下落与补牌时保持在原位。
 */

export const BOARD_WIDTH = 8;
export const BOARD_HEIGHT = 8;
export const CANDY_COUNT = 6;
export const BOARD_SIZE = BOARD_WIDTH * BOARD_HEIGHT;

export const CANDIES = [
  { id: 0, name: '莓果糖', short: '莓果' },
  { id: 1, name: '柠檬糖', short: '柠檬' },
  { id: 2, name: '葡萄糖', short: '葡萄' },
  { id: 3, name: '薄荷糖', short: '薄荷' },
  { id: 4, name: '海盐糖', short: '海盐' },
  { id: 5, name: '橙子糖', short: '橙子' },
];

const cell = (row, column) => row * BOARD_WIDTH + column;
const ring = [
  cell(2, 2), cell(2, 3), cell(2, 4), cell(2, 5),
  cell(3, 2), cell(3, 5),
  cell(4, 2), cell(4, 5),
  cell(5, 2), cell(5, 3), cell(5, 4), cell(5, 5),
];
const corners = [cell(1, 1), cell(1, 6), cell(6, 1), cell(6, 6)];
const cross = [
  cell(1, 3), cell(1, 4),
  cell(2, 3), cell(2, 4),
  cell(3, 1), cell(3, 2), cell(3, 3), cell(3, 4), cell(3, 5), cell(3, 6),
  cell(4, 1), cell(4, 2), cell(4, 3), cell(4, 4), cell(4, 5), cell(4, 6),
  cell(5, 3), cell(5, 4),
  cell(6, 3), cell(6, 4),
];
const checker = [
  cell(1, 1), cell(1, 3), cell(1, 5),
  cell(2, 2), cell(2, 4), cell(2, 6),
  cell(3, 1), cell(3, 3), cell(3, 5),
  cell(4, 2), cell(4, 4), cell(4, 6),
  cell(5, 1), cell(5, 3), cell(5, 5),
  cell(6, 2), cell(6, 4), cell(6, 6),
];

/** 十二关：分数、指定糖果与果冻三种目标逐步叠加。 */
export const LEVELS = [
  {
    id: 1,
    name: '糖霜小径',
    chapter: '晨光糖铺',
    moves: 18,
    score: 2400,
    collect: {},
    ice: [],
    seed: 1103,
  },
  {
    id: 2,
    name: '莓果邮局',
    chapter: '晨光糖铺',
    moves: 20,
    score: 3000,
    collect: { 0: 15 },
    ice: [],
    seed: 2207,
  },
  {
    id: 3,
    name: '柠檬站台',
    chapter: '晨光糖铺',
    moves: 21,
    score: 3600,
    collect: { 1: 12, 5: 12 },
    ice: [],
    seed: 3313,
  },
  {
    id: 4,
    name: '果冻花园',
    chapter: '软糖原野',
    moves: 25,
    score: 3200,
    collect: {},
    ice: ring.map((index) => [index, 1]),
    seed: 4421,
  },
  {
    id: 5,
    name: '薄荷风车',
    chapter: '软糖原野',
    moves: 25,
    score: 4500,
    collect: { 3: 18 },
    ice: corners.map((index) => [index, 1]),
    seed: 5527,
  },
  {
    id: 6,
    name: '葡萄汽水湾',
    chapter: '软糖原野',
    moves: 27,
    score: 5200,
    collect: { 2: 18, 4: 12 },
    ice: ring.filter((_, index) => index % 2 === 0).map((index) => [index, 1]),
    seed: 6637,
  },
  {
    id: 7,
    name: '焦糖钟楼',
    chapter: '暮色糖城',
    moves: 30,
    score: 6000,
    collect: {},
    ice: ring.map((index) => [index, 2]),
    seed: 7753,
  },
  {
    id: 8,
    name: '海盐剧场',
    chapter: '暮色糖城',
    moves: 29,
    score: 6500,
    collect: { 4: 22 },
    ice: cross.filter((_, index) => index % 3 === 0).map((index) => [index, 1]),
    seed: 8861,
  },
  {
    id: 9,
    name: '橙光天文台',
    chapter: '暮色糖城',
    moves: 30,
    score: 7200,
    collect: { 0: 16, 5: 16 },
    ice: corners.map((index) => [index, 1]),
    seed: 9973,
  },
  {
    id: 10,
    name: '彩糖大桥',
    chapter: '云端工坊',
    moves: 31,
    score: 7800,
    collect: { 1: 16, 2: 16, 3: 16 },
    ice: ring.map((index) => [index, 1]),
    seed: 10103,
  },
  {
    id: 11,
    name: '星砂糖工坊',
    chapter: '云端工坊',
    moves: 35,
    score: 8500,
    collect: { 4: 20, 5: 20 },
    ice: checker.map((index) => [index, 1]),
    seed: 11117,
  },
  {
    id: 12,
    name: '甜梦终点站',
    chapter: '云端工坊',
    moves: 40,
    score: 10000,
    collect: { 0: 15, 1: 15, 2: 15 },
    ice: cross.map((index) => [index, index % 2 ? 1 : 2]),
    seed: 12143,
  },
];

/** 可复现的随机数，测试与每关初始棋盘共用。 */
export function seededRandom(seed = Date.now()) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function areAdjacent(a, b, width = BOARD_WIDTH) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  const rowA = Math.floor(a / width);
  const rowB = Math.floor(b / width);
  return Math.abs(rowA - rowB) + Math.abs((a % width) - (b % width)) === 1;
}

export function swap(board, a, b) {
  const next = [...board];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/** 返回全部横向、纵向三连及以上；十字形只在 indices 中出现一次。 */
export function findMatches(board, width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  const indices = new Set();
  const runs = [];

  const record = (start, step, length, type) => {
    if (length < 3 || type == null) return;
    const run = [];
    for (let offset = 0; offset < length; offset += 1) {
      const index = start + offset * step;
      indices.add(index);
      run.push(index);
    }
    runs.push({ type, indices: run });
  };

  for (let row = 0; row < height; row += 1) {
    let start = row * width;
    for (let column = 1; column <= width; column += 1) {
      const index = row * width + column;
      if (column === width || board[index] !== board[start]) {
        record(start, 1, index - start, board[start]);
        start = index;
      }
    }
  }

  for (let column = 0; column < width; column += 1) {
    let startRow = 0;
    for (let row = 1; row <= height; row += 1) {
      const index = row * width + column;
      const startIndex = startRow * width + column;
      if (row === height || board[index] !== board[startIndex]) {
        record(startIndex, width, row - startRow, board[startIndex]);
        startRow = row;
      }
    }
  }

  return { indices: [...indices], runs };
}

export function hasMatch(board, width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  return findMatches(board, width, height).indices.length > 0;
}

export function findValidMoves(board, width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  const moves = [];
  for (let index = 0; index < board.length; index += 1) {
    const column = index % width;
    const candidates = [];
    if (column + 1 < width) candidates.push(index + 1);
    if (index + width < width * height) candidates.push(index + width);
    for (const other of candidates) {
      if (board[index] === board[other]) continue;
      if (hasMatch(swap(board, index, other), width, height)) moves.push([index, other]);
    }
  }
  return moves;
}

/**
 * 初盘逐格避开现成三连；若意外没有可走步，再换一个派生种子重建。
 */
export function createBoard({
  seed = Date.now(),
  width = BOARD_WIDTH,
  height = BOARD_HEIGHT,
  types = CANDY_COUNT,
} = {}) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const random = seededRandom(Number(seed) + attempt * 7919);
    const board = [];
    for (let index = 0; index < width * height; index += 1) {
      const column = index % width;
      const blocked = new Set();
      if (column >= 2 && board[index - 1] === board[index - 2]) blocked.add(board[index - 1]);
      if (index >= width * 2 && board[index - width] === board[index - width * 2]) {
        blocked.add(board[index - width]);
      }
      const choices = Array.from({ length: types }, (_, type) => type).filter(
        (type) => !blocked.has(type)
      );
      board.push(choices[Math.floor(random() * choices.length)]);
    }
    if (findValidMoves(board, width, height).length) return board;
  }
  throw new Error('无法生成可玩的棋盘');
}

function collapseAndRefill(board, random, width, height, types) {
  const next = [...board];
  for (let column = 0; column < width; column += 1) {
    const remaining = [];
    for (let row = height - 1; row >= 0; row -= 1) {
      const value = next[row * width + column];
      if (value != null) remaining.push(value);
    }
    for (let row = height - 1; row >= 0; row -= 1) {
      const fromBottom = height - 1 - row;
      next[row * width + column] =
        remaining[fromBottom] ?? Math.floor(random() * types);
    }
  }
  return next;
}

function remix(board, random, width, height, types) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const next = [...board];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [next[index], next[other]] = [next[other], next[index]];
    }
    if (!hasMatch(next, width, height) && findValidMoves(next, width, height).length) {
      return next;
    }
  }
  return createBoard({ seed: Math.floor(random() * 0xffffffff), width, height, types });
}

export function makeIce(level, size = BOARD_SIZE) {
  const ice = Array(size).fill(0);
  for (const [index, layers] of level?.ice ?? []) {
    if (index >= 0 && index < size) ice[index] = Math.max(0, Math.min(2, layers | 0));
  }
  return ice;
}

/**
 * 尝试一步交换并一次性解析连锁。
 * steps 保留每轮消除前后的棋盘，页面可逐轮播放，而测试只需检查最终状态。
 */
export function resolveTurn(
  board,
  a,
  b,
  {
    ice = Array(board.length).fill(0),
    random = seededRandom(),
    width = BOARD_WIDTH,
    height = BOARD_HEIGHT,
    types = CANDY_COUNT,
  } = {}
) {
  if (
    board.length !== width * height ||
    !areAdjacent(a, b, width) ||
    a >= board.length ||
    b >= board.length
  ) {
    return { valid: false, reason: 'not-adjacent', board: [...board], ice: [...ice] };
  }

  let current = swap(board, a, b);
  if (!hasMatch(current, width, height)) {
    return { valid: false, reason: 'no-match', board: [...board], ice: [...ice] };
  }

  const nextIce = [...ice];
  const collected = Array(types).fill(0);
  const steps = [];
  let score = 0;
  let cascade = 0;

  while (cascade < 50) {
    const matches = findMatches(current, width, height);
    if (!matches.indices.length) break;
    cascade += 1;
    const boardBefore = [...current];

    for (const index of matches.indices) {
      const type = current[index];
      if (type != null) collected[type] += 1;
      current[index] = null;
      if (nextIce[index] > 0) nextIce[index] -= 1;
    }

    const runBonus = matches.runs.reduce(
      (sum, run) => sum + Math.max(0, run.indices.length - 3) * 120,
      0
    );
    const stepScore = matches.indices.length * 80 * cascade + runBonus;
    score += stepScore;
    current = collapseAndRefill(current, random, width, height, types);
    steps.push({
      cascade,
      boardBefore,
      matched: matches.indices,
      boardAfter: [...current],
      score: stepScore,
    });
  }

  let shuffled = false;
  if (!findValidMoves(current, width, height).length) {
    current = remix(current, random, width, height, types);
    shuffled = true;
  }

  return {
    valid: true,
    board: current,
    ice: nextIce,
    collected,
    score,
    cascades: cascade,
    steps,
    shuffled,
  };
}

export function mergeCollected(current = [], gained = [], types = CANDY_COUNT) {
  return Array.from(
    { length: types },
    (_, type) => Math.max(0, Number(current[type]) || 0) + Math.max(0, Number(gained[type]) || 0)
  );
}

export function remainingIce(ice = []) {
  return ice.reduce((sum, layers) => sum + Math.max(0, Number(layers) || 0), 0);
}

export function isLevelComplete(level, { score = 0, collected = [], ice = [] } = {}) {
  if (score < level.score) return false;
  for (const [type, target] of Object.entries(level.collect ?? {})) {
    if ((collected[Number(type)] ?? 0) < target) return false;
  }
  return remainingIce(ice) === 0;
}

export function starsFor(level, movesLeft) {
  const ratio = Math.max(0, Number(movesLeft) || 0) / level.moves;
  if (ratio >= 0.35) return 3;
  if (ratio >= 0.15) return 2;
  return 1;
}

export function getLevel(id) {
  return LEVELS.find((level) => level.id === Number(id)) ?? LEVELS[0];
}
