export const KING_DECK_CODES = [
  "AS",
  "KS",
  "QS",
  "JS",
  "0S",
  "9S",
  "8S",
  "7S",
  "AD",
  "KD",
  "QD",
  "JD",
  "0D",
  "9D",
  "8D",
  "7D",
  "AC",
  "KC",
  "QC",
  "JC",
  "0C",
  "9C",
  "8C",
  "7C",
  "AH",
  "KH",
  "QH",
  "JH",
  "0H",
  "9H",
  "8H",
  "7H",
];

export const SUITS = [
  { id: "S", label: "♠", nameEn: "Spades", nameGe: "ყვავი" },
  { id: "H", label: "♥", nameEn: "Hearts", nameGe: "გული" },
  { id: "D", label: "♦", nameEn: "Diamonds", nameGe: "აგური" },
  { id: "C", label: "♣", nameEn: "Clubs", nameGe: "ჯვარი" },
];

export const emptyDeckGame = {
  deckId: "",
  hands: {},
  pendingExtraCards: [],
  removedCards: [],
  selectedToRemove: [],
  tableCards: [],
  currentTurnId: "",
  trickNumber: 1,
  maxTricks: 0,
  taken: {},
  loading: false,
  error: "",
  roundOver: false,
  lastWinnerId: "",
  trumpSuit: "",
  trumpLocked: false,
  modeLocked: false,
};

const rankPower = {
  7: 1,
  8: 2,
  9: 3,
  0: 4,
  J: 5,
  Q: 6,
  K: 7,
  A: 8,
};

const suitOrder = {
  S: 1,
  H: 2,
  D: 3,
  C: 4,
};

export function getSuit(card) {
  return card?.code?.slice(-1);
}

export function getRank(card) {
  return card?.code?.slice(0, -1);
}

export function cardPower(card) {
  return rankPower[getRank(card)] || 0;
}

export function sortCards(cards = []) {
  return [...cards].sort((a, b) => {
    const suitDiff =
      (suitOrder[getSuit(a)] || 99) - (suitOrder[getSuit(b)] || 99);

    if (suitDiff !== 0) return suitDiff;

    return cardPower(b) - cardPower(a);
  });
}

export function hasSuit(cards, suit) {
  return cards.some((card) => getSuit(card) === suit);
}

export function onlyHearts(cards) {
  return cards.length > 0 && cards.every((card) => getSuit(card) === "H");
}

export function isProtectedRemoveCard(card, contractId) {
  const suit = getSuit(card);
  const rank = getRank(card);

  if (contractId === "no-hearts") return suit === "H";
  if (contractId === "no-king-heart") return suit === "H";
  if (contractId === "no-jacks") return rank === "J";
  if (contractId === "no-queens") return rank === "Q";

  return false;
}

export function canRemoveCard(card, contractId) {
  return !isProtectedRemoveCard(card, contractId);
}

export function canPlayCard({
  hand,
  card,
  tableCards,
  contractId,
  trumpSuit = "",
}) {
  if (!card) return { ok: false, error: "No card." };

  if (tableCards.length === 0) {
    if (
      (contractId === "no-hearts" || contractId === "no-king-heart") &&
      getSuit(card) === "H" &&
      !onlyHearts(hand)
    ) {
      return { ok: false, errorType: "heartsBlocked" };
    }

    return { ok: true };
  }

  const ledSuit = getSuit(tableCards[0].card);
  const cardSuit = getSuit(card);

  if (hasSuit(hand, ledSuit) && cardSuit !== ledSuit) {
    return { ok: false, errorType: "mustFollowSuit" };
  }

  if (
    contractId === "tricks-positive" &&
    trumpSuit &&
    !hasSuit(hand, ledSuit) &&
    hasSuit(hand, trumpSuit) &&
    cardSuit !== trumpSuit
  ) {
    return { ok: false, errorType: "mustPlayTrump" };
  }

  return { ok: true };
}

export function getTrickWinner(tableCards, trumpSuit = "") {
  if (!tableCards.length) return "";

  const ledSuit = getSuit(tableCards[0].card);

  const trumpCards = trumpSuit
    ? tableCards.filter((item) => getSuit(item.card) === trumpSuit)
    : [];

  if (trumpCards.length > 0) {
    return trumpCards.sort((a, b) => cardPower(b.card) - cardPower(a.card))[0]
      ?.playerId;
  }

  const winning = tableCards
    .filter((item) => getSuit(item.card) === ledSuit)
    .sort((a, b) => cardPower(b.card) - cardPower(a.card))[0];

  return winning?.playerId || tableCards[0].playerId;
}

export function createTaken(players) {
  const taken = {};

  players.forEach((player) => {
    taken[player.id] = {
      cards: [],
      tricks: 0,
      hearts: 0,
      jacks: 0,
      queens: 0,
      lastTwo: 0,
      kingHeart: false,
    };
  });

  return taken;
}

export function addTrickToTaken({
  taken,
  winnerId,
  tableCards,
  trickNumber,
  maxTricks,
}) {
  const next = structuredClone(taken);
  const wonCards = tableCards.map((item) => item.card);

  if (!next[winnerId]) {
    next[winnerId] = {
      cards: [],
      tricks: 0,
      hearts: 0,
      jacks: 0,
      queens: 0,
      lastTwo: 0,
      kingHeart: false,
    };
  }

  next[winnerId].cards.push(...wonCards);
  next[winnerId].tricks += 1;

  wonCards.forEach((card) => {
    if (getSuit(card) === "H") next[winnerId].hearts += 1;
    if (getRank(card) === "J") next[winnerId].jacks += 1;
    if (getRank(card) === "Q") next[winnerId].queens += 1;
    if (card.code === "KH") next[winnerId].kingHeart = true;
  });

  if (trickNumber > maxTricks - 2) {
    next[winnerId].lastTwo += 1;
  }

  return next;
}

export function getMetricForContract(contractId, stats) {
  if (contractId === "no-tricks" || contractId === "tricks-positive") {
    return stats.tricks || 0;
  }

  if (contractId === "no-hearts") return stats.hearts || 0;
  if (contractId === "no-jacks") return stats.jacks || 0;
  if (contractId === "no-queens") return stats.queens || 0;
  if (contractId === "no-last-two") return stats.lastTwo || 0;
  if (contractId === "no-king-heart") return stats.kingHeart ? 1 : 0;

  return 0;
}

export function calculateRoundScores(players, contract, taken) {
  const scores = {};
  const entries = {};

  players.forEach((player) => {
    const value = getMetricForContract(contract.id, taken[player.id] || {});
    entries[player.id] = value;

    if (contract.mode === "single") {
      scores[player.id] = value ? contract.points : 0;
    } else {
      scores[player.id] = value * contract.pointsPerUnit;
    }
  });

  return { scores, entries };
}
