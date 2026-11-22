/**
 * 组件注册表：/components/ 索引与每个单组件页的唯一数据源。
 * 新增或调整组件：只改这里 + 组件本身 + ComponentPreview.astro 里对应 slug 的预览。
 * - props 为空 / 未设置：只做静态预览，不渲染控件与 Properties 区
 * - 每个属性的取值通过 cls（追加到预览根元素的类名）和 style（内联样式）落到预览上，
 *   原生 JS 只负责切换这两样，不含任何组件逻辑
 */

export interface PropOption {
  value: string;
  label?: string;
  /** 追加到预览根元素的类名（可含多个，空格分隔） */
  cls?: string;
  /** 追加到预览根元素的内联样式 */
  style?: Record<string, string>;
}

export interface PropDef {
  name: string;
  label: string;
  /** select 下拉；switch 两值开关（options[0] 关、options[1] 开） */
  type?: 'select' | 'switch';
  options: PropOption[];
  default: string;
  /** 依赖条件：仅当 prop 的当前值在 values 内才可编辑，否则控件禁用并显示 disabledReason */
  enabledWhen?: { prop: string; values: string[]; disabledReason: string };
}

export interface ComponentDef {
  slug: string;
  name: string;
  /** 源文件或 CSS 原语，显示在标题旁 */
  source: string;
  group: string;
  summary: string;
  props?: PropDef[];
  /** 预览区的最大宽度（px），不设则撑满 */
  previewWidth?: number;
  /** 预览区是否按整块宽度排布（案例列表、页脚等） */
  block?: boolean;
}

