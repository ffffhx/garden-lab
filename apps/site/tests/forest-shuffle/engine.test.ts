import { describe, expect, it } from "vitest";

import { SAMPLE_CARD_LIBRARY } from "@/lib/forest-shuffle/cards";
import {
  createNewGame,
  drawCards,
  getCardDef,
  playDweller,
  playSapling,
  playTree,
  scoreGame,
} from "@/lib/forest-shuffle/engine";

describe("forest shuffle engine", () => {
  it("defines visible tags for every dweller face", () => {
    const dwellers = SAMPLE_CARD_LIBRARY.filter((card) => card.kind === "dweller");

    expect(dwellers.length).toBeGreaterThan(0);
    for (const card of dwellers) {
      if (card.kind !== "dweller") {
        continue;
      }

      for (const face of card.faces) {
        expect(face.tags, `${face.title} should have tags`).not.toHaveLength(0);
      }
    }
  });

  it("deals six cards to each player and prepares winter cards", () => {
    const game = createNewGame(SAMPLE_CARD_LIBRARY, { seed: "test" });

    expect(game.players[0].hand).toHaveLength(6);
    expect(game.players[1].hand).toHaveLength(6);
    expect(game.deck.filter((uid) => getCardDef(game, uid).kind === "winter")).toHaveLength(3);
    expect(game.revealedWinter).toHaveLength(0);
    expect(game.discardPile).toHaveLength(0);
  });

  it("draws up to two cards and passes the turn", () => {
    const game = createNewGame(SAMPLE_CARD_LIBRARY, { seed: "draw" });
    const firstHandSize = game.players[0].hand.length;
    const next = drawCards(game, [{ type: "deck" }, { type: "deck" }]);

    expect(next.players[0].hand.length).toBeGreaterThanOrEqual(firstHandSize);
    expect(next.currentPlayer).toBe(1);
  });

  it("plays a tree from hand into the current forest after paying its cost", () => {
    const game = createNewGame(SAMPLE_CARD_LIBRARY, { seed: "tree" });
    const treeUid = game.players[0].hand.find((uid) => getCardDef(game, uid).kind === "tree");

    expect(treeUid).toBeDefined();

    const tree = getCardDef(game, treeUid!);
    expect(tree.kind).toBe("tree");

    if (tree.kind !== "tree") {
      return;
    }

    const payment = game.players[0].hand
      .filter((uid) => uid !== treeUid)
      .slice(0, tree.cost);
    const withoutPayment = playTree(game, treeUid!, []);
    const next = playTree(game, treeUid!, payment);

    expect(withoutPayment.players[0].forest).toHaveLength(0);
    expect(next.players[0].forest.map((tree) => tree.uid)).toContain(treeUid);
    expect(next.clearing.length + next.players[0].cave.length).toBeGreaterThanOrEqual(
      tree.cost,
    );
    expect(next.currentPlayer).toBe(1);
  });

  it("reveals winter beside the clearing and draws a replacement", () => {
    const game = createNewGame(SAMPLE_CARD_LIBRARY, { seed: "winter-replace" });
    const winterUid = game.deck.find((uid) => getCardDef(game, uid).kind === "winter");
    const replacementUid = game.deck.find((uid) => getCardDef(game, uid).kind !== "winter");

    expect(winterUid).toBeDefined();
    expect(replacementUid).toBeDefined();

    game.deck = [
      winterUid!,
      replacementUid!,
      ...game.deck.filter((uid) => uid !== winterUid && uid !== replacementUid),
    ];

    const handSize = game.players[0].hand.length;
    const next = drawCards(game, [{ type: "deck" }]);

    expect(next.revealedWinter).toContain(winterUid);
    expect(next.players[0].hand).toContain(replacementUid);
    expect(next.players[0].hand).toHaveLength(handSize + 1);
    expect(next.currentPlayer).toBe(1);
  });

  it("plays any hand card face down as a sapling", () => {
    const game = createNewGame(SAMPLE_CARD_LIBRARY, { seed: "sapling" });
    const cardUid =
      game.players[0].hand.find((uid) => getCardDef(game, uid).kind === "dweller") ??
      game.players[0].hand[0];
    const next = playSapling(game, cardUid);

    expect(next.players[0].forest).toHaveLength(1);
    expect(next.players[0].forest[0].isSapling).toBe(true);
    expect(next.players[0].forest[0].uid).toBe(cardUid);
    expect(next.players[0].hand).not.toContain(cardUid);
    expect(next.currentPlayer).toBe(1);
  });

  it("clears the clearing when it reaches ten cards at end of turn", () => {
    const game = createNewGame(SAMPLE_CARD_LIBRARY, { seed: "crowded-clearing" });
    const oakUid = Object.keys(game.instances).find(
      (uid) => game.instances[uid].defId === "oak",
    );
    const payments = game.deck
      .filter((uid) => getCardDef(game, uid).kind !== "winter" && uid !== oakUid)
      .slice(0, 2);

    expect(oakUid).toBeDefined();
    expect(payments).toHaveLength(2);

    game.players[0].hand = [oakUid!, ...payments];
    game.deck = game.deck.filter((uid) => uid !== oakUid && !payments.includes(uid));
    const clearingCards = game.deck
      .filter((uid) => getCardDef(game, uid).kind !== "winter")
      .slice(0, 9);
    game.clearing = clearingCards;
    game.deck = game.deck.filter((uid) => !clearingCards.includes(uid));

    const next = playTree(game, oakUid!, payments);

    expect(next.clearing).toHaveLength(0);
    expect(next.discardPile.length).toBeGreaterThanOrEqual(10);
    expect(next.currentPlayer).toBe(1);
  });

  it("attaches a dweller after paying its cost", () => {
    const game = createNewGame(SAMPLE_CARD_LIBRARY, { seed: "dweller" });
    let treeUid = game.players[0].hand.find((uid) => getCardDef(game, uid).kind === "tree");

    if (!treeUid) {
      game.players[0].hand.push("oak#1");
      treeUid = "oak#1";
    }

    const tree = getCardDef(game, treeUid);
    expect(tree.kind).toBe("tree");

    if (tree.kind !== "tree") {
      return;
    }

    const treePayment = game.players[0].hand
      .filter((uid) => uid !== treeUid)
      .slice(0, tree.cost);
    const withTree = playTree(game, treeUid, treePayment);
    withTree.currentPlayer = 0;

    const dwellerChoice = withTree.players[0].hand.flatMap((uid) => {
      const definition = getCardDef(withTree, uid);

      if (definition.kind !== "dweller") {
        return [];
      }

      const face = definition.faces.find(
        (item) => item.cost <= withTree.players[0].hand.length - 1,
      );
      return face ? [{ uid, face }] : [];
    })[0];

    expect(dwellerChoice).toBeDefined();
    const payment = withTree.players[0].hand
      .filter((uid) => uid !== dwellerChoice!.uid)
      .slice(0, dwellerChoice!.face.cost);
    const next = playDweller(withTree, {
      cardUid: dwellerChoice!.uid,
      faceId: dwellerChoice!.face.id,
      treeUid,
      paymentUids: payment,
    });

    expect(Object.values(next.players[0].forest[0].attached)).toHaveLength(1);
  });

  it("scores both players", () => {
    const game = createNewGame(SAMPLE_CARD_LIBRARY, { seed: "score" });
    const scores = scoreGame(game);

    expect(scores).toHaveLength(2);
    expect(scores[0].total).toBeGreaterThanOrEqual(0);
    expect(scores[1].total).toBeGreaterThanOrEqual(0);
  });
});
