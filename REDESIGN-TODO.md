# 改版 TODO：还没覆盖到新设计的页面

更新于 2026-11-22。新设计已经落地的：首页、作品 `/work/`、造物 `/products/`、博客列表 `/blog/`、Skill `/skills/`（含介绍 Sheet）、全站顶栏与页脚。

设计稿：[xuweinan.com 首屏方案（Design 画布）](https://claude.ai/artifact/WarQRKgAk5qyPKByUupe3K)。「子页面 · 初稿」页（p4）放旧草稿，「子页面 · 重设计」页（p5）放已定稿。

## 一、旧版式，还没有新设计

- [ ] **样式指南与组件** `/design/`：`/components/` 已并入（组件详情页在 `/design/components/<slug>/`，旧地址由 `public/_redirects` 301 跳转，上线后要验证跳转），整页版式还是旧样式，需要按新设计再过一遍。
- [ ] **更多组件库** `/design/more/`、`/design/flomo/`、`/design/followup/`：旧版式；flomo、Followup 两套展厅本身是独立视觉，只需统一页头与返回入口。
- [ ] **长文** `/work/ai-design-system/`：首页「我的 Design Agent」现在跳这里，版式是按原演示稿重建的独立风格，需要决定是否改成新的案例模板。
- [ ] **幻灯片** `/work/design-engineering-workflow/`：`public/` 下的静态演示稿，从长文开头进入，保持独立风格即可。

## 二、有设计稿，还没实现

- [ ] **完整案例模板**（画板「完整案例模板 · Followup.AI」）：套用到 `/work/followup-ai/`、`/work/comic-manga/`；顶部一眼摘要、右侧目录、章节编号只在案例页使用。Followup 第 04 节配图仍是 AI 临时图。
- [ ] **短案例模板**（画板「短案例模板 · 智能座舱度量」）：智能座舱度量、ColorOS 跨屏互联、OPPO 车机洞察、腾讯公益 AI 配图。目前作品页「更早的作品」链到 Figma，写好后改成站内页。
- [ ] **博客文章页**（画板「文章页」）：`/blog/<id>/` 仍是旧版式；页头分类 · 日期 · 阅读时长 + 摘要，正文约 680px，二级标题超过 3 个时右侧出现目录，文末上一篇 / 下一篇。
- [ ] **产品详情页**（画板「产品详情模板 · 漫漫书架」）：还没有对应路由；隐私政策等三篇留在博客原地址，App Store 按钮暂不放。
- [ ] **404**（画板「404」）：仓库里目前没有 404 页，而 `wrangler.jsonc` 配的是 `not_found_handling: "404-page"`，线上找不到页面时没有自定义 404。设计稿里的顶栏要去掉。

## 三、新页面上还留着的占位与待确认

- [ ] 作品页「更早的作品」：小鹏汇天、OPPO（车机）、腾讯公益的公司 logo 还是文字占位（ColorOS 已用真实图标）。
- [ ] 精选作品「我的 Design Agent」封面还是占位图。
- [ ] 作品页「实验项目」模板位：`src/data/showcase.ts` 的 `experiments` 为空时不显示，有项目后填一条。
- [ ] Skill 介绍 Sheet：21 条「我之前为什么做了这个 SKILL」是推测，需要逐条确认（`src/data/skill-details.ts`）。
- [ ] 新页面的手机宽度与深色模式还没有完整走查。
- [ ] Generative Icons（动画 SVG 导出方案）暂存，之后可替换 Skill 卡片上的 Phosphor duotone 图标。
- [ ] `public/media/other/`（12 张图）原本只给已删除的「其他作品」页用，确认没用后可以删。
