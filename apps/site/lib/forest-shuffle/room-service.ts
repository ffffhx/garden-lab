import { randomBytes } from "node:crypto";

import { SAMPLE_CARD_LIBRARY } from "./cards";
import {
  createNewGame,
  drawCards,
  getLibraryFromState,
  playDweller,
  playSapling,
  playTree,
} from "./engine";
import type { PublicSeat, RoomGameAction, RoomSnapshot, ViewerSeat } from "./room";
import type { DeckDefinition, GameState, PlayerId } from "./types";

interface InternalSeat {
  token: string;
  name: string;
  connected: boolean;
  lastSeenAt: number;
}

interface InternalRoom {
  roomId: string;
  revision: number;
  game: GameState;
  seats: [InternalSeat | null, InternalSeat | null];
  createdAt: number;
  updatedAt: number;
}

export interface RoomStore {
  createRoom(input: {
    token: string;
    name: string;
    seat?: PlayerId;
    library?: DeckDefinition[];
  }): RoomSnapshot;
  joinRoom(input: {
    roomId: string;
    token: string;
    name: string;
    seat?: PlayerId;
  }): RoomSnapshot;
  claimSeat(input: {
    roomId: string;
    token: string;
    name: string;
    seat: PlayerId;
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
    seat?: PlayerId;
    library?: DeckDefinition[];
  }): RoomSnapshot {
    const roomId = createRoomId(rooms);
    const now = Date.now();
    const game = createNewGame(input.library ?? SAMPLE_CARD_LIBRARY, {
      seed: `${roomId}-${now}`,
      playerNames: ["玩家一", "玩家二"],
    });
    const room: InternalRoom = {
      roomId,
      revision: 1,
      game,
      seats: [null, null],
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
    seat?: PlayerId;
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
    seat: PlayerId;
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

    if (input.action.type !== "new-game") {
      if (seat === "spectator") {
        throw new Error("旁观者不能操作牌局。");
      }

      if (seat !== input.action.playerId || room.game.currentPlayer !== input.action.playerId) {
        throw new Error("还没轮到这个座位。");
      }
    }

    room.game = applyGameAction(room.game, input.action, room.seats);
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

function applyGameAction(
  game: GameState,
  action: RoomGameAction,
  seats: [InternalSeat | null, InternalSeat | null],
): GameState {
  if (action.type === "draw") {
    return drawCards(game, action.sources);
  }

  if (action.type === "play-tree") {
    return playTree(game, action.cardUid, action.paymentUids);
  }

  if (action.type === "play-sapling") {
    return playSapling(game, action.cardUid);
  }

  if (action.type === "play-dweller") {
    return playDweller(game, {
      cardUid: action.cardUid,
      faceId: action.faceId,
      treeUid: action.treeUid,
      paymentUids: action.paymentUids,
    });
  }

  const playerNames: [string, string] = [
    getSeatName(0),
    getSeatName(1),
  ];

  return createNewGame(action.library ?? getLibraryFromState(game), {
    seed: String(Date.now()),
    playerNames,
  });
}

function assignSeat(
  room: InternalRoom,
  token: string,
  _name: string,
  preferredSeat?: PlayerId,
  explicitClaim = false,
) {
  const currentSeat = getViewerSeat(room, token);

  if (preferredSeat === undefined) {
    if (currentSeat !== "spectator") {
      const seat = room.seats[currentSeat];
      if (seat) {
        seat.name = getSeatName(currentSeat);
        seat.connected = true;
        seat.lastSeenAt = Date.now();
      }
      return;
    }

    const emptySeat = room.seats.findIndex((seat) => !seat) as PlayerId | -1;
    if (emptySeat === 0 || emptySeat === 1) {
      setSeat(room, emptySeat, token);
    }
    return;
  }

  const target = room.seats[preferredSeat];
  const canClaim = !target || target.token === token || (explicitClaim && !target.connected);

  if (!canClaim) {
    if (currentSeat !== "spectator") {
      const seat = room.seats[currentSeat];
      if (seat) {
        seat.connected = true;
        seat.name = getSeatName(currentSeat);
      }
      return;
    }

    throw new Error(`玩家 ${preferredSeat + 1} 已被占用。`);
  }

  releaseToken(room, token);
  setSeat(room, preferredSeat, token);
}

function setSeat(room: InternalRoom, seatId: PlayerId, token: string) {
  room.seats[seatId] = {
    token,
    name: getSeatName(seatId),
    connected: true,
    lastSeenAt: Date.now(),
  };
}

function releaseToken(room: InternalRoom, token: string) {
  for (const seatId of [0, 1] as PlayerId[]) {
    if (room.seats[seatId]?.token === token) {
      room.seats[seatId] = null;
    }
  }
}

function syncPlayerNames(room: InternalRoom) {
  for (const seatId of [0, 1] as PlayerId[]) {
    const seat = room.seats[seatId];
    room.game.players[seatId].name = getSeatName(seatId);
    if (seat) {
      seat.name = getSeatName(seatId);
    }
  }
}

function toSnapshot(room: InternalRoom, token: string): RoomSnapshot {
  const viewerSeat = getViewerSeat(room, token);
  const game = structuredClone(room.game) as GameState;

  for (const seatId of [0, 1] as PlayerId[]) {
    if (viewerSeat !== seatId) {
      game.players[seatId].hand = game.players[seatId].hand.map(
        (_, index) => `hidden-${seatId}-${index}`,
      );
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
    ) as [PublicSeat | null, PublicSeat | null],
    viewerSeat,
    updatedAt: room.updatedAt,
  };
}

function getViewerSeat(room: InternalRoom, token: string): ViewerSeat {
  const index = room.seats.findIndex((seat) => seat?.token === token);
  return index === 0 || index === 1 ? index : "spectator";
}

export function getSeatName(seat: PlayerId): string {
  return seat === 0 ? "玩家一" : "玩家二";
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
