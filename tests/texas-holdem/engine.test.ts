import { describe, expect, it } from "vitest";

import { applyPlayerAction, createNewHoldemGame } from "@/lib/texas-holdem/engine";
import { createDeck } from "@/lib/texas-holdem/evaluator";
import type { Card, CardRank, CardSuit } from "@/lib/texas-holdem/types";

describe("texas holdem engine", () => {
  it("starts a hand with blinds, two hole cards, and a preflop actor", () => {
    const game = createNewHoldemGame({
      playerNames: ["你", "朋友"],
      seed: "heads-up",
    });

    expect(game.phase).toBe("preflop");
    expect(game.players[0].holeCards).toHaveLength(2);
    expect(game.players[1].holeCards).toHaveLength(2);
    expect(game.players[0].committed).toBe(10);
    expect(game.players[1].committed).toBe(20);
    expect(game.currentPlayer).toBe(0);
  });

  it("advances from preflop to flop after both players match the big blind", () => {
    let game = createNewHoldemGame({
      playerNames: ["你", "朋友"],
      seed: "flop",
    });

    game = applyPlayerAction(game, { type: "call" });
    game = applyPlayerAction(game, { type: "check" });

    expect(game.phase).toBe("flop");
    expect(game.communityCards).toHaveLength(3);
    expect(game.highestBet).toBe(0);
  });

  it("awards the pot immediately when everyone else folds", () => {
    let game = createNewHoldemGame({
      playerNames: ["按钮", "小盲", "大盲"],
      seed: "fold-pot",
    });

    game = applyPlayerAction(game, { type: "fold" });
    game = applyPlayerAction(game, { type: "fold" });

    expect(game.phase).toBe("hand-complete");
    expect(game.winners).toEqual([
      expect.objectContaining({
        playerId: 2,
        amount: 30,
        handLabel: "其他玩家弃牌",
      }),
    ]);
  });

  it("handles all-in side pots at showdown", () => {
    let game = createNewHoldemGame({
      playerNames: ["短筹", "中筹", "大盲"],
      startingStack: 200,
      seed: "side-pot",
    });
    const usedCards = [
      card(14, "spades"),
      card(14, "hearts"),
      card(13, "spades"),
      card(13, "hearts"),
      card(12, "spades"),
      card(12, "hearts"),
      card(14, "clubs"),
      card(13, "clubs"),
      card(2, "spades"),
      card(3, "diamonds"),
      card(4, "clubs"),
    ];

    game.players[0].chips = 100;
    game.players[0].holeCards = [usedCards[0], usedCards[1]];
    game.players[1].holeCards = [usedCards[2], usedCards[3]];
    game.players[2].holeCards = [usedCards[4], usedCards[5]];
    game.deck = [
      usedCards[6],
      usedCards[7],
      usedCards[8],
      usedCards[9],
      usedCards[10],
      ...createDeck().filter((deckCard) =>
        usedCards.every((usedCard) => usedCard.id !== deckCard.id),
      ),
    ];

    game = applyPlayerAction(game, { type: "raise", amount: 100 });
    game = applyPlayerAction(game, { type: "raise", amount: 200 });
    game = applyPlayerAction(game, { type: "call" });

    expect(game.phase).toBe("hand-complete");
    expect(game.communityCards).toHaveLength(5);
    expect(game.winners).toEqual([
      expect.objectContaining({ playerId: 0, amount: 300, handLabel: "三条" }),
      expect.objectContaining({ playerId: 1, amount: 200, handLabel: "三条" }),
    ]);
    expect(game.players[0].chips).toBe(300);
    expect(game.players[1].chips).toBe(200);
    expect(game.players[2].chips).toBe(0);
  });
});

function card(rank: CardRank, suit: CardSuit): Card {
  return {
    id: `${rank}-${suit}`,
    rank,
    suit,
  };
}
