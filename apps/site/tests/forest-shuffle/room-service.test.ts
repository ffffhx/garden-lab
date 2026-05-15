import { describe, expect, it } from "vitest";

import { getCardDef } from "@/lib/forest-shuffle/engine";
import { createRoomStore } from "@/lib/forest-shuffle/room-service";
import type { PlayerId } from "@/lib/forest-shuffle/types";

describe("forest shuffle room service", () => {
  it("creates a room and assigns the creator to a seat", () => {
    const store = createRoomStore();
    const snapshot = store.createRoom({
      token: "creator",
      name: "Alice",
      seat: 0,
    });

    expect(snapshot.roomId).toMatch(/^[A-F0-9]{6}$/);
    expect(snapshot.viewerSeat).toBe(0);
    expect(snapshot.seats[0]?.name).toBe("玩家一");
    expect(snapshot.game.players[0].name).toBe("玩家一");
    expect(snapshot.game.players[0].hand).toHaveLength(6);
    expect(snapshot.game.players[1].hand[0]).toMatch(/^hidden-1-/);
  });

  it("lets a second token join the empty seat and hides the other hand", () => {
    const store = createRoomStore();
    const first = store.createRoom({ token: "a", name: "Alice", seat: 0 });
    const second = store.joinRoom({
      roomId: first.roomId,
      token: "b",
      name: "Bob",
      seat: 1,
    });

    expect(second.viewerSeat).toBe(1);
    expect(second.seats[0]?.name).toBe("玩家一");
    expect(second.seats[1]?.name).toBe("玩家二");
    expect(second.game.players[0].name).toBe("玩家一");
    expect(second.game.players[1].name).toBe("玩家二");
    expect(second.game.players[0].hand[0]).toMatch(/^hidden-0-/);
    expect(second.game.players[1].hand[0]).not.toMatch(/^hidden-/);
  });

  it("keeps fixed seat names when players reconnect or start a new game", () => {
    const store = createRoomStore();
    const room = store.createRoom({ token: "a", name: "Alice", seat: 0 });
    store.joinRoom({ roomId: room.roomId, token: "b", name: "Bob", seat: 1 });
    store.joinRoom({ roomId: room.roomId, token: "a", name: "Changed", seat: 0 });
    const next = store.applyAction({
      roomId: room.roomId,
      token: "a",
      action: { type: "new-game" },
    });

    expect(next.seats[0]?.name).toBe("玩家一");
    expect(next.seats[1]?.name).toBe("玩家二");
    expect(next.game.players[0].name).toBe("玩家一");
    expect(next.game.players[1].name).toBe("玩家二");
  });

  it("rejects actions from the wrong seat", () => {
    const store = createRoomStore();
    const room = store.createRoom({ token: "a", name: "Alice", seat: 0 });
    store.joinRoom({ roomId: room.roomId, token: "b", name: "Bob", seat: 1 });

    expect(() =>
      store.applyAction({
        roomId: room.roomId,
        token: "b",
        action: { type: "draw", playerId: 1 as PlayerId, sources: [{ type: "deck" }] },
      }),
    ).toThrow("还没轮到这个座位");
  });

  it("applies an action and increments the room revision", () => {
    const store = createRoomStore();
    const room = store.createRoom({ token: "a", name: "Alice", seat: 0 });
    const next = store.applyAction({
      roomId: room.roomId,
      token: "a",
      action: { type: "draw", playerId: 0, sources: [{ type: "deck" }] },
    });

    expect(next.revision).toBeGreaterThan(room.revision);
    expect(next.game.currentPlayer).toBe(1);
  });

  it("applies a sapling action without restarting the room game", () => {
    const store = createRoomStore();
    const room = store.createRoom({ token: "a", name: "Alice", seat: 0 });
    const cardUid =
      room.game.players[0].hand.find((uid) => getCardDef(room.game, uid).kind === "dweller") ??
      room.game.players[0].hand[0];
    const next = store.applyAction({
      roomId: room.roomId,
      token: "a",
      action: { type: "play-sapling", playerId: 0, cardUid },
    });

    expect(next.revision).toBeGreaterThan(room.revision);
    expect(next.game.players[0].forest[0].isSapling).toBe(true);
    expect(next.game.currentPlayer).toBe(1);
  });
});
