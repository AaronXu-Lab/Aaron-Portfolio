import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_SIZE,
  LEVELS,
  areAdjacent,
  createBoard,
  findMatches,
  findValidMoves,
  hasMatch,
  isLevelComplete,
  makeIce,
  mergeCollected,
  remainingIce,
  resolveTurn,
  seededRandom,
  starsFor,
} from '../public/tools/candy-match/js/core.js';

test('十二个关卡都有可验证的目标与步数', () => {
  assert.equal(LEVELS.length, 12);
  for (const [index, level] of LEVELS.entries()) {
    assert.equal(level.id, index + 1);
    assert.ok(level.name);
    assert.ok(level.moves >= 18);
    assert.ok(level.score > 0);
  }
});

test('初始棋盘没有现成三连，并且一定有合法交换', () => {
  for (const level of LEVELS) {
    const board = createBoard({ seed: level.seed });
    assert.equal(board.length, BOARD_SIZE);
    assert.equal(hasMatch(board), false, `第 ${level.id} 关不应开局自动消除`);
    assert.ok(findValidMoves(board).length > 0, `第 ${level.id} 关至少应有一步可走`);
  }
});

test('横纵交叉匹配去重，但保留两条连线', () => {
  const board = Array(25).fill(null);
  board[2] = board[7] = board[12] = board[17] = board[22] = 1;
  board[10] = board[11] = board[13] = board[14] = 1;
  const matches = findMatches(board, 5, 5);
  assert.equal(matches.indices.length, 9);
  assert.equal(matches.runs.length, 2);
  assert.ok(matches.indices.includes(12));
});

test('只有上下左右相邻的格子可以交换', () => {
  assert.equal(areAdjacent(0, 1), true);
  assert.equal(areAdjacent(0, 8), true);
  assert.equal(areAdjacent(7, 8), false);
  assert.equal(areAdjacent(0, 9), false);
});

test('无消除的交换回滚，不消耗棋盘状态', () => {
  const board = createBoard({ seed: 2026 });
  let pair = null;
  for (let index = 0; index < board.length && !pair; index += 1) {
    for (const other of [index + 1, index + 8]) {
      if (other >= board.length || (index % 8 === 7 && other === index + 1)) continue;
      if (!findValidMoves(board).some(([a, b]) => a === index && b === other)) {
        pair = [index, other];
        break;
      }
    }
  }
  assert.ok(pair);
  const result = resolveTurn(board, pair[0], pair[1], { random: seededRandom(9) });
  assert.equal(result.valid, false);
  assert.deepEqual(result.board, board);
});

test('合法交换会结算分数、收集糖果并保持棋盘可玩', () => {
  const board = createBoard({ seed: 77 });
  const [a, b] = findValidMoves(board)[0];
  const result = resolveTurn(board, a, b, {
    ice: Array(BOARD_SIZE).fill(0),
    random: seededRandom(808),
  });
  assert.equal(result.valid, true);
  assert.ok(result.score >= 240);
  assert.ok(result.collected.reduce((sum, count) => sum + count, 0) >= 3);
  assert.ok(result.steps.length >= 1);
  assert.equal(hasMatch(result.board), false);
  assert.ok(findValidMoves(result.board).length > 0);
});

test('匹配到的果冻会逐层消除', () => {
  const board = createBoard({ seed: 901 });
  const [a, b] = findValidMoves(board)[0];
  const preview = resolveTurn(board, a, b, { random: seededRandom(902) });
  const target = preview.steps[0].matched[0];
  const ice = Array(BOARD_SIZE).fill(0);
  ice[target] = 2;
  const result = resolveTurn(board, a, b, { ice, random: seededRandom(902) });
  assert.equal(result.ice[target], 1);
  assert.equal(remainingIce(result.ice), 1);
});

test('关卡完成必须同时满足分数、收集与果冻目标', () => {
  const level = {
    moves: 20,
    score: 1000,
    collect: { 0: 4, 2: 3 },
    ice: [[0, 1]],
  };
  const complete = { score: 1000, collected: [4, 0, 3], ice: Array(64).fill(0) };
  assert.equal(isLevelComplete(level, complete), true);
  assert.equal(isLevelComplete(level, { ...complete, score: 999 }), false);
  assert.equal(isLevelComplete(level, { ...complete, collected: [4, 0, 2] }), false);
  assert.equal(isLevelComplete(level, { ...complete, ice: makeIce(level) }), false);
});

test('累计收集、果冻层数与星级边界', () => {
  assert.deepEqual(mergeCollected([1, 2], [3, 4, 1]), [4, 6, 1, 0, 0, 0]);
  assert.equal(remainingIce([0, 1, 2, 0]), 3);
  const level = { moves: 20 };
  assert.equal(starsFor(level, 8), 3);
  assert.equal(starsFor(level, 4), 2);
  assert.equal(starsFor(level, 0), 1);
});
