/**
 * 用户评论的唯一数据源（首页「大产品」里 MasterGo Importer 右侧的评论墙）。
 * 规则：只放真实评论原文（小红书 / Figma 社区 / GitHub Issues），注明来源，不改写、不编造。
 *
 * 评论取自作者自己整理的 MasterGo 评论合集；每条评论没有单独的地址，所以点击跳到对应的笔记或插件页。
 * 头像在 public/media/reviews/，文件编号与下面的顺序一致（01 到 16），取自评论者公开的头像。
 * 顺序有意把长评论和一句话评论交错排开，这样三列的卡片高度才有错落。
 * 卡片高度按评论文字长短自动调整（一句话的矮、长评论高）；评论不够排满一圈时会整份重复，
 * 同一条评论不会同一时刻在面板里出现两次（见 src/lib/review-wall.mjs 的 planFor 与测试）。
 */
export interface Review {
  /** 用户名（对方公开的昵称） */
  name: string;
  /** 评论原文 */
  text: string;
  /** 来源名称，如「小红书」「Figma 社区」 */
  source: string;
  /** 来源链接（点击整张卡片跳转） */
  href: string;
  /** 用户头像（public 下路径，建议 96×96 正方形）；不填则显示姓名首字 */
  avatar?: string;
}

/** 是否仍是示例数据；为 true 时评论墙会显示「示例数据」标签。现在是真实评论 */
export const REVIEWS_ARE_SAMPLE = false;

const XHS =
  'https://www.xiaohongshu.com/discovery/item/6a6f65cc0000000035017c5f?source=webshare&xhsshare=pc_web&xsec_token=ABEmN3fqsIdEIrvlRTva-zrICL_YNWtZuolywhftUzG1k=&xsec_source=pc_share';
const FIGMA = 'https://www.figma.com/community/plugin/1662512589841230294/mastergo-importer';

export const mastergoReviews: Review[] = [
  { name: '婉婉郡主', avatar: '/media/reviews/01.jpg', text: '真的是福利了 之前存了几十个mg 文件 随便拖拽到插件里 几分钟就转成figma的文件了 我目前就没遇到乱码现象 全部100%还原', source: '小红书', href: XHS },
  { name: '打工人', avatar: '/media/reviews/02.jpg', text: '感谢大佬救于水火', source: '小红书', href: XHS },
  { name: '阿赤akano', avatar: '/media/reviews/03.jpg', text: '除了形状填充图片、裁切过的图片会变形，这些手动改回来就行。其他真的都做到99%还原，太牛了', source: '小红书', href: XHS },
  { name: '泡芙吖吖', avatar: '/media/reviews/04.jpg', text: '膜拜大神，我成功了', source: '小红书', href: XHS },
  { name: 'M7Mの夢', avatar: '/media/reviews/05.jpg', text: '太感谢了目前试了两个app界面很还原，希望到时候大屏也能还原', source: '小红书', href: XHS },
  { name: '识趣', avatar: '/media/reviews/06.jpg', text: '大佬，你是我的神', source: '小红书', href: XHS },
  { name: '肉松卷不要肉只要卷', avatar: '/media/reviews/07.jpg', text: '太好用了，现在mastergo个人版页面限制做个PPT都不够用...终于把我之前的PPT和模板都迁过来了', source: '小红书', href: XHS },
  { name: '-初鱼-', avatar: '/media/reviews/08.jpg', text: '老师，你简直配享太庙', source: '小红书', href: XHS },
  { name: '黑子白点', avatar: '/media/reviews/09.jpg', text: '自动布局没有了 有些文字行高会有问题 其他都非常好太方便了 感谢大佬', source: '小红书', href: XHS },
  { name: '京津冀周边短途游攻略手记', avatar: '/media/reviews/10.jpg', text: '义父，文本字体缺失是什么原因呢？', source: '小红书', href: XHS },
  { name: '是Sunday啊', avatar: '/media/reviews/11.jpg', text: '太牛了老师', source: '小红书', href: XHS },
  { name: 'Yancy', avatar: '/media/reviews/12.jpg', text: '给一个大大的赞赏，一个人做插件很不容易，支持支持', source: 'Figma 社区', href: FIGMA },
  { name: '设计系怪学姐', avatar: '/media/reviews/13.jpg', text: '大佬太牛！了！', source: '小红书', href: XHS },
  { name: '假如我有時光机', avatar: '/media/reviews/14.jpg', text: '我用了，效果挺好的，感谢大佬！', source: '小红书', href: XHS },
  { name: '小橙UI设计', avatar: '/media/reviews/15.jpg', text: '你是我亲爹T.T.', source: '小红书', href: XHS },
  { name: 'kkexorcist', avatar: '/media/reviews/16.jpg', text: '你就是神', source: 'Figma 社区', href: FIGMA },
];
