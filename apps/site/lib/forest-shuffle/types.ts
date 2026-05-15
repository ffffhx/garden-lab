export type PlayerId = 0 | 1;

export type CardKind = "tree" | "dweller" | "winter";

export type Side = "top" | "right" | "bottom" | "left";

export type DrawSource =
  | { type: "deck" }
  | { type: "clearing"; uid: string };

export type ScoreRule =
  | { type: "per-tree"; points: number; species?: string; label?: string }
  | { type: "per-tag"; points: number; tag: string; label?: string }
  | { type: "per-pair"; points: number; tag: string; label?: string }
  | { type: "per-position"; points: number; side: Side; label?: string }
  | { type: "per-side"; points: number; label?: string }
  | { type: "per-cave"; points: number; label?: string }
  | { type: "per-distinct-tree-species"; points: number; label?: string };

export type PlayEffect =
  | { type: "draw-deck"; count: number; label?: string }
  | { type: "tuck-clearing"; count: number; label?: string };

export interface CardBase {
  id: string;
  title: string;
  copies?: number;
}

export interface TreeCardDefinition extends CardBase {
  kind: "tree";
  species: string;
  cost: number;
  basePoints: number;
  slots?: Side[];
  scoreRules?: ScoreRule[];
  onPlay?: PlayEffect[];
}

export interface DwellerFace {
  id: string;
  title: string;
  side: Side;
  cost: number;
  tags: string[];
  basePoints: number;
  scoreRules?: ScoreRule[];
  onPlay?: PlayEffect[];
}

export interface DwellerCardDefinition extends CardBase {
  kind: "dweller";
  faces: [DwellerFace, DwellerFace];
}

export interface WinterCardDefinition extends CardBase {
  kind: "winter";
}

export type CardDefinition =
  | TreeCardDefinition
  | DwellerCardDefinition
  | WinterCardDefinition;

export type DeckDefinition = TreeCardDefinition | DwellerCardDefinition;

export interface CardInstance {
  uid: string;
  defId: string;
}

export interface PlayedDweller {
  uid: string;
  defId: string;
  faceId: string;
}

export interface PlayedTree {
  uid: string;
  defId: string;
  isSapling?: boolean;
  attached: Partial<Record<Side, PlayedDweller>>;
}

export interface PlayerState {
  name: string;
  hand: string[];
  forest: PlayedTree[];
  cave: string[];
}

export interface GameState {
  seed: string;
  cardDefs: Record<string, CardDefinition>;
  instances: Record<string, CardInstance>;
  deck: string[];
  clearing: string[];
  revealedWinter: string[];
  discardPile: string[];
  players: [PlayerState, PlayerState];
  currentPlayer: PlayerId;
  winterCount: number;
  turn: number;
  status: "playing" | "finished";
  winner?: PlayerId | "tie";
  log: string[];
}

export interface ScoreLine {
  source: string;
  points: number;
}

export interface PlayerScore {
  player: PlayerId;
  total: number;
  lines: ScoreLine[];
}
