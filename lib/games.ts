export type GameEntry = {
  slug: string;
  title: string;
  href: string;
  description: string;
  status: string;
  actionLabel?: string;
};

export const GAME_ENTRIES: GameEntry[] = [
  {
    slug: "farm-life-mvp",
    title: "山居种田",
    href: "/farm-life-mvp",
    description: "网页版种田游戏 MVP，已换用 Farm RPG 像素美术素材包，并接入 Tiled 可滚动大地图、相机跟随、按住方向键连续移动、J 键山居日志、季节日历、每日目标、山居线索任务链、NPC 分时段日程、原创小事件、活动加成、NPC 聊天送礼、天气、季节、时间体力、公告板订单、小屋室内、电视天气预报、池塘钓鱼、每日野外采集、邮箱信件、三帧走路动画、原创合成音效、种子目录购买弹窗、底部图标工具栏、背包菜单、睡觉结算屏、作物、渔获和采集物 logo、HUD 图标、操作漂浮反馈、木质 UI、种子商店、三种作物和本地存档。",
    status: "可玩原型",
    actionLabel: "进入游戏",
  },
  {
    slug: "forest-shuffle",
    title: "森森不息",
    href: "/forest-shuffle",
    description: "两人私用的森林生态卡牌桌，支持本地游玩和线上房间。",
    status: "暂存入口",
  },
  {
    slug: "texas-holdem",
    title: "德州扑克桌游",
    href: "/texas-holdem",
    description:
      "多人德州扑克桌面，支持 2-6 人、盲注、下注轮、公共牌、摊牌、底池结算，并可通过 ECS 房间服务让朋友公网同桌。",
    status: "可玩桌游",
  },
];

export function getAllGames() {
  return GAME_ENTRIES;
}
