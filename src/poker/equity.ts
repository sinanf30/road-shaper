import { type Card, evaluate, handCategory, preflopPercentile } from "./cards";

/** Geschätzte Range eines Gegners. */
export interface OppRange {
  /** Preflop-Perzentil (1 = beliebige Hand). */
  pct: number;
  /** 0 = keine Postflop-Info, 1 = hat postflop gecallt, 2 = hat postflop gesetzt/geraist. */
  post: 0 | 1 | 2;
}

/** Wahrscheinlichkeit, eine Hand ohne Bezug zum Board trotzdem zu behalten (Bluffs, Floats). */
const KEEP_UNCONNECTED = [1, 0.45, 0.25];

/** Hat die Hand etwas mit dem Board zu tun: Paar oder besser mit Hole Card, oder Flush-/Straight-Draw? */
function connected(hole: Card[], board: Card[]): boolean {
  if (board.length < 3) return true;
  if (handCategory(evaluate([...hole, ...board])) > handCategory(evaluate(board))) return true;
  if (board.length === 5) return false;
  const all = [...hole, ...board];
  for (let s = 0; s < 4; s++) {
    if (all.filter((c) => (c & 3) === s).length >= 4 && hole.some((c) => (c & 3) === s))
      return true;
  }
  let mask = 0;
  for (const c of all) mask |= 1 << (c >> 2);
  if (mask & (1 << 12)) mask |= 1 << 13; // Ass auch als Eins
  const holeMask = hole.reduce((m, c) => m | (1 << (c >> 2)), 0);
  for (let lo = 0; lo <= 9; lo++) {
    const w = (mask >> lo) & 0b11111;
    let bits = 0;
    for (let k = 0; k < 5; k++) if (w & (1 << k)) bits++;
    if (bits >= 4 && ((holeMask << 1) | holeMask) & (0b11111 << lo)) return true;
  }
  return false;
}

/**
 * Monte-Carlo-Equity gegen eine Anzahl Gegner.
 * Jeder Gegner hat eine "Range" als Perzentil (1 = beliebige Hand, 0.25 = Top 25 %),
 * die aus seinen Preflop-Aktionen geschätzt wird.
 */
export function estimateEquity(
  hole: Card[],
  board: Card[],
  opponentRanges: OppRange[],
  iterations = 1200,
): number {
  if (opponentRanges.length === 0) return 1;
  const used = new Uint8Array(52);
  for (const c of hole) used[c] = 1;
  for (const c of board) used[c] = 1;
  const base: Card[] = [];
  for (let i = 0; i < 52; i++) if (!used[i]) base.push(i);

  let total = 0;
  const need = 5 - board.length;
  const deck = base.slice();

  for (let it = 0; it < iterations; it++) {
    let n = deck.length;
    const draw = () => {
      const j = Math.floor(Math.random() * n);
      const c = deck[j];
      deck[j] = deck[n - 1];
      deck[n - 1] = c;
      n--;
      return c;
    };
    const opps: Card[][] = [];
    for (const range of opponentRanges) {
      let hand: Card[] = [draw(), draw()];
      // Rejection-Sampling: unpassende Hände zurücklegen und neu ziehen
      const keep = KEEP_UNCONNECTED[range.post];
      for (let t = 0; t < 14; t++) {
        const fitsPre = range.pct >= 1 || preflopPercentile(hand) <= range.pct;
        const fitsPost = keep >= 1 || connected(hand, board) || Math.random() < keep;
        if (fitsPre && fitsPost) break;
        n += 2;
        hand = [draw(), draw()];
      }
      opps.push(hand);
    }
    const runout = board.slice();
    for (let k = 0; k < need; k++) runout.push(draw());

    const mine = evaluate([...hole, ...runout]);
    let ties = 0;
    let lost = false;
    for (const o of opps) {
      const v = evaluate([...o, ...runout]);
      if (v > mine) {
        lost = true;
        break;
      }
      if (v === mine) ties++;
    }
    if (!lost) total += 1 / (ties + 1);
  }
  return total / iterations;
}
