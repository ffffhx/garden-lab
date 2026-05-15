import {
  compareHands,
  createDeck,
  evaluateBestHand,
  formatCard,
} from "@/lib/texas-holdem/evaluator";
import type {
  Card,
  GamePhase,
  HoldemPlayer,
  HandRank,
  LegalActionSummary,
  NewHoldemGameOptions,
  PlayerAction,
  TexasHoldemGameState,
  WinnerSummary,
} from "@/lib/texas-holdem/types";

const DEFAULT_STARTING_STACK = 1_000;
const DEFAULT_SMALL_BLIND = 10;
const DEFAULT_BIG_BLIND = 20;
const MAX_LOG_ENTRIES = 14;

type SidePot = {
  amount: number;
  eligiblePlayerIds: number[];
};

export function createNewHoldemGame(
  options: NewHoldemGameOptions,
): TexasHoldemGameState {
  if (options.playerNames.length < 2 || options.playerNames.length > 6) {
    throw new Error("Texas Hold'em supports two to six players in this table.");
  }

  const startingStack = options.startingStack ?? DEFAULT_STARTING_STACK;
  const smallBlind = options.smallBlind ?? DEFAULT_SMALL_BLIND;
  const bigBlind = options.bigBlind ?? DEFAULT_BIG_BLIND;
  const seed = options.seed ?? String(Date.now());
  const players = options.playerNames.map((name, index): HoldemPlayer => ({
    id: index,
    name,
    chips: startingStack,
    holeCards: [],
    currentBet: 0,
    committed: 0,
    folded: false,
    allIn: false,
    out: false,
    acted: false,
  }));

  return startHand(
    {
      players,
      deck: [],
      communityCards: [],
      dealerIndex: 0,
      currentPlayer: null,
      phase: "preflop",
      handNumber: 0,
      smallBlind,
      bigBlind,
      highestBet: 0,
      minRaise: bigBlind,
      seed,
      pot: 0,
      winners: [],
      actionLog: [],
    },
    0,
  );
}

export function startNextHand(game: TexasHoldemGameState): TexasHoldemGameState {
  const next = cloneGame(game);
  const nextDealer = findNextSeat(next.players, next.dealerIndex, isPlayerFunded);

  if (nextDealer === null) {
    return {
      ...next,
      currentPlayer: null,
      phase: "game-over",
      actionLog: prependLog(next, "牌局结束。"),
    };
  }

  return startHand(next, nextDealer);
}

export function applyPlayerAction(
  game: TexasHoldemGameState,
  action: PlayerAction,
): TexasHoldemGameState {
  if (!isBettingPhase(game.phase) || game.currentPlayer === null) {
    return game;
  }

  const actorId = game.currentPlayer;
  const next = cloneGame(game);
  const player = next.players[actorId];
  const legal = getLegalActions(next, player.id);
  let logEntry = "";

  if (player.folded || player.allIn || player.out) {
    throw new Error(`${player.name} cannot act right now.`);
  }

  if (action.type === "fold") {
    if (!legal.canFold) {
      throw new Error("This player cannot fold right now.");
    }
    player.folded = true;
    player.acted = true;
    logEntry = `${player.name} 弃牌`;
  }

  if (action.type === "check") {
    if (!legal.canCheck) {
      throw new Error("Cannot check while facing a bet.");
    }
    player.acted = true;
    logEntry = `${player.name} 过牌`;
  }

  if (action.type === "call") {
    if (!legal.canCall) {
      throw new Error("There is no bet to call.");
    }
    const paid = commitChips(player, legal.callAmount);
    player.acted = true;
    logEntry = `${player.name} 跟注 ${paid}`;
  }

  if (action.type === "bet" || action.type === "raise") {
    const targetBet = Math.floor(action.amount);
    const maxTarget = player.currentBet + player.chips;
    const minTarget = next.highestBet === 0 ? legal.minBet : legal.minRaiseTo;
    const isAllInForLess = targetBet === maxTarget && targetBet > next.highestBet;

    if (targetBet > maxTarget) {
      throw new Error("Cannot bet more chips than the player has.");
    }

    if (targetBet <= next.highestBet) {
      throw new Error("Raise target must exceed the current table bet.");
    }

    if (targetBet < minTarget && !isAllInForLess) {
      throw new Error("Bet or raise is below the minimum allowed amount.");
    }

    const previousHighestBet = next.highestBet;
    const paid = commitChips(player, targetBet - player.currentBet);
    const actualRaise = player.currentBet - previousHighestBet;
    next.highestBet = Math.max(next.highestBet, player.currentBet);

    if (actualRaise >= next.minRaise) {
      next.minRaise = actualRaise;
    }

    for (const tablePlayer of next.players) {
      if (
        tablePlayer.id !== player.id &&
        !tablePlayer.folded &&
        !tablePlayer.allIn &&
        !tablePlayer.out
      ) {
        tablePlayer.acted = false;
      }
    }

    player.acted = true;
    logEntry =
      previousHighestBet === 0
        ? `${player.name} 下注 ${paid}`
        : `${player.name} 加注到 ${player.currentBet}`;
  }

  next.pot = getPotSize(next);
  next.actionLog = prependLog(next, logEntry);

  return settleAfterAction(next);
}

