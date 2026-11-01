# 衣集实现与验证

## 当前范围

独立 React PWA，路由 `/tools/wardrobe/`，使用 `vendor/aaronxu-lab-aaron-ui-0.9.0.tgz`。界面采用真实 Button、Input、Checkbox、DialogBasic、UiProvider，通知通过 `useToast` 接入库内 Sonner。主站仅在产品注册表添加入口，不导入组件库样式。

原文件保存在 `originalBlob`；另存最长边 2048 像素的 JPEG `preparedBlob` 用于 API。透明图和标签并行执行，每步完成后在独立 IndexedDB 读写事务里合并，避免互相覆盖。批量最多两件并发。刷新后保留成功结果和待处理记录，不自动重发收费请求。失败步骤由用户重试。

完成后直接入库，整批完成时 Sonner 提供 10 秒撤销，撤销删除该批成功记录。删除及撤销均删除原图、处理用图、透明图与标签。重新生成保留旧图直至新图成功；手动标签保留，显式重新识别才覆盖。导出 ZIP 只含透明 PNG 和同名 JSON。

设置存于 IndexedDB，Key 输入始终遮罩，取消不保存，清空保存可移除。仅向 `api.openai.com` 发 API 请求。没有自建服务、遥测或远程字体。离线缓存仅含应用壳，API 与照片不进 Service Worker Cache。模型列表在每次打开设置时刷新；首次填入 Key 后保存并重新打开即可获取列表。模型列表不包含能力元数据，因此以模型 ID 提示作候选筛选，允许直接编辑，不把可见性当作能力保证。

## 组件证据与缺口

已读取 aw-component-advisor 工作流与知识访问契约。2026-11-01 尝试通过只读 MCP 客户端连接 `http://127.0.0.1:7331/mcp` 失败（fetch failed）；未擅自启动服务。组件规范、完整 Example 目录与 Gallery 实渲染对照暂记待验证，不能声称全部合规。精确使用依据为本地 0.9.0 源码 Button、Input、Checkbox、DialogBasic、UiProvider 与 useToast 的公开类型和实现。原生 select、textarea 保留浏览器语义，未伪装成库导出。

## 官方接口依据

