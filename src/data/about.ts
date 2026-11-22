/**
 * 首页「00 关于与经历」的数据源 —— 首页与 /resume/（简历 PDF 的打印源）共用。
 * 改了这里，记得跑 `npm run build:resume` 重新生成 public/media/resume/aaron-xu-resume.pdf。
 */
import { historical } from './cases';

const figmaOf = (label: string) => historical.find((h) => h.label === label)?.figma ?? '/work/';

/** 简历 PDF（由 npm run build:resume 从 /resume/ 打印生成，提交进仓库） */
export const RESUME_PDF = '/media/resume/aaron-xu-resume.pdf';

export const profile = {
  name: 'Aaron Xu',
  title: '设计工程师',
  hello: { before: '你好，我是 Aaron，一个', accent: '懂技术的设计师', after: '。' },
  education: {
    school: '华中科技大学',
    detail: '传播学 / 计算机科学与技术 双学位 · 2014 - 2018',
  },
  email: 'woshixwn@gmail.com',
  site: 'www.xuweinan.com',
  github: 'github.com/AaronXu-Lab',
};

/* ---------- 00 关于：能力 ---------- */
export const skills = [
  {
    title: '设计工程化',
    desc: '搭建设计系统、Figma 插件与自动化工具，持续提升设计师效率。',
    icon: 'swatches' as const,
  },
  {
    title: '「超」保真原型',
    desc: '原生代码手写原型，接入真实接口，体验接近上线，提前暴露问题。',
    icon: 'hand-pointing' as const,
  },
  {
    title: 'AI 工作流',
    desc: '基于 AI 搭建自动化工作流，快速批量产出标准化程度较高的设计。',
    icon: 'sparkle' as const,
  },
  {
    title: '动效与微交互',
    desc: '运用人因工程设计动效与微交互，建立反馈与预期，提升精致感。',
    icon: 'path' as const,
  },
];

/* ---------- 00 关于：工作经历（core 默认显示，其余点「更多经历」展开） ---------- */
export interface Job {
  span: string;
  time: string;
  company: string;
  role: string;
  domain: string;
  points: string[];
  core: boolean;
  current?: boolean;
  badge?: { text: string; tone: 'accent' | 'dark' };
  link?: { href: string; label: string; external?: boolean };
  /** 资料未补齐前不上线 */
  draft?: boolean;
}

export const jobs: Job[] = [
  {
    // TODO：职位、入职月份、业务方向与要点待补充
    span: '2026 - 今',
    time: '2026 - 至今',
    company: '实在智能',
    role: '职位待补充',
    domain: '业务方向待补充',
    points: ['工作内容待补充'],
    core: true,
    current: true,
    badge: { text: 'NOW', tone: 'accent' },
  },
  {
    span: '2025',
    time: '2025.5 - 2025.12',
    company: 'flomo',
    role: '设计师',
    domain: '独立产品 · 全栈设计 · AI 洞察',
    points: [
      '以全栈视角推动独立产品迭代，梳理设计与开发的协作流程，提升交付效率',
      '主导 AI 洞察功能从设计到上线',
      '用设计手段消化高频用户反馈，改善数据安全、搜索等体验痛点',
    ],
    core: false,
  },
  {
    span: '2024 - 25',
    time: '2024.1 - 2025.3',
    company: 'Followup.AI',
    role: 'UX Designer',
    domain: 'B 端设计系统 · AI Agent',
    points: [
      '主导项目管理平台从 0 到 1 的全流程设计，建立完整的设计体系',
      '打通设计与开发的协作流程',
      '把前沿技术与产品需求结合，落地多个 AI 特色功能',
    ],
    core: true,
    badge: { text: '从 0 到 1 · 初创团队', tone: 'dark' },
    link: { href: '/work/followup-ai/', label: '阅读案例' },
  },
  {
    span: '2022 - 23',
    time: '2022.10 - 2023.5',
    company: '小鹏汇天',
    role: '交互高级设计师',
    domain: 'HMI · 智能座舱体验度量',
    points: [
      '发起并建立可量化的智能座舱体验度量体系，把感官体验拆解为可测的技术指标',
      '填补公司座舱体验评价体系的空白',
    ],
    core: false,
    link: { href: figmaOf('智能座舱度量体系'), label: '查看案例', external: true },
  },
  {
    span: '2018 - 22',
    time: '2018.7 - 2022.9',
    company: 'OPPO',
    role: '用户体验设计师',
    domain: 'ColorOS · 创新项目设计洞察',
    points: [
      '在 ColorOS 跨屏互联项目中定义跨端流转的底层交互逻辑',
      '带领团队完成车机创新预研的设计洞察，为新驾驶模式的落地与后续规划提供依据',
    ],
    core: true,
    badge: { text: '★ 极致体验奖', tone: 'dark' },
  },
];
