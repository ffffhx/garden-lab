import {
  CARD_RANKS,
  CARD_SUITS,
  type Card,
  type CardRank,
  type CardSuit,
  type HandCategory,
  type HandRank,
} from "@/lib/texas-holdem/types";

const CATEGORY_VALUES: Record<HandCategory, number> = {
  "high-card": 0,
  pair: 1,
  "two-pair": 2,
  "three-of-a-kind": 3,
  straight: 4,
  flush: 5,
  "full-house": 6,
  "four-of-a-kind": 7,
  "straight-flush": 8,
};

const CATEGORY_LABELS: Record<HandCategory, string> = {
  "high-card": "高牌",
  pair: "一对",
  "two-pair": "两对",
  "three-of-a-kind": "三条",
  straight: "顺子",
  flush: "同花",
  "full-house": "葫芦",
  "four-of-a-kind": "四条",
  "straight-flush": "同花顺",
};

const RANK_LABELS: Record<number, string> = {
  14: "A",
  13: "K",
  12: "Q",
  11: "J",
  10: "10",
  9: "9",
  8: "8",
  7: "7",
  6: "6",
  5: "5",
  4: "4",
  3: "3",
  2: "2",
};

const SUIT_SYMBOLS: Record<CardSuit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

export function createDeck(): Card[] {
  return CARD_SUITS.flatMap((suit) =>
    CARD_RANKS.map((rank) => ({
      id: `${rank}-${suit}`,
      suit,
      rank,
    })),
  );
}

export function rankLabel(rank: number) {
  return RANK_LABELS[rank] ?? String(rank);
}

export function suitSymbol(suit: CardSuit) {
  return SUIT_SYMBOLS[suit];
}

export function formatCard(card: Card) {
  return `${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
}

export function compareHands(left: HandRank, right: HandRank) {
  if (left.categoryValue !== right.categoryValue) {
    return left.categoryValue - right.categoryValue;
  }

  const length = Math.max(left.ranks.length, right.ranks.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left.ranks[index] ?? 0) - (right.ranks[index] ?? 0);

    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

export function evaluateBestHand(cards: Card[]): HandRank {
  if (cards.length < 5) {
    throw new Error("At least five cards are required to evaluate a poker hand.");
  }

  const combinations = getFiveCardCombinations(cards);
  return combinations
    .map((combination) => evaluateFiveCardHand(combination))
    .reduce((best, candidate) => (compareHands(candidate, best) > 0 ? candidate : best));
}

function evaluateFiveCardHand(cards: Card[]): HandRank {
  const sortedRanks = cards.map((card) => card.rank).sort((a, b) => b - a);
  const counts = countRanks(sortedRanks);
  const groups = [...counts.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((left, right) => right.count - left.count || right.rank - left.rank);
  const isFlush = cards.every((card) => card.suit === cards[0].suit);
  const straightHigh = getStraightHigh(sortedRanks);

  if (isFlush && straightHigh) {
    return makeHand(
      "straight-flush",
      straightHigh === 14 ? "皇家同花顺" : CATEGORY_LABELS["straight-flush"],
      [straightHigh],
      cards,
    );
  }

  if (groups[0].count === 4) {
    return makeHand(
      "four-of-a-kind",
      CATEGORY_LABELS["four-of-a-kind"],
      [groups[0].rank, groups[1].rank],
      cards,
    );
  }

  if (groups[0].count === 3 && groups[1].count === 2) {
    return makeHand(
      "full-house",
      CATEGORY_LABELS["full-house"],
      [groups[0].rank, groups[1].rank],
      cards,
    );
  }

  if (isFlush) {
    return makeHand("flush", CATEGORY_LABELS.flush, sortedRanks, cards);
  }

  if (straightHigh) {
    return makeHand("straight", CATEGORY_LABELS.straight, [straightHigh], cards);
  }

  if (groups[0].count === 3) {
    const kickers = groups
      .filter((group) => group.count === 1)
      .map((group) => group.rank)
      .sort((a, b) => b - a);
    return makeHand(
      "three-of-a-kind",
      CATEGORY_LABELS["three-of-a-kind"],
      [groups[0].rank, ...kickers],
      cards,
    );
  }

  if (groups[0].count === 2 && groups[1].count === 2) {
    const pairs = groups
      .filter((group) => group.count === 2)
      .map((group) => group.rank)
      .sort((a, b) => b - a);
    const kicker = groups.find((group) => group.count === 1)?.rank ?? 0;
    return makeHand("two-pair", CATEGORY_LABELS["two-pair"], [...pairs, kicker], cards);
  }

  if (groups[0].count === 2) {
    const kickers = groups
      .filter((group) => group.count === 1)
      .map((group) => group.rank)
      .sort((a, b) => b - a);
    return makeHand("pair", CATEGORY_LABELS.pair, [groups[0].rank, ...kickers], cards);
  }

  return makeHand("high-card", CATEGORY_LABELS["high-card"], sortedRanks, cards);
}

function makeHand(
  category: HandCategory,
  label: string,
  ranks: number[],
  cards: Card[],
): HandRank {
  return {
    category,
    categoryValue: CATEGORY_VALUES[category],
    ranks,
    label,
    cards: sortCards(cards),
  };
}

function countRanks(ranks: number[]) {
  const counts = new Map<number, number>();

  for (const rank of ranks) {
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }

  return counts;
}

function getStraightHigh(ranks: number[]) {
  const unique = [...new Set(ranks)].sort((a, b) => b - a);

  if (unique.length !== 5) {
    return null;
  }

  if (unique[0] - unique[4] === 4) {
    return unique[0];
  }

  if (unique.join(",") === "14,5,4,3,2") {
    return 5;
  }

  return null;
}

function getFiveCardCombinations(cards: Card[]) {
  const combinations: Card[][] = [];

  for (let first = 0; first < cards.length - 4; first += 1) {
    for (let second = first + 1; second < cards.length - 3; second += 1) {
      for (let third = second + 1; third < cards.length - 2; third += 1) {
        for (let fourth = third + 1; fourth < cards.length - 1; fourth += 1) {
          for (let fifth = fourth + 1; fifth < cards.length; fifth += 1) {
            combinations.push([
              cards[first],
              cards[second],
              cards[third],
              cards[fourth],
              cards[fifth],
            ]);
          }
        }
      }
    }
  }

  return combinations;
}

function sortCards(cards: Card[]) {
  return [...cards].sort((left, right) => right.rank - left.rank);
}
