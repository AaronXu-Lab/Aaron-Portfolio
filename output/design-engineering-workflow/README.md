# 把设计带进真实产品

- 本地预览：http://127.0.0.1:4322/work/design-engineering-workflow/?qa
- 页面：src/pages/work/design-engineering-workflow.astro
- 登记：src/data/cases.ts（全部案例入口，未加入首页精选）
- 关联修改：旧 ai-design-system 案例底部的下一案例改读注册表，正文不变。

## 内容结构

1. 早期 DESIGN.md：共同视觉依据与实际验证循环。
2. Design Agent：生成初版、分类检查、独立走查；保留人工评审。
3. MCP：按需提供组件资料，支撑三个环节。
4. 串行到并行：设计原型与研发功能同时推进，最后集中迁移。
5. 迁移核对：字段、操作、状态，以及共用组件的版本差异。
6. 下一步：仅持续优化 Design Agent。

## 媒体

- design-md-ide.png：实际 Antigravity IDE 文档截图，1860 × 1120。
- ds-gallery-button.png：DS Gallery Button 截图，2208 × 2395。

来源为 output/handoffs/design-engineering-workflow-20261012T072817Z 的快照与完整备注。只复制这两张图片到 public；内部答辩、讲稿和本地路径不对外附载。无约束反例未用于新案例，以缩短早期探索段落并避免与旧案例重复。

## 验证

- npm run build：通过，123 个页面，零错误。保留既有 Vite 大包警告。
- 文案提取后运行 npm run fix:punct：无修正；避免直接改源码括号。
- Playwright：1440 × 1000 与 390 × 844，浅色和深色；图片加载、折叠交互、页面横向溢出、案例列表、前一案例链接、首页精选均核对。
- 截图位于 output/playwright/design-engineering-*.png。
- 未执行提交、推送或部署。
