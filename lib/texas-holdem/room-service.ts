import { randomBytes } from "node:crypto";

import {
  applyPlayerAction,
  createNewHoldemGame,
  startNextHand,
} from "@/lib/texas-holdem/engine";
import type { PublicSeat, RoomGameAction, RoomSnapshot, ViewerSeat } from "@/lib/texas-holdem/room";
import type { TexasHoldemGameState } from "@/lib/texas-holdem/types";

interface InternalSeat {
  token: string;
  name: string;
  connected: boolean;
  lastSeenAt: number;
}

interface InternalRoom {
  roomId: string;
  revision: number;
  game: TexasHoldemGameState;
  seats: Array<InternalSeat | null>;
  createdAt: number;
  updatedAt: number;
}

export interface RoomStore {
  createRoom(input: {
    token: string;
    name: string;
    seat?: number;
    playerCount: number;
  }): RoomSnapshot;
  joinRoom(input: {
    roomId: string;
    token: string;
    name: string;
    seat?: number;
  }): RoomSnapshot;
  claimSeat(input: {
    roomId: string;
    token: string;
    name: string;
    seat: number;
  }): RoomSnapshot;
  applyAction(input: {
    roomId: string;
    token: string;
    action: RoomGameAction;
  }): RoomSnapshot;
  disconnect(roomId: string, token: string): RoomSnapshot | null;
  getSnapshot(roomId: string, token?: string): RoomSnapshot | null;
  getRoomCount(): number;
}

export function createRoomStore(): RoomStore {
  const rooms = new Map<string, InternalRoom>();

  function createRoom(input: {
    token: string;
    name: string;
    seat?: number;
    playerCount: number;
  }): RoomSnapshot {
    const roomId = createRoomId(rooms);
    const now = Date.now();
    const playerCount = normalizePlayerCount(input.playerCount);
    const room: InternalRoom = {
      roomId,
      revision: 1,
      game: createRoomGame(roomId, 1, playerCount),
      seats: Array.from({ length: playerCount }, () => null),
      createdAt: now,
      updatedAt: now,
    };

    rooms.set(roomId, room);
    assignSeat(room, input.token, input.name, input.seat ?? 0);
    syncPlayerNames(room);
    touch(room);

    return toSnapshot(room, input.token);
  }

  function joinRoom(input: {
    roomId: string;
    token: string;
    name: string;
    seat?: number;
  }): RoomSnapshot {
    const room = requireRoom(rooms, input.roomId);
    assignSeat(room, input.token, input.name, input.seat);
    syncPlayerNames(room);
    touch(room);
    return toSnapshot(room, input.token);
  }

  function claimSeat(input: {
    roomId: string;
    token: string;
    name: string;
    seat: number;
  }): RoomSnapshot {
    const room = requireRoom(rooms, input.roomId);
    assignSeat(room, input.token, input.name, input.seat, true);
    syncPlayerNames(room);
    touch(room);
    return toSnapshot(room, input.token);
  }

  function applyAction(input: {
    roomId: string;
    token: string;
    action: RoomGameAction;
  }): RoomSnapshot {
    const room = requireRoom(rooms, input.roomId);
    const seat = getViewerSeat(room, input.token);

    if (input.action.type === "player-action") {
      if (seat === "spectator") {
        throw new Error("旁观者不能操作牌局。");
      }

      if (seat !== input.action.playerId || room.game.currentPlayer !== input.action.playerId) {
        throw new Error("还没轮到这个座位。");
      }
    } else if (seat === "spectator") {
      throw new Error("旁观者不能重开牌局。");
    }

    room.game = applyRoomAction(room, input.action);
    room.revision += 1;
    touch(room);
    return toSnapshot(room, input.token);
  }

  function disconnect(roomId: string, token: string): RoomSnapshot | null {
    const room = rooms.get(normalizeRoomId(roomId));

    if (!room) {
      return null;
    }

    for (const seat of room.seats) {
      if (seat?.token === token) {
        seat.connected = false;
        seat.lastSeenAt = Date.now();
      }
    }

    touch(room);
    return toSnapshot(room, token);
  }

  function getSnapshot(roomId: string, token = ""): RoomSnapshot | null {
    const room = rooms.get(normalizeRoomId(roomId));
    return room ? toSnapshot(room, token) : null;
  }

  return {
    createRoom,
    joinRoom,
    claimSeat,
    applyAction,
    disconnect,
    getSnapshot,
    getRoomCount: () => rooms.size,
  };
}

function applyRoomAction(room: InternalRoom, action: RoomGameAction): TexasHoldemGameState {
  if (action.type === "player-action") {
    return applyPlayerAction(room.game, action.action);
  }

  if (action.type === "next-hand") {
    return startNextHand(room.game);
  }

  const playerCount = normalizePlayerCount(action.playerCount);
  room.seats = Array.from({ length: playerCount }, (_, index) => room.seats[index] ?? null);
  const game = createRoomGame(room.roomId, room.revision + 1, playerCount);
  syncPlayerNames({ ...room, game });
  return game;
}

