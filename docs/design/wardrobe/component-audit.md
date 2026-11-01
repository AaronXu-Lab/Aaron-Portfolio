# 衣集组件用法审查与修复

日期：2026-11-01。模式：audit，用户授权直接修复。范围：`src/lib/wardrobe/app.tsx` 与 `style.css` 的拍摄、相册、筛选、多选、设置、衣服详情及确认入口。

## 基线与证据

实现依赖为仓库内打包的 `@aaronxu-lab/aaron-ui` 0.9.0；精确接口核对已安装包的公开 `.d.ts` 与 AaronUI-Web 当前 TypeScript 源码。没有修改组件库源仓库或更换依赖版本。

本次成功连接只读 MCP `http://127.0.0.1:7331/mcp`，完成相关组件发现、Layout Docs 发现及正文读取。此前实施记录中“知识服务不可用”的结论是历史状态，本次不沿用为当前证据。

已读的 `component` 文档：scrollbar、dropdown、combobox、input、input-area、field-container、sheet-basic、dialog-basic、checkbox、switch、button、tabs、badge、collapsible、bulk-action-bar、empty-state、error-state、alert、loading、sonner、filter-pill、grid-item。审查使用 usage／composition／best-practices；有相应章节的组件另读 properties。collapsible 仅提供 usage／composition，bulk-action-bar 无 properties，首次请求按实际章节修正。另读 `get_design_rules`；`doc/form-gap`、`doc/controls-gap`、`doc/dialog-label` 的 core-rules。

Example 完整目录共 15 项，`nextCursor=null`。选择并读取：

| Example ID | 规则与实现 | 采用与差异 |
| --- | --- | --- |
| `scenarios/dialog/example-1/delete-confirmation` | rules.status=available；读取 `gallery/scenarios/dialog.tsx`、`dialog.module.css`、相关 MDX 及默认返回文件 | 采用 DialogBasic 的 primaryAction／secondaryAction、破坏性确认和可访问 Description；目标对象改为衣服，增加实际 IndexedDB 失败恢复。 |
| `scenarios/dialog/example-1/compact-form` | rules.status=available；读取同上实现与 CSS | 采用 FieldContainer、Input／InputArea 以及失败时保留草稿；衣服详情含多项管理任务，依据 Sheet 规范改为 Sheet，设置即时保存沿用用户明确要求，不照搬 Example 的提交后关闭。 |
| `components/dialog-basic/example-1` | 返回 INVALID_ARGUMENT，未取得实现 | 待验证；不将其规则或移植状态计为通过。 |

其余 12 项为尺寸／动作轴、Scenario 聚合、重命名、信息与加载示例，本次未读实现；已有明确匹配参考，不宣称遍历全部实现。已在运行中的 `/zh/scenarios/dialog` 打开匹配入口并检查实际渲染，截图位于本次会话的 visualization 目录：`gallery-delete-reference.png`、`gallery-form-reference.png`。复用真实组件和组合，不移植 Gallery 依赖与模拟失败代码。

## 发现与完成的修复

