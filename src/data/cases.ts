/**
 * 案例注册表 —— 新增案例的唯一接线点。
 *
 * 一条记录同时驱动:
 *  1. /work/ 全部案例页 + 首页「精选案例」区(featured 决定是否上首页,kind 决定卡片形态)
 *  2. 页脚 Case Studies 栏(只列精选)
 *  3. 案例页底部「下一个案例」卡(按数组顺序自动串联,CaseLayout 消费)
 *
 * 新增案例只需:① 建 src/pages/work/<slug>.astro ② 在此按叙事顺序插入一条记录。
 * 详细流程见 site/workflows/add-case.md。
 */

export type CaseKind =
  /** 首页大卡(双列非对称网格) */
  | 'featured'
  /** 首页深色横幅(长文/实验) */
  | 'lab'
  /** 首页小卡(单行) */
  | 'minor';

export interface CaseEntry {
  /** 路由:/work/<slug>/,同时是 .astro 文件名 */
  slug: string;
  kind: CaseKind;
  /** 上首页精选区与页脚;案例页「返回」回首页,否则回 /work/ */
  featured?: boolean;
  /** 首页卡角标,如 '01' */
  num?: string;
  /** 分类 badge 文案 */
  category?: string;
  /** 主标题 */
  title: string;
  /** 中文主标题后的英文小注 */
  subEn?: string;
  /** 评分等荣誉行(mono) */
  rating?: string;
  /** 首页卡摘要(全角标点) */
  summary?: string;
  tags?: string[];
  /** 首页卡媒体占位(真实图导出后可换 img) */
  media?: { label: string; node?: string; ratio?: string; src?: string };
  /** lab 卡左右 mono 标 */
  labKicker?: string;
  labFrames?: string;
  /** minor 卡 mono 标与描述 */
  minorLabel?: string;
  minorDesc?: string;
  /** 页脚链接文案 */
  footerLabel: string;
  /** 作为「下一个案例」卡时的 hint 与描述行 */
  nextHint: string;
  nextLine: string;
}

export const cases: CaseEntry[] = [
  {
    slug: 'followup-ai',
    kind: 'featured',
    featured: true,
    num: '01',
    category: 'AI 产品设计',
    title: 'Followup.AI',
    summary:
      '基于 AI Agent 工作流的团队协作与项目管理平台。从 0 到 1 搭建设计系统，并探索「意图驱动」的 AI 交互范式。',
    tags: ['B端 SaaS', '设计系统', 'AI Agent', 'Playbook 探索'],
    media: { label: 'Followup.AI 产品截图', node: '539:8738', ratio: '16 / 10', src: '/media/followup/overview.jpg' },
    footerLabel: 'Followup.AI',
    nextHint: 'Case 01',
    nextLine: 'Followup.AI —— 基于 AI Agent 工作流的项目管理平台',
  },
  {
    slug: 'comic-manga',
    kind: 'featured',
    featured: true,
    num: '02',
    category: '独立设计 & 开发产品',
    title: '漫漫书架',
    subEn: 'Comic&Manga',
    rating: '★ 4.8 / 5.0 · App Store',
    summary:
      '围绕 ComfyUI 生图能力，自己 Design 并 Code 的 iPad 漫画应用。用户可借助 AI 绘图，将任意漫画页面转为特定风格。',
    tags: ['ComfyUI', 'SwiftUI', 'Design to Code', 'AI 绘图'],
    media: { label: '漫漫书架 App 截图', node: '539:9342', ratio: '16 / 10', src: '/media/comic/collection.jpg' },
    footerLabel: '漫漫书架 Comic&Manga',
    nextHint: 'Next Case · 02',
    nextLine: '漫漫书架 Comic&Manga —— 独立设计 & 开发的 iPad 漫画应用',
  },
  {
    slug: 'ai-design-system',
    kind: 'lab',
    title: '让 AI 稳定产出 production-level 设计稿',
    summary:
      '一次关于「复合设计系统」的探索 —— 把设计系统从一份交付物，做成一个 AI 能执行、能验证的可运行约束系统。',
    labKicker: 'LAB · LONG ESSAY',
    labFrames: '15 SECTIONS',
    footerLabel: 'AI 设计系统 · 长案例',
    nextHint: 'Long Essay · Lab',
    nextLine: '让 AI 稳定产出 production-level 设计稿 —— 复合设计系统探索',
  },
  {
    slug: 'other',
    kind: 'minor',
    title: '其他作品',
    minorLabel: 'Other Work',
    minorDesc: 'Figma 插件 · 技术分享 · 动效设计',
    footerLabel: '其他作品',
    nextHint: 'Other Work',
    nextLine: '其他作品 —— Figma 插件 · 技术分享 · 动效设计',
  },
];

/** 历史作品集:每项跳转到 📝简历 Figma 文件里的对应画板(node-id 可后续细化到单项) */
const RESUME_FIGMA_URL =
  'https://www.figma.com/design/S01WbvJxrtsbrUqbaF7sdT/%F0%9F%93%9D-%E7%AE%80%E5%8E%86?node-id=2730-51683';

const resumeNode = (id: string) => RESUME_FIGMA_URL.replace(/node-id=[\d-]+/, `node-id=${id}`);

export const historical = [
  { label: 'OPPO 车机设计洞察', figma: resumeNode('2730-51627') },
  { label: '智能座舱度量体系', figma: resumeNode('2730-51623') },
  { label: '腾讯公益课件 AI 配图', figma: resumeNode('2730-51631') },
  { label: '跨屏互联创新项目', figma: resumeNode('2730-51607') },
];
