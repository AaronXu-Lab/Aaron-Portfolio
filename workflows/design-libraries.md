# 更多组件库

`/design/more/` 为总入口，`src/data/libraries.ts` 中的 `showcaseLibraries` 登记两个展厅。`/design/` 原入口保持不变。

两个展厅都以 **Figma 源节点为唯一视觉标准**：每个公开组件的每个变体都由 Web 实渲染，与 Figma 并排对比时应看不出差异（几何误差 ≤1px，颜色取源变量，图标用源 SVG）。数据是静态快照，不会自动同步 Figma。

| 库 | Figma 文件 |
| --- | --- |
| Followup | [oEYHBrbLVcmWpgKAQ7KXcl](https://www.figma.com/design/oEYHBrbLVcmWpgKAQ7KXcl/followup_%F0%9F%92%8E-Design-Library?node-id=34-1767) |
| flomo | [Tvq9bNPX2M0SksYFiEvaW7](https://www.figma.com/design/Tvq9bNPX2M0SksYFiEvaW7/?node-id=94-9382) |

## 访客可见范围

源目录完整保留在数据里，展厅只展示公开组件：

- 名称以 `_` 开头的内部件、`_Old` 旧版、`_Drafts` 草稿、Recycle／Trash 回收区不展示。
- 仅作为槽位的原子件（光标、分隔点、图标槽等）和 `…Wrapper` 场景容器不单独成页。
- 属性轴顺序：尺寸按实际大小从小到大；Followup 的布尔属性排在变体轴之后。

## Followup

`/design/followup/` 由 Astro 客户端脚本挂载 React 展厅，代码在 `src/design-libraries/followup/`。

- `data/showcase.ts`：把源数据整理成组件页。组件页按 Figma 分区归并（Inputbox、Dropdown……），Scenary 页只收公开组件集。每个条目带变体属性、布尔属性和变体在 Figma 画板中的坐标。
- `pages/ComponentsPage.tsx`：每个组件是「游乐场 + 全部变体」。游乐场可切换任意属性并直接交互；变体矩阵按 Figma 画板坐标平铺全部变体，静态渲染。
- `specimens/*.tsx`：Web 实现。每个文件默认导出 `RendererMap`（键为 Figma 组件集或组件的节点 ID），`specimens/registry.ts` 自动收集，新增文件无需登记。渲染器的外框尺寸必须等于 Figma 变体尺寸。
- `specimens/shared.tsx`：`Icon`（`public/design-libraries/followup/icons/` 下的 Figma 图标，以 `currentColor` 着色）与 `Placeholder`。
- 颜色与数值：`App.tsx` 把全部 COLOR、FLOAT 变量写成 `--followup-<变量名>`，随四种主题色切换。组件样式只引用这些变量。
- 字体：SF Pro 走系统字体栈，Inter 由 `@fontsource-variable/inter` 本地加载。
- 图标页：`data/icons.json` 与 `public/design-libraries/followup/icons/` 由 Figma「Icon Total」分区整体导出后按组件坐标拆分而来，颜色统一替换为 `currentColor`。

## flomo

`/design/flomo/` 同样挂载 React 展厅，代码在 `src/design-libraries/flomo/`。

- `showcase.ts`：按 Figma 分区（family）整理公开组件，属性轴解析自 Figma 变体名。
- `components/<family>.tsx`：每个分区一个文件，默认导出 `FamilyModule`（`renderers`、可选 `defaults`／`axes`／`description`／`demo`），自动收集。
- 面板结构沿用「默认示例 + 属性对比 + 交互演示」。属性对比只覆写当前轴；源设计未绘制的组合会变暗并注明。Figma 布尔属性（Show Title 等）不在变体名里，需在模块 `axes`／`defaults` 中声明。
- 依赖轴：只在某个前提下生效的属性（如 Dialog 的 Show Description 仅限 Preset）写在模块的 `requires` 里。前提不满足时，该轴的对比块整块置灰、不可操作，并显示生效条件；默认示例的设置仍可编辑，旁注「当前不生效」。
- 对比栏数按内容区实测宽度与最宽变体计算（最多 3 栏）；组件仍比舞台宽时等比缩小（不低于 50%），两库的游乐场与舞台同理。
- 平台切换：顶栏可选 iOS／Android／Web，写入 `data-flomo-platform`。Figma「Platform」集合（字体、正文字号、菜单内边距、Sheet 高度等）映射为 `--fm-p-*`；「Numbers」集合为 `--fm-n-*`；颜色为 `--fm-*`，随 Light／Dark／Dark Elevated 切换。
- 交互手感：可按压元素加 `fm-press`。iOS 按下变暗，Android 从指针位置扩散水波纹（`App.tsx` 统一处理），Web 的悬停态按 Figma 标注在各组件样式里实现。所有动效在 `prefers-reduced-motion` 下关闭。
- 图片选择只创建本地 Object URL，移除或卸载时释放，不上传。AudioBox 没有音频文件，播放按钮只演示状态。

`catalog.json` 是从 Swift 生成文件解析出的静态快照。重新导入时运行：

```bash
python3 scripts/import-flomo-library.py /path/to/FlomoComponents/FlomoComponents
```

导入器只解析声明，不执行附带代码。重新导入颜色后需同步 `global.css` 中 flomo 的三套语义变量、`--fm-n-*` 与 `--fm-p-*`；组件变体改变时同步对应的 `components/<family>.tsx`。

## 外壳可读性

展厅外壳（导航、页头、Token／样式列表、控件标签、说明文字）与组件示例分开对待：示例的字号、颜色必须与 Figma 一致；外壳遵守以下下限。

- 字号：主要内容（名称、色值、导航、按钮、输入框）14px，次要信息（别名、说明、标签、状态）13px，计数、角标、大写小标题最低 12px；页面描述 15px 起。
- 对比度：外壳文字不低于 4.5:1。弱化文字用 `--muted`（Followup）／`--fm-muted`（flomo），强调色文字用 `--primary-text`；它们由 Figma 变量混合得出，不要直接用 Figma 的 Secondary／Subtle 色或写死浅灰。
- 窄屏：信息不截断到看不出含义，长名称换行或改为上下排列。

## 验证

```bash
npm run check:design-libraries
npm run build
npm run preview -- --port 4322
```

每改一个组件，都用 Figma MCP 取该组件集的截图，与展厅中的变体矩阵或属性对比同倍率并排核对。另需验证入口页、两个展厅在 390 px 宽度下无页面级横向溢出（宽组件在舞台内滚动）、主题与平台切换、键盘操作。截图等验证产物放在 `output/`，不作为运行时资源。