export function getLegalActions(
  game: TexasHoldemGameState,
  playerId = game.currentPlayer ?? 0,
): LegalActionSummary {
  const player = game.players[playerId];
  const callAmount = Math.max(0, game.highestBet - player.currentBet);
  const maxRaiseTo = player.currentBet + player.chips;
  const minBet = Math.min(game.bigBlind, maxRaiseTo);
  const minRaiseTo = Math.min(game.highestBet + game.minRaise, maxRaiseTo);
  const canAct =
    isBettingPhase(game.phase) &&
    game.currentPlayer === playerId &&
    !player.folded &&
    !player.allIn &&
    !player.out;

  return {
    callAmount: Math.min(callAmount, player.chips),
    minBet,
    minRaiseTo,
    maxRaiseTo,
    canFold: canAct,
    canCheck: canAct && callAmount === 0,
    canCall: canAct && callAmount > 0 && player.chips > 0,
    canBet: canAct && game.highestBet === 0 && player.chips > 0,
    canRaise: canAct && game.highestBet > 0 && maxRaiseTo > game.highestBet,
  };
}

export function getPotSize(game: TexasHoldemGameState) {
  return game.players.reduce((sum, player) => sum + player.committed, 0);
}

export function getPhaseLabel(phase: GamePhase) {
  const labels: Record<GamePhase, string> = {
    preflop: "翻牌前",
    flop: "翻牌圈",
    turn: "转牌圈",
    river: "河牌圈",
    "hand-complete": "本手结束",
    "game-over": "牌局结束",
  };

  return labels[phase];
}

function startHand(
  game: TexasHoldemGameState,
  dealerIndex: number,
): TexasHoldemGameState {
  const next = cloneGame(game);
  const fundedPlayers = next.players.filter(isPlayerFunded);

  if (fundedPlayers.length < 2) {
    return {
      ...next,
      currentPlayer: null,
      phase: "game-over",
      actionLog: prependLog(next, "只剩一名玩家有筹码，牌局结束。"),
    };
  }

  next.handNumber += 1;
  next.dealerIndex = dealerIndex;
  next.communityCards = [];
  next.deck = shuffleDeck(createDeck(), `${next.seed}:${next.handNumber}`);
  next.phase = "preflop";
  next.currentPlayer = null;
  next.highestBet = 0;
  next.minRaise = next.bigBlind;
  next.pot = 0;
  next.winners = [];
  next.actionLog = [`第 ${next.handNumber} 手开始`];

  for (const player of next.players) {
    player.holeCards = [];
    player.currentBet = 0;
    player.committed = 0;
    player.folded = false;
    player.allIn = false;
    player.out = !isPlayerFunded(player);
    player.acted = false;
    player.lastHand = undefined;
  }

  dealHoleCards(next);
  postBlinds(next);
  next.currentPlayer = getFirstPreflopActor(next);
  next.pot = getPotSize(next);

  if (next.currentPlayer === null) {
    return resolveAllInShowdown(next);
  }

  return next;
}

