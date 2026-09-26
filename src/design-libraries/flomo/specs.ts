export type Config = Record<string, string>;
export type Axis = { name: string; values: string[] };
export type Spec = {
  description: string;
  defaults: Config;
  axes: Axis[];
  note?: string;
};
const axis = (name: string, ...values: string[]): Axis => ({ name, values });
export const specs: Record<string, Spec> = {
  button: {
    description:
      "从轻量文字操作到强调按钮，保留 iOS 的三档尺寸与四种内容组合。",
    defaults: {
      Size: "Medium",
      Style: "Fill",
      Type: "Text",
      Disabled: "False",
    },
    axes: [
      axis("Size", "Small", "Medium", "Large"),
      axis("Style", "Plain", "Light", "Fill"),
      axis("Type", "Icon", "Text", "Icon+Text", "Text+Icon"),
      axis("Disabled", "False", "True"),
    ],
  },
  segment: {
    description: "在一组互斥选项中切换，选中项随操作更新。",
    defaults: { Count: "3" },
    axes: [axis("Count", "2", "3", "5")],
  },
  label: {
    description: "承载短文本，支持前置图标。",
    defaults: { Icon: "True" },
    axes: [axis("Icon", "False", "True")],
  },
  input: {
    description: "支持真实输入与清空，保留前后内容槽位和尺寸。",
    defaults: { Size: "Medium", Leading: "Icon", Trailing: "Clear" },
    axes: [
      axis("Size", "Small", "Medium", "Large"),
      axis("Leading", "None", "Icon"),
      axis("Trailing", "None", "Clear", "Text"),
    ],
  },
  snackbar: {
    description: "短暂反馈的消息表面，可提供操作与关闭入口。",
    defaults: { Action: "True", Close: "True" },
    axes: [axis("Action", "False", "True"), axis("Close", "False", "True")],
  },
  list: {
    description: "组合标题、描述和尾部操作，保持列表的阅读顺序。",
    defaults: { Icon: "True", Detail: "True", Trailing: "Chevron" },
    axes: [
      axis("Icon", "False", "True"),
      axis("Detail", "False", "True"),
      axis("Trailing", "None", "Chevron", "Toggle"),
    ],
  },
  checkbox: {
    description: "圆形选择控件，支持选中、未选中与部分选中。",
    defaults: { State: "Checked" },
    axes: [axis("State", "Unchecked", "Checked", "Indeterminate")],
  },
  message: {
    description: "按语义区分提示、警告和固定提醒。",
    defaults: {
      Type: "Message",
      Badge: "True",
      Description: "False",
      Cancelable: "False",
    },
    axes: [
      axis("Type", "Alert", "Message", "Fixed Tip"),
      axis("Badge", "False", "True"),
      axis("Description", "False", "True"),
      axis("Cancelable", "False", "True"),
    ],
  },
  trash: {
    description: "源库保留的旧版消息定义，沿用其提示组件结构。",
    defaults: { Type: "Alert", Badge: "True" },
    axes: [axis("Type", "Alert", "Message", "Fixed Tip")],
    note: "Legacy：保留源库目录归属。",
  },
  "page-indicator": {
    description: "通过点状导航表达页数和当前位置，点击切换。",
    defaults: { Count: "5" },
    axes: [axis("Count", "3", "5", "7")],
  },
  menu: {
    description: "菜单表面支持图标、补充信息、徽标和开关。",
    defaults: { Leading: "Icon", Trailing: "None" },
    axes: [
      axis("Leading", "None", "Icon", "Emoji"),
      axis("Trailing", "None", "Icon", "Detail", "Badge", "Chip", "Toggle"),
    ],
  },
  contribution: {
    description: "用四级色阶呈现记录密度，点击单元格查看并切换选中状态。",
    defaults: { Size: "Small" },
    axes: [axis("Size", "Small", "Large")],
  },
  dialog: {
    description:
      "保留原生弹窗的内容层级，使用浏览器 dialog 实现焦点约束与 Escape 关闭。",
    defaults: { Count: "2" },
    axes: [axis("Count", "1", "2")],
    note: "源设计仅含 Android 和 Web/Desktop 变体；此处沿用 SwiftUI 展厅的 iOS 弹窗示例。",
  },
  navigation: {
    description: "支持居中、左对齐、品牌标题与搜索操作。",
    defaults: { Title: "Title", Align: "Center", Trailing: "Button" },
    axes: [
      axis("Title", "None", "Title", "Logo"),
      axis("Align", "Center", "Left"),
      axis("Trailing", "Button", "Search"),
    ],
  },
  "image-uploader": {
    description: "保留四个源图状态；演示支持选择本地图片、预览和移除。",
    defaults: { State: "Done" },
    axes: [axis("State", "Todo", "Uploading", "Done", "Blur Number")],
    note: "图片仅在当前浏览器预览。",
  },
  audio: {
    description: "紧凑音频条与原文展开区域。",
    defaults: { Expanded: "False" },
    axes: [axis("Expanded", "False", "True")],
    note: "源库未附音频，播放按钮仅演示播放与暂停状态。",
  },
  sheet: {
    description: "底部面板与全屏面板，支持点击遮罩、关闭按钮和 Escape 收起。",
    defaults: { Type: "Half" },
    axes: [axis("Type", "Half", "Full")],
  },
  "bottom-bar": {
    description: "一至三个底部操作，选中状态随点击更新。",
    defaults: { Count: "3" },
    axes: [axis("Count", "1", "2", "3")],
  },
  "float-button": {
    description: "悬浮操作支持圆形、圆角矩形和主次层级。",
    defaults: { Shape: "Round Rectangle", Priority: "Primary" },
    axes: [
      axis("Shape", "Round Rectangle", "Circle"),
      axis("Priority", "Primary", "Secondary"),
    ],
  },
  "empty-page-b": {
    description: "用图形与说明表达尚无内容的状态。",
    defaults: { Type: "Emoji" },
    axes: [axis("Type", "Emoji", "Symbol")],
  },
};
export const documentation: Record<string, string> = {
  "time-format":
    "源库中的时间格式规范文档，没有独立组件定义。保留源节点，便于查看原规范。",
  "easy-script": "源库中的快捷记录 Widget 文档，没有独立组件定义。",
  "empty-page-a":
    "源库中的空页面组合示例，没有独立组件定义。可交互展示见另一组 Empty Page。",
};
