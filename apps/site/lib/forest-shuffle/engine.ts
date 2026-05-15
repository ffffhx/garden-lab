import type {
  CardDefinition,
  CardInstance,
  DeckDefinition,
  DrawSource,
  DwellerCardDefinition,
  DwellerFace,
  GameState,
  PlayerId,
  PlayerScore,
  PlayerState,
  PlayedDweller,
  PlayedTree,
  PlayEffect,
  ScoreLine,
  ScoreRule,
  Side,
  TreeCardDefinition,
} from "./types";

const WINTER_CARD: CardDefinition = {
  id: "winter",
  kind: "winter",
  title: "冬季",
};

const DEFAULT_SLOTS: Side[] = ["top", "right", "bottom", "left"];
const DEFAULT_TREE_COST = 2;
const HAND_LIMIT = 10;

export function createNewGame(
  library: DeckDefinition[],
  options: { seed?: string; playerNames?: [string, string] } = {},
): GameState {
  const seed = options.seed ?? String(Date.now());
  const random = createRandom(seed);
  const cardDefs: Record<string, CardDefinition> = { [WINTER_CARD.id]: WINTER_CARD };
  const instances: Record<string, CardInstance> = {};
  const deck: string[] = [];

  for (const definition of library) {
    cardDefs[definition.id] = definition;
    const copies = definition.copies ?? 1;

    for (let copy = 1; copy <= copies; copy += 1) {
      const uid = `${definition.id}#${copy}`;
      instances[uid] = { uid, defId: definition.id };
      deck.push(uid);
    }
  }

  shuffle(deck, random);

  const winterUids = Array.from({ length: 3 }, (_, index) => {
    const uid = `winter#${index + 1}`;
    instances[uid] = { uid, defId: WINTER_CARD.id };
    return uid;
  });

  const winterStart = Math.ceil(deck.length * 0.66);
  const earlyDeck = deck.slice(0, winterStart);
  const lateDeck = deck.slice(winterStart);
  const lateWithWinter = [winterUids[1], winterUids[2], ...lateDeck];
  shuffle(lateWithWinter, random);
  const preparedDeck = [...earlyDeck, winterUids[0], ...lateWithWinter];

  const players: [PlayerState, PlayerState] = [
    { name: options.playerNames?.[0] ?? "玩家一", hand: [], forest: [], cave: [] },
    { name: options.playerNames?.[1] ?? "玩家二", hand: [], forest: [], cave: [] },
  ];

  const state: GameState = {
    seed,
    cardDefs,
    instances,
    deck: preparedDeck,
    clearing: [],
    revealedWinter: [],
    discardPile: [],
    players,
    currentPlayer: 0,
    winterCount: 0,
    turn: 1,
    status: "playing",
    log: [`新牌局开始，种子 ${seed}。`],
  };

  for (let round = 0; round < 6; round += 1) {
    drawFromDeckIntoHand(state, 0);
    drawFromDeckIntoHand(state, 1);
  }

  return state;
}

export function getCardDef(state: GameState, uid: string): CardDefinition {
  const instance = state.instances[uid];
  const definition = instance ? state.cardDefs[instance.defId] : undefined;

  if (!definition) {
    throw new Error(`Unknown card instance: ${uid}`);
  }

  return definition;
}

export function getDwellerFace(
  definition: DwellerCardDefinition,
  faceId: string,
): DwellerFace {
  const face = definition.faces.find((item) => item.id === faceId);

  if (!face) {
    throw new Error(`Unknown dweller face: ${faceId}`);
  }

  return face;
}

export function getVisibleFace(state: GameState, dweller: PlayedDweller): DwellerFace {
  const definition = state.cardDefs[dweller.defId];

  if (!definition || definition.kind !== "dweller") {
    throw new Error(`Card is not a dweller: ${dweller.defId}`);
  }

  return getDwellerFace(definition, dweller.faceId);
}

export function getMaxDrawCount(state: GameState, playerId = state.currentPlayer): number {
  return Math.max(0, Math.min(2, HAND_LIMIT - state.players[playerId].hand.length));
}

