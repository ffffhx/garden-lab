import { describe, expect, it } from "vitest";

import { compareHands, evaluateBestHand } from "@/lib/texas-holdem/evaluator";
import type { Card, CardRank, CardSuit } from "@/lib/texas-holdem/types";

describe("texas holdem evaluator", () => {
  it("finds the best five-card hand from seven cards", () => {
    const hand = evaluateBestHand([
      card(14, "spades"),
      card(13, "spades"),
      card(12, "spades"),
      card(11, "spades"),
      card(10, "spades"),
      card(2, "clubs"),
      card(3, "diamonds"),
    ]);

    expect(hand.category).toBe("straight-flush");
    expect(hand.label).toBe("皇家同花顺");
    expect(hand.ranks).toEqual([14]);
  });

  it("supports ace-low wheel straights", () => {
    const hand = evaluateBestHand([
      card(14, "hearts"),
      card(5, "clubs"),
      card(4, "spades"),
      card(3, "diamonds"),
      card(2, "hearts"),
      card(9, "clubs"),
      card(12, "diamonds"),
    ]);

    expect(hand.category).toBe("straight");
    expect(hand.ranks).toEqual([5]);
  });

  it("orders made hands before kickers", () => {
    const fullHouse = evaluateBestHand([
      card(9, "spades"),
      card(9, "hearts"),
      card(9, "diamonds"),
      card(2, "spades"),
      card(2, "clubs"),
    ]);
    const flush = evaluateBestHand([
      card(14, "clubs"),
      card(10, "clubs"),
      card(8, "clubs"),
      card(6, "clubs"),
      card(4, "clubs"),
    ]);

    expect(compareHands(fullHouse, flush)).toBeGreaterThan(0);
  });
});

function card(rank: CardRank, suit: CardSuit): Card {
  return {
    id: `${rank}-${suit}`,
    rank,
    suit,
  };
}
