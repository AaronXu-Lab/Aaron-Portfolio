import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAGE_SIZE,
  PREVIEW_MINUTES,
  clampMinutes,
  commit,
  createSession,
  formatClock,
  formatDuration,
  isDone,
  loadActive,
  loadSessions,
  pageLabel,
  paginate,
  progressOf,
  remainingMs,
  saveActive,
  saveSessions,
  stageOf,
  summary,
} from '../public/tools/focus-forest/js/core.js';

/** 最小 localStorage 替身。 */
function fakeStore(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

const session = (over = {}) => ({
  id: 's1',
  minutes: 25,
  startedAt: 1_000_000,
  endsAt: 1_000_000 + 25 * 60000,
  interruptions: 0,
  ...over,
});

test('五个阶段按 20% 一档切换，两端夹紧', () => {
  assert.equal(stageOf(0), 0);
  assert.equal(stageOf(0.19), 0);
  assert.equal(stageOf(0.2), 1);
  assert.equal(stageOf(0.4), 2);
  assert.equal(stageOf(0.6), 3);
  assert.equal(stageOf(0.8), 4);
  assert.equal(stageOf(1), 4);
  assert.equal(stageOf(3), 4);
  assert.equal(stageOf(-1), 0);
  assert.equal(stageOf(NaN), 0);
});

test('进度只由时间戳推导：后台多久回来都落在正确阶段', () => {
  const s = session();
  assert.equal(progressOf(s, s.startedAt), 0);
  assert.equal(stageOf(progressOf(s, s.startedAt + 12 * 60000)), 2);
  assert.equal(progressOf(s, s.endsAt + 99 * 60000), 1); // 迟到很久也不会超过 1
  assert.equal(remainingMs(s, s.endsAt + 5000), 0);
  assert.equal(isDone(s, s.endsAt - 1), false);
  assert.equal(isDone(s, s.endsAt), true);
});

test('时长与倒计时格式', () => {
  assert.equal(formatClock(25 * 60000), '25:00');
  assert.equal(formatClock(61_000), '01:01');
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(-500), '00:00');
  // 累计时长会远超单次上限，不能被 clampMinutes 削掉
  assert.equal(formatDuration(45), '45 分钟');
  assert.equal(formatDuration(60), '1 小时');
  assert.equal(formatDuration(1215), '20 小时 15 分钟');
  assert.equal(formatDuration(0), '0 分钟');
  assert.equal(clampMinutes(0), 1);
  assert.equal(clampMinutes(999), 180);
  assert.equal(clampMinutes('45'), 45);
  assert.equal(clampMinutes('abc'), 1);
});

test('15 秒预览档：唯一不足一分钟的时长', () => {
  assert.equal(PREVIEW_MINUTES, 0.25);
  assert.equal(clampMinutes(PREVIEW_MINUTES), PREVIEW_MINUTES, '预览档原样放行');
  assert.equal(clampMinutes('0.25'), PREVIEW_MINUTES, '来自 data-min 的字符串同样放行');
  assert.equal(clampMinutes(0.4), 1, '其余不足一分钟的值仍然退到 1 分钟');
  assert.equal(formatDuration(PREVIEW_MINUTES), '15 秒');
  assert.equal(formatDuration(0), '0 分钟', '零仍按分钟说');

  const s = createSession({ minutes: PREVIEW_MINUTES, now: 1000 });
  assert.equal(s.endsAt - s.startedAt, 15_000);
  assert.equal(formatClock(remainingMs(s, s.startedAt)), '00:15');
  // 预览档也要能累进统计：4 次 = 1 分钟
  assert.equal(summary(Array.from({ length: 4 }, () => ({ minutes: PREVIEW_MINUTES }))).minutes, 1);
});

test('createSession 夹紧时长', () => {
  const s = createSession({ minutes: 500, now: 1000 });
  assert.equal(s.minutes, 180);
  assert.equal(s.endsAt, 1000 + 180 * 60000);
  assert.ok(s.id.length > 1);
});

test('同一次专注只种一棵树', () => {
  const s = session();
  const once = commit([], s);
  const twice = commit(once, s);
  assert.equal(once.length, 1);
  assert.equal(twice.length, 1);
  assert.equal(twice, once, '重复提交应原样返回，不产生新数组');
  assert.equal(once[0].id, s.id);
  assert.equal(once[0].endedAt, s.endsAt);
  assert.equal(commit(once, session({ id: 's2' })).length, 2);
});

test('森林分页：最后一页是最近的一片，每页不超过上限', () => {
  const make = (n) =>
    Array.from({ length: n }, (_, i) => ({
      id: `s${i}`,
      minutes: 25,
      startedAt: i,
      endedAt: i + 1,
    }));

  assert.deepEqual(paginate([]), []);
  assert.equal(paginate(make(PAGE_SIZE)).length, 1);

  const pages = paginate(make(PAGE_SIZE + 1));
  assert.equal(pages.length, 2);
  assert.equal(pages[0].length, 1, '最早的一株单独成第一页');
  assert.equal(pages[1].length, PAGE_SIZE);
  assert.equal(pages[1].at(-1).id, `s${PAGE_SIZE}`, '最后一页收尾于最新记录');
});

test('日期跨度标签：同一天只显示一个日期', () => {
  const day = (iso) => ({ id: iso, minutes: 25, startedAt: 0, endedAt: Date.parse(iso) });
  assert.equal(pageLabel([day('2026-07-25T09:00'), day('2026-07-25T21:00')]), '2026.07.25');
  assert.equal(
    pageLabel([day('2026-07-20T09:00'), day('2026-07-25T09:00')]),
    '2026.07.20 - 2026.07.25'
  );
  assert.equal(pageLabel([]), '');
});

test('本地存储往返，并且拒收坏数据', () => {
  const store = fakeStore();
  const s = session();
  assert.equal(saveActive(s, store), true);
  assert.deepEqual(loadActive(store), s);
  saveActive(null, store);
  assert.equal(loadActive(store), null);

  saveSessions(commit([], s), store);
  assert.equal(loadSessions(store).length, 1);

  const broken = fakeStore({
    'ff.v1.sessions': '[{"id":1},{"nope":true},{"id":"ok","startedAt":1,"endedAt":2,"minutes":5}]',
    'ff.v1.active': '{"id":"x","startedAt":9,"endsAt":9}',
  });
  assert.equal(loadSessions(broken).length, 1, '只留形状正确的记录');
  assert.equal(loadActive(broken), null, 'endsAt 不晚于 startedAt 的会话作废');

  const garbage = fakeStore({ 'ff.v1.sessions': '{oops', 'ff.v1.active': 'nope' });
  assert.deepEqual(loadSessions(garbage), []);
  assert.equal(loadActive(garbage), null);
});

test('统计口径', () => {
  assert.deepEqual(summary([]), { count: 0, minutes: 0 });
  assert.deepEqual(summary([session(), session({ id: 's2', minutes: 45 })]), {
    count: 2,
    minutes: 70,
  });
});
