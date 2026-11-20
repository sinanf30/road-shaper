/**
 * Karten, Deck und ein schneller 7-Karten-Handbewerter.
 * Karte = Zahl 0..51, Rang = c >> 2 (0 = Zwei … 12 = Ass), Farbe = c & 3.
 */

export type Card = number;

export const RANK_CHARS = "23456789TJQKA";
export const SUIT_CHARS = ["♠", "♥", "♦", "♣"];
export const SUIT_LETTERS = "shdc";

export const rankOf = (c: Card) => c >> 2;
export const suitOf = (c: Card) => c & 3;

export function cardLabel(c: Card): string {
  return RANK_CHARS[rankOf(c)] + SUIT_CHARS[suitOf(c)];
}

export function cardText(c: Card): string {
  return RANK_CHARS[rankOf(c)] + SUIT_LETTERS[suitOf(c)];
}

export function cardsText(cs: Card[]): string {
  return cs.map(cardText).join(" ");
}

export function freshDeck(): Card[] {
  const d: Card[] = [];
  for (let i = 0; i < 52; i++) d.push(i);
  return d;
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const HAND_NAMES = [
  "High Card",
  "Paar",
  "Zwei Paare",
  "Drilling",
  "Straße",
  "Flush",
  "Full House",
  "Vierling",
  "Straight Flush",
];

const B = 13;
const B5 = B ** 5;

function straightHigh(mask: number): number {
  for (let hi = 12; hi >= 4; hi--) {
    const m = 0b11111 << (hi - 4);
    if ((mask & m) === m) return hi;
  }
  // Wheel A-2-3-4-5
  if ((mask & 0b1000000001111) === 0b1000000001111) return 3;
  return -1;
}

function topRanks(mask: number, n: number, out: number[]) {
  for (let r = 12; r >= 0 && out.length < n; r--) if (mask & (1 << r)) out.push(r);
}

function score(cat: number, ks: number[]): number {
  let s = 0;
  for (let i = 0; i < 5; i++) s = s * B + (ks[i] ?? 0);
  return cat * B5 + s;
}

/** Bewertet 5 bis 7 Karten. Höherer Wert = bessere Hand. */
export function evaluate(cards: Card[]): number {
  const counts = new Array(13).fill(0);
  const suitCount = [0, 0, 0, 0];
  const suitMask = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cards) {
    const r = c >> 2;
    const s = c & 3;
    counts[r]++;
    suitCount[s]++;
    suitMask[s] |= 1 << r;
    mask |= 1 << r;
  }
  for (let s = 0; s < 4; s++) {
    if (suitCount[s] >= 5) {
      const sh = straightHigh(suitMask[s]);
      if (sh >= 0) return score(8, [sh]);
      const ks: number[] = [];
      topRanks(suitMask[s], 5, ks);
      return score(5, ks);
    }
  }
  let quad = -1;
  const trips: number[] = [];
  const pairs: number[] = [];
  for (let r = 12; r >= 0; r--) {
    if (counts[r] === 4) quad = r;
    else if (counts[r] === 3) trips.push(r);
    else if (counts[r] === 2) pairs.push(r);
  }
  if (quad >= 0) {
    const ks: number[] = [];
    topRanks(mask & ~(1 << quad), 1, ks);
    return score(7, [quad, ks[0]]);
  }
  if (trips.length > 0 && (trips.length > 1 || pairs.length > 0)) {
    const pr = trips.length > 1 ? Math.max(trips[1], pairs[0] ?? -1) : pairs[0];
    return score(6, [trips[0], pr]);
  }
  const sh = straightHigh(mask);
  if (sh >= 0) return score(4, [sh]);
  if (trips.length) {
    const ks: number[] = [];
    topRanks(mask & ~(1 << trips[0]), 2, ks);
    return score(3, [trips[0], ...ks]);
  }
  if (pairs.length >= 2) {
    const ks: number[] = [];
    topRanks(mask & ~(1 << pairs[0]) & ~(1 << pairs[1]), 1, ks);
    return score(2, [pairs[0], pairs[1], ks[0]]);
  }
  if (pairs.length === 1) {
    const ks: number[] = [];
    topRanks(mask & ~(1 << pairs[0]), 3, ks);
    return score(1, [pairs[0], ...ks]);
  }
  const ks: number[] = [];
  topRanks(mask, 5, ks);
  return score(0, ks);
}

export function handCategory(scoreValue: number): number {
  return Math.floor(scoreValue / B5);
}

export function handName(cards: Card[]): string {
  return HAND_NAMES[handCategory(evaluate(cards))];
}

/* ---------- Preflop-Handstärke (Chen-Formel → Perzentil) ---------- */

function chenRankValue(r: number): number {
  if (r === 12) return 10;
  if (r === 11) return 8;
  if (r === 10) return 7;
  if (r === 9) return 6;
  return (r + 2) / 2;
}

export function chenScore(hi: number, lo: number, suited: boolean): number {
  if (hi === lo) return Math.max(5, chenRankValue(hi) * 2);
  let s = chenRankValue(hi);
  if (suited) s += 2;
  const gap = hi - lo - 1;
  s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 10) s += 1;
  // feiner Tie-Break nach dem Kicker
  return s + lo * 0.01;
}

export function handClass(cards: Card[]): string {
  const a = rankOf(cards[0]);
  const b = rankOf(cards[1]);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi === lo) return RANK_CHARS[hi] + RANK_CHARS[lo];
  return RANK_CHARS[hi] + RANK_CHARS[lo] + (suitOf(cards[0]) === suitOf(cards[1]) ? "s" : "o");
}

/** Perzentil: Anteil aller Starthände, die mindestens so gut sind (0.005 = Top, 1 = schlechteste). */
const PERCENTILE = new Map<string, number>();
(() => {
  const classes: { key: string; score: number; combos: number }[] = [];
  for (let hi = 0; hi < 13; hi++) {
    for (let lo = 0; lo <= hi; lo++) {
      if (hi === lo) {
        classes.push({
          key: RANK_CHARS[hi] + RANK_CHARS[lo],
          score: chenScore(hi, lo, false),
          combos: 6,
        });
      } else {
        classes.push({
          key: RANK_CHARS[hi] + RANK_CHARS[lo] + "s",
          score: chenScore(hi, lo, true),
          combos: 4,
        });
        classes.push({
          key: RANK_CHARS[hi] + RANK_CHARS[lo] + "o",
          score: chenScore(hi, lo, false),
          combos: 12,
        });
      }
    }
  }
  classes.sort((x, y) => y.score - x.score);
  let cum = 0;
  for (const c of classes) {
    cum += c.combos;
    PERCENTILE.set(c.key, cum / 1326);
  }
})();

export function preflopPercentile(cards: Card[]): number {
  return PERCENTILE.get(handClass(cards)) ?? 1;
}
