import type { Metadata } from "next";

import { TexasHoldemGame } from "@/components/texas-holdem/texas-holdem-game";

export const metadata: Metadata = {
  title: "德州扑克桌游",
  description:
    "多人德州扑克桌面，支持盲注、下注轮、公共牌、摊牌、底池结算和 ECS 房间服务公网同桌。",
};

export default function TexasHoldemPage() {
  return <TexasHoldemGame />;
}
