import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_SIZE,
  advanceTask,
  areAdjacent,
  createBoard,
  createTask,
  expandSpecialClears,
  findMatches,
  findValidMoves,
  hasMatch,
  isTaskComplete,
  makeCell,
  mergeCollected,
  planSpecialCreations,
  resolveTurn,
  seededRandom,
  specialOf,
  typeOf,
} from '../public/tools/candy-match/js/core.js';

const cells = (values) =>
  values.map((value) =>
    value == null
      ? null
      : typeof value === 'object'
        ? makeCell(value.type, value.special)
        : makeCell(value)
  );

test('初始棋盘没有现成匹配，并且一定有合法交换', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const board = createBoard({ seed });
    assert.equal(board.length, BOARD_SIZE);
    assert.equal(hasMatch(board), false);
    assert.ok(findValidMoves(board).length > 0);
    assert.ok(board.every((cell) => Number.isInteger(typeOf(cell))));
  }
});

test('横纵交叉匹配去重，但保留两条直线', () => {
  const board = Array(25).fill(null);
  [2, 7, 12, 17, 22, 10, 11, 13, 14].forEach((index) => {
    board[index] = makeCell(1);
  });
  const matches = findMatches(board, 5, 5);
  assert.equal(matches.indices.length, 9);
  assert.equal(matches.runs.length, 2);
  assert.ok(matches.indices.includes(12));
});

test('横四消、竖四消、L 形四消、五消生成四类技能糖', () => {
  const pattern = (indices) => {
    const board = Array(25).fill(null);
    indices.forEach((index) => {
      board[index] = makeCell(2);
    });
    return board;
  };

  const horizontal = pattern([10, 11, 12, 13]);
  const vertical = pattern([1, 6, 11, 16]);
  const lShape = pattern([0, 5, 10, 11]);
  const five = pattern([15, 16, 17, 18, 19]);

  assert.equal(
    planSpecialCreations(horizontal, findMatches(horizontal, 5, 5), [], 5)[0].special,
    'row'
  );
  assert.equal(
    planSpecialCreations(vertical, findMatches(vertical, 5, 5), [], 5)[0].special,
    'column'
  );
  assert.equal(
    planSpecialCreations(lShape, findMatches(lShape, 5, 5), [], 5)[0].special,
    'burst'
  );
  assert.equal(
    planSpecialCreations(five, findMatches(five, 5, 5), [], 5)[0].special,
    'color'
  );
});

test('四类技能分别扩展为整行、整列、九宫格与同类消除', () => {
  const base = Array.from({ length: 25 }, (_, index) => makeCell(index % 6));

  const rowBoard = cells(base);
  rowBoard[12] = makeCell(0, 'row');
  const row = expandSpecialClears(rowBoard, [12], { width: 5, height: 5 });
  assert.deepEqual(row.indices.sort((a, b) => a - b), [10, 11, 12, 13, 14]);

  const columnBoard = cells(base);
  columnBoard[12] = makeCell(0, 'column');
  const column = expandSpecialClears(columnBoard, [12], { width: 5, height: 5 });
  assert.deepEqual(column.indices.sort((a, b) => a - b), [2, 7, 12, 17, 22]);

  const burstBoard = cells(base);
  burstBoard[12] = makeCell(0, 'burst');
  const burst = expandSpecialClears(burstBoard, [12], { width: 5, height: 5 });
  assert.deepEqual(
    burst.indices.sort((a, b) => a - b),
    [6, 7, 8, 11, 12, 13, 16, 17, 18]
  );

  const colorBoard = cells(base);
  colorBoard[12] = makeCell(2, 'color');
  const color = expandSpecialClears(colorBoard, [12], { width: 5, height: 5 });
  assert.ok(color.indices.every((index) => typeOf(colorBoard[index]) === 2));
  assert.equal(color.activated.length, 1);
});

test('技能扫到另一颗技能时会连锁触发', () => {
  const board = Array.from({ length: 25 }, (_, index) => makeCell(index % 6));
  board[12] = makeCell(0, 'row');
  board[10] = makeCell(1, 'column');
  const result = expandSpecialClears(board, [12], { width: 5, height: 5 });
  assert.equal(result.activated.length, 2);
  assert.deepEqual(
    result.indices.sort((a, b) => a - b),
    [0, 5, 10, 11, 12, 13, 14, 15, 20]
  );
});

