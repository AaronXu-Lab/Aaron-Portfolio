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
  { slug: 'more', name: '更多组件库', note: '整理中' },
];
