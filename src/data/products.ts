/**
 * 产品注册表 —— /products/ 页面的唯一接线点，分三个 Section:
 *  · products:「大」产品（独立发布的 App / 开源项目）
 *  · tools:小工具（站内自制，PWA 或独立静态壳）
 *  · games:小游戏（「玩个 Go」，与小工具同构，仅卡片样式不同）
 *
 * 新增产品：补一条记录 + 把缩略图放进 public/media/products/。
 * 新增小工具：参照 src/pages/tools/flypy.astro(PWA)或 public/tools/travel-maps/（静态壳）。
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
  /** 造物页卡片描述：最多三行（约 45 个字） */
  description: string;
  /** 工具卡片使用的方形图标（public 路径） */
  icon: string;
  iconAlt: string;
  /** 是否为可安装的 PWA（可添加到手机主屏幕） */
  pwa: boolean;
  /** 卡片角标上的一枚技术标签（大写 mono 小胶囊，如 HTML5），与 PWA 徽标同槽位 */
  badge?: string;
  status: 'shipped' | 'wip';
  tags?: string[];
  date?: string;
  /** 覆盖默认链接（默认 /tools/<slug>/） */
  href?: string;
  /** 在新标签页打开（独立壳工具，脱离主站导航） */
  newTab?: boolean;
  /**
   * 小游戏卡片的底：用游戏打开后看到的背景（取自游戏自己的资源 / CSS，属于工具独立视觉，不走主站 token），
   * tone 决定卡片文字用深色还是浅色
   */
  cover?: { background: string; tone: 'dark' | 'light' };
}

export const products: ProductEntry[] = [
  {
    slug: 'lyoon-garment',
    name: 'Lyoon Garment',
    en: 'Brand Website',
    tagline: 'Garment-dye expertise, made for a global audience',
    description:
      'An English-language website for a garment-dye apparel manufacturer, bringing together product collections, a wash library, manufacturing capabilities and industry articles. Built to help international brands explore the range and start a production inquiry.',
    image: '/media/products/lyoon-garment-icon.png',
    imageAlt: 'Lyoon Garment logo',
    links: [
      {
        label: 'Visit Website',
        href: 'https://lyoongarment.com/',
        icon: 'arrow-up-right',
      },
    ],
    tags: ['Website', 'Apparel', 'B2B'],
    status: 'shipped',
  },
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
      // App Store 页面暂不可用，先不放跳转（恢复时在此补回 label: 'App Store' 的链接）
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
      'iOS / iPadOS 与 macOS 的 Markdown 便签：macOS 菜单栏常驻，全局快捷键随时唤起悬浮便签；iPhone 与 iPad 提供笔记列表和全屏编辑器。每篇笔记都是标准 Markdown 文件，不锁数据，iCloud Drive 跨设备自然同步；敏感内容可在 macOS 上选择端侧 AES-GCM 加密。SwiftUI + AppKit 原生体验，无账号、无追踪。',
    image: '/media/products/seal-note-icon.png',
    imageAlt: 'Seal Note App 图标',
    links: [
      {
        label: 'GitHub',
        href: 'https://github.com/AaronXu-Lab/EncryptNotes_for_TRAE',
        icon: 'github-logo',
      },
    ],
    tags: ['iOS / macOS', 'Markdown', '端侧加密'],
  },
];

/** 小游戏（「玩个 Go」Section），字段与小工具同构 */
export const games: ToolEntry[] = [
  {
    slug: 'flying-ninja-cat',
    name: '飞天忍者猫',
    en: 'FLYING NINJA CAT',
    description: '童年 Flash 页游的 H5 重制：点击起跳、发射绳索，在夜空里一路摆荡向前，吃金币。',
    icon: '/tools/flying-ninja-cat/icon.png',
    iconAlt: '飞天忍者猫游戏图标',
    pwa: false,
    badge: 'HTML5',
    status: 'shipped',
    tags: ['Flash 怀旧', 'Canvas', '本地运行'],
    date: '2026.07',
    href: '/tools/flying-ninja-cat/',
    newTab: true,
    // 打开后的标题画面：夜空 + 屋顶；压一层夜空色渐变保证文字可读
    cover: {
      background:
        "linear-gradient(180deg, rgb(6 20 38 / 0.2) 0%, rgb(6 20 38 / 0.86) 42%, rgb(6 20 38 / 0.95) 100%), url('/tools/flying-ninja-cat/assets/backgrounds/title-wide.jpg') 70% 0% / auto 160%",
      tone: 'dark',
    },
  },
  {
    slug: 'candy-match',
    name: '糖果漫游',
    en: 'CANDY MATCH',
    description: '无限流糖果三消：限时完成随机任务，赚糖果券换道具；四消、五消会生成连锁技能糖。',
    icon: '/tools/candy-match/icon.svg',
    iconAlt: '糖果漫游图标',
    pwa: true,
    status: 'shipped',
    tags: ['PWA', '三消游戏', '离线可玩'],
    date: '2026.07',
    href: '/tools/candy-match/',
    newTab: true,
    // 与 public/tools/candy-match/css/style.css 的 body 背景一致：奶油桃色 + 淡紫光斑
    cover: {
      background:
        'radial-gradient(circle at 12% 5%, rgb(255 207 165 / 0.65), transparent 70%), radial-gradient(circle at 90% 8%, rgb(210 191 255 / 0.5), transparent 70%), linear-gradient(145deg, #fff9ef, #f8efff)',
      tone: 'light',
    },
  },
];

