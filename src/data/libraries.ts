/**
 * 组件库注册表 —— /design/ 底部「其他组件库」区块的唯一接线点。
 *
 * 每条记录对应 /design/<slug>/。没有 href 时该地址渲染「施工中」页;
 * 做好后:Figma 等外链填 href(新标签页打开),站内 HTML 预览则在
 * src/pages/design/ 下建同名 .astro 并填 href: '/design/<slug>/'。
 */
export interface LibraryEntry {
  slug: string;
  name: string;
  /** 列表右侧 mono 小字 */
  note: string;
  /** 真实入口;为空时指向施工中页 */
  href?: string;
}

export const libraries: LibraryEntry[] = [
  { slug: 'more', name: '更多组件库', note: 'Followup · flomo', href: '/design/more/' },
];

/** /design/more/ 的两套独立展厅。 */
export const showcaseLibraries = [
  {
    slug: 'followup', name: 'Followup', href: '/design/followup/',
    platform: 'Web · Product design system',
    description: '面向工作协作的设计语言。浏览语义化 Token、多主题配色，以及按 Figma 逐变体实现的组件与图标。',
    note: '180 个变量 · 74 个组件 · 180 个图标',
  },
  {
    slug: 'flomo', name: 'flomo', href: '/design/flomo/',
    platform: 'iOS · Android · Web · Component library',
    description: '轻巧、克制的记录体验。按 Figma 源设计实现可交互的 Web 组件，可切换 iOS、Android 与 Web 的交互手感。',
    note: '667 个变量 · 39 个样式 · 22 个组件分组',
  },
];
