# Aaron Xu 个人网站 · 项目指南

Aaron Xu,UX Engineer 的作品集 + 站内博客 + Skill / 产品集。Astro 5 静态站,部署在 Cloudflare Pages,绑定 [xuweinan.com](https://www.xuweinan.com)。视觉语言为 oklch 编辑部风格,自 `portfolio/site` 原型迁移而来;博客内容源自本地 Hexo 旧站(iCloud `Share/xuweinanblog`)。

## 目录速览

| 路径 | 说明 |
| --- | --- |
| `src/styles/global.css` | **Design Token 唯一定义源**(`:root` 浅色 / `[data-theme='dark']` 深色)+ 全局原语 |
| `src/data/cases.ts` | **案例注册表**:首页卡片、页脚链接、下一案例卡的唯一接线点 |
| `src/data/skills.ts` | **Skill 注册表**:/skills/ 页的唯一接线点(自写 Agent Skill) |
| `src/data/products.ts` | **产品注册表**:/products/ 页的唯一接线点(大产品 + 小工具两个 Section) |
| `src/pages/work/*.astro` | 案例页(用 `CaseLayout` + `SectionHead` + `MediaSlot`) |
| `src/pages/tools/punct.astro` | PWA 小工具「标点修正」页面(独立壳,不用 Base 布局) |
| `public/tools/punct/` | 该 PWA 的 manifest / service worker / 图标(SW 作用域 = `/tools/punct/`) |
| `public/tools/travel-maps/` | 独立静态壳工具「出发吧打工人」:D3 手账风等时旅行地图,支持多出发城市(`?from=`,默认上海),新标签页打开(见 [workflows/travel-maps.md](workflows/travel-maps.md)) |
| `src/content/blog/` | 博客文章(脚本生成,**勿手改**) |
| `src/pages/design.astro` | `/design/` 活体样式指南:全部 token 与组件的实渲染 |
| `scripts/` | 新建/导入/标点脚本 |
| `workflows/` | 沉淀工作流:新增案例(AI 剧本)、新增博客(脚本) |

## 常用命令

```bash
npm run dev          # http://localhost:4321
npm run build        # 必须零错误才算完成
npm run new          # 一键新建文章:询问文章名 → 生成空笔记;输入 .md 路径 → 导入发布
npm run add:post -- <文章.md>   # 新增博客(见 workflows/add-post.md)
npm run import:blog  # 全量重导 Hexo 博客(重建目录,慎用)
npm run fix:punct -- <文件...>  # 中文标点修正(CJK 后的半角 → 全角)
```

macOS 下双击仓库根目录的 `新建文章.command` 等价于 `npm run new`。

## 部署

Cloudflare Pages 监听 `main` 分支,push 即部署。Build command `npm run build`,输出 `dist/`,Node 22(见 `.node-version`)。`public/_headers` 会复制到 `dist/` 生效自定义响应头。纯静态输出,无需 Cloudflare 适配器。

## 工作流

- **新增作品案例** → 按 [workflows/add-case.md](workflows/add-case.md) 执行(先读完再动手)
- **新增博客文章** → `npm run new` 或见 [workflows/add-post.md](workflows/add-post.md)
- **新增 Skill** → 在 `src/data/skills.ts` 追加记录(列表页自动渲染,空数组时显示预告态)
- **新增小工具** → 两种形态任选:① Astro 页 `src/pages/tools/<slug>.astro`(PWA 参照 `punct`:`public/tools/<slug>/` 放 manifest + sw.js + 图标,SW 作用域限定在自己路径下);② 纯静态壳直接放 `public/tools/<slug>/index.html`(参照 `travel-maps`,登记时用 `href` + `newTab: true` 新标签页打开)。最后都要在 `src/data/products.ts` 的 `tools` 数组登记
- **travel-maps 增补目的地/出发城市** → 见 [workflows/travel-maps.md](workflows/travel-maps.md)(数据结构与信息来源口径)

## 硬性规则(改动任何页面前必读)

1. **Token 单源**:颜色/圆角/间距只从 `global.css` 的 CSS 变量取,禁止页面内写死色值(band 系列变量用于深色带区)。核对入口:`/design/` 页。例外:PWA 工具页(独立壳)内联了同值 token 副本,改 token 时需同步。
2. **工具页设计独立**:从 /products/ 列表点开的工具页面(独立壳,无论 Astro 页还是 `public/` 静态壳)保持设计独立性——**通常不需要遵守主站设计规范与 DESIGN.md**(token、字体、动效纪律、排版规则均不强制),各工具维护自己的视觉语言;除非特别要求对齐主站。/products/ 列表页本身仍属主站,照常遵守全部规范。
3. **中文排版**:文案用全角标点(，。：；?!),写完跑 `npm run fix:punct`。中文破折号「——」(成对)允许;**孤立单个 em-dash「—」全站禁止**,区间用连字符(`2024.1 - 2025.3`)。
4. **动效纪律**:禁止 `window.addEventListener('scroll')`(用 IntersectionObserver / CSS scroll-driven);入场动画用 `.reveal` 类(+ 可选 `--d` 延迟),交互元素需 `:hover` 与 `:active` 态;一切动效在 `prefers-reduced-motion` 下降级。
5. **图片**:真实图未导出前用 `MediaSlot`(标注 Figma 节点号并登记进 `README.md` 的替换表);禁止 div 拼假截图、手绘装饰 SVG。
6. **验证**:每次改动后 `npm run build` 零错误;视觉核对可给 URL 加 `?qa`(跳过入场动画,截图稳定)。
7. **不可 silent 更改**:路由 slug、导航文案、既有内容语态。
8. **PWA 安装入口**:后续新增 PWA 工具必须提供可见的「安装应用」按钮;在支持 `beforeinstallprompt` 的浏览器中仅由用户点击后调用安装提示,并监听 `appinstalled` 更新状态。iOS 等不支持主动提示的环境须给出「添加到主屏幕」步骤;三星浏览器须提示其 WebAPK 可能触发 Android 安全警告并建议改用最新版 Chrome。禁止页面加载后自动弹出安装提示。
