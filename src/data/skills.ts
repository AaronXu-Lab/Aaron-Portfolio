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
  /** 一句话说明：解决什么问题。卡片上最多显示两行（约 24 个字），以 SKILL.md 的 description 为准改写 */
  description: string;
  /** Phosphor duotone 图标名（不带 -duotone 后缀），显示在 SkillCard 顶部 */
  icon: string;
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
    description: '串起设计全流程，从塑形、实现到审查。',
    icon: 'tree-structure',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-design-orchestrator',
    tags: ['设计流程', '协调', '审查'],
  },
  {
    group: 'design-agent',
    slug: 'aw-design-shaping',
    name: '设计方向塑形',
    description: '把想法或需求收敛成明确的 UI/UX 方向。',
    icon: 'compass-tool',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-design-shaping',
    tags: ['UI/UX', '需求', '设计探索'],
  },
  {
    group: 'design-agent',
    slug: 'aw-component-advisor',
    name: '组件使用顾问',
    description: '指导 AaronUI-Web 组件选用，并审计已有用法。',
    icon: 'puzzle-piece',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-component-advisor',
    tags: ['组件', '设计系统', '审计'],
  },
  {
    group: 'design-agent',
    slug: 'aw-flow-completeness-audit',
    name: '用户流程完整性审计',
    description: '找出流程里缺失的分支、状态与恢复。',
    icon: 'path',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-flow-completeness-audit',
    tags: ['用户流程', 'UX 审计', '完整性'],
  },
  {
    group: 'design-agent',
    slug: 'aw-task-walkthrough',
    name: '独立任务走查',
    description: '独立走一遍任务，找出难发现、操作重的地方。',
    icon: 'footprints',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-task-walkthrough',
    tags: ['任务走查', '可用性', '原型'],
  },
  {
    group: 'other',
    slug: 'aw-meta-skill',
    name: '元 Skill',
    description: '创建和更新 Skill 的统一入口。',
    icon: 'magic-wand',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-meta-skill',
    tags: ['Skill', '工作流', '验证'],
  },
  {
    group: 'other',
    slug: 'aw-clash-network-doctor',
    name: '网络诊断与优化',
    description: '清理 Claude 数据，测速挑选并保存 Clash 配置。',
    icon: 'stethoscope',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-clash-network-doctor',
    tags: ['网络', 'Clash', '诊断'],
  },
  {
    group: 'other',
    slug: 'aw-mail-read-later',
    name: '稍后阅读邮件助手',
    description: '从 Read Later 里挑一篇适合现在读的邮件。',
    icon: 'envelope-open',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-mail-read-later',
    tags: ['Outlook', '阅读', '邮件'],
  },
  {
    group: 'other',
    slug: 'aw-tiered-task-dispatch',
    name: '分层任务派发',
    description: '一个主会话协调三档模型，分派项目任务。',
    icon: 'stack',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-tiered-task-dispatch',
    tags: ['Codex', 'Claude', '任务协调'],
  },
  {
    group: 'other',
    slug: 'aw-design-md-author',
    name: 'DESIGN.md 编写助手',
    description: '创建和维护 Google 格式的 DESIGN.md。',
    icon: 'file-md',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-design-md-author',
    tags: ['DESIGN.md', '设计系统', 'Lint'],
  },
  {
    group: 'other',
    slug: 'aw-design-system-gallery',
    name: '设计系统 Gallery',
    description: '维护设计系统 Gallery 的示例、属性与文案。',
    icon: 'squares-four',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-design-system-gallery',
    tags: ['设计系统', 'Gallery', '组件'],
  },
  {
    group: 'other',
    slug: 'aw-design-fake',
    name: '原型假数据与演示',
    description: '给原型接入假数据和可关闭的演示状态。',
    icon: 'mask-happy',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-design-fake',
    tags: ['原型', '假数据', 'Design to Code'],
  },
  {
    group: 'other',
    slug: 'aw-design-token-consistency-auditor',
    name: '设计 Token 一致性审计',
    description: '比对 Figma、DESIGN.md 与 CSS 的 Token 差异。',
    icon: 'swatches',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-design-token-consistency-auditor',
    tags: ['Design Token', 'Figma', '审计'],
  },
  {
    group: 'other',
    slug: 'aw-find-and-port-ui-component',
    name: 'UI 组件查找与移植',
    description: '比较 React 组件实现，移植选定的一份。',
    icon: 'arrow-square-in',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-find-and-port-ui-component',
    tags: ['UI 组件', '源码验证', 'Design to Code'],
  },
  {
    group: 'design-agent',
    slug: 'aw-canvas-design',
    name: '组件画布设计',
    description: '用真实组件画布串起流程，对齐比较页面。',
    icon: 'frame-corners',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-canvas-design',
    tags: ['交互设计', '画布', '业务流程'],
  },
  {
    group: 'design-agent',
    slug: 'aw-ux-info-redundancy-audit',
    name: 'UX 重复信息审计',
    description: '找出界面里的重复信息，给出精简建议。',
    icon: 'copy',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-ux-info-redundancy-audit',
    tags: ['信息架构', 'UX 审计', '信息密度'],
  },
  {
    group: 'design-agent',
    slug: 'aw-wording-reviewer',
    name: '文案走查',
    description: '统一中文 UI 文案的排版、术语与格式。',
    icon: 'text-aa',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/Design-Agent/tree/main/aw-wording-reviewer',
    tags: ['UX Writing', '中文排版', 'i18n'],
  },
  {
    group: 'other',
    slug: 'aw-comic-dossier-packer',
    name: '漫画档案打包',
    description: '输入漫画名，生成封面图和资料档案。',
    icon: 'books',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-comic-dossier-packer',
    tags: ['内容生产', 'ImageGen', '漫画'],
  },
  {
    group: 'other',
    slug: 'aw-logo-finder',
    name: '品牌 Logo 查找',
    description: '找到可靠的品牌 Logo，导出无损 WebP。',
    icon: 'magnifying-glass',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-logo-finder',
    tags: ['品牌资产', '图标', 'WebP'],
  },
  {
    group: 'other',
    slug: 'aw-logo-asset-cook',
    name: '图标资源生成',
    description: '把 SVG 资源做成验证过的全平台图标。',
    icon: 'cooking-pot',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/aw-logo-asset-cook',
    tags: ['品牌资产', '图标', '多平台'],
  },
  {
    group: 'other',
    slug: 'rewrite-like-aaron',
    name: 'Aaron 文风改写',
    description: '把泛泛的中文草稿改成我的博客文风。',
    icon: 'pen-nib',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/rewrite-like-aaron',
    tags: ['写作', '反 AI 味', '博客'],
  },
  {
    group: 'other',
    slug: 'convert-swf-to-h5',
    name: 'SWF 转 H5',
    description: '把老 Flash 游戏移植成验证过的 HTML5 版本。',
    icon: 'game-controller',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/convert-swf-to-h5',
    tags: ['Flash', 'Canvas', '逆向迁移'],
  },
  {
    group: 'other',
    slug: 'mg-import-fix',
    name: 'MG 导入修复',
    description: '用 .mg 测试集对比，持续修复 Figma 导入问题。',
    icon: 'wrench',
    status: 'shipped',
    href: 'https://github.com/AaronXu-Lab/AaronSkill/tree/main/mg-import-fix',
    tags: ['MasterGo', 'Figma', '导入修复'],
  },
];
