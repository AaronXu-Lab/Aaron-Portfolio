/**
 * 组件注册表：/design/ 页「组件」区块的卡片索引与每个单组件页（/design/components/<slug>/）的唯一数据源。
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
    name: 'Button',
    source: '.btn / .btn-outline / .btn-ghost / .btn-sm / .btn-xs / .btn-icon / .btn-capsule',
    group: 'Basics',
    summary: '触发主要或次要操作。主按钮用于页面唯一的核心行动，次级按钮用于并列的备选行动。',
    props: [
      {
        name: 'size',
        label: '尺寸',
        options: [
          { value: 'md', label: 'md · 54px' },
          { value: 'sm', label: 'sm · 44px', cls: 'btn-sm' },
          { value: 'xs', label: 'xs · 28px', cls: 'btn-xs' },
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
        name: 'shape',
        label: '形状',
        options: [
          { value: 'rounded', label: 'rounded 圆角' },
          { value: 'capsule', label: 'capsule 胶囊', cls: 'btn-capsule' },
        ],
        default: 'rounded',
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
    name: 'TextLink',
    source: 'TextLink.astro',
    group: 'Basics',
    summary: '虚线下划线文字，尾部箭头可选。有 href 渲染为链接，没有则渲染为按钮；aria-expanded 为 true 时箭头旋转 180°。',
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
          { value: 'arrow-up', cls: 'pv-i-up' },
          { value: 'arrow-bend-down-right', cls: 'pv-i-bend' },
          { value: 'none', label: 'none · 无箭头', cls: 'pv-i-none' },
        ],
        default: 'arrow-right',
      },
    ],
  },
  {
    slug: 'auto-border-image',
    name: 'AutoBorderImage',
    source: 'AutoBorderImage.astro',
    group: 'Basics',
    summary: '图标类图片：构建时读取图片边缘亮度，浅色主题下边缘偏亮的加描边，深色主题下判断相反，边缘偏深的加描边，中间调不描边；四周是透明抠图的图（边缘一圈不透明占比低于 50%）两种主题都描边。border 可强制开或关。',
    props: [
      {
        name: 'border',
        label: '描边',
        options: [
          { value: 'auto' },
          { value: 'on', cls: 'pv-b-on' },
          { value: 'off', cls: 'pv-b-off' },
        ],
        default: 'auto',
      },
    ],
  },
  {
    slug: 'badge',
    name: 'Badge',
    source: '.badge + .badge-text / .badge-accent / .badge-dark / .badge-fill',
    group: 'Basics',
    summary: '标注状态或身份的小标签，不可点击。字体、颜色、样式三个属性互相独立、可任意组合：等宽小字用于状态（WORK IN PROGRESS），正文字体加粗用于内容里的标注（经历上的 NOW、创业项目）。',
    props: [
      {
        name: 'type',
        label: '字体',
        options: [
          { value: 'mono', label: 'mono · 等宽小字' },
          { value: 'text', label: 'text · 正文加粗', cls: 'badge-text' },
        ],
        default: 'mono',
      },
      {
        name: 'tone',
        label: '颜色',
        options: [
          { value: 'neutral', label: 'neutral · 中性灰' },
          { value: 'accent', label: 'accent · 强调蓝', cls: 'badge-accent' },
          { value: 'dark', label: 'dark · 深色', cls: 'badge-dark' },
        ],
        default: 'neutral',
      },
      {
        name: 'style',
        label: '样式',
        options: [
          { value: 'outline', label: 'outline · 描边' },
          { value: 'fill', label: 'fill · 实心', cls: 'badge-fill' },
        ],
        default: 'outline',
      },
    ],
  },
  {
    slug: 'chip',
    name: 'Chip',
    source: '.chip',
    group: 'Basics',
    summary: '圆角胶囊，用于关键词与分类（产品标签、博客分类筛选）。本身不可点击；做成按钮时（博客筛选）由页面补充选中态。',
  },
  {
    slug: 'skill-card',
    name: 'SkillCard',
    source: 'SkillCard.astro',
    group: 'Basics',
    summary: 'Skill 卡片：顶部居中放 Phosphor duotone 图标，下方中文名 + 两行描述，整张可点。悬停时标题向上滚动换成真实名称（SKILL.md 的 name）。数据来自 src/data/skills.ts。',
    previewWidth: 300,
  },
  {
    slug: 'card',
    name: 'Card',
    source: '.card',
    group: 'Basics',
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
    name: 'Band',
    source: '.band',
    group: 'Basics',
    summary: '在两种主题下都保持深色的强调区块，内部使用独立的 band token。',
  },
  {
    slug: 'section-head',
    name: 'SectionHead',
    source: 'SectionHead.astro',
    group: 'Layout',
    summary: '案例页区块的标题行：编号 + 中文名 + 英文 mono 标签，右侧可放内容。',
    block: true,
  },
  {
    slug: 'media-slot',
    name: 'MediaSlot',
    source: 'MediaSlot.astro',
    group: 'Layout',
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
    name: 'Icon',
    source: 'Icon.astro',
    group: 'Layout',
    summary: 'Phosphor regular 图标。新增图标：在 Icon.astro 里 import 并登记，再补到预览列表。',
    block: true,
  },
  {
    slug: 'hero-caret',
    name: 'HeroCaret',
    source: 'HeroCaret.astro',
    group: 'Home',
    summary: '绝对定位在首屏底部居中的向下箭头；减弱动效时不浮动。',
  },
  {
    slug: 'case-list',
    name: 'CaseList',
    source: 'CaseList.astro',
    group: 'Sections',
    summary: '首页精选作品列表；传 all 渲染 /work/ 全部。数据来自 src/data/cases.ts。',
    block: true,
  },
  {
    slug: 'footer',
    name: 'Footer',
    source: 'Footer.astro',
    group: 'Sections',
    summary: '全站页脚，分简版（版权 + 回到顶部）和完整版两种形态，下方同时展示。',
    block: true,
  },
];

export const groups = ['Basics', 'Layout', 'Home', 'Sections'];

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
