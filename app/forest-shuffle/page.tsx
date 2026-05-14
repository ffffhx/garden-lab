import type { Metadata } from "next";

import { ForestShuffleGame } from "@/components/forest-shuffle/forest-shuffle-game";

export const metadata: Metadata = {
  title: "森森不息",
  description: "两人私用的森林生态卡牌桌，支持线上房间。",
};

export default function ForestShufflePage() {
  return <ForestShuffleGame />;
}
