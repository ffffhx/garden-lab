import type { DeckDefinition, DrawSource, GameState, PlayerId } from "./types";

export type ViewerSeat = PlayerId | "spectator";

export interface PublicSeat {
  name: string;
  connected: boolean;
  mine: boolean;
}

export interface RoomSnapshot {
  roomId: string;
  revision: number;
  game: GameState;
  seats: [PublicSeat | null, PublicSeat | null];
  viewerSeat: ViewerSeat;
  updatedAt: number;
}

export type RoomGameAction =
  | { type: "draw"; playerId: PlayerId; sources: DrawSource[] }
  | { type: "play-tree"; playerId: PlayerId; cardUid: string; paymentUids: string[] }
  | { type: "play-sapling"; playerId: PlayerId; cardUid: string }
  | {
      type: "play-dweller";
      playerId: PlayerId;
      cardUid: string;
      faceId: string;
      treeUid: string;
      paymentUids: string[];
    }
  | { type: "new-game"; library?: DeckDefinition[] };

export type RoomClientMessage =
  | {
      type: "create-room";
      token: string;
      name: string;
      seat?: PlayerId;
      library?: DeckDefinition[];
    }
  | {
      type: "join-room";
      token: string;
      roomId: string;
      name: string;
      seat?: PlayerId;
    }
  | {
      type: "claim-seat";
      token: string;
      roomId: string;
      name: string;
      seat: PlayerId;
    }
  | {
      type: "action";
      token: string;
      roomId: string;
      action: RoomGameAction;
    }
  | { type: "ping"; token?: string };

export type RoomServerMessage =
  | { type: "hello"; serverTime: number }
  | { type: "snapshot"; snapshot: RoomSnapshot }
  | { type: "notice"; message: string }
  | { type: "error"; message: string }
  | { type: "pong"; serverTime: number };