function postBlinds(game: TexasHoldemGameState) {
  const { smallBlindPlayerId, bigBlindPlayerId } = getBlindSeats(game);
  const smallBlindPlayer = game.players[smallBlindPlayerId];
  const bigBlindPlayer = game.players[bigBlindPlayerId];
  const smallPaid = commitChips(smallBlindPlayer, game.smallBlind);
  const bigPaid = commitChips(bigBlindPlayer, game.bigBlind);

  game.highestBet = Math.max(smallBlindPlayer.currentBet, bigBlindPlayer.currentBet);
  game.actionLog = prependLog(
    {
      ...game,
      actionLog: game.actionLog,
    },
    `${smallBlindPlayer.name} 下小盲 ${smallPaid}，${bigBlindPlayer.name} 下大盲 ${bigPaid}`,
  );
}

function getBlindSeats(game: TexasHoldemGameState) {
  const smallBlindPlayerId =
    activePlayerCount(game.players) === 2
      ? game.dealerIndex
      : requireSeat(findNextSeat(game.players, game.dealerIndex, isPlayerInHand));
  const bigBlindPlayerId = requireSeat(
    findNextSeat(game.players, smallBlindPlayerId, isPlayerInHand),
  );

  return { smallBlindPlayerId, bigBlindPlayerId };
}

function dealHoleCards(game: TexasHoldemGameState) {
  for (let round = 0; round < 2; round += 1) {
    let seat = game.dealerIndex;

    for (let count = 0; count < activePlayerCount(game.players); count += 1) {
      seat = requireSeat(findNextSeat(game.players, seat, isPlayerInHand));
      game.players[seat].holeCards.push(drawCard(game));
    }
  }
}

function settleAfterAction(game: TexasHoldemGameState): TexasHoldemGameState {
  const contenders = game.players.filter((player) => isPlayerInHand(player) && !player.folded);

  if (contenders.length === 1) {
    return awardFoldedPot(game, contenders[0]);
  }

  if (contenders.every((player) => player.allIn)) {
    return resolveAllInShowdown(game);
  }

  if (isBettingRoundComplete(game)) {
    return advanceStreet(game);
  }

  game.currentPlayer = requireSeat(
    findNextSeat(
      game.players,
      game.currentPlayer ?? game.dealerIndex,
      (player) => isPlayerInHand(player) && !player.folded && !player.allIn,
    ),
  );
  return game;
}

function advanceStreet(game: TexasHoldemGameState): TexasHoldemGameState {
  if (game.phase === "river") {
    return resolveShowdown(game);
  }

  const next = cloneGame(game);
  const nextPhase: Record<"preflop" | "flop" | "turn", GamePhase> = {
    preflop: "flop",
    flop: "turn",
    turn: "river",
  };
  const phase = next.phase as "preflop" | "flop" | "turn";
  const cardsToReveal = next.phase === "preflop" ? 3 : 1;

  next.phase = nextPhase[phase];
  next.communityCards.push(...drawCards(next, cardsToReveal));
  resetBettingRound(next);
  next.actionLog = prependLog(next, `${getPhaseLabel(next.phase)}：${formatStreetCards(next)}`);
  next.currentPlayer = findNextSeat(
    next.players,
    next.dealerIndex,
    (player) => isPlayerInHand(player) && !player.folded && !player.allIn,
  );

  if (next.currentPlayer === null) {
    return resolveAllInShowdown(next);
  }

  return next;
}