export function drawCards(state: GameState, sources: DrawSource[]): GameState {
  const next = cloneGame(state);

  if (next.status !== "playing") {
    return next;
  }

  const player = next.players[next.currentPlayer];
  const maxDrawCount = getMaxDrawCount(next);
  const cleanSources = sources.slice(0, maxDrawCount);

  if (cleanSources.length === 0) {
    next.log.unshift(`${player.name} 手牌已满，无法抽牌。`);
    return next;
  }

  let drawn = 0;

  for (const source of cleanSources) {
    if (next.status !== "playing") {
      break;
    }

    if (source.type === "deck") {
      drawn += drawFromDeckIntoHand(next, next.currentPlayer) ? 1 : 0;
      continue;
    }

    const clearingIndex = next.clearing.indexOf(source.uid);
    if (clearingIndex >= 0) {
      next.clearing.splice(clearingIndex, 1);
      player.hand.push(source.uid);
      drawn += 1;
    }
  }

  if (drawn > 0 && next.status === "playing") {
    next.log.unshift(`${player.name} 抽取 ${drawn} 张牌。`);
    completeTurn(next);
  }

  return finishIfDeckEmpty(next);
}

export function playTree(
  state: GameState,
  cardUid: string,
  paymentUids: string[] = [],
): GameState {
  const next = cloneGame(state);

  if (next.status !== "playing") {
    return next;
  }

  const player = next.players[next.currentPlayer];
  const handIndex = player.hand.indexOf(cardUid);
  const definition = getCardDef(next, cardUid);

  if (handIndex < 0 || definition.kind !== "tree") {
    return next;
  }

  const cost = getTreeCost(definition);
  const uniquePayments = getUniquePayments(player, cardUid, paymentUids);

  if (uniquePayments.length !== cost) {
    return next;
  }

  player.hand = player.hand.filter(
    (uid) => uid !== cardUid && !uniquePayments.includes(uid),
  );
  next.clearing.push(...uniquePayments);
  player.forest.push({
    uid: cardUid,
    defId: definition.id,
    attached: {},
  });

  next.log.unshift(`${player.name} 支付 ${cost} 张牌，种下 ${definition.title}。`);
  drawFromDeckToClearing(next);

  if (next.status === "playing") {
    resolvePlayEffects(next, next.currentPlayer, definition.onPlay ?? []);
  }

  if (next.status === "playing") {
    completeTurn(next);
  }

  return finishIfDeckEmpty(next);
}

export function playSapling(state: GameState, cardUid: string): GameState {
  const next = cloneGame(state);

  if (next.status !== "playing") {
    return next;
  }

  const player = next.players[next.currentPlayer];
  const handIndex = player.hand.indexOf(cardUid);
  const definition = getCardDef(next, cardUid);

  if (handIndex < 0 || definition.kind === "winter") {
    return next;
  }

  player.hand.splice(handIndex, 1);
  player.forest.push({
    uid: cardUid,
    defId: definition.id,
    isSapling: true,
    attached: {},
  });

  next.log.unshift(`${player.name} 将一张手牌倒扣为树苗。`);
  drawFromDeckToClearing(next);

  if (next.status === "playing") {
    completeTurn(next);
  }

  return finishIfDeckEmpty(next);
}

export function playDweller(
  state: GameState,
  options: {
    cardUid: string;
    faceId: string;
    treeUid: string;
    paymentUids: string[];
  },
): GameState {
  const next = cloneGame(state);

  if (next.status !== "playing") {
    return next;
  }

  const player = next.players[next.currentPlayer];
  const handIndex = player.hand.indexOf(options.cardUid);
  const definition = getCardDef(next, options.cardUid);

  if (handIndex < 0 || definition.kind !== "dweller") {
    return next;
  }

  const face = getDwellerFace(definition, options.faceId);
  const targetTree = player.forest.find((tree) => tree.uid === options.treeUid);

  if (
    !targetTree ||
    !getPlayedTreeSlots(next, targetTree).includes(face.side) ||
    targetTree.attached[face.side]
  ) {
    return next;
  }

  const uniquePayments = getUniquePayments(player, options.cardUid, options.paymentUids);

  if (uniquePayments.length !== face.cost) {
    return next;
  }

  player.hand = player.hand.filter(
    (uid) => uid !== options.cardUid && !uniquePayments.includes(uid),
  );
  next.clearing.push(...uniquePayments);
  targetTree.attached[face.side] = {
    uid: options.cardUid,
    defId: definition.id,
    faceId: face.id,
  };

  next.log.unshift(`${player.name} 将 ${face.title} 放到树的${sideLabel(face.side)}。`);
  resolvePlayEffects(next, next.currentPlayer, face.onPlay ?? []);

  if (next.status === "playing") {
    completeTurn(next);
  }

  return finishIfDeckEmpty(next);
}

export function resetWinner(state: GameState): GameState {
  const next = cloneGame(state);
  next.status = "playing";
  next.winner = undefined;
  return next;
}

