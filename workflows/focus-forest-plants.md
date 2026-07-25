# 专注森林 · 植物生长脚本方法论

如何让一株 3D 植物随 progress（0–1）无缝长大，以及如何据此新增其他植物样式。
落地文件：`public/tools/focus-forest/js/scene.js`（`buildPlant` / `applyGrowth` / `setProgress`）。

## 核心方法：生长脚本（Growth Script）

不做离散阶段模型，也不做顶点级形变。整株植物只是一张部件清单，每个部件登记三件事：

| 字段 | 含义 |
| --- | --- |
| `birth` | 出生进度：progress 到达该值时开始生长 |
| `span` | 生长跨度：`birth → birth + span` 之间从 0 长到成品尺寸 |
| `retire` | 可选 `[开始, 跨度]`：到期原路缩回退场（幼叶谢幕） |

驱动只有一个原语：**从自身轴心等比缩放 0→1**。applier 全文如下：

```js
function applyGrowth(parts, p) {
  for (const it of parts) {
    let k = it.ease(clamp((p - it.birth) / it.span, 0, 1));
    if (it.retire) k *= 1 - smooth(clamp((p - it.retire[0]) / it.retire[1], 0, 1));
    it.node.visible = k > 0.001;
    it.node.scale.copy(it.base).multiplyScalar(Math.max(k, 0.001));
  }
}
```

无缝感来自三个设计决定，不来自任何复杂技术：

1. **轴心决定语义**。同一个「等比缩放」，轴心放在不同位置就是不同的生长动作：
   - 枝干包一层「基点组」（组落在枝干底端，网格在组内上移半长）→ 缩放 = 从基点**抽长变粗**。幼年的主干天然又细又矮，就是「芽」，不需要单独的芽模型。`limbFrom` 接受与静态建模同口径的 center / len，内部自动换算基点。
   - 叶团 / 花的轴心在几何中心 → 缩放 = 原地**鼓出**（配标准 easeOutBack，有一点回弹）。
2. **排期讲物理**。部件的 `birth` 必须晚于「挂点可达」的进度 —— 分枝要等树干长过它的挂点高度才萌出，否则悬空。树干进度 t 时的高度 = `len * ease(t)`，据此反推每根分枝的最早 birth，再手工错开节奏。
3. **谢幕补叙事**。子叶、中层叶只属于幼年期，树冠成形前后用 `retire` 缩回 —— 成树脚下留着子叶会穿帮，这也是真实植物的行为。

### 进度怎么送进来

两种模式，别混用：

- **跟随**（专注中）：`trackProgress(startedAt, endsAt)`，目标进度由渲染循环**每帧**按真实时间插值。上层的倒计时 ticker 只有 2Hz，用它推 3D 会把生长切成半秒一级的台阶 —— 这是「按秒数控制生长」看起来卡顿的根因，不是缓动不够。
- **静态**（首页预览 / 完成 / 放弃后复位 / `?p=`）：`setProgress(p)`，钉住并退出跟随。

`shown` 每帧按 `1 - e^(-dt/τ)`（τ = `GROW_TAU` = 0.3s）指数逼近 `goal`。选指数而不是匀速追赶，是因为目标移动时它的速度连续 —— 匀速追赶在目标每次跳变处有折角，看起来就是一顿一顿的。`prefers-reduced-motion` 下直接钉到目标值。

## 性能

- 每帧只改 transform（visible + scale），**零几何重建**；progress 不变时一次都不算。
- 森林 = 模板定格在某个 p 后整树 clone（共享几何体与材质）；低画质定格在 0.66，相当于旧「成长期」株型。
- 预算口径不变：成品 ≤ 20k 三角面（现 1864）、≤ 5 材质、零贴图。面数只压 GPU 光栅化，不影响每帧的 CPU 开销。
- 基元精度集中在 `GEO`：圆柱类可精确指定分段数；多面体族（Icosahedron / Dodecahedron）的面数是 `base × (detail + 1)²`，所以 detail 0→1 是 ×4，1→2 是 ×2.25 —— 想「翻倍」就挑后者那档。

## 新增一种植物样式

1. **先以成品建模**（p=1 即成品，所有坐标按成品标定）：在 `scene.js` 里仿照 `buildPlant` 写 `buildXxx(mat)`，用现成 helper —— `limbFrom(center, thick, len, rot, birth, span)` 造枝干，`pop(mesh, birth, span, retire?)` 造叶团 / 花 / 种子。返回 `{ root, parts }`，收尾调一次 `applyGrowth(parts, 1)` 出厂。
2. **排期**：参照本株的节奏表 —— 种子 0–0.25（含谢幕）、主干 0.02–0.52、幼叶 0.1–0.35（0.45–0.7 谢幕）、分枝 0.24–0.55、树冠 0.5–0.88、开花 0.84–1。最后一个部件应恰好在 1.0 长完。
3. **调试**（两个开关，都只影响自己）：
   - `?p=0.35` 把生长定格在任意进度（仅无进行中的专注时生效）；配 `?qa` 关动画，截图稳定。
   - `?dev` 放出「15 秒」时长档，用来实时看完一整轮生长。不带 `?dev` 时该档从 DOM 里摘掉，访客看到的还是四档。

   `npm run build && npm run preview`（dev server 下静态壳 404），从 0.05 到 1 扫几个点，检查悬空与穿插。
4. **接入**：替换 `createScene` 里两处 `buildPlant(...)` 调用（活株 + 森林模板）。多样式并存时在这两处按需选构建函数即可。
5. **2D 简版**（可选）：`index.html` 里的降级 SVG 仍是五阶段（`html[data-stage]` 驱动，阈值来自 `core.js` 的 `stageOf`）。新样式若差异大，同步改那五组 `<g class="f-stage">`。

## 边界

- 不做顶点形变 / morph target：低多边形玩具风下，transform 级生长已经足够可信，成本低一个数量级。
- 不做骨骼：部件级刚体缩放 + 轻风摆动（`breeze`）已覆盖需要的动感。
- clone 上限 30 株（`FOREST_LIMIT`），再放开要换 InstancedMesh —— 与生长脚本不冲突，定格后的模板本来就是静态的。
