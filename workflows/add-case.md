# 工作流:新增作品案例

> 写给 Opus 及同等水平的 AI。目标:在保持全站视觉与工程约束一致的前提下,新增一个案例页并完成全部接线。**通读本文后再动手。**

## 0. 前置阅读(按顺序,约 5 分钟)

1. 仓库根 `CLAUDE.md`:目录结构 + 硬性规则
2. `site/src/data/cases.ts`:注册表接口(本工作流的核心)
3. `site/src/pages/work/followup-ai.astro`:**标准范本**,新页面以它为模板
4. `site/src/styles/global.css` 顶部 token 区,或直接开 `http://localhost:4321/design/` 看活体样式指南
5. 可选:`site/src/layouts/CaseLayout.astro`(案例头/自动下一案例卡)、`SectionHead.astro`、`MediaSlot.astro`

## 1. 整理内容

先把案例内容整理成结构化清单(参考 `figma/content/02-followup-ai.md` 的形态):

- 案例元信息:标题、分类、角色、时间、平台/技术栈
- 摘要(1–2 句,首页卡用;2–4 句,案例头用)
- 3–6 个正文区块,每块:中文区块名 + 英文 mono 标签 + 正文/要点
- 媒体清单:每张图一行「用途 + 尺寸比例 + (如来自 Figma)节点号」

内容语言:中文为主、英文短语点缀;全角标点;禁止孤立 em-dash(成对破折号「——」允许)。

## 2. 创建页面 `site/src/pages/work/<slug>.astro`

slug 用小写连字符英文(它就是 URL:`/work/<slug>/`)。骨架:

```astro
---
import CaseLayout from '../../layouts/CaseLayout.astro';
import SectionHead from '../../components/SectionHead.astro';
import MediaSlot from '../../components/MediaSlot.astro';

// 结构化数据放 frontmatter(参考 followup-ai.astro 的 scope/statusExample 等)
---

<CaseLayout
  title="<案例名> - 案例 · Aaron Xu"
  description="<SEO 一句话>"
  index="CASE 0X"
  category="<分类>"
  heading="<案例名>"
  summary="<案例头摘要,可含 <br/>>"
  meta={[
    { label: 'Role', value: '…' },
    { label: 'Type', value: '…' },
    { label: 'Timeframe', value: '20XX.X - 20XX.X' },
  ]}
  slug="<slug>"
>
  <!-- 概览媒体 -->
  <div class="container case-section">
    <div class="reveal">
      <MediaSlot label="<用途>" node="<figma-node>" ratio="16 / 9" />
    </div>
  </div>

  <!-- 区块:编号 + 中文名 + 英文标签,id 用于深链 -->
  <section id="<anchor>" class="container case-section">
    <SectionHead num="01" zh="<区块名>" en="<Section Label>" />
    <p class="section-lead lead reveal"><区块导语></p>
    <!-- 区块内容:优先复用 /design/ 里的原语;网格一律 CSS Grid + auto-fit -->
  </section>

  <!-- 「下一个案例」卡由 CaseLayout 按 cases.ts 顺序自动生成 -->
</CaseLayout>

<style>
  /* 页面级组合样式;颜色/圆角/缓动一律引用 var(--*) */
</style>
```

### 版式语汇(按需取用,避免与相邻案例页布局家族重复)

| 模式 | 参考实现 |
| --- | --- |
| 编号卡片网格 | `followup-ai.astro` 的 `.scope-grid` |
| 双栏文案 | `.duo` |
| 步骤流(带箭头) | `.steps` / comic 的 `.comfy-steps` |
| 深色带区(关键幕) | `.cycle-band`(用 `--band-*` token 族) |
| 细线行列表 | 首页 `.cap-list` / `.note-row` |
| 引用旁注 | `.aside` |
| 对照双卡 | ai-design-system 的 `.reuse-grid` |

规则:同一布局家族在一页内最多出现一次;连续两个以上"左图右文"式分栏禁止;深色带区一页最多 1–2 处。

## 3. 注册 `site/src/data/cases.ts`

在数组中**按叙事顺序**插入一条(顺序决定首页排列与"下一个案例"链)。字段:

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `slug` / `kind` | ✓ | kind:`featured` 首页大卡 / `lab` 深色横幅 / `minor` 小卡 |
| `title` `footerLabel` `nextHint` `nextLine` | ✓ | nextLine 是别的案例页底部指向本案例时的一行描述 |
| `num` `category` `summary` `tags` `media` | featured 必填 | media.node 为 Figma 节点号 |
| `subEn` `rating` | 可选 | 中文标题的英文小注 / 荣誉行 |
| `labKicker` `labFrames` | lab 必填 | 横幅左右 mono 标 |
| `minorLabel` `minorDesc` | minor 必填 | |

注册后自动生效:首页精选区、页脚 Case Studies、前一案例的"下一个案例"卡。**无需再改 index/Footer/其他案例页。**

## 4. 媒体占位登记

每个 `MediaSlot` 的节点号与用途,追加到 `site/README.md` 的「媒体占位待替换」表格。

## 5. 收尾三步(缺一不可)

```bash
npm run fix:punct -- src/pages/work/<slug>.astro src/data/cases.ts
npm run build        # 必须零错误
```

然后视觉核对:`http://localhost:4321/work/<slug>/?qa`(桌面 + 移动宽度),同时检查首页精选区与上一个案例页的"下一个案例"卡。

## 6. 完成检查单

- [ ] 全角标点;无孤立「—」(区间用 `-`,成对「——」允许)
- [ ] 颜色/圆角/间距全部来自 `var(--*)`,无写死色值
- [ ] 每个区块有 `SectionHead` + 锚点 id;`.reveal` 入场类已加
- [ ] 布局家族不与本页其他区块重复;多列网格声明了移动端折叠
- [ ] 图片全部 `MediaSlot` 并登记 README;无 div 假截图
- [ ] 交互元素有 `:hover` / `:active`;无 `window scroll` 监听
- [ ] `cases.ts` 已注册,首页/页脚/next 链自动出现
- [ ] `npm run build` 零错误;`?qa` 下桌面与移动截图正常
