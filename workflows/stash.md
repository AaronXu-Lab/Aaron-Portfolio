# 暂存箱

入口：`/tools/stash/`，在「造物 → 小工具」登记。所有人共用一个存放区域，文字与文件互斥，无登录、无取件码、无历史版本。文字停顿 700 ms 后自动保存，上传文件成功后清除文字并显示文件标示，删除文件后恢复空白编辑器，不显示冲突提示。

- 文件：最多一个，最大 10 MiB（10 × 1024 × 1024 字节），前后端均校验。
- 文字：UTF-8 最多 100 KiB，按纯文本展示。
- 整箱在最后成功修改后保留 7 天。编辑文字、上传或替换文件会刷新时间；删除文件后箱子为空，不再显示倒计时；读取与下载不会。
- 空箱没有到期时间。后台每 15 分钟清理一次，接口先检查过期，因此不依赖定时任务准时触发来阻止过期读取。
- 每个可见页面每 15 秒刷新，编辑中的文字不会被后台刷新覆盖。

## 结构

- `public/tools/stash/`：独立静态 PWA 界面。`app.js` 为构建产物，勿手改。
- `src/lib/stash/`：前端源码。`editor.js` 使用 CodeMirror 处理输入、选区、撤销和自动换行，`markdown.js` 是可独立测试的高亮规则。
- `scripts/build-stash.mjs`：将编辑器打包到本地资源，不依赖运行时 CDN。`npm run build` 自动先执行它。
- `workers/stash/index.js`：Worker 实现，R2 存储 `box.json` 与 `files/<随机 ID>`。
- `workers/stash/worker.js`：只导出 Worker handler，避免将测试用常量作为 Worker 入口导出。
- `workers/stash/wrangler.jsonc`：R2 绑定、接口路由和 Cron。
- `tests/stash.test.mjs`：文件边界、过期、并发保存与清理回归测试。

R2 的条件写入保证文字与文件互斥；存在文件时文字写入返回 409，客户端静默显示文件。旧版混合记录以文件为准，删除文件不会恢复旧文字。版本冲突只在后台重试，不要求用户确认。清理也采用条件写入，避免覆盖新内容。

替换后的文件立即从工具中不可访问。后台回收创建超过 24 小时且不再被当前清单引用的文件；这段宽限保护正在上传但尚未提交的文件。有效期以当前清单为准，由清理任务回收过期内容。

R2 桶保持私有，不启用 r2.dev 或公开域名。文件由 Worker 作为附件下载，禁止内联执行。接口响应 `no-store`，不缓存公共箱子的内容。每 IP 每分钟最多 60 次写入，属于基本资源保护，不提供内容隐私保证。

## 本地验证

```sh
npm run build
npm run dev:stash
# 另一个终端
node scripts/preview-stash.mjs
```

打开 `http://127.0.0.1:4322/tools/stash/`。预览服务器提供 dist 并将 API 请求转发到本地 Worker 的 8787 端口，本地 R2 与生产隔离。

```sh
npm run test:stash
npx wrangler deploy --config workers/stash/wrangler.jsonc --dry-run
curl http://localhost:8787/cdn-cgi/local/scheduled
```

## 首次部署

先由账户持有人开通 R2，再完成 Wrangler OAuth 登录。

```sh
npx wrangler login
npx wrangler r2 bucket create aaron-portfolio-stash
npm run deploy:stash
```

Worker 路由覆盖 `www.xuweinan.com/api/stash*` 和 `xuweinan.com/api/stash*`，需要对应 zone 的路由权限。

2026-09-07 已通过 Cloudflare API 核实：主站实际是 `aaron-portfolio` Worker 静态托管，绑定上述两个域名；账号下没有 Pages 项目。仓库旧部署说明中的 Pages 与现状不符。接口独立部署，不迁移主站。主站静态资源发布命令：

```sh
npm run build
npx wrangler deploy --name aaron-portfolio --assets ./dist --compatibility-date 2026-07-18
```

先部署接口，再发布带工具入口的静态资源。主站兼容日期沿用远端现值，接口有自己的兼容日期。应用图标使用 imagegen 生成的苔绿色箱子；文件和操作图标采用 Phosphor Icons（MIT）。

## Markdown 高亮

