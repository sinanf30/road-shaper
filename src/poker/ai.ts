import { preflopPercentile } from "./cards";
import { estimateEquity } from "./equity";
import { type GameState, type AIStyle, type AIStyleId } from "./types";
import { legalActions, opponentRanges, positionOf, potTotal, type Move } from "./engine";

export const AI_STYLES: Record<AIStyleId, AIStyle> = {
  tag: {
    id: "tag",
    label: "Tight-Aggressiv",
    description: "Spielt wenige, gute Hände und setzt sie druckvoll.",
    openRange: 0.18,
    callRange: 0.12,
    threeBetRange: 0.05,
    aggression: 0.75,
    bluff: 0.18,
    stickiness: 0.02,
  },
  lag: {
    id: "lag",
    label: "Loose-Aggressiv",
    description: "Viele Hände, viel Druck, blufft gerne.",
    openRange: 0.32,
    callRange: 0.2,
    threeBetRange: 0.09,
    aggression: 0.85,
    bluff: 0.32,
    stickiness: 0.04,
  },
  station: {
    id: "station",
    label: "Calling Station",
    description: "Callt fast alles, setzt selten selbst.",
    openRange: 0.25,
    callRange: 0.5,
    threeBetRange: 0.03,
    aggression: 0.3,
    bluff: 0.05,
    stickiness: 0.15,
  },
  rock: {
    id: "rock",
    label: "Rock (sehr tight)",
    description: "Wartet auf Monsterhände.",
    openRange: 0.1,
    callRange: 0.07,
    threeBetRange: 0.03,
    aggression: 0.55,
    bluff: 0.05,
    stickiness: -0.02,
  },
  maniac: {
    id: "maniac",
    label: "Maniac",
    description: "Raist und blufft wild, oft auch All-in.",
    openRange: 0.55,
    callRange: 0.35,
    threeBetRange: 0.18,
    aggression: 0.95,
    bluff: 0.5,
    stickiness: 0.06,
  },
};

export const AI_NAMES = [
  "Ada",
  "Bruno",
  "Clara",
  "Dario",
  "Elif",
  "Finn",
  "Greta",
  "Hakan",
  "Ines",
  "Jonas",
  "Kira",
  "Lukas",
  "Mira",
  "Noah",
  "Olga",
  "Paul",
  "Rosa",
  "Selin",
  "Tom",
  "Vera",
];

export function randomStyle(): AIStyleId {
  const ids: AIStyleId[] = ["tag", "tag", "lag", "station", "rock", "maniac"];
  return ids[Math.floor(Math.random() * ids.length)];
}

const POS_BONUS: Record<string, number> = {
  UTG: 0.75,
  MP: 0.9,
  CO: 1.2,
  BTN: 1.6,
  SB: 1.1,
  BB: 1.0,
};

function roundTo(x: number, step: number) {
  return Math.max(step, Math.round(x / step) * step);
}

export function decideAI(s: GameState): Move {
  const p = s.players[s.toAct];
  const style = AI_STYLES[p.style ?? "tag"];
  const legal = legalActions(s);
  const bb = s.config.bigBlind;
  const pot = potTotal(s);
  const r = Math.random();
  const raiseTo = (to: number): Move => {
    if (!legal.canRaise) return legal.toCall > 0 ? { type: "call" } : { type: "check" };
    const clamped = Math.max(
      legal.minRaiseTo,
      Math.min(legal.maxRaiseTo, roundTo(to, s.config.smallBlind)),
    );
    // Wenn fast der ganze Stack drin wäre: gleich All-in
    if (clamped > legal.maxRaiseTo * 0.75) return { type: "raise", to: legal.maxRaiseTo };
    return { type: "raise", to: clamped };
  };
  const passive = (): Move => (legal.canCheck ? { type: "check" } : { type: "fold" });

  if (s.street === "preflop") {
    const pct = preflopPercentile(p.hole);
    const pos = positionOf(s, p.seat);
    const bonus = POS_BONUS[pos] ?? 1;
    const jitter = 0.85 + Math.random() * 0.3;
    const limpers = s.players.filter(
      (o) => !o.folded && o.betThisRound === bb && o.seat !== s.bbSeat,
    ).length;

    if (s.raisesThisRound === 0) {
      if (pct <= style.openRange * bonus * jitter) return raiseTo(bb * (2.5 + limpers));
      if (legal.canCheck) return { type: "check" };
      // Limpen nur loose Stile oder Small Blind
      if (pct <= style.callRange * 1.3 && style.aggression < 0.5) return { type: "call" };
      if (pos === "SB" && pct <= style.openRange * 1.5) return { type: "call" };
      return { type: "fold" };
    }
    // Gegen Raise
    const tighten = s.raisesThisRound >= 2 ? 0.45 : 1;
    const stackShare = legal.toCall / (p.stack + p.betThisRound);
    if (pct <= style.threeBetRange * tighten * jitter) {
      if (s.raisesThisRound >= 2 && pct <= 0.03) return { type: "raise", to: legal.maxRaiseTo };
      return raiseTo(s.currentBet * 3);
    }
    let callLimit = style.callRange * tighten * jitter * (pos === "BB" ? 1.4 : 1);
    if (stackShare > 0.35) callLimit *= 0.4;
    if (pct <= callLimit) return { type: "call" };
    if (r < style.bluff * 0.12 && s.raisesThisRound === 1 && stackShare < 0.15)
      return raiseTo(s.currentBet * 3);
    return { type: "fold" };
  }

  // Postflop: Equity gegen geschätzte Ranges
  const equity = estimateEquity(p.hole, s.board, opponentRanges(s, p.seat), 500);
  const opps = opponentRanges(s, p.seat).length;
  const fair = 1 / (opps + 1);
  const strength = equity / fair; // >1 = besser als Durchschnitt
  const betSize = (frac: number) => s.currentBet + (pot + legal.toCall) * frac;

  if (legal.toCall === 0) {
    if (strength > 1.6 && r < style.aggression) return raiseTo(betSize(0.6 + Math.random() * 0.3));
    if (strength > 1.25 && r < style.aggression * 0.6) return raiseTo(betSize(0.5));
    const isAggressor = s.preflopAggressor === p.seat;
    if (isAggressor && s.street === "flop" && r < style.aggression * 0.55)
      return raiseTo(betSize(0.4));
    if (r < style.bluff * (opps === 1 ? 1 : 0.4)) return raiseTo(betSize(0.55));
    return { type: "check" };
  }

  const potOdds = legal.toCall / (pot + legal.toCall);
  if (strength > 1.9 && equity > 0.6 && r < style.aggression)
    return raiseTo(s.currentBet * 2.5 + pot * 0.3);
  if (equity >= potOdds + 0.03 - style.stickiness) return { type: "call" };
  // gelegentlicher Bluff-Raise
  if (r < style.bluff * 0.08 && opps === 1 && s.street !== "river")
    return raiseTo(s.currentBet * 2.5);
  return passive();
}
