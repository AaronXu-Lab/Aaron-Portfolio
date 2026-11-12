# Prompt 擂台

入口：`/tools/prompt-lab/`。独立静态 PWA，作品预览随窗口宽高自适应。

## 新增作品

请阅读项目根目录的 [作品接入指南](../../../workflows/prompt-lab.md)。交付目录、登记字段、题目版本与验证要求以该指南为唯一来源。

## 文件与维护

- `prompt.txt`：页面复制的固定 Prompt 原文，当前题目为「鹈鹕骑自行车」。已有真实测试后请冻结该版本，不要静默修改题目。
- `entries.json`：作品登记表，顺序即下拉菜单顺序，每次运行独立登记。
- `entries/<作品ID>/index.html`：独立作品入口。

主界面保留模型切换、复制 Prompt 与当前作品的新窗口打开入口；复制失败时提供手动复制弹窗。作品切换链接为 `/tools/prompt-lab/?model=<作品ID>`。

iframe 的同源权限用于本地持久化，并不是安全隔离边界，只接入经过审阅的仓库作品。

Service worker 初次安装缓存展示台和已登记入口，其他本地资源在访问后缓存；在线优先获取最新文件，离线使用已缓存资源。修改缓存策略时递增 `sw.js` 内 CACHE 版本，仅清理自身前缀缓存。

## 模型菜单

模型切换使用已安装 AaronUI 的 `Menu.Submenu` 与 `Menu.RadioItem`，按 ChatGPT、Claude、Grok、Gemini 分组。源文件位于 `src/lib/prompt-lab/model-menu.tsx`，运行 `npm run build:prompt-lab` 生成独立壳所需的 JS 与 CSS（完整构建也会执行）。新增模型沿用 `entries.json`；新增系列时同步菜单中的系列匹配规则。

本次接入依据 AaronUI 0.9.0 已安装包的公开类型；本地知识 MCP 未连接，组件规范与 Gallery Example 对照待验证。