function resolveAllInShowdown(game: TexasHoldemGameState): TexasHoldemGameState {
  const next = cloneGame(game);

  while (next.communityCards.length < 5) {
    next.communityCards.push(drawCard(next));
  }

  return resolveShowdown(next);
}

function resolveShowdown(game: TexasHoldemGameState): TexasHoldemGameState {
  const next = cloneGame(game);
  const handRanks = new Map<number, ReturnType<typeof evaluateBestHand>>();

  for (const player of next.players) {
    if (isPlayerInHand(player) && !player.folded) {
      const hand = evaluateBestHand([...player.holeCards, ...next.communityCards]);
      player.lastHand = hand;
      handRanks.set(player.id, hand);
    }
  }

  const payouts = new Map<number, WinnerSummary>();
  const sidePots = buildSidePots(next.players);

  for (const sidePot of sidePots) {
    const eligible = sidePot.eligiblePlayerIds
      .map((id) => next.players[id])
      .filter(Boolean);
    const bestHand = eligible
      .map((player) => handRanks.get(player.id))
      .filter((hand): hand is HandRank => Boolean(hand))
      .reduce((best, hand) => (compareHands(hand, best) > 0 ? hand : best));
    const winners = eligible.filter((player) => {
      const hand = handRanks.get(player.id);
      return hand ? compareHands(hand, bestHand) === 0 : false;
    });
    const orderedWinners = sortPlayersFromDealerLeft(next, winners);
    const share = Math.floor(sidePot.amount / orderedWinners.length);
    let remainder = sidePot.amount % orderedWinners.length;

    for (const winner of orderedWinners) {
      const amount = share + (remainder > 0 ? 1 : 0);
      remainder -= remainder > 0 ? 1 : 0;
      winner.chips += amount;

      const current = payouts.get(winner.id);
      const hand = handRanks.get(winner.id);

      payouts.set(winner.id, {
        playerId: winner.id,
        name: winner.name,
        amount: (current?.amount ?? 0) + amount,
        handLabel: hand?.label ?? "获胜",
        cards: hand?.cards ?? [],
      });
    }
  }

  next.pot = getPotSize(next);
  next.winners = [...payouts.values()].sort((left, right) => right.amount - left.amount);
  next.phase = "hand-complete";
  next.currentPlayer = null;
  next.highestBet = 0;
  next.actionLog = prependLog(
    next,
    `摊牌：${next.winners.map((winner) => `${winner.name} +${winner.amount}`).join("，")}`,
  );

  return next;
}

function awardFoldedPot(
  game: TexasHoldemGameState,
  winner: HoldemPlayer,
): TexasHoldemGameState {
  const next = cloneGame(game);
  const tableWinner = next.players[winner.id];
  const amount = getPotSize(next);

  tableWinner.chips += amount;
  next.pot = amount;
  next.winners = [
    {
      playerId: tableWinner.id,
      name: tableWinner.name,
      amount,
      handLabel: "其他玩家弃牌",
      cards: [],
    },
  ];
  next.phase = "hand-complete";
  next.currentPlayer = null;
  next.highestBet = 0;
  next.actionLog = prependLog(next, `${tableWinner.name} 赢得底池 ${amount}`);

  return next;
}

function resetBettingRound(game: TexasHoldemGameState) {
  game.highestBet = 0;
  game.minRaise = game.bigBlind;

  for (const player of game.players) {
    player.currentBet = 0;
    player.acted = player.folded || player.allIn || player.out;
  }
}

function isBettingRoundComplete(game: TexasHoldemGameState) {
  const actors = game.players.filter(
    (player) => isPlayerInHand(player) && !player.folded && !player.allIn,
  );

  if (actors.length === 0) {
    return true;
  }

  return actors.every((player) => player.acted && player.currentBet === game.highestBet);
}