export function scoreGame(state: GameState): [PlayerScore, PlayerScore] {
  return [scorePlayer(state, 0), scorePlayer(state, 1)];
}

export function scorePlayer(state: GameState, playerId: PlayerId): PlayerScore {
  const player = state.players[playerId];
  const lines: ScoreLine[] = [];

  for (const tree of player.forest) {
    const definition = state.cardDefs[tree.defId];

    if (!tree.isSapling && definition?.kind === "tree") {
      addLine(lines, definition.title, definition.basePoints);
      for (const rule of definition.scoreRules ?? []) {
        addRuleLine(lines, state, playerId, rule, definition.title, tree);
      }
    }

    for (const dweller of Object.values(tree.attached)) {
      if (!dweller) {
        continue;
      }

      const face = getVisibleFace(state, dweller);
      addLine(lines, face.title, face.basePoints);
      for (const rule of face.scoreRules ?? []) {
        addRuleLine(lines, state, playerId, rule, face.title, tree, face);
      }
    }
  }

  if (player.cave.length > 0) {
    addLine(lines, "洞穴藏牌", player.cave.length);
  }

  return {
    player: playerId,
    total: lines.reduce((sum, line) => sum + line.points, 0),
    lines,
  };
}

export function getLibraryFromState(state: GameState): DeckDefinition[] {
  return Object.values(state.cardDefs).filter(
    (definition): definition is DeckDefinition => definition.kind !== "winter",
  );
}

export function sideLabel(side: Side): string {
  return {
    top: "上方",
    right: "右侧",
    bottom: "下方",
    left: "左侧",
  }[side];
}

export function getTreeSlots(tree: TreeCardDefinition): Side[] {
  return tree.slots ?? DEFAULT_SLOTS;
}

export function getPlayedTreeSlots(state: GameState, tree: PlayedTree): Side[] {
  if (tree.isSapling) {
    return DEFAULT_SLOTS;
  }

  const definition = state.cardDefs[tree.defId];
  return definition?.kind === "tree" ? getTreeSlots(definition) : DEFAULT_SLOTS;
}

export function getTreeCost(tree: TreeCardDefinition): number {
  return tree.cost ?? DEFAULT_TREE_COST;
}

function getUniquePayments(
  player: PlayerState,
  playedCardUid: string,
  paymentUids: string[],
): string[] {
  return Array.from(new Set(paymentUids)).filter(
    (uid) => uid !== playedCardUid && player.hand.includes(uid),
  );
}

function resolvePlayEffects(
  state: GameState,
  playerId: PlayerId,
  effects: PlayEffect[],
) {
  const player = state.players[playerId];

  for (const effect of effects) {
    if (state.status !== "playing") {
      break;
    }

    if (effect.type === "draw-deck") {
      let count = 0;
      for (let index = 0; index < effect.count; index += 1) {
        count += drawFromDeckIntoHand(state, playerId) ? 1 : 0;
      }
      if (count > 0) {
        state.log.unshift(`${player.name} 触发效果，抽取 ${count} 张牌。`);
      }
    }

    if (effect.type === "tuck-clearing") {
      const tucked = state.clearing.splice(0, effect.count);
      if (tucked.length > 0) {
        player.cave.push(...tucked);
        state.log.unshift(`${player.name} 将 ${tucked.length} 张空地牌藏入洞穴。`);
      }
    }
  }
}

function drawFromDeckIntoHand(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const player = state.players[playerId];

  if (player.hand.length >= HAND_LIMIT) {
    return false;
  }

  while (state.status === "playing" && player.hand.length < HAND_LIMIT) {
    const uid = state.deck.shift();

    if (!uid) {
      state.status = "finished";
      settleWinner(state);
      state.log.unshift("牌堆耗尽，游戏结束。");
      return false;
    }

    const definition = getCardDef(state, uid);

    if (definition.kind === "winter") {
      revealWinterCard(state, uid);
      continue;
    }

    player.hand.push(uid);
    return true;
  }

  return false;
}

function drawFromDeckToClearing(state: GameState): boolean {
  while (state.status === "playing") {
    const uid = state.deck.shift();

    if (!uid) {
      state.status = "finished";
      settleWinner(state);
      state.log.unshift("牌堆耗尽，游戏结束。");
      return false;
    }

    const definition = getCardDef(state, uid);

    if (definition.kind === "winter") {
      revealWinterCard(state, uid);
      continue;
    }

    state.clearing.push(uid);
    state.log.unshift(`翻开 ${definition.title} 到空地。`);
    return true;
  }

  return false;
}