参考本地 SealNote 项目的 `SealNote/Views/Markdown/MarkdownHighlighter.swift` 与 `SealNote/Tests/MacMarkdownHighlighterTests.swift`。只高亮 Markdown 原始文本，不渲染 HTML 或隐藏语法符号；复制与存储仍为 Markdown 原文。

- 标题标记为紫色，标题文字加粗，字号与正文相同。
- 支持粗体、斜体、删除线、`<u>` 下划线、行内代码、链接、图片语法、有序与无序列表、任务列表、引用、表格分隔符和水平线。
- 语法标记与 URL 弱化；行内代码有浅底色，注释为低饱和绿色，颜色适配暂存箱背景。
- 与 Seal Note 一致：代码围栏只高亮标记，块内正文保持普通文本；单行三反引号、`==文本==` 不作特殊高亮；HTML 注释仅在独占一行时高亮。
- 自动保存、7 天清空、文件接口保持原有语义。远端刷新不进入撤销历史，也不触发再次保存。

高亮规则回归测试包含在 `npm run test:stash` 中。

## 单区域界面

页头只显示「暂存箱」，有内容时显示清空倒计时。文字与文件共用一块区域；文件状态隐藏编辑器并清除撤销历史。底部不显示提示或清空按钮，存放区域填满视口剩余高度并保留外边距；错误通过统一 dialog 按需显示。上传失败保留文字草稿。

## 状态与上传交互

标题区固定 100 px 并居中；空箱只有标题，有内容时增加倒计时。保存状态圆点以灰色表示空闲、黄色表示保存中、绿色表示已保存、红色表示未保存；输入等待与请求处理中共用「保存中...」。复制与上传采用带可访问名称的 Phosphor 图标按钮。

上传时隐藏编辑区与工具栏，以居中圆环显示 XMLHttpRequest 的传输进度和已上传大小 / 总大小，不额外显示上传状态说明文字。圆环下方提供「取消上传」，取消排队或正在传输的请求后立即恢复编辑并保留文字草稿，不显示上传失败提示。文件名保持单行并保留扩展名，下载与删除按钮垂直排列。超限文件使用模态对话框，关闭后可重新选择。

文字未保存或上传未完成时通过 beforeunload 请求浏览器原生离开确认。提示文案由浏览器控制；移动端强制关闭应用等情况可能不会触发该事件。

标题与倒计时、首次加载完成、内容切换、进度环和拖拽边框均提供短过渡，并遵循减少动态效果设置。所有内容状态允许拖入文件，使用同一高亮边框；新文件通过大小校验后中止旧上传，存在旧文件则先删除再开始新上传。

上传前先读取所选文件，再取消/删除旧内容；0 字节和小文件均受支持。拖入的文件夹通过目录入口识别并提示压缩为 ZIP，文件夹包（如 macOS Playground）同样处理。无法读取的选择项在本地提示，不再混同网络连接失败。上传、保存、复制、加载、数量和大小限制等错误统一使用 dialog，持续加载失败只弹一次，连接恢复后重置。

## 图片预览

常见图片扩展名使用浏览器图片解码，在文件区域显示较大预览；点击打开全屏 lightbox，可通过关闭按钮、Esc 或背景关闭。图片以 Blob URL 供 img 展示，不将文件内容注入 HTML；替换或删除时取消预览请求并回收 URL。无法解码或非图片文件使用 Phosphor file 图标，下载行为不变。

## PWA

2026-09-07 按用户明确要求不提供站内安装按钮。浏览器可通过 manifest 安装，独立窗口启动；应用图标、Apple Touch 图标与「造物」入口使用同一生成图。192/512 PNG 用于安装，180 PNG 用于主屏幕，32 PNG 用于 favicon，源图保存为 icon-source.png。

Service Worker 仅作用于 `/tools/stash/`，严格预缓存列出的页面、脚本、样式和图标；API、上传、下载及图片内容不进入 Cache Storage。缓存名由应用外壳和 SW 模板内容生成。更新不调用 skipWaiting、不自动刷新；旧窗口关闭后由浏览器启用新版本。SW 模板在 `src/lib/stash/sw-template.js`，`public/tools/stash/sw.js` 为构建产物。

离线可启动外壳，使用连接提示并禁止编辑和上传；不保存离线操作队列，不在重连时自动提交未保存草稿。恢复连接后重新读取公共箱子，已有草稿不被后台覆盖。安全区域适配独立窗口，云端和 R2 配置不变。
