/**
 * Skill 注册表 —— /skills/ 页面的唯一接线点。
 *
 * 这里登记「我自己写的 Agent Skill」（Claude Code / Codex 等使用的 SKILL.md 包）。
 * 新增 Skill 只需在此追加一条记录，列表页自动渲染；数组为空时页面显示预告态。
 */

export interface SkillEntry {
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
    slug: 'aw-design-md-author',
    name: 'DESIGN.md 编写助手',
    description:
      '按 Google Labs 官方规范创建、审查和维护完整的 DESIGN.md 视觉契约，统一处理 Token 所有权、语义命名、标准章节与官方 lint 验证。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-design-md-author',
    tags: ['DESIGN.md', '设计系统', 'Lint'],
  },
  {
    slug: 'aw-design-system-gallery',
    name: '设计系统 Gallery',
    description:
      '创建、审查和优化设计系统 Gallery 的默认示例、属性轴与状态对比；新增或修改组件时顺带维护对应 Panel、Caption 与占位内容。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-design-system-gallery',
    tags: ['设计系统', 'Gallery', '组件'],
  },
  {
    slug: 'aw-design-fake',
    name: '原型假数据与演示',
    description:
      '为前端原型统一接入假数据、占位交互、源码展示和可关闭的演示状态，并维护共享的 fake bundle，不碰单元测试 mock。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-design-fake',
    tags: ['原型', '假数据', 'Design to Code'],
  },
  {
    slug: 'aw-design-token-consistency-auditor',
    name: '设计 Token 一致性审计',
    description:
      '审计 Figma Variables、DESIGN.md 与 CSS / Less Token 之间的覆盖、映射和值一致性，输出可追溯的 Markdown、JSON 与 CSV 报告。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-design-token-consistency-auditor',
    tags: ['Design Token', 'Figma', '审计'],
  },
  {
    slug: 'aw-find-and-port-ui-component',
    name: 'UI 组件查找与移植',
    description:
      '分两个阶段搜索、比较、验证并移植 UI 组件实现：先完成来源与兼容性调研，再由用户明确选择后适配目标项目。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-find-and-port-ui-component',
    tags: ['UI 组件', '源码验证', 'Design to Code'],
  },
  {
    slug: 'aw-canvas-design',
    name: '组件画布设计',
    description:
      '用可交互的真实组件画布设计多 Modal、Sheet、Dialog 串联的业务流程，支持独立环境初始化、评论迭代与入口覆盖验收。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-canvas-design',
    tags: ['交互设计', '画布', '业务流程'],
  },
  {
    slug: 'aw-component-checker',
    name: '组件语义检查',
    description:
      '审查桌面端组件的语义、组合方式与内部使用；组件变化后以编辑模式维护 Component Reference 与索引。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-component-checker',
    tags: ['组件', '设计审查', '桌面端'],
  },
  {
    slug: 'aw-ux-info-redundancy-audit',
    name: 'UI/UX 重复信息审计',
    description:
      '把界面内容归一为事实，标出每个事实的重复出现位置，判断哪些重复真正提供任务价值，再给出保留、合并、删除、缩短、移动或拆分的最小安全改动。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-ux-info-redundancy-audit',
    tags: ['信息架构', 'UX 审计', '信息密度'],
  },
  {
    slug: 'aw-wording-reviewer',
    name: '中文 UI 文案审查',
    description:
      '审查简体中文 UI 文案的排版、术语、微文案与数据展示格式，默认只给审查结论，按要求再动手修改。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-wording-reviewer',
    tags: ['UX Writing', '中文排版', 'i18n'],
  },
  {
    slug: 'aw-comic-dossier-packer',
    name: '漫画档案打包',
    description:
      '从漫画标题出发，收集单行本封面与可靠资料，生成中文介绍、小红书封面图和包含来源链接的完整 Markdown 档案。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-comic-dossier-packer',
    tags: ['内容生产', 'ImageGen', '漫画'],
  },
  {
    slug: 'aw-logo-finder',
    name: '品牌 Logo 查找',
    description:
      '从品牌官网、Logo 资源站与三大应用商店并行搜集候选，比对真实素材、剔除比例不当与带水印的版本，确认候选和输出尺寸后导出无损 WebP。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-logo-finder',
    tags: ['品牌资产', '图标', 'WebP'],
  },
  {
    slug: 'aw-logo-asset-cook',
    name: '图标资源生成',
    description:
      '从指定的 SVG 或图片生成并验证全平台图标资源；图片先评估能否矢量化，再迭代重绘对照，覆盖明暗主题与分平台用法说明。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-logo-asset-cook',
    tags: ['品牌资产', '图标', '多平台'],
  },
  {
    slug: 'rewrite-like-aaron',
    name: 'Aaron 文风改写',
    description:
      '把 AI 生成或表达过于通用的中文草稿改写成我当前的博客文风，保留事实、立场与结构，同时避免用口头禅、反问和中英混写做表面模仿。',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/rewrite-like-aaron',
    tags: ['写作', '反 AI 味', '博客'],
  },
];
