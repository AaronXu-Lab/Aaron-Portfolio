/**
 * 糖果漫游 · 无限糖罐纯逻辑核
 *
 * 不碰 DOM、计时器或 localStorage。页面只负责播放 steps、显示任务与保存战绩。
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

export const SPECIALS = {
  row: { name: '横纹糖', effect: '整行消除' },
  column: { name: '竖纹糖', effect: '整列消除' },
  burst: { name: '爆爆糖', effect: '区域消除' },
  color: { name: '彩虹糖', effect: '同类消除' },
};

export function makeCell(type, special = null) {
  return { type: Number(type), special: special || null };
}

export function typeOf(value) {
  if (value == null) return null;
  return typeof value === 'number' ? value : value.type;
}

export function specialOf(value) {
  return value && typeof value === 'object' ? value.special || null : null;
}

function cloneCell(value) {
  return value == null ? null : makeCell(typeOf(value), specialOf(value));
}

function cloneBoard(board) {
  return board.map(cloneCell);
}

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
  const next = cloneBoard(board);
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function inBounds(row, column, width, height) {
  return row >= 0 && row < height && column >= 0 && column < width;
}

/**
 * 找出常规直线三消，以及“长边三颗 + 端点转角一颗”的 L 形四消。
 * L 形的第四颗会并入消除集合，因此它不是只做视觉识别。
 */
export function findMatches(board, width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  const indices = new Set();
  const runs = [];
  const lShapes = [];

  const recordRun = (start, step, length, type, orientation) => {
    if (length < 3 || type == null) return;
    const runIndices = [];
    for (let offset = 0; offset < length; offset += 1) {
      const index = start + offset * step;
      indices.add(index);
      runIndices.push(index);
    }
    runs.push({ type, indices: runIndices, orientation });
  };

  for (let row = 0; row < height; row += 1) {
    let startColumn = 0;
    for (let column = 1; column <= width; column += 1) {
      const current = row * width + column;
      const start = row * width + startColumn;
      if (column === width || typeOf(board[current]) !== typeOf(board[start])) {
        recordRun(start, 1, column - startColumn, typeOf(board[start]), 'row');
        startColumn = column;
      }
    }
  }

  for (let column = 0; column < width; column += 1) {
    let startRow = 0;
    for (let row = 1; row <= height; row += 1) {
      const current = row * width + column;
      const start = startRow * width + column;
      if (row === height || typeOf(board[current]) !== typeOf(board[start])) {
        recordRun(start, width, row - startRow, typeOf(board[start]), 'column');
        startRow = row;
      }
    }
  }

  const seenShapes = new Set();
  const recordL = (coordinates, corner) => {
    if (!coordinates.every(([row, column]) => inBounds(row, column, width, height))) return;
    const shapeIndices = coordinates.map(([row, column]) => row * width + column);
    const type = typeOf(board[shapeIndices[0]]);
    if (type == null || !shapeIndices.every((index) => typeOf(board[index]) === type)) return;
    const key = [...shapeIndices].sort((a, b) => a - b).join(',');
    if (seenShapes.has(key)) return;
    seenShapes.add(key);
    shapeIndices.forEach((index) => indices.add(index));
    lShapes.push({ type, indices: shapeIndices, corner });
  };

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const corner = row * width + column;
      for (const vertical of [-1, 1]) {
        for (const horizontal of [-1, 1]) {
          recordL(
            [
              [row, column],
              [row + vertical, column],
              [row + vertical * 2, column],
              [row, column + horizontal],
            ],
            corner
          );
          recordL(
            [
              [row, column],
              [row, column + horizontal],
              [row, column + horizontal * 2],
              [row + vertical, column],
            ],
            corner
          );
        }
      }
    }
  }

  return { indices: [...indices], runs, lShapes };
}

export function hasMatch(board, width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  return findMatches(board, width, height).indices.length > 0;
}

