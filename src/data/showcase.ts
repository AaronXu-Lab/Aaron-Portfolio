/**
 * 首页与二级页（/work/、/products/）共用的展示数据 —— 两边内容必须一致，所以只在这里写一份。
 *  · works：精选作品（首页 01、/work/ 精选案例）
 *  · earlyWorks：更早的作品（首页悬浮卡、/work/ 卡片）
 *  · experiments：实验项目（/work/ 顶部模板位，空数组时不渲染）
 *  · featuredProduct / productCards：大产品（首页 02、/products/ 01）
 *  · skillPicks：三个代表 Skill（首页 02、/products/ 04）
 *  · designSystems：设计系统（/products/ 05）
 */
import { historical } from './cases';
import { products, type ProductEntry } from './products';
import { skills as agentSkills } from './skills';
import { figmaLikes, figmaUsers, githubStars } from './stats';
import stats from './stats.json';

export interface WorkEntry {
  kicker: string;
  title: [string, string];
  desc: string;
  tags: string[];
  href: string;
  newTab?: boolean;
  media: { label: string; src?: string };
}

export const works: WorkEntry[] = [
  {
    kicker: 'AI 时代的工作方式',
    title: ['我的 Design Agent：', '让 AI 稳定产出可上线的设计稿'],
    desc: '把设计系统、DESIGN.md 和一组自写的 Agent Skill 组合成一个设计 Agent，让 AI 的产出可执行、可校验，并能和开发并行协作。',
    tags: ['DESIGN.md', 'Agent Skills', 'Claude Code'],
    href: '/work/ai-design-system/',
    media: { label: 'Design Agent 封面：Agent 工作流 / 产出设计稿' },
  },
  {
    kicker: 'Followup.AI',
    title: ['AI 项目管理平台：', '从 0 到 1 搭建完整设计体系'],
    desc: '在初创团队中主导 AI 项目管理平台从 0 到 1 的全流程设计，搭建设计系统、定义 20+ 种 Column 类型，并探索「意图驱动」的 AI 交互方式。',
    tags: ['初创团队', 'B 端 SaaS', '设计系统', 'AI Agent'],
    href: '/work/followup-ai/',
    media: { label: 'Followup.AI 产品界面', src: '/media/followup/overview.jpg' },
  },
  {
    kicker: '独立设计与开发',
    title: ['漫漫书架：', '一个人设计并写完的漫画阅读器'],
    desc: '支持多格式与多网盘，借助 ComfyUI 把任意漫画页转换成特定画风。从交互到代码都由自己完成，已在 App Store 上线。',
    tags: ['SwiftUI', 'ComfyUI', 'Design to Code'],
    href: '/work/comic-manga/',
    media: { label: '漫漫书架：拿在手里的 iPad 上显示书架页', src: '/media/comic/subtly-improve-the-tablet.jpg' },
  },
];

const figmaOf = (label: string) => historical.find((h) => h.label === label)?.figma ?? '/work/';
/** Figma 链接里的 node-id → MediaSlot 用的节点号 */
export const nodeOf = (href: string) => {
  try {
    return new URL(href).searchParams.get('node-id')?.replace('-', ':');
  } catch {
    return undefined;
  }
};

export interface EarlyWork {
  name: string;
  /** 首页悬浮卡的一句话 */
  desc: string;
  /** /work/ 卡片上的介绍 */
  detail: string;
  org: string;
  /** 公司 logo（public 路径）；没有时显示 mark 文字占位 */
  logo?: string;
  mark: string;
  badge?: string;
  /** Figma 原稿 */
  href: string;
  /** 首页悬浮卡配图 */
  img?: string;
}

export const earlyWorks: EarlyWork[] = [
  {
    name: '智能座舱体验度量',
    desc: '把座舱里的感官体验拆成可测的技术指标，填补公司座舱评价体系的空白。',
    detail: '把「坐着舒不舒服、屏幕好不好用」这类主观感受，拆成可以测量的技术指标，补上公司座舱评价体系里缺的一块。',
    org: '小鹏汇天',
    mark: 'XPENG',
    href: figmaOf('智能座舱度量体系'),
  },
  {
    name: 'ColorOS 跨屏互联',
    desc: '定义手机、平板与 PC 之间跨端流转的底层交互逻辑，获「极致体验奖」。',
    detail: '定义手机、平板与电脑之间跨端流转的底层交互规则，是 OPPO 当年的年度重点项目，获「极致体验奖」。',
    org: 'OPPO',
    logo: '/media/products/coloros-icon.png',
    mark: 'OPPO',
    href: figmaOf('跨屏互联创新项目'),
  },
  {
    name: 'OPPO 车机设计洞察',
    desc: '车机创新预研中的设计洞察，为新驾驶模式的落地与后续规划提供依据。',
    detail: '在车机创新预研里做设计洞察，为新驾驶模式的落地和后续规划提供依据。',
    org: 'OPPO',
    mark: 'OPPO',
    href: figmaOf('OPPO 车机设计洞察'),
  },
  {
    name: '腾讯公益课件 AI 配图',
    desc: '用 ComfyUI 工作流为公益课件生成配图。',
    detail: '搭了一套 ComfyUI 工作流，为公益课件生成配图。',
    org: '腾讯公益',
    mark: '腾讯',
    href: figmaOf('腾讯公益课件 AI 配图'),
  },
];