export const components: ComponentDef[] = [
  {
    slug: 'button',
    name: '按钮',
    source: '.btn / .btn-outline / .btn-ghost / .btn-sm / .btn-icon',
    group: '基础',
    summary: '触发主要或次要操作。主按钮用于页面唯一的核心行动，次级按钮用于并列的备选行动。',
    props: [
      {
        name: 'size',
        label: '尺寸',
        options: [
          { value: 'md', label: 'md · 54px' },
          { value: 'sm', label: 'sm · 44px', cls: 'btn-sm' },
        ],
        default: 'md',
      },
      {
        name: 'style',
        label: '样式',
        options: [
          { value: 'primary', label: 'primary 主按钮' },
          { value: 'outline', label: 'outline 次级', cls: 'btn-outline' },
          { value: 'ghost', label: 'ghost 无描边', cls: 'btn-ghost' },
        ],
        default: 'primary',
      },
      {
        name: 'type',
        label: '内容',
        options: [
          { value: 'text' },
          { value: 'icon', cls: 'btn-icon' },
          { value: 'icon+text', cls: 'pv-has-icon' },
        ],
        default: 'text',
      },
      {
        name: 'arrow',
        label: '尾部箭头',
        options: [
          { value: 'none' },
          { value: 'right', label: 'right →', cls: 'pv-arrow-r' },
          { value: 'up-right', label: 'up-right ↗', cls: 'pv-arrow-ur' },
        ],
        default: 'none',
        enabledWhen: {
          prop: 'type',
          values: ['text', 'icon+text'],
          disabledReason: 'Set 「type」 to 「text」 or 「icon+text」 to enable',
        },
      },
    ],
  },
  {
    slug: 'text-link',
    name: '文字链接',
    source: 'TextLink.astro',
    group: '基础',
    summary: '虚线下划线文字加箭头。有 href 渲染为链接，没有则渲染为按钮；aria-expanded 为 true 时箭头旋转 180°。',
    props: [
      {
        name: 'size',
        label: '尺寸',
        options: [
          { value: 'sm', label: 'sm · 14px' },
          { value: 'md', label: 'md · 16px', cls: 'tl-md' },
        ],
        default: 'sm',
      },
      {
        name: 'icon',
        label: '图标',
        options: [
          { value: 'arrow-right' },
          { value: 'arrow-down', cls: 'pv-i-down' },
          { value: 'arrow-bend-down-right', cls: 'pv-i-bend' },
        ],
        default: 'arrow-right',
      },
    ],
  },
  {
    slug: 'badge',
    name: '徽章与标签',
    source: '.badge / .chip',
    group: '基础',
    summary: '徽章标注状态（等宽小字），标签标注分类（圆角胶囊）。两者都不可点击。',
    props: [
      {
        name: 'variant',
        label: '类型',
        options: [
          { value: 'badge', label: 'badge 描边', cls: 'badge' },
          { value: 'badge-solid', label: 'badge 实心', cls: 'badge badge-solid' },
          { value: 'chip', label: 'chip 标签', cls: 'chip' },
        ],
        default: 'badge',
      },
    ],
  },
  {
    slug: 'card',
    name: '卡片',
    source: '.card',
    group: '基础',
    summary: '1px 描边的容器，仅在需要层级时使用。作为链接时悬停上浮。',
    previewWidth: 360,
    props: [
      {
        name: 'interactive',
        label: '可交互',
        type: 'switch',
        options: [{ value: 'off' }, { value: 'on', cls: 'card-hover' }],
        default: 'off',
      },
    ],
  },
  {
    slug: 'band',
    name: '深色带区',
    source: '.band',
    group: '基础',
    summary: '在两种主题下都保持深色的强调区块，内部使用独立的 band token。',
  },
  {
    slug: 'section-head',
    name: '区块头',
    source: 'SectionHead.astro',
    group: '布局',
    summary: '案例页区块的标题行：编号 + 中文名 + 英文 mono 标签，右侧可放内容。',
    block: true,
  },
  {
    slug: 'media-slot',
    name: '媒体占位',
    source: 'MediaSlot.astro',
    group: '布局',
    summary: '图片位组件：未传 src 时显示斜纹占位并标注 Figma 节点，传入后渲染真实图片并保持外框比例。',
    previewWidth: 440,
    props: [
      {
        name: 'ratio',
        label: '比例',
        options: ['16 / 9', '21 / 9', '4 / 3', '1 / 1'].map((r) => ({
          value: r,
          style: { 'aspect-ratio': r },
        })),
        default: '16 / 9',
      },
    ],
  },
  {
    slug: 'icon',
    name: '图标',
    source: 'Icon.astro',
    group: '布局',
    summary: 'Phosphor regular 图标。新增图标：在 Icon.astro 里 import 并登记，再补到预览列表。',
    block: true,
  },
  {
    slug: 'hero-caret',
    name: '首屏向下按钮',
    source: 'HeroCaret.astro',
    group: '首页',
    summary: '绝对定位在首屏底部居中的向下箭头；减弱动效时不浮动。',
  },
  {
    slug: 'case-list',
    name: '案例列表',
    source: 'CaseList.astro',
    group: '整块',
    summary: '首页精选作品列表；传 all 渲染 /work/ 全部。数据来自 src/data/cases.ts。',
    block: true,
  },
  {
    slug: 'footer',
    name: '页脚',
    source: 'Footer.astro',
    group: '整块',
    summary: '全站页脚，分简版（版权 + 回到顶部）和完整版两种形态，下方同时展示。',
    block: true,
  },
];

export const groups = ['基础', '布局', '首页', '整块'];

export const bySlug = (slug: string) => components.find((c) => c.slug === slug)!;

/** 取每个属性某个取值对应的 cls / style，合成预览根元素的类名与内联样式 */
export function resolveVariant(def: ComponentDef, picks: Record<string, string> = {}) {
  const cls: string[] = [];
  const style: Record<string, string> = {};
  for (const p of def.props ?? []) {
    const v = picks[p.name] ?? p.default;
    const opt = p.options.find((o) => o.value === v) ?? p.options[0];
    if (opt.cls) cls.push(opt.cls);
    Object.assign(style, opt.style);
  }
  return {
    cls: cls.join(' '),
    style: Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; '),
  };
}
