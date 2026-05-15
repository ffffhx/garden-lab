import type { PlayerAction, TexasHoldemGameState } from "@/lib/texas-holdem/types";

export type ViewerSeat = number | "spectator";

export interface PublicSeat {
  name: string;
  connected: boolean;
  mine: boolean;
}

export interface RoomSnapshot {
  roomId: string;
  revision: number;
  game: TexasHoldemGameState;
  seats: Array<PublicSeat | null>;
  viewerSeat: ViewerSeat;
  updatedAt: number;
}

export type RoomGameAction =
  | { type: "player-action"; playerId: number; action: PlayerAction }
  | { type: "next-hand" }
  | { type: "new-game"; playerCount: number };

export type RoomClientMessage =
  | {
      type: "create-room";
      token: string;
      name: string;
      seat?: number;
      playerCount: number;
    }
  | {
      type: "join-room";
      token: string;
      roomId: string;
      name: string;
      seat?: number;
    }
  | {
      type: "claim-seat";
      token: string;
      roomId: string;
      name: string;
      seat: number;
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
