export const CODEX_SNAPSHOTS_URL =
  process.env.NEXT_PUBLIC_CODEX_SNAPSHOTS_URL || "https://ffffhx.github.io/codex-snapshots/";

export const OPEN_TOKEN_BOARD_URL =
  process.env.NEXT_PUBLIC_OPEN_TOKEN_BOARD_URL || "https://ffffhx.github.io/open-token-board/";

export const GAMES_SITE_URL =
  process.env.NEXT_PUBLIC_GAMES_SITE_URL || "https://ffffhx.github.io/games/";

export type StandaloneProject = {
  slug: string;
  title: string;
  productName: string;
  href: string;
  displayUrl: string;
  badge: string;
  description: string;
  accentClassName: string;
};

export const STANDALONE_PROJECTS: StandaloneProject[] = [
  {
    slug: "codex-snapshots",
    title: "会话快照",
    productName: "Codex Snapshots",
    href: CODEX_SNAPSHOTS_URL,
    displayUrl: "ffffhx.github.io/codex-snapshots",
    badge: "会话沉淀",
    description:
      "把本地 Agent 会话整理成可浏览、可分享的只读快照，适合复盘推理过程、保留上下文和沉淀案例。",
    accentClassName: "text-[#245d83]",
  },
  {
    slug: "open-token-board",
    title: "Token榜",
    productName: "Open Token Board",
    href: OPEN_TOKEN_BOARD_URL,
    displayUrl: "ffffhx.github.io/open-token-board",
    badge: "用量看板",
    description:
      "把本地 Codex token 使用记录汇总成排行榜和成本看板，用来观察模型消耗、项目节奏和长期趋势。",
    accentClassName: "text-[#8f3f18]",
  },
  {
    slug: "games",
    title: "游戏入口",
    productName: "Garden Games",
    href: GAMES_SITE_URL,
    displayUrl: "ffffhx.github.io/games",
    badge: "独立游戏站",
    description:
      "山居种田、森林卡牌和德州扑克等小游戏都搬到独立站点，Garden Lab 首页只保留公开跳转和项目介绍。",
    accentClassName: "text-[#2f6b4f]",
  },
];
