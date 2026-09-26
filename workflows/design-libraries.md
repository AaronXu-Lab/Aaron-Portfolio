# 更多组件库

`/design/more/` 为总入口，`src/data/libraries.ts` 中的 `showcaseLibraries` 登记两个展厅。`/design/` 原入口保持不变。

## Followup

`/design/followup/` 通过 Astro 的客户端脚本挂载提供仓库中的 React 展厅。源码与源数据放在 `src/design-libraries/followup/`，19 张源设计参照位于 `public/design-libraries/followup/reference/`。保留变量解析、四种主题色、样式、组件检索、变体检查器与源数据审计。

这是一份用户提供的仓库快照，不会连接 Figma 自动同步。源节点链接仍指向原设计。1,237 条定义是设计目录数量，源展厅的交互示例不等同于每条定义的像素级实现。

## flomo

`/design/flomo/` 把提供的 SwiftUI 组件库迁移为 React、CSS 与浏览器原生控件。`src/design-libraries/flomo/components.tsx` 包含 Web 实现，`specs.ts` 定义默认值与可比较的设计属性轴。属性比较继承当前默认配置，只覆盖正在比较的属性；重置同时恢复演示状态。

源目录包含 667 个变量、39 个样式、381 条定义（292 个组件、42 个图标、47 个示例），以及 23 个组件分组。其中 20 组有 Web 示例；Time Format、Easy Script 和一个 Empty Page 分组仅为源设计文档，保留原节点入口。源设计中的跨平台变体保留为目录，不将全部目录条目宣称为独立 Web 实现。

- 设计值 `Style` 对应按钮 `data-variant`，`Type` 对应 `data-kind`，不覆盖原生 DOM 属性。
- SwiftUI Binding 由 React 状态承接；弹窗与 Sheet 使用原生 `dialog`，支持焦点约束、Escape 与焦点返回。
- 图片选择只创建浏览器本地 Object URL，移除或卸载时释放，不上传。
- AudioBox 沿用源库的播放状态演示，源库没有音频文件。
- Light、Dark、Dark Elevated 三套颜色直接来自源变量，语义值集中在 `src/styles/global.css` 的独立作用域。

`catalog.json` 是从 Swift 生成文件解析出的静态快照。重新导入时运行：

```bash
python3 scripts/import-flomo-library.py /path/to/FlomoComponents/FlomoComponents
```

导入器只解析声明，不执行附带代码。重新导入颜色后需同步 `global.css` 中 flomo 的三套语义变量；组件 API 发生改变时同步 `specs.ts`、Web 实现与展示。源图标直接使用原 SVG，上传器的四个 PNG 从原 Swift 文件解码取得。

## 验证

```bash
npm run check:design-libraries
npm run build
npm run preview -- --port 4322
```

验证入口、两个展厅、组件交互、移动导航、窄屏溢出、源图加载和主题切换。Playwright 使用专用命名会话，完成后关闭。浏览器截图在 `output/playwright/design-libraries/`，不作为运行时资源。
