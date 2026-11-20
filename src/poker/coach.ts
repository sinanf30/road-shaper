import type { GameState, Street } from "./types";
import { HERO, legalActions, positionOf, potTotal } from "./engine";
import { preflopPercentile } from "./cards";

export const STREET_DE: Record<Street, string> = {
  preflop: "Vor dem Flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
};

/** Starthand in Worten. */
export function startHandWords(pct: number): { label: string; tone: "good" | "ok" | "bad" } {
  if (pct <= 0.05) return { label: "Premium, eine der besten Starthände", tone: "good" };
  if (pct <= 0.15) return { label: "Stark", tone: "good" };
  if (pct <= 0.3) return { label: "Ordentlich, aber nicht überall spielbar", tone: "ok" };
  if (pct <= 0.5) return { label: "Schwach, meist nur am Button spielbar", tone: "bad" };
  return { label: "Sehr schwach, fast immer folden", tone: "bad" };
}

const OPEN: Record<string, number> = { UTG: 0.15, MP: 0.19, CO: 0.27, BTN: 0.45, SB: 0.38, BB: 1 };

const POS_WORDS: Record<string, string> = {
  UTG: "Du sitzt früh (UTG) und musst als Erster handeln, deshalb nur starke Hände spielen.",
  MP: "Du sitzt in mittlerer Position (MP): noch eher vorsichtig sein.",
  CO: "Du sitzt spät (Cutoff): hier darfst du schon etwas mehr Hände spielen.",
  BTN: "Du hast den Button: die beste Position, weil du nach dem Flop als Letzter handelst. Hier kannst du viele Hände spielen.",
  SB: "Du bist im Small Blind: nach dem Flop musst du zuerst handeln, das ist ein Nachteil.",
  BB: "Du bist im Big Blind und hast schon einen Einsatz im Pot, deshalb lohnt sich Mitgehen öfter.",
};

export interface Advice {
  action: string;
  tone: "good" | "ok" | "bad";
  reasons: string[];
}

