import type { Metadata } from "next";

import { TokenLeaderboardApp } from "@/components/token-leaderboard-app";

const INITIAL_NOW = "2026-05-14T12:00:00.000Z";
const CANONICAL_URL = "https://ffffhx.github.io/garden-lab/token-leaderboard/";

export const metadata: Metadata = {
  title: "Open Token Board | AI 编码 Token 排行榜",
  description: "朋友间共享 AI 编码工具 token 使用量的排行榜，包含 7D/30D 排名、费用估算、模型消耗、工具分布与效率指标。",
  alternates: {
    canonical: CANONICAL_URL,
  },
  openGraph: {
    title: "Open Token Board | AI 编码 Token 排行榜",
    description: "查看朋友间的 AI 编码 Token 排名、费用估算、模型消耗、工具分布与效率指标。",
    type: "website",
    url: CANONICAL_URL,
  },
  twitter: {
    card: "summary",
    title: "Open Token Board | AI 编码 Token 排行榜",
    description: "朋友间共享 AI 编码工具 token 使用量的排行榜。",
  },
};

export default function TokenLeaderboardPage() {
  return (
    <TokenLeaderboardApp
      apiBaseUrl={process.env.NEXT_PUBLIC_TOKEN_BOARD_API_URL}
      initialNow={INITIAL_NOW}
    />
  );
}
