/**
 * Skill 注册表 —— /skills/ 页面的唯一接线点。
 *
 * 这里登记「我自己写的 Agent Skill」（Claude Code / Codex 等使用的 SKILL.md 包）。
 * 新增 Skill 只需在此追加一条记录，列表页自动渲染；数组为空时页面显示预告态。
 */

export interface SkillEntry {
  /** 所属仓库 */
  group: 'design-agent' | 'other';
  /** 唯一标识，亦可作为未来详情页 slug */
  slug: string;
  /** Skill 名称（通常与 SKILL.md 的 name 一致） */
  name: string;
  /** 一句话说明：解决什么问题、怎么触发 */
  description: string;
  /** shipped:可用；wip:打磨中 */
  status: 'shipped' | 'wip';
  /** 仓库或文档链接（可选） */
  href?: string;
  /** 适用环境等标签，如 ['Claude Code', '设计'] */
  tags?: string[];
  /** 登记日期，YYYY.MM 即可 */
  date?: string;
}

export const skills: SkillEntry[] = [
  {
    group: 'design-agent',
    slug: 'aw-design-orchestrator',
    name: '设计工作流协调',
    description: '串联需求塑形、组件指导、实现审计、任务走查与文案审查，协调完整的设计工作流程。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-design-orchestrator',
    tags: ['设计流程', '协调', '审查'],
  },
  {
    group: 'design-agent',
    slug: 'aw-design-shaping',
    name: '设计方向塑形',
    description: '通过聚焦提问、研究与线框探索，将想法、需求或竞品参考转化为明确的 UI/UX 方向。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-design-shaping',
    tags: ['UI/UX', '需求', '设计探索'],
  },
  {
    group: 'design-agent',
    slug: 'aw-component-advisor',
    name: '组件使用顾问',
    description: '在实现前指导 AaronUI-Web 组件选用，并依据实时组件知识审计已有实现。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-component-advisor',
    tags: ['组件', '设计系统', '审计'],
  },
  {
    group: 'design-agent',
    slug: 'aw-flow-completeness-audit',
    name: '用户流程完整性审计',
    description: '检查流程步骤、分支、状态转换、交接、恢复与完成结果，提出有依据的补全建议。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-flow-completeness-audit',
    tags: ['用户流程', 'UX 审计', '完整性'],
  },
  {
    group: 'design-agent',
    slug: 'aw-task-walkthrough',
    name: '独立任务走查',
    description: '在交互原型或真实产品中独立完成选定任务，检查可发现性、理解成本和任务结果。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-task-walkthrough',
    tags: ['任务走查', '可用性', '原型'],
  },
  {
    group: 'other',
    slug: 'aw-meta-skill',
    name: 'Skill 创建与维护',
    description: '创建、更新和规范化 Skill，维护工作流、流程图与验证结果。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-meta-skill',
    tags: ['Skill', '工作流', '验证'],
  },
  {
    group: 'other',
    slug: 'aw-clash-network-doctor',
    name: '网络诊断与优化',
    description: '诊断网络配置，优化 macOS 目标网站连接，并处理 Claude 数据清理和 Android 诊断。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-clash-network-doctor',
    tags: ['网络', 'Clash', '诊断'],
  },
  {
    group: 'other',
    slug: 'aw-mail-read-later',
    name: '稍后阅读邮件助手',
    description: '从 Outlook 的 Read Later 文件夹推荐适合当前阅读情境的一篇邮件，并支持阅读、总结与翻译。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-mail-read-later',
    tags: ['Outlook', '阅读', '邮件'],
  },
  {
    group: 'other',
    slug: 'aw-tiered-task-dispatch',
    name: '分层任务派发',
    description: '按任务的不确定性、影响和协调复杂度，在 Codex 或 Claude 中分层派发和整合项目工作。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-tiered-task-dispatch',
    tags: ['Codex', 'Claude', '任务协调'],
  },
  {
    group: 'other',
    slug: 'aw-design-md-author',
    name: 'DESIGN.md 编写助手',
    description:
      '按 Google Labs 官方规范创建、审查和维护完整的 DESIGN.md 视觉契约，统一处理 Token 所有权、语义命名、标准章节与官方 lint 验证。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-design-md-author',
    tags: ['DESIGN.md', '设计系统', 'Lint'],
  },
  {
    group: 'other',
    slug: 'aw-design-system-gallery',
    name: '设计系统 Gallery',
    description:
      '创建、审查和优化设计系统 Gallery 的默认示例、属性轴与状态对比；新增或修改组件时顺带维护对应 Panel、Caption 与占位内容。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-design-system-gallery',
    tags: ['设计系统', 'Gallery', '组件'],
  },
  {
    group: 'other',
    slug: 'aw-design-fake',
    name: '原型假数据与演示',
    description:
      '为前端原型统一接入假数据、占位交互、源码展示和可关闭的演示状态，并维护共享的 fake bundle，不碰单元测试 mock。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-design-fake',
    tags: ['原型', '假数据', 'Design to Code'],
  },
  {
    group: 'other',
    slug: 'aw-design-token-consistency-auditor',
    name: '设计 Token 一致性审计',
    description:
      '审计 Figma Variables、DESIGN.md 与 CSS / Less Token 之间的覆盖、映射和值一致性，输出可追溯的 Markdown、JSON 与 CSV 报告。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-design-token-consistency-auditor',
    tags: ['Design Token', 'Figma', '审计'],
  },
  {
    group: 'other',
    slug: 'aw-find-and-port-ui-component',
    name: 'UI 组件查找与移植',
    description:
      '分两个阶段搜索、比较、验证并移植 UI 组件实现：先完成来源与兼容性调研，再由用户明确选择后适配目标项目。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-find-and-port-ui-component',
    tags: ['UI 组件', '源码验证', 'Design to Code'],
  },
  {
    group: 'design-agent',
    slug: 'aw-canvas-design',
    name: '组件画布设计',
    description:
      '用可交互的真实组件画布设计多 Modal、Sheet、Dialog 串联的业务流程，支持独立环境初始化、评论迭代与入口覆盖验收。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-canvas-design',
    tags: ['交互设计', '画布', '业务流程'],
  },
  {
    group: 'design-agent',
    slug: 'aw-ux-info-redundancy-audit',
    name: 'UI/UX 重复信息审计',
    description:
      '把界面内容归一为事实，标出每个事实的重复出现位置，判断哪些重复真正提供任务价值，再给出保留、合并、删除、缩短、移动或拆分的最小安全改动。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-ux-info-redundancy-audit',
    tags: ['信息架构', 'UX 审计', '信息密度'],
  },
  {
    group: 'design-agent',
    slug: 'aw-wording-reviewer',
    name: '中文 UI 文案审查',
    description:
      '审查简体中文 UI 文案的排版、术语、微文案与数据展示格式，默认只给审查结论，按要求再动手修改。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-wording-reviewer',
    tags: ['UX Writing', '中文排版', 'i18n'],
  },
  {
    group: 'other',
    slug: 'aw-comic-dossier-packer',
    name: '漫画档案打包',
    description:
      '从漫画标题出发，收集单行本封面与可靠资料，生成中文介绍、小红书封面图和包含来源链接的完整 Markdown 档案。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-comic-dossier-packer',
    tags: ['内容生产', 'ImageGen', '漫画'],
  },
  {
    group: 'other',
    slug: 'aw-logo-finder',
    name: '品牌 Logo 查找',
    description:
      '从品牌官网、Logo 资源站与三大应用商店并行搜集候选，比对真实素材、剔除比例不当与带水印的版本，确认候选和输出尺寸后导出无损 WebP。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-logo-finder',
    tags: ['品牌资产', '图标', 'WebP'],
  },
  {
    group: 'other',
    slug: 'aw-logo-asset-cook',
    name: '图标资源生成',
    description:
      '从指定的 SVG 或图片生成并验证全平台图标资源；图片先评估能否矢量化，再迭代重绘对照，覆盖明暗主题与分平台用法说明。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-logo-asset-cook',
    tags: ['品牌资产', '图标', '多平台'],
  },
  {
    group: 'other',
    slug: 'rewrite-like-aaron',
    name: 'Aaron 文风改写',
    description:
      '把 AI 生成或表达过于通用的中文草稿改写成我当前的博客文风，保留事实、立场与结构，同时避免用口头禅、反问和中英混写做表面模仿。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/rewrite-like-aaron',
    tags: ['写作', '反 AI 味', '博客'],
  },
];
