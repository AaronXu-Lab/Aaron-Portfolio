/**
 * Grid Breakpoint 计算器 · 纯逻辑核（无 DOM 依赖，被 app.js 与 tests/ 共用）
 *
 * Equal Column Deviation：Grid 从 n 列切到 n - 1 列时，把 breakpoint 放在
 * 「切换前后的单列宽度相对默认列宽的偏差相等」的那个位置，
 * 即 width_before + width_after = 2 × width_default。
 *
 * 全程保留浮点精度，取整一律留给展示层。
 */

/** 默认列宽 D：max_width 下摆满 column 列时的单列宽度。 */
export function defaultWidthOf({ maxWidth, columns, spacing }) {
  return (maxWidth - (columns - 1) * spacing) / columns;
}

/** 理想宽度 I_n：n 列都恰好等于默认列宽时，整个 Grid 该有多宽。 */
export function idealWidth(n, defaultWidth, spacing) {
  return n * defaultWidth + (n - 1) * spacing;
}

/** 配置合法性检查；不合法返回错误文案，合法返回 null。 */
export function validate({ maxWidth, columns, spacing }) {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return '最大宽度需要是大于 0 的数字';
  if (!Number.isInteger(columns) || columns < 1) return '列数需要是不小于 1 的整数';
  if (!Number.isFinite(spacing) || spacing < 0) return '间距不能是负数';
  if (maxWidth <= (columns - 1) * spacing) return '间距吃掉了全部宽度，默认列宽不大于 0';
  return null;
}

/**
 * 从 max_width / column / spacing 推导全部 breakpoint。
 * 返回 { defaultWidth, breakpoints }，breakpoints 按列数从多到少排列。
 */
export function calculateGrid(config) {
  const invalid = validate(config);
  if (invalid) throw new Error(invalid);

  const { columns, spacing } = config;
  const defaultWidth = defaultWidthOf(config);
  const breakpoints = [];

  for (let n = columns; n >= 2; n--) {
    const idealFrom = idealWidth(n, defaultWidth, spacing);
    const idealTo = idealWidth(n - 1, defaultWidth, spacing);
    // BP_n = I_n - n / (2n - 1) × (D + S)，与 ((n-1)I_n + n·I_(n-1)) / (2n-1) 等价
    const breakpoint = idealFrom - (n / (2 * n - 1)) * (defaultWidth + spacing);
    const deviation = (defaultWidth + spacing) / (2 * n - 1);

    breakpoints.push({
      fromColumns: n,
      toColumns: n - 1,
      breakpoint,
      widthMin: defaultWidth - deviation,
      widthMax: defaultWidth + deviation,
      deviation,
      deviationPercent: (deviation / defaultWidth) * 100,
      idealFrom,
      idealTo,
    });
  }

  return { defaultWidth, breakpoints };
}

/** 宽度 width 下实际显示几列。列数越多的 breakpoint 排在前面，取第一个够宽的。 */
export function columnsAt(width, breakpoints) {
  const hit = breakpoints.find((bp) => width >= bp.breakpoint);
  return hit ? hit.fromColumns : 1;
}

/** 宽度 width 下的实际单列宽度；内容区不会超过 max_width。 */
export function columnWidthAt(width, { maxWidth, spacing }, columns) {
  const content = Math.min(width, maxWidth);
  return (content - (columns - 1) * spacing) / columns;
}
