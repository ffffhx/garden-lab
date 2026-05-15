export const CARD_SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export const CARD_RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

export type CardSuit = (typeof CARD_SUITS)[number];
export type CardRank = (typeof CARD_RANKS)[number];

export type Card = {
  id: string;
  suit: CardSuit;
  rank: CardRank;
};

export type HandCategory =
  | "high-card"
  | "pair"
  | "two-pair"
  | "three-of-a-kind"
  | "straight"
  | "flush"
  | "full-house"
  | "four-of-a-kind"
  | "straight-flush";

export type HandRank = {
  category: HandCategory;
  categoryValue: number;
  ranks: number[];
  label: string;
  cards: Card[];
};

export type GamePhase =
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "hand-complete"
  | "game-over";

export type PlayerAction =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "bet"; amount: number }
  | { type: "raise"; amount: number };

export type HoldemPlayer = {
  id: number;
  name: string;
  chips: number;
  holeCards: Card[];
  currentBet: number;
  committed: number;
  folded: boolean;
  allIn: boolean;
  out: boolean;
  acted: boolean;
  lastHand?: HandRank;
};

export type WinnerSummary = {
  playerId: number;
  name: string;
  amount: number;
  handLabel: string;
  cards: Card[];
};

export type TexasHoldemGameState = {
  players: HoldemPlayer[];
  deck: Card[];
  communityCards: Card[];
  dealerIndex: number;
  currentPlayer: number | null;
  phase: GamePhase;
  handNumber: number;
  smallBlind: number;
  bigBlind: number;
  highestBet: number;
  minRaise: number;
  seed: string;
  pot: number;
  winners: WinnerSummary[];
  actionLog: string[];
};

export type NewHoldemGameOptions = {
  playerNames: string[];
  startingStack?: number;
  smallBlind?: number;
  bigBlind?: number;
  seed?: string;
};

export type LegalActionSummary = {
  callAmount: number;
  minBet: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  canBet: boolean;
  canRaise: boolean;
};
