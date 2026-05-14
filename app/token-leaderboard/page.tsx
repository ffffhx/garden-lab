import type { Metadata } from "next";

import { TokenLeaderboardApp } from "@/components/token-leaderboard-app";
import { createDemoTokenEntries } from "@/lib/token-leaderboard";

const INITIAL_NOW = "2026-05-14T12:00:00.000Z";

export const metadata: Metadata = {
  title: "Token 排行榜",
  description: "朋友间共享 AI 编码工具 token 使用量的排行榜。",
};

export default function TokenLeaderboardPage() {
  return (
    <TokenLeaderboardApp
      apiBaseUrl={process.env.NEXT_PUBLIC_TOKEN_BOARD_API_URL}
      initialEntries={createDemoTokenEntries(new Date(INITIAL_NOW))}
      initialNow={INITIAL_NOW}
    />
  );
}