function buildSidePots(players: HoldemPlayer[]): SidePot[] {
  const commitmentLevels = [
    ...new Set(
      players
        .filter((player) => player.committed > 0)
        .map((player) => player.committed)
        .sort((left, right) => left - right),
    ),
  ];
  const sidePots: SidePot[] = [];
  let previousLevel = 0;

  for (const level of commitmentLevels) {
    const contributors = players.filter((player) => player.committed >= level);
    const amount = (level - previousLevel) * contributors.length;
    const eligiblePlayerIds = contributors
      .filter((player) => !player.folded && isPlayerInHand(player))
      .map((player) => player.id);

    if (amount > 0 && eligiblePlayerIds.length > 0) {
      sidePots.push({ amount, eligiblePlayerIds });
    }

    previousLevel = level;
  }

  return sidePots;
}

function getFirstPreflopActor(game: TexasHoldemGameState) {
  const { bigBlindPlayerId } = getBlindSeats(game);
  return findNextSeat(
    game.players,
    bigBlindPlayerId,
    (player) => isPlayerInHand(player) && !player.folded && !player.allIn,
  );
}

function drawCards(game: TexasHoldemGameState, count: number) {
  return Array.from({ length: count }, () => drawCard(game));
}

function drawCard(game: TexasHoldemGameState) {
  const card = game.deck.shift();

  if (!card) {
    throw new Error("The deck is empty.");
  }

  return card;
}

function commitChips(player: HoldemPlayer, amount: number) {
  const paid = Math.min(player.chips, Math.max(0, amount));

  player.chips -= paid;
  player.currentBet += paid;
  player.committed += paid;
  player.allIn = player.chips === 0;

  return paid;
}

function activePlayerCount(players: HoldemPlayer[]) {
  return players.filter(isPlayerInHand).length;
}

function isPlayerFunded(player: HoldemPlayer) {
  return player.chips > 0;
}

function isPlayerInHand(player: HoldemPlayer) {
  return !player.out;
}

function isBettingPhase(phase: GamePhase) {
  return phase === "preflop" || phase === "flop" || phase === "turn" || phase === "river";
}

function findNextSeat(
  players: HoldemPlayer[],
  fromSeat: number,
  predicate: (player: HoldemPlayer) => boolean,
) {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const seat = (fromSeat + offset) % players.length;

    if (predicate(players[seat])) {
      return seat;
    }
  }

  return null;
}

function requireSeat(seat: number | null) {
  if (seat === null) {
    throw new Error("No valid seat is available.");
  }

  return seat;
}

function sortPlayersFromDealerLeft(
  game: TexasHoldemGameState,
  players: HoldemPlayer[],
) {
  return [...players].sort((left, right) => {
    const leftDistance =
      (left.id - game.dealerIndex - 1 + game.players.length) % game.players.length;
    const rightDistance =
      (right.id - game.dealerIndex - 1 + game.players.length) % game.players.length;

    return leftDistance - rightDistance;
  });
}

function shuffleDeck(cards: Card[], seed: string) {
  const random = seededRandom(seed);
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function seededRandom(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return () => {
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function formatStreetCards(game: TexasHoldemGameState) {
  return game.communityCards.map(formatCard).join(" ");
}

function prependLog(game: TexasHoldemGameState, entry: string) {
  return [entry, ...game.actionLog].slice(0, MAX_LOG_ENTRIES);
}

function cloneGame(game: TexasHoldemGameState): TexasHoldemGameState {
  return {
    ...game,
    deck: game.deck.map((card) => ({ ...card })),
    communityCards: game.communityCards.map((card) => ({ ...card })),
    players: game.players.map((player) => ({
      ...player,
      holeCards: player.holeCards.map((card) => ({ ...card })),
      lastHand: player.lastHand
        ? {
            ...player.lastHand,
            cards: player.lastHand.cards.map((card) => ({ ...card })),
            ranks: [...player.lastHand.ranks],
          }
        : undefined,
    })),
    winners: game.winners.map((winner) => ({
      ...winner,
      cards: winner.cards.map((card) => ({ ...card })),
    })),
    actionLog: [...game.actionLog],
  };
}
