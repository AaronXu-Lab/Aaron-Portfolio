/**
 * 专注森林 · 纯逻辑核 —— 不碰 DOM / WebGL / three。
 *
 * 计时一律用「真实时间戳」推导，不累加 tick：
 * 后台、息屏、刷新、关掉标签页再回来，进度都由 startedAt / endsAt 直接算出，
 * 因此「返回前台恢复正确进度」与「刷新后回到正确阶段」是免费的。
 *
 * 被 js/app.js 与 tests/focus-forest-core.test.mjs 共用；改这里要跑 npm run test:forest。
 */

export const STAGES = ['seed', 'sprout', 'small', 'medium', 'mature'];

/** 每页森林最多展示的株数（PRD:20～30 株）。 */
export const PAGE_SIZE = 24;

const KEY_SESSIONS = 'ff.v1.sessions';
const KEY_ACTIVE = 'ff.v1.active';

const MIN_MINUTES = 1;
const MAX_MINUTES = 180;

/** 预览档：唯一允许不足一分钟的时长（15 秒），用来快速看完整个生长过程。 */
export const PREVIEW_MINUTES = 0.25;

/** 进度 0–1 → 阶段序号 0–4（0–20% 种子、20–40% 发芽 …… 80–100% 成熟）。 */
export function stageOf(progress) {
  const p = Math.min(1, Math.max(0, Number(progress) || 0));
  return Math.min(STAGES.length - 1, Math.floor(p * STAGES.length));
}

export function clampMinutes(minutes) {
  const n = Number(minutes) || 0;
  // 预览档单独放行；其余一律取整并夹到 1–180，坏数据仍然退到 1 分钟而不是 15 秒
  if (n === PREVIEW_MINUTES) return n;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(n)));
}

/** 开始一次专注：此刻即写入 endsAt,之后一切进度都从这两个时间戳推。 */
export function createSession({ minutes, now, id }) {
  const m = clampMinutes(minutes);
  return {
    id: id || `s${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    minutes: m,
    startedAt: now,
    endsAt: now + m * 60000,
    interruptions: 0,
  };
}

export function progressOf(session, now) {
  const total = session.endsAt - session.startedAt;
  if (!(total > 0)) return 1;
  return Math.min(1, Math.max(0, (now - session.startedAt) / total));
}

export function remainingMs(session, now) {
  return Math.max(0, session.endsAt - now);
}

export function isDone(session, now) {
  return now >= session.endsAt;
}

/** 毫秒 → mm:ss（超过 99 分钟按实际分钟数展示）。 */
export function formatClock(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** 也要能格式化累计时长，所以这里不套 clampMinutes 的单次上限。 */
export function formatDuration(minutes) {
  const n = Math.max(0, Number(minutes) || 0);
  if (n > 0 && n < 1) return `${Math.round(n * 60)} 秒`; // 预览档
  const m = Math.round(n);
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} 小时 ${rest} 分钟` : `${h} 小时`;
}

/**
 * 完成：把进行中的 session 落成一条记录。
 * 同 id 只落一次 —— 完成页刷新、双击「完成」、后台唤回都不会重复种树。
 */
export function commit(sessions, session) {
  if (!session || sessions.some((r) => r.id === session.id)) return sessions;
  return [
    ...sessions,
    {
      id: session.id,
      minutes: session.minutes,
      startedAt: session.startedAt,
      endedAt: session.endsAt,
      interruptions: Math.max(0, session.interruptions | 0),
    },
  ];
}

/** localStorage 里的数据不可信（可能被改坏或跨版本）,读进来先验形状。 */
function isRecord(r) {
  return (
    r &&
    typeof r.id === 'string' &&
    Number.isFinite(r.startedAt) &&
    Number.isFinite(r.endedAt) &&
    Number.isFinite(r.minutes)
  );
}

function isSession(s) {
  return (
    s &&
    typeof s.id === 'string' &&
    Number.isFinite(s.startedAt) &&
    Number.isFinite(s.endsAt) &&
    s.endsAt > s.startedAt
  );
}

function read(store, key) {
  try {
    const raw = store?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(store, key, value) {
  try {
    if (value === null) store?.removeItem(key);
    else store?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadSessions(store = globalThis.localStorage) {
  const list = read(store, KEY_SESSIONS);
  if (!Array.isArray(list)) return [];
  return list.filter(isRecord).sort((a, b) => a.endedAt - b.endedAt);
}

export function saveSessions(list, store = globalThis.localStorage) {
  return write(store, KEY_SESSIONS, list);
}

export function loadActive(store = globalThis.localStorage) {
  const s = read(store, KEY_ACTIVE);
  return isSession(s) ? s : null;
}

export function saveActive(session, store = globalThis.localStorage) {
  return write(store, KEY_ACTIVE, session ?? null);
}

/**
 * 森林分页：按结束时间升序，每页至多 size 株，最后一页为最近的一片森林。
 * 「超过数量后按日期切换森林」与「默认只展示最近 20～30 株」由同一个机制满足。
 */
export function paginate(sessions, size = PAGE_SIZE) {
  const sorted = [...sessions].sort((a, b) => a.endedAt - b.endedAt);
  const pages = [];
  for (let end = sorted.length; end > 0; end -= size) {
    pages.unshift(sorted.slice(Math.max(0, end - size), end));
  }
  return pages;
}

export function dayLabel(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function timeLabel(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 一页森林的日期跨度，单日则只显示一个日期（区间用连字符）。 */
export function pageLabel(page) {
  if (!page?.length) return '';
  const first = dayLabel(page[0].endedAt);
  const last = dayLabel(page[page.length - 1].endedAt);
  return first === last ? first : `${first} - ${last}`;
}

export function summary(sessions) {
  const minutes = sessions.reduce((sum, r) => sum + clampMinutes(r.minutes), 0);
  return { count: sessions.length, minutes };
}

/** 由 id 派生的稳定伪随机(0–1):植物朝向与大小的细微差异不必落库。 */
export function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** 黄金角螺旋：第 i 株的 [x, z],不用手工排布也不会重叠。 */
export function forestSpot(i, spacing = 1.1) {
  const r = spacing * Math.sqrt(i + 0.55);
  const a = i * 2.399963229728653;
  return [Math.cos(a) * r, Math.sin(a) * r];
}
