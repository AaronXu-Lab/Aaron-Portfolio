# Aarxon Xu 个人网站 · xuweinan.com

UX Engineer 作品集 + 站内博客 + Skill / 产品集。基于 [Astro 5](https://astro.build) 静态生成，视觉语言延续手搓原型（oklch 色系 · Inter + JetBrains Mono · 编辑部风格），博客一次性导入自本地 Hexo 文件夹，部署在 Cloudflare Pages 并绑定 [xuweinan.com](https://www.xuweinan.com)。

## 本地运行

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # 产物在 dist/,纯静态
npm run preview    # 本地预览构建产物
```

## Cloudflare Pages 部署

监听 `main` 分支，push 即自动构建部署。

| 配置 | 值 |
| --- | --- |
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | `22`（见 `.node-version`） |

纯静态输出，不需要 `@astrojs/cloudflare` 适配器。`public/_headers` 随构建复制到 `dist/_headers`,用于自定义响应头。

## 站点结构

| 路由 | 内容 |
| --- | --- |
| `/` | 长滚动首页：Hero → 关于 → 经历 → 能力 → 实验性项目 → 精选案例 → 博客 → 联系我 |
| `/work/followup-ai/` | 案例：Followup.AI（B 端 SaaS / 设计系统 / AI Agent / Playbook） |
| `/work/comic-manga/` | 案例：漫漫书架 Comic&Manga(ComfyUI / design-to-code) |
| `/work/ai-design-system/` | 长案例：复合设计系统（15 个分幕） |
| `/work/other/` | 其他作品：Figma 插件 / 技术分享 / 动效设计 |
| `/blog/` | 博客列表（按年分组 + 分类筛选） |
| `/blog/<slug>/` | 文章详情（105 篇，含 2015–2026 全部存量文章，已对照旧站校验无遗漏） |
| `/skills/` | 自写 Agent Skill 列表（注册表：`src/data/skills.ts`） |
| `/products/` | 自研产品与小工具（注册表：`src/data/products.ts`;`/tools/` 旧地址自动重定向） |
| `/tools/punct/` | PWA 小工具「标点修正」：可添加到手机主屏幕，离线可用 |
| `/design/` | 活体样式指南：全部 Design Token（双主题实时对照）+ 全局组件实渲染 |

深浅色主题：右上角切换，跟随系统偏好，localStorage 记忆。
微交互：滚动显现、scrollspy、阅读进度条、复制按钮、hover 位移；`prefers-reduced-motion` 全部降级；URL 加 `?qa` 可跳过入场动画（视觉回归用）。

## 写文章

```bash
npm run new                # 询问文章名 → 生成空笔记（类似 hexo new）
npm run new -- 文章名       # 免交互
npm run new -- ~/draft.md  # 给 .md 路径 → 导入内容发布（规范化 frontmatter、搬运图片）
```

macOS 下也可以直接双击仓库根目录的 `新建文章.command`。更多细节见 [workflows/add-post.md](workflows/add-post.md)。

### 全量重导旧博客

```bash
npm run import:blog
```

从 `~/Library/Mobile Documents/com~apple~CloudDocs/Share/xuweinanblog/source/_posts` 读取全部 Hexo 文章，规范化 frontmatter（`tag`/`tags` 统一、裸时间戳按中国时区 +08:00 解析、`<!-- more -->` 提取摘要、估算阅读时长）后写入 `src/content/blog/`。已导入 105 篇；后续有新文章重跑一次即可（目标目录会重建，不要手改其中文件）。

已知限制：2017 年前后的老文章图片托管在新浪图床，源站已失效，站内做了降级占位样式（全站已设 `no-referrer` 尽量放行防盗链）。

## 项目规则

AI 上手必读：[AGENTS.md](AGENTS.md)（`CLAUDE.md` 指向同一文件）。

## 🖼 媒体图状态

已通过 Figma MCP 从 📝简历 文件(key `S01WbvJxrtsbrUqbaF7sdT`)批量导出并填充 **30 处**真实图片（存放于 `public/media/`,`MediaSlot` 组件传 `src` 即渲染真图）。旧清单指向的 `Playground` 文件(key `cpxGuEaNoMIHF4IZcmbUfx`)已失效，539 系列节点不存在。首页历史作品集 4 项的 Figma 链接也已精确到各自画板（`data-node-id` 见 `src/pages/index.astro` 的 `historical`）。

### 仍待替换（6 处）

| 页面 | 用途 | 比例 | 说明 |
| --- | --- | --- | --- |
| /work/followup-ai/ | Automation 工作流视觉 | 21/9 | 简历文件中该场景（AI 归类候选人 · HR 招聘流程）无专属配图，现有素材是通用任务看板，已复用于 Foundation Builder,避免重复/误导未强行填入 |
| /work/comic-manga/ | App 截图 · AI 重绘 | 4/3 | 简历文件中未找到该功能的 App 界面截图 |
| /work/comic-manga/ | iPad 实机视觉 | 4/3 | 未找到实机拍摄图 |
| /work/comic-manga/ | 组件拆分视觉 | 4/3 | 未找到对应素材 |
| /work/ai-design-system/ | 结果示例 A/B/C（3 处） | 4/5 | 需自备脱敏截图，无 Figma 节点 |
| / | 个人头像 | 4/5 | 按要求已还原为占位，留给本人自行替换 |

> 补图方式：图片放入 `public/media/<分组>/`,给对应 `<MediaSlot … src="/media/…" />` 传 `src` 即可；`/design/` 页的 `node="000:0000"` 是样式指南演示占位，非真实待替换项。