function assignSeat(
  room: InternalRoom,
  token: string,
  name: string,
  preferredSeat?: number,
  explicitClaim = false,
) {
  const currentSeat = getViewerSeat(room, token);

  if (preferredSeat === undefined) {
    if (currentSeat !== "spectator") {
      const seat = room.seats[currentSeat];
      if (seat) {
        seat.name = name.trim() || getSeatName(currentSeat);
        seat.connected = true;
        seat.lastSeenAt = Date.now();
      }
      return;
    }

    const emptySeat = room.seats.findIndex((seat) => !seat);
    if (emptySeat >= 0) {
      setSeat(room, emptySeat, token, name);
    }
    return;
  }

  assertSeat(room, preferredSeat);
  const target = room.seats[preferredSeat];
  const canClaim = !target || target.token === token || (explicitClaim && !target.connected);

  if (!canClaim) {
    if (currentSeat !== "spectator") {
      const seat = room.seats[currentSeat];
      if (seat) {
        seat.connected = true;
        seat.name = name.trim() || getSeatName(currentSeat);
      }
      return;
    }

    throw new Error(`${getSeatName(preferredSeat)} 已被占用。`);
  }

  releaseToken(room, token);
  setSeat(room, preferredSeat, token, name);
}

function setSeat(room: InternalRoom, seatId: number, token: string, name: string) {
  room.seats[seatId] = {
    token,
    name: name.trim() || getSeatName(seatId),
    connected: true,
    lastSeenAt: Date.now(),
  };
}

function releaseToken(room: InternalRoom, token: string) {
  for (let seatId = 0; seatId < room.seats.length; seatId += 1) {
    if (room.seats[seatId]?.token === token) {
      room.seats[seatId] = null;
    }
  }
}

function syncPlayerNames(room: InternalRoom) {
  for (let seatId = 0; seatId < room.seats.length; seatId += 1) {
    const seat = room.seats[seatId];
    const name = seat?.name || getSeatName(seatId);

    room.game.players[seatId].name = name;
  }
}

function toSnapshot(room: InternalRoom, token: string): RoomSnapshot {
  const viewerSeat = getViewerSeat(room, token);
  const game = structuredClone(room.game) as TexasHoldemGameState;
  const revealAll = game.phase === "hand-complete" || game.phase === "game-over";

  for (const player of game.players) {
    if (!revealAll && viewerSeat !== player.id) {
      player.holeCards = player.holeCards.map((_, index) => ({
        id: `hidden-${player.id}-${index}`,
        rank: 2,
        suit: "clubs",
      }));
    }
  }

  return {
    roomId: room.roomId,
    revision: room.revision,
    game,
    seats: room.seats.map((seat) =>
      seat
        ? ({
            name: seat.name,
            connected: seat.connected,
            mine: seat.token === token,
          } satisfies PublicSeat)
        : null,
    ),
    viewerSeat,
    updatedAt: room.updatedAt,
  };
}

function getViewerSeat(room: InternalRoom, token: string): ViewerSeat {
  const index = room.seats.findIndex((seat) => seat?.token === token);
  return index >= 0 ? index : "spectator";
}

export function getSeatName(seat: number): string {
  return `玩家 ${seat + 1}`;
}

function createRoomGame(roomId: string, revision: number, playerCount: number) {
  return createNewHoldemGame({
    playerNames: Array.from({ length: playerCount }, (_, index) => getSeatName(index)),
    seed: `${roomId}-${revision}-${Date.now()}`,
  });
}

function normalizePlayerCount(playerCount: number) {
  const normalized = Math.floor(playerCount);

  if (normalized < 2 || normalized > 6) {
    throw new Error("德州房间支持 2 到 6 人。");
  }

  return normalized;
}

function assertSeat(room: InternalRoom, seat: number) {
  if (!Number.isInteger(seat) || seat < 0 || seat >= room.seats.length) {
    throw new Error("座位不存在。");
  }
}

function touch(room: InternalRoom) {
  room.updatedAt = Date.now();
}

function requireRoom(rooms: Map<string, InternalRoom>, roomId: string): InternalRoom {
  const room = rooms.get(normalizeRoomId(roomId));

  if (!room) {
    throw new Error("房间不存在。");
  }

  return room;
}

function normalizeRoomId(roomId: string) {
  return roomId.trim().toUpperCase();
}

function createRoomId(rooms: Map<string, InternalRoom>): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const roomId = randomBytes(3).toString("hex").toUpperCase();

    if (!rooms.has(roomId)) {
      return roomId;
    }
  }

  throw new Error("无法创建房间号。");
}