test('只有上下左右相邻的格子可以交换', () => {
  assert.equal(areAdjacent(0, 1), true);
  assert.equal(areAdjacent(0, 8), true);
  assert.equal(areAdjacent(7, 8), false);
  assert.equal(areAdjacent(0, 9), false);
});

test('无匹配的交换回滚，合法交换会结算并保持棋盘可玩', () => {
  const board = createBoard({ seed: 2026 });
  const validMoves = findValidMoves(board);
  const [a, b] = validMoves[0];
  const result = resolveTurn(board, a, b, { random: seededRandom(808) });
  assert.equal(result.valid, true);
  assert.ok(result.score >= 240);
  assert.ok(result.collected.reduce((sum, count) => sum + count, 0) >= 3);
  assert.ok(result.steps.length >= 1);
  result.steps.forEach((step) => {
    assert.ok(step.movements.length > 0);
    assert.ok(step.movements.some((movement) => movement.spawned));
    step.movements.forEach((movement) => {
      assert.ok(movement.distance > 0);
      assert.ok(movement.to >= 0 && movement.to < BOARD_SIZE);
      assert.equal(
        ((movement.from % 8) + 8) % 8,
        movement.to % 8,
        '糖果只能在同一列内下落'
      );
      assert.equal(
        Math.floor(movement.to / 8) - Math.floor(movement.from / 8),
        movement.distance
      );
    });
  });
  assert.equal(hasMatch(result.board), false);
  assert.ok(findValidMoves(result.board).length > 0);

  let invalidPair = null;
  for (let index = 0; index < board.length && !invalidPair; index += 1) {
    for (const other of [index + 1, index + 8]) {
      if (other >= board.length || (index % 8 === 7 && other === index + 1)) continue;
      if (!validMoves.some(([left, right]) => left === index && right === other)) {
        invalidPair = [index, other];
        break;
      }
    }
  }
  assert.ok(invalidPair);
  const invalid = resolveTurn(board, invalidPair[0], invalidPair[1]);
  assert.equal(invalid.valid, false);
  assert.deepEqual(invalid.board, board);
});

test('彩虹糖与任意糖果交换，会消除棋盘上该类糖果', () => {
  const board = cells([
    { type: 0, special: 'color' }, 1, 2,
    1, 2, 0,
    2, 0, 1,
  ]);
  const result = resolveTurn(board, 0, 1, {
    width: 3,
    height: 3,
    types: 3,
    random: seededRandom(77),
  });
  assert.equal(result.valid, true);
  assert.equal(result.specialsActivated, 1);
  assert.deepEqual(result.steps[0].matched.sort((a, b) => a - b), [0, 1, 3, 8]);
});

test('无限任务随机轮换、逐步增加进度并在达标时完成', () => {
  const random = seededRandom(99);
  let previous = null;
  for (let number = 1; number <= 30; number += 1) {
    const task = createTask({ number, random, avoidKind: previous });
    assert.notEqual(task.kind, previous);
    assert.ok(task.target > 0);
    assert.ok(task.timeMs >= 26000);
    assert.ok(task.reward >= 2);
    previous = task.kind;
  }

  const scoreTask = { kind: 'score', target: 500 };
  assert.equal(advanceTask(scoreTask, 100, { score: 250 }), 350);
  assert.equal(advanceTask(scoreTask, 350, { score: 300 }), 500);
  assert.equal(isTaskComplete(scoreTask, 499), false);
  assert.equal(isTaskComplete(scoreTask, 500), true);

  const skillTask = { kind: 'skill', target: 3 };
  assert.equal(
    advanceTask(skillTask, 0, { specialsCreated: 1, specialsActivated: 2 }),
    3
  );
});

test('收集计数可跨连锁累计', () => {
  assert.deepEqual(mergeCollected([1, 2], [3, 4, 1]), [4, 6, 1, 0, 0, 0]);
  const task = { kind: 'collect', type: 2, target: 5 };
  assert.equal(advanceTask(task, 1, { collected: [0, 0, 3] }), 4);
});

test('特殊糖保留类型与技能标记', () => {
  const special = makeCell(4, 'column');
  assert.equal(typeOf(special), 4);
  assert.equal(specialOf(special), 'column');
});