| 位置与原观察 | 依据 | 修改及验证状态 |
| --- | --- | --- |
| 详情粗分类使用原生 select；表单自建 label 包装 | dropdown composition「A named field」；field-container usage／composition | 改用 Dropdown＋FieldContainer，标签／说明关联到焦点控件；分类修改与保存已验证。 |
| 相册用一排普通 Button 保存分类选中值 | button usage「Field value selection」；dropdown usage | 改为具名的粗分类 Dropdown，保持原筛选含义；全部／分类切换已验证。 |
| Prompt 为原生 textarea，自建表面覆盖组件样式 | input-area usage「A multiline field」与 composition | 改用 InputArea，保留换行与编辑即保存；输入、关闭、重开持久化通过。文本内部滚动由 InputArea 自身管理，不把 Scrollbar 接到无关 textarea 上。 |
| 页面、细标签列表存在原生或隐藏滚动条；详情 Dialog 承载多个管理任务 | scrollbar composition「Owning viewport」；dialog-basic usage「Workspace or feedback」；sheet-basic usage「Content scrolling」 | 页面和标签区采用 Base UI Root→Viewport→Content→AaronUI Scrollbar；设置和详情复用 Sheet 自带滚动，不叠加同轴视口。详情改用 Sheet。42 件衣服、45 个细标签下独立滚动通过。 |
| 原自定义 Sheet 底部定位覆盖库的视口安全预算 | sheet-basic best-practices；height sizing | 移除自定义定位，使用 auto＋minHeight=none＋adaptiveHeight；设置仍无底部操作。320、390、758、1280 像素检查安全边距、正文滚动及无横向溢出。 |
| Base UI Content 默认 min-width:fit-content 撑开窄屏 Sheet | 运行时尺寸及 Base UI 已安装实现；scrollbar 的独立内容边界 | 应用内仅针对竖向内容约束 min-width 与 width；320 像素复测通过，不修改组件库。 |
| 标签筛选按钮与卡片勾选圆圈为自绘 | checkbox usage「Independent choices」 | 改用真实 Checkbox，卡片图片按钮与勾选控件为同级目标，避免嵌套交互元素；全选、部分选中、逐项选择与筛选通过。 |
| 原生 details 展开设置、隐私和筛选 | collapsible composition「Ordinary disclosure」 | 改为 Collapsible＋Trigger，retainActive=false，不引入 Sidebar 选中路径；展开／收起与输入可达性通过。 |
| 批量操作自绘；窄屏可能挤掉数量 | bulk-action-bar composition／best-practices | 使用 BulkActionBar，所选 IDs、数量、导出和删除保持同源；全选独立于浮动操作条。窄屏数量完整、导出及删除确认通过。 |
| BulkActionBar 0.9.0 将隐藏测量组设为零宽后，scrollWidth 从 154 变为 58，导致展开／收起逐帧交替 | 连续 8 帧运行观测；bulk-action-bar 动作收起语义 | 消费方局部 CSS 保留 selection 的固有宽度，并让动作测量组保持 max-content；连续 12 帧稳定，320 像素“更多”菜单可点击。该 CSS 依赖当前组件子节点结构，升级组件库时需复核；未修改源仓。 |
| 重识别使用 window.confirm；删除后果未注册为弹窗说明 | dialog-basic composition；doc/dialog-label action-execution；Delete Confirmation Example | 使用真实 DialogBasic，配置 primaryAction／secondaryAction 和 BaseDialog.Description；取消不调用 API，删除取消不影响记录。 |
| 表单保存／删除失败仅依赖短暂通知 | alert usage「Persistent context」；sonner best-practices；Compact Form Example | 增加持续错误与重试、按钮 loading；注入 IndexedDB 写入失败，确认保留输入和对象，重试可完成。 |
| 空相册、无匹配结果和全局读失败自绘；处理中使用自绘 pulse | empty-state、error-state、loading 的 usage／composition | 使用 EmptyState、ErrorState、Loading；连接提示与持续错误使用 Alert。已有 Button、Switch、Tabs、UiProvider/useToast 继续使用真实组件。 |
| 通用 button／textarea 焦点与按压样式覆盖组件反馈 | 真实组件拥有自己的状态样式；运行中的展开按钮点击问题 | 移除通用覆盖，仅业务图片入口与折叠触发器保留局部反馈。 |

## 有意保留与证据边界

- 两个隐藏的原生 file input 保留：分别负责系统相机与多选相册，属于平台输入能力，不伪造上传组件。
- 服装照片入口保留原生 button 和业务图片布局：GridItem 当前模板以标识、标题、摘要和最近动态组织内容，本应用的主要目标是可完整查看的大幅透明服装图。使用键盘可操作的按钮，选择控件独立放置；没有重造同名组件或把 GridItem 的 div 当按钮。
- 模型 Combobox／分类 Dropdown 的弹出列表、InputArea 的文本内部滚动由库实现拥有，不增加第二个同轴 ScrollArea，不通过私有类名把 Scrollbar 绑定到其内部元素。
- 设置 Prompt 的即时保存是用户明确要求，优先于 Compact Form Example 的显式保存并关闭行为。
- 主站 PWA 安装入口要求继续按用户此前明确“移除安装应用”处理，本次未恢复。

## 验证与剩余项

`npm run check:wardrobe`：类型检查和 9 项逻辑测试通过。`npm run build`：123 页构建零错误。`git diff --check` 通过。

隔离浏览器使用模拟模型列表和测试 IndexedDB，没有读取用户 Key 或修改用户相册，没有收费 API 调用。已验证：两个字段搜索选择的既有能力、分类筛选和详情编辑、多个标签选择、InputArea 自动保存、主页面／标签／Sheet 独立滚动、批量 ZIP 导出及实际解包 PNG＋JSON、删除取消／确认、保存和删除失败恢复、窄屏批量菜单以及 390×500 短屏末尾操作可达性。主要视觉证据：`wardrobe-components-detail.png`、`wardrobe-components-bulk.png`。

未重测真实相机、iOS 实机键盘、辅助技术朗读与收费生成保真度。基础 Dialog Example 的 MCP 读取失败仍为待验证；未将它算作通过。本报告表示本次入口和状态的组件审查及修复完成，不表示组件库所有能力或所有设备均合规。