- [Images Edit](https://developers.openai.com/api/reference/resources/images/methods/edit)：multipart 图片编辑，透明背景 PNG。
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)：Responses `text.format` 严格 JSON Schema。
- [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra)：默认标签模型采用具体模型 ID `gpt-6-astra`，设置可改。
- [List Models](https://developers.openai.com/api/reference/resources/models/methods/list)：按用户 Key 获取可见模型。

## Logo

内置 ImageGen 生成，非手绘 SVG。最终原图 `public/tools/wardrobe/logo.png`，派生 180、192、512 像素安装图标。提示词：Create a refined app icon for a personal wardrobe photo catalog PWA called 衣集. No text or letters. One sculptural ivory folded shirt whose collar subtly resembles a hanger, centered on a solid muted deep aubergine square background, tiny peach fabric label accent. Clean editorial fashion identity, soft dimensional paper material, crisp silhouette readable at 32px, generous 20 percent safe padding, no outer rounded corners, no mockup, no border. Square 1024x1024.

## 验证边界

核心测试覆盖分类、标签契约、交集筛选、按步骤重试、导出不含原图或 Key、设置迁移与模型拒绝输出。浏览器使用受控 API 响应验证；无用户 Key，不声称真实 API 质量、账号模型权限、照片保真度已验证。iOS 原生相机与安装步骤仍需真机核对。

## 已完成验证

- `npm run build`：123 个页面构建成功。
- `npm run check:wardrobe`：TypeScript 检查及 6 项核心测试通过。
- `npm ci --dry-run --ignore-scripts --offline`：锁文件可重复安装检查通过。
- Playwright 受控响应：设置保存与模型刷新、Key 遮罩、两张照片并行入库、整批 Sonner 撤销、标签失败仅重试标签、图像重生成失败保留旧图、重生成保留手动标签、交集筛选、刷新保留记录、离线刷新、390 像素布局均通过。
- 相机文件入口、两件多选导出、取消删除不丢记录、确认批量删除后刷新仍为空已验证。单张与批量 ZIP 已解包核对，分别只有 PNG 和同名 JSON，不含原图或 Key。
- 预览服务器的 `Vary: Origin` 导致模块缓存未命中已修复：应用壳匹配忽略 Vary，Service Worker 版本摘要同时包含构建脚本。API 请求和用户照片不缓存。
- 浏览器测试中的照片与 Key 均为隔离上下文内的虚拟数据，未调用真实 OpenAI 模型。

## 移动端精简与双 Tab（当前版本）

按用户后续要求，页面品牌栏（logo、名称、描述）和安装入口已删除；PWA manifest 和主屏幕图标保留为安装元数据。该要求优先于项目原有可见安装按钮规则。页面使用真实 AaronUI-Web Tabs，以「拍摄／相册」切换任务；拍摄页只做拍照、批量选图和连接提示，上传后进入相册。相册空态隐藏搜索、分类和多选；有内容后启用搜索、横向粗分类及可展开的细标签筛选。多选操作固定在底部 Tab 上方。重复添加按钮、宣传标题、品牌页脚和卡片日期已删除。

设置说明合并为贴近 Key 的简短提示及可展开的「数据与隐私」。自定义 Prompt 默认折叠，恢复默认使用用户提供的完整七节服装商品图处理 Prompt。只把旧版默认文案迁移为新版，保留用户自定义内容。GPT Image 2／2.5 请求 2048 × 2048、high 质量，其他型号使用标准 1024 × 1024。模型实际权限与分辨率支持仍取决于用户账号和具体模型，不自动重发收费请求。

本地知识 MCP 再次连接失败（fetch failed）。Tabs 的 Root／List／Item／Panel 类型、`icon` 插槽及填满列表宽度的行为已核对当前源码；规范与 Gallery 对照仍为待验证。信息精简依据为当前实现和手机截图，不将该缺口记作合规。

移动端改版已使用受控 API 响应验证：拍摄／相册切换、无安装和品牌入口、空相册隐藏筛选、Prompt 默认折叠、完整七节 Prompt 及恢复默认、2048 图像请求、上传后切到相册、细标签筛选、详情编辑与多选 ZIP 下载。7 项核心测试和类型检查通过。320、390、430 和 1280 像素检查横向溢出、页面宽度利用及底部 Tab 可见性；修正 Tabs 根布局下 main 的自动宽度收缩。真实照片、API 付费调用与 iOS 原生相机仍未验证。

## 设置 Sheet（当前版本）

设置改为真实 AaronUI-Web `SheetBasic`，独立 open 状态，保留原拍摄／相册 Tab、相册筛选与滚动上下文。手机贴底展开；桌面使用库的居中工作区。标题和关闭入口由 Sheet 提供，正文独立滚动，自定义 footer 固定承载取消和保存。关闭按钮、取消及 Esc 丢弃草稿；保存成功后更新本地配置并关闭。打开 Sheet 时刷新模型列表。

已核对当前 `SheetBasic` 公开类型和实现的 open/onOpenChange、width、heightMode、contentInset、contentDivider、actions 与 closeLabel。知识 MCP 仍不可连接，规范／Example／Gallery 对照延续待验证状态，不宣称组件规范全量通过。

Playwright 受控响应验证通过：390 像素 Sheet 贴底且宽度铺满、长内容下保存按钮可见、取消丢弃修改、保存持久化、打开刷新模型、关闭保留原 Tab、焦点回到设置入口、Esc 关闭，以及桌面宽度受限无横向溢出。

## 模型选择与连接测试（当前版本）

模型改为真实 AaronUI-Web Dropdown，`items`、`value`、`onValueChange`、`width="fill"` 与可访问名称按当前公开实现核对，不再提供自由填写框。预设标签模型改为 `gpt-6.1-terra`，旧默认 Astra 在首次迁移时更新，迁移后明确选择的模型继续保留。官方模型 ID 与视觉／结构化输出能力已核对 [GPT-6.1 Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra)。

API Key 标签旁提供测试连接按钮，使用尚未保存的当前输入 Key 请求 GET `/v1/models`，不调用图片或标签生成；成功刷新 Dropdown，失败显示原因。编辑 Key 或关闭 Sheet 使旧响应失效，模型读取 15 秒超时。测试成功只代表认证与模型列表读取成功，不保证具体模型调用权限或余额。

修复用户 758 × 1314 截图中设置内容右侧溢出：Sheet 内容明确限制宽度，模型字段改为纵向单列，Dropdown 的长模型名由自身截断显示。已验证 320、390、600、758、1280 像素下正文无横向溢出，所有字段边界均位于 Sheet 内。受控响应验证默认 Terra、下拉切换与保存、空 Key 禁用、失败提示、当前草稿 Key 测试及旧响应失效。核心测试增至 8 项。

## 设置自动保存（当前版本）

按用户要求移除 Sheet 底部取消／保存操作，使用 `hideActions`，右上角关闭只收起 Sheet。Key、模型、Prompt 和恢复默认均编辑即写入 IndexedDB，运行配置同步更新。所有写入串行排队，避免快速编辑后旧值覆盖新值；保存失败保留当前编辑并显示错误与重试。关闭 Sheet 不丢弃已编辑值。

受控浏览器验证：无底部按钮、Key 和模型直接保存、连续 Prompt 修改后立即关闭并刷新仍保留最后值、写入失败可见且重试后持久化、恢复默认自动保存。组件知识服务缺口延续此前记录。

## 可选透明图生成（当前版本）

设置增加真实 AaronUI-Web Switch「生成透明图」，默认开启，编辑即保存。关闭后自动处理只调用标签识别，保留原图；记录持久化 `imageSkipped`，完成判定与失败重试不再把无透明图视作待处理。相册使用原图展示，详情明确标示「仅识别标签」。标签完成后可导出 ZIP 内的 JSON，不导出原图；有透明图的记录仍导出 PNG＋JSON。可在详情显式生成透明图，成功后清除跳过状态，不重复识别标签。开关不删除既有透明图。

已核实 Switch 的 checked/onCheckedChange、id 和可访问名称。受控浏览器回归通过：默认开启、关闭后模型控件禁用、开关跨刷新保留、两张批量只调用两次识别且零次图像生成、完成状态、JSON-only ZIP 导出、手动补图仅调用一次图像接口。ZIP 已实际解包，确认不含原图。核心测试增至 9 项。

## 模型搜索选择（当前版本）

两个模型选择器改用真实 AaronUI-Web Combobox。已核对公开实现的 items、value、onValueChange、width、disabled、placeholder、emptyText 和 triggerLabel；模型去重后按英文名称自然排序，预设与当前模型也参与统一排序。搜索文本仅用于筛选，只有选择选项才自动保存。移除旧 Dropdown 样式，并排除展开按钮上的页面通用按压位移动效，避免覆盖组件的定位变换导致点击失败。组件知识 MCP 缺口延续此前记录。

390 像素浏览器验证通过：两处完整列表顺序、展开按钮、搜索选择、无匹配提示、选择后刷新仍保留、未匹配搜索不保存，以及输入框不超出 Sheet。类型检查、9 项核心测试与全站构建通过；验证使用模拟模型列表，无付费调用。

## 全面组件审查（2026-11-01 当前版本）

按用户指定的 aw-component-advisor 连接实时 MCP，完成当前组件规范、相关布局文档及匹配 Example 的核对，并修复原生分类下拉框、表单包装、Prompt 文本框、自绘选择和批量操作、原生确认框与滚动边界。详情使用 Sheet；设置继续编辑即保存。完整依据、源码兼容修复、运行验证和剩余证据缺口见 [组件审查报告](component-audit.md)。此前各节记录的 Dialog 详情、原生 details 及旧设置定位属于历史实现。
