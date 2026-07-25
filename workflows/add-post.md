# 工作流:新增博客文章

流程已固化为脚本 `site/scripts/add-post.mjs`。你只需要提交 `.md` 文件。

## 用法

```bash
cd site
npm run add:post -- <文章.md>            # 单篇
npm run add:post -- a.md b.md c.md       # 多篇
npm run add:post -- --force <文章.md>    # 覆盖同名旧文
```

跑完验证:`npm run dev` 打开脚本打印的「上线地址」,或 `npm run build`。

## 对来稿 .md 的要求(非常宽松)

| 项 | 规则 |
| --- | --- |
| frontmatter | **可整个省略**,或只写一部分;支持 Hexo 风格(`tag`/`tags` 混用均可) |
| `title` | 缺省时取正文第一个 `# 一级标题`(该行会从正文移除,避免页面双标题);再退回文件名 |
| `date` | 缺省 = 当前时间;写裸时间戳(`2026-07-05 14:00:00`)按**中国时区**理解 |
| `tags` | 缺省 = `随笔` |
| `categories` | 缺省 = `随笔`(博客页筛选 chip 会自动出现新分类) |
| 摘要 | 正文里放一行 `<!-- more -->` 手动指定截断点;否则自动取前 140 字 |
| 图片 | **相对路径图片会被自动复制**到 `public/blog-assets/<slug>/` 并改写引用;http(s) 外链与 `/` 绝对路径保持不动 |
| 文件名 | 即 slug:`我的文章.md` → `/blog/我的文章/`(URL 经 github-slugger 处理:小写化、剥标点) |

脚本自动补齐:`author: Aaron Xu`、`excerpt`、`minutes`(按中文 400 字/分钟)。

## 示例

最小可用来稿(无 frontmatter):

```markdown
# 当 App 开始融化(二)

正文第一段,会成为摘要。

<!-- more -->

![配图](./img/shot.png)

正文继续……
```

```bash
npm run add:post -- ~/Desktop/当-App-开始融化(二).md
# ✓ 已写入 src/content/blog/当-App-开始融化(二).md
#   图片:复制 1 张 → public/blog-assets/…/
#   上线地址:/blog/当-app-开始融化二/
```

## 注意

- **勿手改 `src/content/blog/` 下的文件**;要改内容:改原稿 → `add:post --force` 重新导入。
- `npm run import:blog` 是**全量重建**(读 Hexo 目录、清空重写整个 blog 目录),只在需要重同步存量文章时用;它不会知道 `add:post` 加的新文章 —— 全量重导后需把新文章的原稿重新 `add:post` 一遍。建议:新文章的原稿 .md 长期保留(或直接放进 Hexo 的 `_posts` 目录再 import,二选一)。
- 文章正文遵循全站排版约定:全角标点、成对破折号「——」可用。