function revealWinterCard(state: GameState, uid: string) {
  ensureGameCollections(state);
  state.revealedWinter.push(uid);
  state.winterCount += 1;
  state.log.unshift(`第 ${state.winterCount} 张冬季牌出现。`);

  if (state.winterCount >= 3) {
    state.status = "finished";
    settleWinner(state);
    state.log.unshift("第三张冬季牌出现，游戏立即结束。");
  }
}

function finishIfDeckEmpty(state: GameState): GameState {
  if (state.status === "playing" && state.deck.length === 0) {
    state.status = "finished";
    settleWinner(state);
    state.log.unshift("牌堆耗尽，游戏结束。");
  }

  return state;
}

function passTurn(state: GameState) {
  state.currentPlayer = state.currentPlayer === 0 ? 1 : 0;
  state.turn += 1;
}

function completeTurn(state: GameState) {
  clearCrowdedClearing(state);

  if (state.status === "playing") {
    passTurn(state);
  }
}

function clearCrowdedClearing(state: GameState) {
  ensureGameCollections(state);

  if (state.clearing.length < 10) {
    return;
  }

  const removed = state.clearing.splice(0);
  state.discardPile.push(...removed);
  state.log.unshift(`空地达到 ${removed.length} 张，全部清走。`);
}

function settleWinner(state: GameState) {
  const [first, second] = scoreGame(state);

  if (first.total === second.total) {
    state.winner = "tie";
  } else {
    state.winner = first.total > second.total ? 0 : 1;
  }
}

function addRuleLine(
  lines: ScoreLine[],
  state: GameState,
  playerId: PlayerId,
  rule: ScoreRule,
  source: string,
  currentTree?: PlayedTree,
  currentFace?: DwellerFace,
) {
  const points = evaluateRule(state, playerId, rule, currentTree, currentFace);
  addLine(lines, `${source} - ${rule.label ?? rule.type}`, points);
}

function addLine(lines: ScoreLine[], source: string, points: number) {
  if (points !== 0) {
    lines.push({ source, points });
  }
}

function evaluateRule(
  state: GameState,
  playerId: PlayerId,
  rule: ScoreRule,
  currentTree?: PlayedTree,
  currentFace?: DwellerFace,
): number {
  const player = state.players[playerId];
  const visibleFaces = getAllVisibleFaces(state, playerId);

  if (rule.type === "per-tree") {
    const count = rule.species
      ? player.forest.filter((tree) => {
          const definition = state.cardDefs[tree.defId];
          return !tree.isSapling && definition?.kind === "tree" && definition.species === rule.species;
        }).length
      : player.forest.filter((tree) => !tree.isSapling).length;
    return count * rule.points;
  }

  if (rule.type === "per-tag") {
    return visibleFaces.filter((face) => face.tags.includes(rule.tag)).length * rule.points;
  }

  if (rule.type === "per-pair") {
    return Math.floor(
      visibleFaces.filter((face) => face.tags.includes(rule.tag)).length / 2,
    ) * rule.points;
  }

  if (rule.type === "per-side") {
    return Object.values(currentTree?.attached ?? {}).filter(Boolean).length * rule.points;
  }

  if (rule.type === "per-position") {
    return currentFace?.side === rule.side ? rule.points : 0;
  }

  if (rule.type === "per-cave") {
    return player.cave.length * rule.points;
  }

  if (rule.type === "per-distinct-tree-species") {
    const species = new Set(
      player.forest.flatMap((tree) => {
        const definition = state.cardDefs[tree.defId];
        return !tree.isSapling && definition?.kind === "tree" ? [definition.species] : [];
      }),
    );
    return species.size * rule.points;
  }

  return 0;
}

function getAllVisibleFaces(state: GameState, playerId: PlayerId): DwellerFace[] {
  return state.players[playerId].forest.flatMap((tree) =>
    Object.values(tree.attached).flatMap((dweller) =>
      dweller ? [getVisibleFace(state, dweller)] : [],
    ),
  );
}

function cloneGame(state: GameState): GameState {
  return ensureGameCollections(structuredClone(state) as GameState);
}

function ensureGameCollections(state: GameState): GameState {
  const mutable = state as GameState & {
    revealedWinter?: string[];
    discardPile?: string[];
  };

  mutable.revealedWinter ??= [];
  mutable.discardPile ??= [];
  mutable.clearing ??= [];
  return mutable as GameState;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }

  return items;
}

function createRandom(seed: string): () => number {
  let value = hashSeed(seed);

  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
