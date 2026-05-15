import { describe, expect, it } from "vitest";

import { createRoomStore } from "@/lib/texas-holdem/room-service";

describe("texas holdem room service", () => {
  it("creates a multiplayer room and assigns the creator to a seat", () => {
    const store = createRoomStore();
    const snapshot = store.createRoom({
      token: "creator",
      name: "Alice",
      seat: 0,
      playerCount: 4,
    });

    expect(snapshot.roomId).toMatch(/^[A-F0-9]{6}$/);
    expect(snapshot.viewerSeat).toBe(0);
    expect(snapshot.seats).toHaveLength(4);
    expect(snapshot.seats[0]?.name).toBe("Alice");
    expect(snapshot.game.players).toHaveLength(4);
    expect(snapshot.game.players[0].holeCards[0].id).not.toMatch(/^hidden-/);
    expect(snapshot.game.players[1].holeCards[0].id).toMatch(/^hidden-1-/);
  });

  it("lets a second token join a seat and hides the creator hole cards", () => {
    const store = createRoomStore();
    const first = store.createRoom({
      token: "a",
      name: "Alice",
      seat: 0,
      playerCount: 3,
    });
    const second = store.joinRoom({
      roomId: first.roomId,
      token: "b",
      name: "Bob",
      seat: 1,
    });

    expect(second.viewerSeat).toBe(1);
    expect(second.seats[0]?.name).toBe("Alice");
    expect(second.seats[1]?.name).toBe("Bob");
    expect(second.game.players[0].holeCards[0].id).toMatch(/^hidden-0-/);
    expect(second.game.players[1].holeCards[0].id).not.toMatch(/^hidden-/);
  });

  it("rejects spectators and wrong seats for player actions", () => {
    const store = createRoomStore();
    const room = store.createRoom({
      token: "a",
      name: "Alice",
      seat: 0,
      playerCount: 2,
    });
    store.joinRoom({ roomId: room.roomId, token: "b", name: "Bob", seat: 1 });

    expect(() =>
      store.applyAction({
        roomId: room.roomId,
        token: "spectator",
        action: { type: "player-action", playerId: 0, action: { type: "call" } },
      }),
    ).toThrow("旁观者不能操作牌局");

    expect(() =>
      store.applyAction({
        roomId: room.roomId,
        token: "b",
        action: { type: "player-action", playerId: 1, action: { type: "call" } },
      }),
    ).toThrow("还没轮到这个座位");
  });

  it("applies actions and reveals hole cards after showdown", () => {
    const store = createRoomStore();
    const room = store.createRoom({
      token: "a",
      name: "Alice",
      seat: 0,
      playerCount: 2,
    });
    store.joinRoom({ roomId: room.roomId, token: "b", name: "Bob", seat: 1 });

    let snapshot = store.applyAction({
      roomId: room.roomId,
      token: "a",
      action: { type: "player-action", playerId: 0, action: { type: "call" } },
    });
    snapshot = store.applyAction({
      roomId: room.roomId,
      token: "b",
      action: { type: "player-action", playerId: 1, action: { type: "check" } },
    });

    expect(snapshot.game.phase).toBe("flop");

    for (let index = 0; index < 6 && snapshot.game.phase !== "hand-complete"; index += 1) {
      const playerId = snapshot.game.currentPlayer;
      expect(playerId).not.toBeNull();
      const token = playerId === 0 ? "a" : "b";
      snapshot = store.applyAction({
        roomId: room.roomId,
        token,
        action: { type: "player-action", playerId: playerId!, action: { type: "check" } },
      });
    }

    expect(snapshot.game.phase).toBe("hand-complete");
    expect(snapshot.game.players[0].holeCards[0].id).not.toMatch(/^hidden-/);
    expect(snapshot.game.players[1].holeCards[0].id).not.toMatch(/^hidden-/);
    expect(snapshot.game.winners.length).toBeGreaterThan(0);
  });

  it("starts the next hand from a connected seat", () => {
    const store = createRoomStore();
    const room = store.createRoom({
      token: "a",
      name: "Alice",
      seat: 0,
      playerCount: 2,
    });
    const next = store.applyAction({
      roomId: room.roomId,
      token: "a",
      action: { type: "next-hand" },
    });

    expect(next.revision).toBeGreaterThan(room.revision);
    expect(next.game.handNumber).toBe(2);
  });
});