/** Konkrete Empfehlung in Alltagssprache für die aktuelle Situation des Helden. */
export function adviseHero(s: GameState, equity: number | null): Advice | null {
  if (s.handOver || s.toAct !== HERO) return null;
  const hero = s.players[HERO];
  const legal = legalActions(s);
  const pot = potTotal(s);
  const pos = positionOf(s, HERO);
  const reasons: string[] = [];

  if (s.street === "preflop") {
    const pct = preflopPercentile(hero.hole);
    const tableSize = s.players.filter((p) => !p.sittingOut).length;
    let open = OPEN[pos] ?? 0.2;
    if (tableSize === 2) open = pos === "BTN" ? 0.8 : 1;
    else if (tableSize <= 4) open *= 1.3;
    const top = Math.round(pct * 100);
    reasons.push(`Deine Hand gehört zu den besten ${top} % aller Starthände.`);
    if (POS_WORDS[pos]) reasons.push(POS_WORDS[pos]);

    if (s.raisesThisRound === 0) {
      if (pos === "BB" && legal.canCheck) {
        if (pct <= 0.12)
          return {
            action: "Erhöhen (Raise auf ca. 3 bis 4 Big Blinds)",
            tone: "good",
            reasons: [
              ...reasons,
              "Starke Hand: mach den Pot größer, solange du vermutlich vorne liegst.",
            ],
          };
        return {
          action: "Checken (kostenlos weiterspielen)",
          tone: "ok",
          reasons: [...reasons, "Niemand hat erhöht, du kannst gratis den Flop sehen."],
        };
      }
      if (pct <= open)
        return {
          action: "Erhöhen (Raise auf ca. 2,5 bis 3 Big Blinds)",
          tone: "good",
          reasons: [
            ...reasons,
            `Von dieser Position spielt man etwa die besten ${Math.round(open * 100)} % der Hände, und zwar mit einem Raise statt nur mitzugehen. Oft gewinnst du die Blinds sofort.`,
          ],
        };
      return {
        action: legal.canCheck ? "Checken" : "Folden (aussteigen)",
        tone: "bad",
        reasons: [
          ...reasons,
          `Von dieser Position spielt man nur etwa die besten ${Math.round(open * 100)} %. Diese Hand verliert auf Dauer Geld.`,
        ],
      };
    }
    // Jemand hat erhöht
    const facing3bet = s.raisesThisRound >= 2;
    const limit = facing3bet ? 0.05 : pos === "BB" ? 0.3 : 0.13;
    reasons.push(
      facing3bet
        ? "Es wurde schon mehrfach erhöht, das deutet auf sehr starke Hände hin."
        : "Ein Gegner hat erhöht. Er hat also vermutlich eine gute Hand.",
    );
    if (pct <= (facing3bet ? 0.025 : 0.04))
      return {
        action: "Erneut erhöhen (Re-Raise)",
        tone: "good",
        reasons: [
          ...reasons,
          "Deine Hand ist so stark, dass du den Pot weiter vergrößern solltest.",
        ],
      };
    if (pct <= limit)
      return {
        action: `Mitgehen (Call ${legal.callAmount})`,
        tone: "ok",
        reasons: [...reasons, "Deine Hand ist gut genug, um gegen eine Erhöhung weiterzuspielen."],
      };
    return {
      action: "Folden (aussteigen)",
      tone: "bad",
      reasons: [
        ...reasons,
        `Gegen eine Erhöhung spielt man nur etwa die besten ${Math.round(limit * 100)} % weiter. Sonst hat der Gegner oft die bessere Hand.`,
      ],
    };
  }

  if (equity === null) return null;
  const eq = Math.round(equity * 100);
  reasons.push(`Deine geschätzte Gewinnchance liegt bei etwa ${eq} %.`);

  if (legal.toCall === 0) {
    if (equity > 0.6)
      return {
        action: "Setzen (Bet, etwa halber bis ¾ Pot)",
        tone: "good",
        reasons: [
          ...reasons,
          "Du liegst wahrscheinlich vorne. Wenn du setzt, zahlen schwächere Hände dich aus. Beim Checken verschenkst du Geld.",
        ],
      };
    if (equity > 0.4)
      return {
        action: "Checken oder klein setzen",
        tone: "ok",
        reasons: [
          ...reasons,
          "Mittelstarke Hand: kein großer Pot nötig, aber auch kein Grund aufzugeben.",
        ],
      };
    return {
      action: "Checken",
      tone: "ok",
      reasons: [
        ...reasons,
        "Du liegst eher hinten. Checken kostet nichts, vielleicht kommt eine gute Karte.",
      ],
    };
  }

  const need = legal.callAmount / (pot + legal.callAmount);
  const needPct = Math.round(need * 100);
  reasons.push(
    `Du musst ${legal.callAmount} zahlen, um ${pot + legal.callAmount} zu gewinnen. Damit sich das lohnt, brauchst du mindestens ${needPct} % Gewinnchance.`,
  );
  if (equity > 0.65 && legal.canRaise)
    return {
      action: "Erhöhen (Raise)",
      tone: "good",
      reasons: [...reasons, "Du bist klar vorne: erhöhe, damit mehr Geld in den Pot kommt."],
    };
  if (equity >= need)
    return {
      action: `Mitgehen (Call ${legal.callAmount})`,
      tone: "ok",
      reasons: [
        ...reasons,
        `${eq} % ist mehr als die nötigen ${needPct} %: Mitgehen lohnt sich auf Dauer.`,
      ],
    };
  return {
    action: "Folden (aussteigen)",
    tone: "bad",
    reasons: [
      ...reasons,
      `${eq} % ist weniger als die nötigen ${needPct} %: Mitgehen verliert auf Dauer Geld.`,
    ],
  };
}
