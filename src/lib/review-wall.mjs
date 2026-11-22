/**
 * 评论墙的排布逻辑（纯函数，服务端首屏与浏览器脚本、tests/ 三处共用）。
 *
 * 模型：评论是一条首尾相接的环形传送带，三列只是这条带子经过面板的三段。
 * 一张卡片先在第一列向下，滚出底部后从第二列底部升上来，滚出顶部后从第三列顶部进入向下，再接回第一列顶部。
 * 三段衔接都发生在面板可见区域之外（E 比最高的卡片还大），所以看起来是同一张卡片在逐列流过。
 * 窄屏（columns = 1）时只剩一列：整条带子在中间一列里向上滚。
 */
export const GAP = 12;
/** 三列的垂直偏移：第一列、第二列（居中抬起的那列）、第三列，让三列不是整齐的横排 */
const OFFSETS_3 = [-70, 30, -50];
/** 正文一行的高度（14px，行高 1.65） */
export const LINE = 23.1;

const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** 卡片高度 = 头像行 30 + 间距 8 + 正文 N 行 + 上下内边距 28 + 描边 2 */
export const heightForLines = (lines) => Math.ceil(68 + lines * LINE);

/** 估算文字占几行用的「视觉宽度」：中日韩字符算 1，空格 0.3，其余半角约 0.56 */
export function weightedLength(text) {
  let w = 0;
  for (const ch of text) w += /[\u2e80-\u9fff\uff00-\uffef\u3000-\u303f]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.56;
  return w;
}

/** 估算正文行数（1 到 4 行；超过 4 行的评论会在第 4 行截断），cpl = 每行大约能放的汉字数 */
export function linesFor(text, cpl) {
  return Math.min(4, Math.max(1, Math.ceil(weightedLength(text) / cpl)));
}

/**
 * 按列数和面板高度排出传送带；评论太少、带子装不下时返回 null。
 * @param {number[]} hs 每张卡片的高度
 * @param {{H: number, columns: 1 | 3}} opt
 */
export function buildBelt(hs, { H, columns }) {
  const M = hs.length;
  const maxh = Math.max(...hs);
  const cum = [0];
  for (const h of hs) cum.push(cum[cum.length - 1] + h + GAP);
  const Lb = cum[M];
  const L = Lb / columns;
  const E = (L - H) / 2;
  if (!(E >= maxh)) return null;
  const off =
    columns === 3
      ? [
          clamp(OFFSETS_3[0], -E, E - maxh),
          clamp(OFFSETS_3[1], maxh - E, E),
          clamp(OFFSETS_3[2], -E, E - maxh),
        ]
      : [0, 0, 0];
  const k0 = Math.floor(M / 2);
  const u0 = (columns === 3 ? L : 0) + (H / 2 + E + off[1] - hs[k0] / 2);
  const U = hs.map((_, k) => mod(u0 + cum[k] - cum[k0], Lb));
  // 居中的卡片依次是 k0, k0-1, k0-2 …（第二列向上滚，下一张来自下方，也就是队列里更靠前的一张）
  const PRE = [0];
  for (let s = 0; s < M; s++) {
    const k = mod(k0 - s, M);
    const kn = mod(k0 - s - 1, M);
    PRE.push(PRE[s] + (hs[k] + hs[kn]) / 2 + GAP);
  }
  const belt = { M, hs, H, columns, Lb, L, E, off, k0, U, PRE };
  return popFree(belt) ? belt : null;
}

/** 换列（或绕回起点）时，滑出位置和新位置都必须完全在面板之外，否则会看到卡片突然冒出来 */
function popFree(belt) {
  for (let s = 0; s < belt.M; s++) {
    for (let i = 0; i < belt.M; i++) {
      const mv = move(belt, i, s);
      if (!mv.via) continue;
      for (const q of [mv.via, mv.to]) {
        if (!(q.y >= belt.H || q.y + belt.hs[i] <= 0)) return false;
      }
    }
  }
  return true;
}

/**
 * 按评论文字估算每张卡片的高度并排出传送带；评论太少、带子装不下时，整份重复到装得下为止（保持原顺序）。
 * @param {string[]} texts 每条评论的原文
 * @param {{H: number, columns: 1 | 3, cpl?: number}} opt cpl：每行大约能放的汉字数（服务端用偏保守的值）
 * @returns {{M: number, hs: number[], belt: object} | null}
 */
export function planFor(texts, { H, columns, cpl = 20 }) {
  const n = texts.length;
  if (!n) return null;
  for (let m = n; m <= n * 12; m += n) {
    const hs = Array.from({ length: m }, (_, i) => heightForLines(linesFor(texts[i % n], cpl)));
    const belt = buildBelt(hs, { H, columns });
    if (belt) return { M: m, hs, belt };
  }
  return null;
}

function at(belt, i, u) {
  const { hs, H, columns, L, E, off } = belt;
  const col = columns === 1 ? 1 : Math.floor(u / L);
  const v = columns === 1 ? u : u - col * L;
  return { col, y: col === 1 ? H + E - v - hs[i] + off[1] : -E + v + off[col], u };
}

/** 第 i 张卡片在第 step 步时所在的列（0 / 1 / 2）与顶边 y（面板坐标，像素） */
export function place(belt, i, step) {
  const { M, Lb, U, PRE } = belt;
  return at(belt, i, (U[i] + PRE[mod(step, M)]) % Lb);
}

/**
 * 从第 step-1 步走到第 step 步：返回 from / to；
 * 如果这一步里卡片要换列（或绕回带子起点），再给出 via：先在原来那一列里继续滑出面板的位置，
 * 滑出去之后再瞬间换到 to（from → via 有过渡，via → to 在面板之外瞬移）。
 */
export function move(belt, i, step) {
  const { M, Lb, L, PRE, columns } = belt;
  const from = place(belt, i, step - 1);
  const to = place(belt, i, step);
  const k = mod(step - 1, M);
  const unwrapped = from.u + (PRE[k + 1] - PRE[k]);
  const jump = unwrapped >= Lb || to.col !== from.col;
  if (!jump) return { from, to, via: null };
  const via = at(belt, i, unwrapped);
  // at() 按 unwrapped 所在的列算；要沿用原来那一列的坐标继续滑出
  const v = unwrapped - (columns === 1 ? 0 : from.col * L);
  const { hs, H, E, off } = belt;
  via.col = from.col;
  via.y = from.col === 1 ? H + E - v - hs[i] + off[1] : -E + v + off[from.col];
  return { from, to, via };
}

/** 第 step 步时处在面板正中、需要抬起的那张卡片 */
export function centeredIndex(belt, step) {
  return mod(belt.k0 - step, belt.M);
}
