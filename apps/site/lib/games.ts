import { GAMES_SITE_URL } from "@/lib/standalone-projects";

export { GAMES_SITE_URL } from "@/lib/standalone-projects";

export type GameEntry = {
  slug: string;
  title: string;
  href: string;
  description: string;
  status: string;
  actionLabel?: string;
};

function withGamesSite(pathname = "") {
  return `${GAMES_SITE_URL.replace(/\/+$/, "")}/${pathname.replace(/^\/+/, "")}`;
}

export const GAME_ENTRIES: GameEntry[] = [
  {
    slug: "farm-life",
    title: "山居种田",
    href: withGamesSite("/farm-life/"),
    description: "Phaser 单机种田原型：地图、作物、背包、天气、NPC、订单、钓鱼和本地存档已经接入。",
    status: "可玩原型",
    actionLabel: "进入游戏",
  },
  {
    slug: "forest-shuffle",
    title: "森森不息",
    href: withGamesSite("/forest-shuffle/"),
    description: "两人私用的森林生态卡牌桌，支持本地游玩和线上房间。",
    status: "可玩桌游",
  },
  {
    slug: "texas-holdem",
    title: "德州扑克桌游",
    href: withGamesSite("/texas-holdem/"),
    description:
      "多人德州扑克桌面，支持 2-6 人、盲注、下注轮、公共牌、摊牌、底池结算，并可通过 ECS 房间服务让朋友公网同桌。",
    status: "可玩桌游",
  },
];

export function getAllGames() {
  return GAME_ENTRIES;
}