function matchedComponents(analysis, board, width) {
  const pool = new Set(analysis.indices);
  const components = [];

  while (pool.size) {
    const first = pool.values().next().value;
    pool.delete(first);
    const type = typeOf(board[first]);
    const queue = [first];
    const component = [];

    while (queue.length) {
      const index = queue.shift();
      component.push(index);
      const row = Math.floor(index / width);
      const column = index % width;
      const neighbors = [
        row > 0 ? index - width : -1,
        row + 1 < Math.ceil(board.length / width) ? index + width : -1,
        column > 0 ? index - 1 : -1,
        column + 1 < width ? index + 1 : -1,
      ];
      for (const neighbor of neighbors) {
        if (pool.has(neighbor) && typeOf(board[neighbor]) === type) {
          pool.delete(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push({ type, indices: component });
  }
  return components;
}

/**
 * 每个相连匹配区最多生成一颗技能糖，优先级为五消 > L 形 > 直线四消。
 */
export function planSpecialCreations(
  board,
  analysis = findMatches(board),
  preferred = [],
  width = BOARD_WIDTH
) {
  const creations = [];
  for (const component of matchedComponents(analysis, board, width)) {
    const set = new Set(component.indices);
    const five = analysis.runs.find(
      (run) => run.indices.length >= 5 && run.indices.every((index) => set.has(index))
    );
    const lShape = analysis.lShapes.find((shape) =>
      shape.indices.every((index) => set.has(index))
    );
    const four = analysis.runs.find(
      (run) => run.indices.length === 4 && run.indices.every((index) => set.has(index))
    );

    let special = null;
    let pattern = null;
    let fallback = component.indices[0];
    if (five) {
      special = 'color';
      pattern = five.indices;
      fallback = five.indices[Math.floor(five.indices.length / 2)];
    } else if (lShape) {
      special = 'burst';
      pattern = lShape.indices;
      fallback = lShape.corner;
    } else if (four) {
      special = four.orientation === 'row' ? 'row' : 'column';
      pattern = four.indices;
      fallback = four.indices[Math.floor(four.indices.length / 2)];
    }
    if (!special) continue;

    const anchor = preferred.find((index) => pattern.includes(index)) ?? fallback;
    creations.push({ index: anchor, type: component.type, special });
  }
  return creations;
}

/**
 * 技能触发会递归扩展：一颗技能扫到另一颗技能时，第二颗也会立即生效。
 */
export function expandSpecialClears(
  board,
  initial,
  {
    width = BOARD_WIDTH,
    height = BOARD_HEIGHT,
    colorTargets = new Map(),
  } = {}
) {
  const cleared = new Set(initial);
  const queue = [...cleared];
  const activated = new Set();

  const add = (index) => {
    if (index < 0 || index >= board.length || cleared.has(index)) return;
    cleared.add(index);
    queue.push(index);
  };

  while (queue.length) {
    const index = queue.shift();
    const special = specialOf(board[index]);
    if (!special || activated.has(index)) continue;
    activated.add(index);
    const row = Math.floor(index / width);
    const column = index % width;

    if (special === 'row') {
      for (let nextColumn = 0; nextColumn < width; nextColumn += 1) {
        add(row * width + nextColumn);
      }
    } else if (special === 'column') {
      for (let nextRow = 0; nextRow < height; nextRow += 1) add(nextRow * width + column);
    } else if (special === 'burst') {
      for (let nextRow = row - 1; nextRow <= row + 1; nextRow += 1) {
        for (let nextColumn = column - 1; nextColumn <= column + 1; nextColumn += 1) {
          if (inBounds(nextRow, nextColumn, width, height)) add(nextRow * width + nextColumn);
        }
      }
    } else if (special === 'color') {
      const target = colorTargets.get(index) ?? typeOf(board[index]);
      for (let other = 0; other < board.length; other += 1) {
        if (target == null || typeOf(board[other]) === target) add(other);
      }
    }
  }

  return { indices: [...cleared], activated: [...activated] };
}

export function findValidMoves(board, width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  const moves = [];
  for (let index = 0; index < board.length; index += 1) {
    const column = index % width;
    const candidates = [];
    if (column + 1 < width) candidates.push(index + 1);
    if (index + width < width * height) candidates.push(index + width);
    for (const other of candidates) {
      if (specialOf(board[index]) === 'color' || specialOf(board[other]) === 'color') {
        moves.push([index, other]);
        continue;
      }
      if (typeOf(board[index]) === typeOf(board[other])) continue;
      if (hasMatch(swap(board, index, other), width, height)) moves.push([index, other]);
    }
  }
  return moves;
}

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
      if (
        column >= 2 &&
        typeOf(board[index - 1]) === typeOf(board[index - 2])
      ) blocked.add(typeOf(board[index - 1]));
      if (
        index >= width * 2 &&
        typeOf(board[index - width]) === typeOf(board[index - width * 2])
      ) blocked.add(typeOf(board[index - width]));
      const choices = Array.from({ length: types }, (_, type) => type).filter(
        (type) => !blocked.has(type)
      );
      board.push(makeCell(choices[Math.floor(random() * choices.length)]));
    }
    if (findValidMoves(board, width, height).length) return board;
  }
  throw new Error('无法生成可玩的棋盘');
}

function collapseAndRefill(board, random, width, height, types) {
  const next = cloneBoard(board);
  const movements = [];
  for (let column = 0; column < width; column += 1) {
    const remaining = [];
    for (let row = height - 1; row >= 0; row -= 1) {
      const value = next[row * width + column];
      if (value != null) {
        remaining.push({
          cell: value,
          from: row * width + column,
        });
      }
    }
    let spawnOffset = 0;
    for (let row = height - 1; row >= 0; row -= 1) {
      const fromBottom = height - 1 - row;
      const destination = row * width + column;
      const existing = remaining[fromBottom];
      if (existing) {
        next[destination] = existing.cell;
        const sourceRow = Math.floor(existing.from / width);
        if (sourceRow !== row) {
          movements.push({
            from: existing.from,
            to: destination,
            distance: row - sourceRow,
            spawned: false,
          });
        }
      } else {
        const sourceRow = -1 - spawnOffset;
        next[destination] = makeCell(Math.floor(random() * types));
        movements.push({
          from: sourceRow * width + column,
          to: destination,
          distance: row - sourceRow,
          spawned: true,
        });
        spawnOffset += 1;
      }
    }
  }
  return { board: next, movements };
}

function remix(board, random, width, height, types) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const next = cloneBoard(board);
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

export function resolveTurn(
  board,
  a,
  b,
  {
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
    return { valid: false, reason: 'not-adjacent', board: cloneBoard(board) };
  }

  let current = swap(board, a, b);
  const colorTargets = new Map();
  const firstA = specialOf(current[a]);
  const firstB = specialOf(current[b]);
  let manualClear = null;

  if (firstA === 'color' || firstB === 'color') {
    const colorIndex = firstA === 'color' ? a : b;
    const otherIndex = colorIndex === a ? b : a;
    const target = typeOf(current[otherIndex]);
    colorTargets.set(colorIndex, target);
    manualClear = current
      .map((value, index) => (typeOf(value) === target || index === colorIndex ? index : -1))
      .filter((index) => index >= 0);
    if (firstA === 'color' && firstB === 'color') {
      manualClear = current.map((_, index) => index);
      colorTargets.set(a, null);
      colorTargets.set(b, null);
    }
  } else if (!hasMatch(current, width, height)) {
    return { valid: false, reason: 'no-match', board: cloneBoard(board) };
  }

  const collected = Array(types).fill(0);
  const steps = [];
  let score = 0;
  let cascade = 0;
  let specialsCreated = 0;
  let specialsActivated = 0;

  while (cascade < 50) {
    const analysis = manualClear
      ? { indices: manualClear, runs: [], lShapes: [] }
      : findMatches(current, width, height);
    if (!analysis.indices.length) break;

    cascade += 1;
    const creations = manualClear
      ? []
      : planSpecialCreations(current, analysis, cascade === 1 ? [b, a] : [], width);
    const expanded = expandSpecialClears(current, analysis.indices, {
      width,
      height,
      colorTargets,
    });
    const anchors = new Set(creations.map((creation) => creation.index));
    const cleared = expanded.indices.filter((index) => !anchors.has(index));
    const boardBefore = cloneBoard(current);

    for (const index of cleared) {
      const type = typeOf(current[index]);
      if (type != null) collected[type] += 1;
      current[index] = null;
    }
    for (const creation of creations) {
      current[creation.index] = makeCell(creation.type, creation.special);
    }

    const stepScore =
      cleared.length * 80 * cascade + creations.length * 240 + expanded.activated.length * 320;
    score += stepScore;
    specialsCreated += creations.length;
    specialsActivated += expanded.activated.length;
    const collapsed = collapseAndRefill(current, random, width, height, types);
    current = collapsed.board;
    steps.push({
      cascade,
      boardBefore,
      matched: cleared,
      created: creations,
      activated: expanded.activated,
      boardAfter: cloneBoard(current),
      movements: collapsed.movements,
      score: stepScore,
    });
    manualClear = null;
    colorTargets.clear();
  }

  let shuffled = false;
  if (!findValidMoves(current, width, height).length) {
    current = remix(current, random, width, height, types);
    shuffled = true;
  }

  return {
    valid: true,
    board: current,
    collected,
    score,
    cascades: cascade,
    steps,
    shuffled,
    specialsCreated,
    specialsActivated,
  };
}

export function mergeCollected(current = [], gained = [], types = CANDY_COUNT) {
  return Array.from(
    { length: types },
    (_, type) => Math.max(0, Number(current[type]) || 0) + Math.max(0, Number(gained[type]) || 0)
  );
}

/** 随游戏时长缓慢升压，但每项任务都会给足独立时间。 */
export function createTask({
  number = 1,
  random = seededRandom(),
  avoidKind = null,
} = {}) {
  const kinds = ['collect', 'score', 'skill'].filter((kind) => kind !== avoidKind);
  const kind = kinds[Math.floor(random() * kinds.length)];
  const difficulty = Math.floor(Math.max(0, number - 1) / 3);
  const reward = Math.min(6, 2 + Math.floor(difficulty / 3) + (kind === 'skill' ? 1 : 0));

  if (kind === 'collect') {
    const type = Math.floor(random() * CANDY_COUNT);
    return {
      id: number,
      kind,
      type,
      target: Math.min(32, 12 + difficulty * 2 + Math.floor(random() * 5)),
      timeMs: Math.max(26000, 42000 - difficulty * 1000),
      reward,
    };
  }
  if (kind === 'skill') {
    return {
      id: number,
      kind,
      target: Math.min(4, 1 + Math.floor(difficulty / 4)),
      timeMs: Math.max(36000, 52000 - difficulty * 1000),
      reward,
    };
  }
  return {
    id: number,
    kind,
    target: Math.min(8500, 1800 + difficulty * 420),
    timeMs: Math.max(26000, 40000 - difficulty * 1000),
    reward,
  };
}

export function taskGain(task, turn) {
  if (task.kind === 'collect') return turn.collected?.[task.type] ?? 0;
  if (task.kind === 'skill') {
    return (turn.specialsCreated || 0) + (turn.specialsActivated || 0);
  }
  return turn.score || 0;
}

export function advanceTask(task, progress = 0, turn = {}) {
  return Math.min(task.target, Math.max(0, progress) + taskGain(task, turn));
}

export function isTaskComplete(task, progress = 0) {
  return progress >= task.target;
}
