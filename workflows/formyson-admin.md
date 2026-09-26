# Formyson 内容管理

## 使用

后台地址：`https://www.xuweinan.com/formyson/admin/`。前台和后台均为英文。

1. 用固定管理员账号登录。
2. 切换 Products 或 Articles，搜索、新建或编辑内容。
3. 文章只必填 Title 和正文，再选择发布状态并保存。Optional settings 默认折叠：网址自动生成，日期默认为当天，分类默认 Studio Notes，作者默认 LOOMWORKS，摘要从正文提取，SEO 沿用标题与摘要，未提供封面时使用现有缝制演示图占位。可随时展开修改；已有内容不会批量替换。产品仍需填写标题、网址和日期，发布时需封面及替代文本。
4. 正文可直接输入纯文本，也支持 Markdown：标题、粗体、斜体、列表、引用、图片和链接。Insert image 自动上传并插入图片语法，Insert link 插入链接，Preview body 预览正文。
5. 选择 Draft / hidden 保存草稿，或 Published / visible 发布。发布、更新、下架和删除立即影响列表、详情、首页与站点地图，无需重新构建。日期只用于展示与排序，不代表定时发布。
6. 删除需要二次确认；已上传图片保留，避免其他文章引用的图片失效。
7. Export content 下载产品和文章的 JSON 快照。此导出不包含图片二进制，也不是数据库完整备份。

首次自动生成的账号凭据保存在操作者本机 `~/.config/formyson/admin.json`，文件权限为 `600`。密码不在 Git、页面源码或日志中；Cloudflare 只存带随机盐的 PBKDF2-SHA256 密码摘要。

## 当前范围

- 实现需求文档的固定账号登录、产品／文章管理、搜索、分类筛选、分页、图片上传、图集、规格、Markdown 正文、发布状态、SEO title / description 与 alt。
- 图片在浏览器缩放到最长边 2,400 px，优先转 WebP；服务端仅接受 JPEG、PNG、WebP，限制 5 MB。上传前原图限制 20 MB、5,000 万像素。
- 无多角色、定时发布或所见即所得编辑器。正文 HTML 不执行。
- 沿用现有公司信息、演示图片与品牌 LOOMWORKS。About、Contact 与联系表单仍为既有演示页面，不属于本次产品／文章后台范围；联系表单尚未接收询盘。
- 保留企业演示站的 `noindex`。真实公司内容替换完毕后，再明确决定开放搜索收录。
- 上传图片拥有公开 URL，草稿仅隐藏内容记录；不要上传私密文件。

## 架构与文件

| 文件／资源 | 用途 |
| --- | --- |
| 根目录 `wrangler.jsonc` | 主站 Worker、域名、静态资产及绑定的部署事实源 |
| `workers/formyson/worker.js` | API、登录、图片代理、服务端页面渲染 |
| `workers/formyson/content.js` | 校验、Markdown 安全渲染、前台内容模板 |
| `workers/formyson/migrations/` | D1 表结构和只执行一次的初始内容迁移 |
| `src/pages/formyson/admin.astro` | 管理界面结构 |
| `public/formyson/admin/` | 管理界面样式、脚本 |
| `public/formyson/content.css` | 动态内容沿用 Formyson 视觉样式 |
| `src/pages/formyson/_Layout.astro` | 共享前台壳及 Formyson token 定义 |
| D1 `formyson` | 内容、会话、登录限流计数、媒体索引 |
| R2 `formyson-media` | 新上传图片，与 stash 存储桶隔离 |

Astro 生成主站静态资产及 Formyson 页面壳。主 Worker 仅优先处理 `/formyson` 与 `/formyson/*`，其余路径继续使用静态资源。`ASSETS` 获取页面壳，`HTMLRewriter` 填充 D1 内容。产品和文章详情由 Worker 按 slug 动态生成，Astro 不再输出含演示正文的静态详情页。`_data.ts` 只保留品牌常量和首次迁移种子，修改它不会覆盖线上内容。

现有 `aaron-portfolio-stash` Worker 及 `/api/stash*` 路由保持独立。主站使用 `aaron-portfolio` Worker，绑定 `xuweinan.com` 和 `www.xuweinan.com`，不是 Pages 项目。

## 本地开发与验证

```bash
node scripts/formyson/credentials.mjs
npm run dev:formyson
# 打开 http://localhost:8787/formyson/admin/
```

脚本复用本机已有账号，重新生成盐和密码摘要，并写入被 Git 忽略的 `.dev.vars`。不得提交 `.dev.vars` 或 `~/.config/formyson/` 内的凭据。首次创建资源和账号不应在每次构建时执行。

```bash
npm run build
npm run test:formyson
```

测试通过真实本地 Workers、D1、R2 和构建资产验证登录、CSRF、限流、内容 CRUD、并发冲突、草稿隐藏、SEO、分页、图片与退出。Astro dev / preview 仅预览静态壳，完整管理功能必须通过 Wrangler 验证。

## 部署

数据库和存储桶已创建。新迁移必须先应用，再部署使用新字段的 Worker：

```bash
npm run migrate:formyson
npx wrangler secret bulk ~/.config/formyson/secrets.json
npm run deploy
```

`ADMIN_USERNAME` 位于 Wrangler 配置；`ADMIN_PASSWORD_HASH` 与 `ADMIN_PASSWORD_SALT` 使用 Worker secrets。首次上线才需要初始化 secrets，日常内容更新不需要部署。GitHub 自动部署仍由 Cloudflare Workers Builds 监听；构建命令为 `npm run build`，部署命令为 `npx wrangler deploy`，根 Wrangler 配置会同时部署 Worker 与 `dist/`。

修改固定密码：在本机私有 `admin.json` 中更新密码（建议至少 16 位），运行 credentials 脚本，再上传新 secrets。若改用户名，同步 `wrangler.jsonc` 中的 `ADMIN_USERNAME`。更新凭据会使已有会话失效。不要在命令参数中直接传明文密码。

## 安全与备份

- Cookie 为 HttpOnly、Secure、SameSite=Strict，12 小时过期；退出会删除服务端会话。
- 写接口检查 Origin；所有管理接口要求登录；参数使用预编译 SQL；Markdown 禁止执行 HTML 和危险 URL。
- 登录有 Cloudflare 速率限制和 D1 持久计数，单 IP 连续尝试过多后暂时锁定。
- 保存使用 revision 防止多个标签页覆盖对方修改，冲突时需重新载入。
- D1 完整备份：`npx wrangler d1 export formyson --remote --output <私有备份路径.sql>`。图片需另行通过 R2 备份；不要把数据库备份放在 `public/` 或提交到 Git。
- 暂不自动删除未引用图片；定期检查 R2 使用量。R2 超过免费额度按量计费。
