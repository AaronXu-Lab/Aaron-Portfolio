/**
 * 产品注册表 —— /products/ 页面的唯一接线点，分两个 Section:
 *  · products:「大」产品（独立发布的 App / 开源项目）
 *  · tools:小工具（站内自制，PWA 或独立静态壳）
 *
 * 新增产品：补一条记录 + 把缩略图放进 public/media/products/。
 * 新增小工具：参照 src/pages/tools/punct.astro(PWA)或 public/tools/travel-maps/（静态壳）。
 */

export interface ProductLink {
  label: string;
  href: string;
  icon: 'app-store-logo' | 'github-logo' | 'arrow-up-right';
}

export interface ProductEntry {
  slug: string;
  name: string;
  /** 英文 mono 小标 */
  en: string;
  /** 一句话定位（全角标点） */
  tagline: string;
  /** 产品介绍（全角标点） */
  description: string;
  /** 缩略图（public 路径，方形图标） */
  image: string;
  imageAlt: string;
  links: ProductLink[];
  tags: string[];
  status?: 'shipped' | 'wip';
}

export interface ToolEntry {
  slug: string;
  name: string;
  en: string;
  description: string;
  /** 是否为可安装的 PWA（可添加到手机主屏幕） */
  pwa: boolean;
  status: 'shipped' | 'wip';
  tags?: string[];
  date?: string;
  /** 覆盖默认链接（默认 /tools/<slug>/） */
  href?: string;
  /** 在新标签页打开（独立壳工具，脱离主站导航） */
  newTab?: boolean;
}

export const products: ProductEntry[] = [
  {
    slug: 'comic-manga',
    name: '漫漫书架',
    en: 'COMIC & MANGA',
    tagline: '收藏、阅读与整理漫画',
    description:
      '为漫画爱好者打造的阅读与收藏 App：整理个人漫画库、追踪阅读进度，支持日漫从右向左、欧美漫画从左向右及条漫纵向阅读；兼容 EPUB、MOBI、AZW3、PDF、ZIP 等格式，可连接 iCloud、Google Drive、百度网盘、Komga、OneDrive、Dropbox、SMB 与 WebDAV，另有剪藏和 AI 重绘功能。',
    image: '/media/products/comic-manga-icon.jpg',
    imageAlt: '漫漫书架 App 图标',
    links: [
      {
        label: 'App Store',
        href: 'https://apps.apple.com/cn/app/id6743392463',
        icon: 'app-store-logo',
      },
      { label: '设计案例', href: '/work/comic-manga/', icon: 'arrow-up-right' },
    ],
    tags: ['iOS / iPadOS', 'SwiftUI', 'AI 重绘'],
  },
  {
    slug: 'mastergo2figma',
    name: 'MasterGo2Figma',
    en: 'PLUGIN SUITE',
    tagline: '把 MasterGo 图层迁移为可编辑的 Figma 图层',
    description:
      '开源迁移工具：MasterGo 端的 SendToFigma 将页面和图层导出为 JSON ZIP，Figma 端的 ReceiveFromMasterGo 上传后还原为可编辑图层；也支持直接导入 MasterGo 原生 .mg 文件，并提供本地 Python 中继服务与 CLI，适合大文件和批量处理。',
    image: '/media/products/mastergo2figma.png',
    imageAlt: 'MasterGo2Figma 图标：设计图层迁移',
    links: [
      {
        label: 'GitHub',
        href: 'https://github.com/AaronXu-Lab/MasterGo2Figma',
        icon: 'github-logo',
      },
    ],
    tags: ['Figma 插件', 'MasterGo', '开源'],
  },
  {
    slug: 'seal-note',
    name: 'Seal Note',
    en: 'ENCRYPT NOTES',
    tagline: '快速记录，不打断当前工作',
    description:
      'macOS 菜单栏 Markdown 便签：全局快捷键随时唤起悬浮便签；每篇笔记都是标准 Markdown 文件，不锁数据；敏感内容可选端侧 AES-GCM 加密，iCloud Drive 自然同步。SwiftUI + AppKit 原生体验，无账号、无追踪。',
    image: '/media/products/seal-note-icon.png',
    imageAlt: 'Seal Note App 图标',
    links: [
      {
        label: 'GitHub',
        href: 'https://github.com/AaronXu-Lab/EncryptNotes_for_TRAE',
        icon: 'github-logo',
      },
    ],
    tags: ['macOS', 'Markdown', '端侧加密'],
  },
];

export const tools: ToolEntry[] = [
  {
    slug: 'candy-match',
    name: '糖果漫游',
    en: 'CANDY MATCH',
    description:
      '一场装进口袋的糖果三消旅行：在限定步数内完成分数、糖果收集与果冻清除目标，沿四个章节闯过 12 个关卡。进度只存在本机，支持离线游玩。',
    pwa: true,
    status: 'shipped',
    tags: ['PWA', '三消游戏', '离线可玩'],
    date: '2026.07',
    href: '/tools/candy-match/',
    newTab: true,
  },
  {
    slug: 'flypy',
    name: '小鹤双拼练习器',
    en: 'FLYPY TRAINER',
    description:
      '专注小鹤双拼的离线练习器：支持实体键盘与可收起的触屏软键盘，逐键提示声母和韵母；也可以粘贴自己的中文文本反复练习。',
    pwa: true,
    status: 'shipped',
    tags: ['PWA', '小鹤双拼', '离线可用'],
    date: '2026.07',
  },
  {
    slug: 'punct',
    name: '标点修正',
    en: 'PUNCT FIXER',
    description:
      '粘贴中文文案，一键把紧跟在中文后的半角标点 , : ; ! ? 转为全角，并修正含中文的半角括号对。离线可用，适合发文前最后一道校对。',
    pwa: true,
    status: 'shipped',
    tags: ['PWA', '排版', '离线可用'],
    date: '2026.07',
  },
  {
    slug: 'focus-forest',
    name: '专注森林',
    en: 'FOCUS FOREST',
    description:
      '开始专注就种下一颗种子：一株低多边形 3D 植物随进度长过种子、发芽、幼苗、成长、成熟五个阶段，完成后种进你的森林，点开每棵树都能看到它对应的那次专注。数据只存在本机，离线可用。',
    pwa: true,
    status: 'shipped',
    tags: ['PWA', 'Three.js', '专注计时'],
    date: '2026.07',
    href: '/tools/focus-forest/',
    newTab: true,
  },
  {
    slug: 'travel-maps',
    name: '出发吧打工人！',
    en: 'TRAVEL MAPS',
    description:
      '一张手账风格的真实等时旅行地图：支持上海 / 北京 / 广州 / 深圳 / 杭州五个出发地，按高铁 / 飞机 / 驾车算出近 190 个城市的门到门耗时，配水彩等时圈与逐城攻略手账。',
    pwa: false,
    status: 'shipped',
    tags: ['地图', 'D3', '旅行'],
    date: '2026.07',
    href: '/tools/travel-maps/',
    newTab: true,
  },
];