export const tools: ToolEntry[] = [
  {
    slug: 'wardrobe', name: '衣集', en: 'WARDROBE',
    description: '把衣架上的衣服整理成透明图片和标签，本地保存，筛选后打包导出。',
    icon: '/tools/wardrobe/icon-192.png', iconAlt: '衣集：衣架与衬衫',
    pwa: true, status: 'shipped', tags: ['本地相册', 'AI 去背'],
    href: '/tools/wardrobe/', newTab: true,
  },
  {
    slug: 'prompt-lab',
    name: 'Prompt 擂台',
    en: 'PROMPT ARENA',
    description: '同一段 Prompt 交给不同模型实现，切换着直接体验各自的作品。',
    icon: '/tools/prompt-lab/pelican-v4-192.png',
    iconAlt: '鹈鹕骑自行车，Prompt 擂台图标',
    pwa: true,
    status: 'shipped',
    tags: ['PWA', '模型对比', '固定 Prompt'],
    date: '2026.09',
    href: '/tools/prompt-lab/',
    newTab: true,
  },
  {
    slug: 'stash',
    name: '暂存箱',
    en: 'STASH',
    description: '免登录的公共暂存箱：放下一段文字或一个文件，换台设备直接取，保留 7 天。',
    icon: '/tools/stash/icon-192.png',
    iconAlt: '暂存箱图标',
    pwa: true,
    status: 'shipped',
    tags: ['跨设备', '临时存储', '公共箱子'],
    date: '2026.09',
    href: '/tools/stash/',
    newTab: true,
  },
  {
    slug: 'flypy',
    name: '小鹤双拼练习器',
    en: 'FLYPY TRAINER',
    description: '小鹤双拼的离线练习器，支持实体键盘和触屏，逐键提示，也能练自己的文本。',
    icon: '/tools/flypy/icon-192.png',
    iconAlt: '小鹤双拼练习器图标',
    pwa: true,
    status: 'shipped',
    tags: ['PWA', '小鹤双拼', '离线可用'],
    date: '2026.07',
  },
  {
    slug: 'focus-forest',
    name: '专注森林',
    en: 'FOCUS FOREST',
    description: '专注时种下一株 3D 植物，随进度长大，完成后种进你的森林。数据只存在本机。',
    icon: '/tools/focus-forest/icon.svg',
    iconAlt: '专注森林图标',
    pwa: true,
    status: 'shipped',
    tags: ['PWA', 'Three.js', '专注计时'],
    date: '2026.07',
    href: '/tools/focus-forest/',
    newTab: true,
  },
  {
    slug: 'grid-breakpoint',
    name: 'Grid 断点计算器',
    en: 'GRID BREAKPOINT',
    description: '从最大宽度、列数和间距反推响应式断点，带实时预览和可复制的 CSS。',
    icon: '/tools/grid-breakpoint/icon.svg',
    iconAlt: 'Grid 断点计算器图标',
    pwa: true,
    status: 'shipped',
    tags: ['PWA', '响应式栅格', '离线可用'],
    date: '2026.08',
    href: '/tools/grid-breakpoint/',
    newTab: true,
  },
  {
    slug: 'travel-maps',
    name: '出发吧打工人！',
    en: 'TRAVEL MAPS',
    description: '手账风格的等时旅行地图：从五个出发城市，看高铁、飞机、驾车到各城要多久。',
    icon: '/tools/travel-maps/travel-logo.png',
    iconAlt: '出发吧打工人旅行地图图标',
    pwa: false,
    status: 'shipped',
    tags: ['地图', 'D3', '旅行'],
    date: '2026.07',
    href: '/tools/travel-maps/',
    newTab: true,
  },
  {
    slug: 'mesh-gradient',
    name: 'Mesh Gradient 图片生成器',
    en: 'MESH GRADIENT',
    description: '给截图加上可调的 Mesh Gradient 背景、留白与阴影，按原尺寸导出 PNG。',
    icon: '/tools/mesh-gradient/icon.svg',
    iconAlt: 'Mesh Gradient 图片生成器图标',
    pwa: false,
    badge: 'CANVAS',
    status: 'shipped',
    tags: ['Mesh Gradient', '出图', '本地处理'],
    date: '2026.09',
    href: '/tools/mesh-gradient/',
    newTab: true,
  },
];
