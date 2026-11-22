import test from 'node:test';
import assert from 'node:assert/strict';
import { GAP, heightForLines, linesFor, planFor, place, move, centeredIndex } from '../src/lib/review-wall.mjs';

const H = 440;
// 与 src/data/reviews.ts 里真实评论的长短一致：多数是一句话，少数三四十到六十字
const lens = [61, 8, 45, 9, 30, 8, 49, 10, 33, 15, 6, 24, 8, 15, 11, 4];
const texts = lens.map((n) => '字'.repeat(n));

test('估算行数：中文按字数、英文半角更窄，最多 4 行', () => {
  assert.equal(linesFor('字'.repeat(8), 17), 1);
  assert.equal(linesFor('字'.repeat(18), 17), 2);
  assert.equal(linesFor('字'.repeat(200), 17), 4);
  assert.equal(linesFor('a'.repeat(30), 17), 1, '半角字符更窄');
  assert.ok(heightForLines(1) < heightForLines(2) && heightForLines(2) < heightForLines(3));
});

for (const columns of [3, 1]) {
  test(`columns=${columns}：带子闭合，居中的卡片正好在面板正中`, () => {
    const plan = planFor(texts, { H, columns });
    assert.ok(plan, '16 条评论应当排得下');
    const { belt, hs } = plan;
    assert.equal(belt.PRE[belt.M].toFixed(6), belt.Lb.toFixed(6), '走完一圈正好是整条带子的长度');
    for (let s = 0; s < belt.M * 2; s++) {
      const k = centeredIndex(belt, s);
      const p = place(belt, k, s);
      assert.equal(p.col, 1, '抬起的卡片在第二列');
      assert.ok(Math.abs(p.y + hs[k] / 2 - H / 2) < 1e-6, `第 ${s} 步居中`);
    }
  });

  test(`columns=${columns}：每一步每一列的可见区域都被卡片连续排满，换列只发生在面板之外`, () => {
    const { belt, hs } = planFor(texts, { H, columns });
    for (let s = 0; s < belt.M; s++) {
      const vis = { 0: [], 1: [], 2: [] };
      for (let i = 0; i < belt.M; i++) {
        const a = place(belt, i, s);
        const mv = move(belt, i, s);
        assert.ok(mv.to.col === a.col && Math.abs(mv.to.y - a.y) < 1e-9);
        if (mv.via) {
          // 换列的一步：先沿原来的列滑出面板，再在面板之外瞬移到新位置
          for (const q of [mv.via, mv.to]) {
            assert.ok(q.y >= H || q.y + hs[i] <= 0, `第 ${s} 步卡片 ${i} 换列时${q === mv.via ? '滑出位置' : '新位置'}在可见区域内`);
          }
        } else {
          assert.equal(mv.from.col, mv.to.col, '不换列时前后在同一列');
        }
        if (a.y < H && a.y + hs[i] > 0) vis[a.col].push([a.y, a.y + hs[i]]);
      }
      const cols = columns === 3 ? [0, 1, 2] : [1];
      for (const c of cols) {
        const iv = vis[c].sort((x, y) => x[0] - y[0]);
        assert.ok(iv.length >= 2, `第 ${s} 步第 ${c} 列有卡片`);
        assert.ok(iv[0][0] <= GAP && iv.at(-1)[1] >= H - GAP, `第 ${s} 步第 ${c} 列两端被排满（最多留一个间距）`);
        for (let j = 0; j + 1 < iv.length; j++) {
          assert.ok(Math.abs(iv[j + 1][0] - iv[j][1] - GAP) < 1e-6, `第 ${s} 步第 ${c} 列卡片间距一致`);
        }
      }
    }
  });
}

test('评论整份重复时，同一条评论不会在同一时刻出现在面板里两次', () => {
  const { belt, M } = planFor(texts, { H, columns: 3 });
  const n = texts.length;
  for (let s = 0; s < M; s++) {
    const seen = new Set();
    for (let i = 0; i < M; i++) {
      const p = place(belt, i, s);
      if (p.y < H && p.y + belt.hs[i] > 0) {
        assert.ok(!seen.has(i % n), `第 ${s} 步评论 ${i % n} 同时出现了两次`);
        seen.add(i % n);
      }
    }
  }
});

test('评论太少时整份重复到够用', () => {
  const few = texts.slice(0, 4);
  const plan = planFor(few, { H, columns: 3 });
  assert.ok(plan && plan.M % 4 === 0 && plan.M > 4);
});
