import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateGrid,
  columnWidthAt,
  columnsAt,
  defaultWidthOf,
  idealWidth,
  validate,
} from '../public/tools/grid-breakpoint/js/core.js';

const SPEC = { maxWidth: 1200, columns: 4, spacing: 24 };
const near = (actual, expected, tol = 0.01) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `期望 ${expected} ± ${tol}，实际 ${actual}`
  );

// ---------------------------------------------------------------- 验收标准

test('验收：1200 / 4 / 24 的默认列宽为 282px', () => {
  assert.equal(defaultWidthOf(SPEC), 282);
  assert.equal(calculateGrid(SPEC).defaultWidth, 282);
});

test('验收：三个 breakpoint 依次为 1025.14 / 710.4 / 384', () => {
  const { breakpoints } = calculateGrid(SPEC);
  assert.deepEqual(
    breakpoints.map((bp) => `${bp.fromColumns}→${bp.toColumns}`),
    ['4→3', '3→2', '2→1']
  );
  near(breakpoints[0].breakpoint, 1025.14);
  near(breakpoints[1].breakpoint, 710.4);
  near(breakpoints[2].breakpoint, 384);
});

test('验收：4→3 的 min / max / deviation', () => {
  const [first] = calculateGrid(SPEC).breakpoints;
  near(first.widthMin, 238.29);
  near(first.widthMax, 325.71);
  near(first.deviation, 43.71);
  near(first.idealFrom, 1200);
  near(first.idealTo, 894);
  near(282 - first.widthMin, first.widthMax - 282);
});

test('验收：3→2 与 2→1 的 min / max', () => {
  const [, second, third] = calculateGrid(SPEC).breakpoints;
  near(second.deviation, 61.2);
  near(second.widthMin, 220.8);
  near(second.widthMax, 343.2);
  near(third.deviation, 102);
  near(third.widthMin, 180);
  near(third.widthMax, 384);
});

// ---------------------------------------------------------------- 核心不变量

const CASES = [
  SPEC,
  { maxWidth: 1440, columns: 12, spacing: 16 },
  { maxWidth: 960, columns: 3, spacing: 0 },
  { maxWidth: 375, columns: 2, spacing: 8 },
  { maxWidth: 1600, columns: 6, spacing: 40 },
];

test('不变量：偏差对称，且默认列宽正好落在 min / max 中点', () => {
  for (const config of CASES) {
    const { defaultWidth, breakpoints } = calculateGrid(config);
    for (const bp of breakpoints) {
      near(defaultWidth - bp.widthMin, bp.widthMax - defaultWidth, 1e-9);
      near((bp.widthMin + bp.widthMax) / 2, defaultWidth, 1e-9);
      near(bp.deviationPercent, (bp.deviation / defaultWidth) * 100, 1e-9);
    }
  }
});

test('不变量：用原始 Grid 公式反推 min / max 一致', () => {
  for (const config of CASES) {
    const { spacing } = config;
    for (const bp of calculateGrid(config).breakpoints) {
      const rawMin = (bp.breakpoint - (bp.fromColumns - 1) * spacing) / bp.fromColumns;
      const rawMax = (bp.breakpoint - (bp.toColumns - 1) * spacing) / bp.toColumns;
      near(bp.widthMin, rawMin, 1e-9);
      near(bp.widthMax, rawMax, 1e-9);
    }
  }
});

test('不变量：相邻理想宽度之差恒为 D + S，breakpoint 逐级递减', () => {
  for (const config of CASES) {
    const { defaultWidth, breakpoints } = calculateGrid(config);
    for (const bp of breakpoints) {
      near(bp.idealFrom - bp.idealTo, defaultWidth + config.spacing, 1e-9);
      assert.ok(bp.breakpoint > bp.idealTo && bp.breakpoint < bp.idealFrom);
    }
    const widths = breakpoints.map((bp) => bp.breakpoint);
    assert.deepEqual(widths, [...widths].sort((a, b) => b - a));
  }
});

test('idealWidth 与三种等价 breakpoint 公式一致', () => {
  const { defaultWidth, breakpoints } = calculateGrid(SPEC);
  assert.equal(idealWidth(4, defaultWidth, SPEC.spacing), 1200);
  for (const bp of breakpoints) {
    const n = bp.fromColumns;
    const byIdeals = ((n - 1) * bp.idealFrom + n * bp.idealTo) / (2 * n - 1);
    const fromLower = bp.idealTo + ((n - 1) / (2 * n - 1)) * (defaultWidth + SPEC.spacing);
    near(bp.breakpoint, byIdeals, 1e-9);
    near(bp.breakpoint, fromLower, 1e-9);
  }
});

// ---------------------------------------------------------------- 边界与派生

test('单列配置没有 breakpoint，默认列宽即 max_width', () => {
  const result = calculateGrid({ maxWidth: 720, columns: 1, spacing: 24 });
  assert.equal(result.defaultWidth, 720);
  assert.deepEqual(result.breakpoints, []);
  assert.equal(columnsAt(9999, result.breakpoints), 1);
});

test('非法配置被拦下', () => {
  assert.equal(validate(SPEC), null);
  assert.ok(validate({ maxWidth: 0, columns: 4, spacing: 24 }));
  assert.ok(validate({ maxWidth: 1200, columns: 0, spacing: 24 }));
  assert.ok(validate({ maxWidth: 1200, columns: 2.5, spacing: 24 }));
  assert.ok(validate({ maxWidth: 1200, columns: 4, spacing: -1 }));
  assert.ok(validate({ maxWidth: 60, columns: 4, spacing: 24 })); // 60 <= 3 × 24
  assert.ok(validate({ maxWidth: Number.NaN, columns: 4, spacing: 24 }));
  assert.throws(() => calculateGrid({ maxWidth: 60, columns: 4, spacing: 24 }));
});

test('columnsAt 落在文档给出的区间上', () => {
  const { breakpoints } = calculateGrid(SPEC);
  assert.equal(columnsAt(1200, breakpoints), 4);
  // 用真值断言：1025.14 是文档里的四舍五入结果，实际 breakpoint 略高于它
  assert.equal(columnsAt(breakpoints[0].breakpoint, breakpoints), 4);
  assert.equal(columnsAt(1025, breakpoints), 3);
  assert.equal(columnsAt(710.4, breakpoints), 3);
  assert.equal(columnsAt(710, breakpoints), 2);
  assert.equal(columnsAt(384, breakpoints), 2);
  assert.equal(columnsAt(383, breakpoints), 1);
  assert.equal(columnsAt(0, breakpoints), 1);
});

test('columnWidthAt：breakpoint 上下正好是 min / max，超出 max_width 后封顶', () => {
  const { defaultWidth, breakpoints } = calculateGrid(SPEC);
  const [first] = breakpoints;
  near(columnWidthAt(first.breakpoint, SPEC, 4), first.widthMin, 1e-9);
  near(columnWidthAt(first.breakpoint, SPEC, 3), first.widthMax, 1e-9);
  near(columnWidthAt(1200, SPEC, 4), defaultWidth, 1e-9);
  near(columnWidthAt(2000, SPEC, 4), defaultWidth, 1e-9);
});