export interface ExperimentEntry {
  title: string;
  desc: string;
  href: string;
  cta?: string;
}

/** 实验项目：现在还没有，加一条记录后 /work/ 顶部自动出现深色卡片 */
export const experiments: ExperimentEntry[] = [];

const productBySlug = (slug: string): ProductEntry => {
  const p = products.find((x) => x.slug === slug);
  if (!p) throw new Error(`products.ts 缺少 ${slug}`);
  return p;
};

const mastergo = productBySlug('mastergo2figma');
export const featuredProduct = {
  name: 'MasterGo Importer',
  meta: '非常受欢迎的 Figma 插件（已开源）',
  kind: 'Figma 插件 · 已开源',
  desc: 'MasterGo 不支持导出，我写了个 Figma 插件，支持直接解析 .mg 文件，导入回来继续编辑。',
  /** 首页「大产品」主推卡的数据行 */
  stats: [`${figmaLikes} ${figmaUsers}`, `Github ${githubStars}`],
  /** /products/ 的三个大数字 */
  numbers: [
    { value: formatCount(stats.figma.users), label: 'Figma 用户' },
    { value: formatCount(stats.figma.likes), label: 'Figma 点赞' },
    { value: formatCount(stats.github.stars), label: 'GitHub Stars' },
  ],
  icon: mastergo.image,
  href: mastergo.links[0].href,
  figmaHref: 'https://www.figma.com/community/plugin/1662512589841230294/mastergo-importer',
};

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
}

export const productCards = [
  {
    slug: 'comic-manga',
    desc: '在 iPad 上收藏和阅读漫画，支持多种格式与云存储，还能用 AI 转换画风。',
    kind: 'iOS / iPadOS · App Store 4.8 分',
  },
  {
    slug: 'seal-note',
    desc: 'iOS 与 macOS 的 Markdown 便签，快捷键唤起，标准 .md 文件，iCloud 同步，可选端侧加密。',
    kind: 'iOS / macOS · 开源',
  },
  {
    slug: 'lyoon-garment',
    desc: '面向海外客户的染整服装厂官网，展示产品、工艺与行业文章。',
    kind: '品牌设计 · 真实上线网站',
  },
].map((c) => {
  const p = productBySlug(c.slug);
  const href = p.links[0].href;
  return { ...c, name: p.name, icon: p.image, href, external: !href.startsWith('/') };
});

export const skillPicks = ['aw-ux-info-redundancy-audit', 'aw-canvas-design', 'aw-find-and-port-ui-component'].map(
  (slug) => {
    const entry = agentSkills.find((x) => x.slug === slug);
    if (!entry) throw new Error(`skills.ts 缺少 ${slug}`);
    return entry;
  },
);

/** iOS 与 macOS 同一套 SwiftUI 实现，合并显示 */
export type Platform = 'Web' | 'SwiftUI' | 'iOS' | 'Android';

export interface DesignSystemEntry {
  name: string;
  /** 方形图标（public 路径）；没有时显示 mark 文字占位 */
  icon?: string;
  mark: string;
  platforms: Platform[];
  desc: string;
  href: string;
  external?: boolean;
}

export const designSystems: DesignSystemEntry[] = [
  {
    name: 'AaronUI',
    icon: '/media/products/aaronui-icon.png',
    mark: 'A',
    platforms: ['Web', 'SwiftUI', 'Android'],
    desc: '自己的设计系统：React 组件库与设计 Token，另有 SwiftUI 与 Jetpack Compose 两个平台版本。',
    // 同域名下的子路由，由单独部署的 AaronUI Gallery 提供（不在本仓库里）
    href: '/aaronui/',
  },
  {
    name: 'flomo',
    icon: '/media/products/flomo-icon.png',
    mark: 'f',
    platforms: ['iOS', 'Android', 'Web'],
    desc: '轻巧、克制的记录体验：按 Figma 源设计实现可交互的 Web 组件，可切换三端的交互手感。',
    href: '/design/flomo/',
  },
  {
    name: 'Followup',
    icon: '/media/products/followup-icon.png',
    mark: 'F',
    platforms: ['Web'],
    desc: '面向工作协作的设计语言：语义化 Token、多主题配色，以及按 Figma 逐变体实现的组件与图标。',
    href: '/design/followup/',
  },
];
