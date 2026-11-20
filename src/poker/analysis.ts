import { cardsText, handClass } from "./cards";
import type { HandRecord, HeroDecision, Street } from "./types";

export type Severity = "klein" | "mittel" | "groß";

export interface Mistake {
  handNo: number;
  street: Street;
  severity: Severity;
  category: string;
  title: string;
  detail: string;
  /** Geschätzter Verlust in Big Blinds. */
  evLossBB: number;
  decision: HeroDecision;
}

export interface StatLine {
  key: string;
  label: string;
  value: number | null;
  /** Anzahl Gelegenheiten */
  sample: number;
  target: [number, number];
  unit: "%" | "x";
  explain: string;
}

export interface Leak {
  title: string;
  text: string;
  weight: number;
}

export interface PositionResult {
  position: string;
  hands: number;
  netBB: number;
  vpip: number;
}

export interface Analysis {
  hands: number;
  netChips: number;
  netBB: number;
  bbPer100: number;
  stats: StatLine[];
  mistakes: Mistake[];
  totalEvLossBB: number;
  decisions: number;
  goodDecisionRate: number;
  leaks: Leak[];
  strengths: string[];
  positions: PositionResult[];
  streetErrors: Record<Street, number>;
  biggestPots: HandRecord[];
}

/* ---------- Empfohlene Preflop-Ranges (Anteil aller Hände) ---------- */

const OPEN_RANGE: Record<string, number> = {
  UTG: 0.15,
  MP: 0.19,
  CO: 0.27,
  BTN: 0.45,
  SB: 0.38,
  BB: 1,
};

function openRangeFor(pos: string, tableSize: number): number {
  if (tableSize === 2) return pos === "BTN" ? 0.8 : 1;
  const base = OPEN_RANGE[pos] ?? 0.2;
  // an kleineren Tischen etwas weiter öffnen
  return Math.min(0.85, base * (tableSize <= 3 ? 1.5 : tableSize === 4 ? 1.2 : 1));
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

function sev(lossBB: number): Severity {
  if (lossBB >= 6) return "groß";
  if (lossBB >= 2) return "mittel";
  return "klein";
}

function describe(d: HeroDecision) {
  const board = d.board.length ? ` auf ${cardsText(d.board)}` : "";
  return `${cardsText(d.cards)} (${handClass(d.cards)}) in ${d.position}${board}`;
}

/* ---------- Bewertung einzelner Entscheidungen ---------- */

export function judgeDecision(d: HeroDecision, tableSize: number): Mistake[] {
  const out: Mistake[] = [];
  const add = (
    category: string,
    title: string,
    detail: string,
    lossBB: number,
    severity?: Severity,
  ) =>
    out.push({
      handNo: d.handNo,
      street: d.street,
      severity: severity ?? sev(lossBB),
      category,
      title,
      detail,
      evLossBB: Math.max(0, Math.round(lossBB * 10) / 10),
      decision: d,
    });

  if (d.street === "preflop") {
    const open = openRangeFor(d.position, tableSize);
    const p = d.percentile;
    const top = `gehört zu den Top ${pct(p)} der Starthände`;
    if (d.raisesBefore === 0) {
      if (d.kind === "fold" && p <= open * 0.6 && d.position !== "BB")
        add(
          "Preflop zu tight",
          "Spielbare Hand weggeworfen",
          `${describe(d)} ${top}. In ${d.position} solltest du etwa die besten ${pct(open)} eröffnen. Hier wäre ein Raise auf 2,5 bis 3 BB Standard.`,
          p <= 0.08 ? 2.5 : 0.8,
        );
      if (d.kind === "call" && d.position !== "BB")
        add(
          "Limpen",
          "Gelimpt statt geraist",
          `${describe(d)}: Du hast nur den Big Blind bezahlt. Limpen gibt die Initiative ab und lässt die Blinds billig mitspielen. Entweder mit 2,5 bis 3 BB eröffnen oder folden.`,
          p > open * 1.4 ? 1.2 : 0.6,
        );
      if (d.kind === "raise" && p > open * 1.6 && d.position !== "BB")
        add(
          "Preflop zu loose",
          "Zu schwache Hand eröffnet",
          `${describe(d)} ${top}. Aus ${d.position} ist das deutlich außerhalb einer soliden Openrange (etwa Top ${pct(open)}).`,
          p > open * 2.5 ? 2 : 1,
        );
      if (d.kind === "raise" && d.amount < d.stack) {
        const size = d.raiseTo / d.bb;
        if (size > 5.5)
          add(
            "Bet Sizing",
            "Open-Raise zu groß",
            `Du hast auf ${size.toFixed(1)} BB eröffnet. Größere Raises riskieren viel gegen nur die Blinds; 2,5 bis 3,5 BB reichen (plus 1 BB pro Limper).`,
            0.8,
            "klein",
          );
        if (size < 2)
          add(
            "Bet Sizing",
            "Min-Raise zu klein",
            `Ein Raise auf ${size.toFixed(1)} BB gibt den Blinds sehr gute Odds. 2,5 bis 3 BB sind Standard.`,
            0.3,
            "klein",
          );
      }
    } else {
      const facing3bet = d.raisesBefore >= 2;
      const limit = facing3bet ? 0.05 : d.position === "BB" ? 0.3 : 0.13;
      if ((d.kind === "call" || d.kind === "raise") && p > limit * 1.6) {
        const loss = facing3bet ? 4 : d.toCall / d.bb > 4 ? 2 : 1;
        add(
          "Preflop zu loose",
          facing3bet ? "Zu loose gegen 3-Bet weitergespielt" : "Zu loose gegen Raise mitgegangen",
          `${describe(d)} ${top}. Gegen ${facing3bet ? "eine 3-Bet" : "ein Raise"} ist eine Range von etwa Top ${pct(limit)} sinnvoll. Mit schwächeren Händen bist du oft dominiert.`,
          loss,
        );
      }
      if (d.kind === "fold" && ((facing3bet && p <= 0.025) || (!facing3bet && p <= 0.045)))
        add(
          "Preflop zu tight",
          "Premiumhand gegen Raise gefoldet",
          `${describe(d)} ${top}. Diese Hand ist gegen ${facing3bet ? "eine 3-Bet" : "ein Raise"} fast immer ein Raise oder zumindest ein Call.`,
          facing3bet ? 8 : 4,
        );
      if (d.kind === "call" && !facing3bet && p <= 0.03)
        add(
          "Zu passiv",
          "Premiumhand nur gecallt",
          `${describe(d)}: Mit Top-Händen solltest du 3-betten (etwa 3x das Raise), um Value zu holen und das Feld zu verkleinern.`,
          1,
          "klein",
        );
    }
    return out;
  }

  // Postflop
  const e = d.equity;
  const callTotal = d.pot + d.toCall;
  if (d.kind === "call" && d.toCall > 0) {
    const ev = e * callTotal - d.toCall;
    // auf früheren Straßen etwas Toleranz für Implied Odds
    const tol = d.street === "river" ? 0.04 : 0.08;
    if (e < d.potOdds - tol)
      add(
        "Calls ohne Odds",
        "Call ohne ausreichende Equity",
        `${describe(d)}: Du musstest ${d.toCall} in einen Pot von ${d.pot} zahlen, brauchst also ${pct(d.potOdds)} Equity. Deine geschätzte Equity lag bei ${pct(e)}. Langfristig kostet dieser Call etwa ${(-ev / d.bb).toFixed(1)} BB.`,
        -ev / d.bb,
      );
  }
  if (d.kind === "fold" && d.toCall > 0) {
    const ev = e * callTotal - d.toCall;
    if (e > d.potOdds + 0.08 && ev > 0)
      add(
        "Zu viele Folds",
        "Fold trotz guter Pot Odds",
        `${describe(d)}: Benötigt waren nur ${pct(d.potOdds)} Equity, du hattest etwa ${pct(e)}. Ein Call hätte im Schnitt ${(ev / d.bb).toFixed(1)} BB eingebracht.`,
        ev / d.bb,
      );
  }
  if (d.kind === "check" && d.toCall === 0 && d.opponents > 0) {
    const threshold = d.street === "river" ? 0.72 : 0.68;
    if (e > threshold) {
      const loss = (d.pot * 0.5 * (e - 0.5)) / d.bb;
      add(
        "Value verschenkt",
        d.street === "river" ? "Value-Bet am River verpasst" : "Starke Hand nur gecheckt",
        `${describe(d)}: Mit etwa ${pct(e)} Equity solltest du meist selbst setzen (50 bis 75 % des Pots), damit schwächere Hände bezahlen.${d.street !== "river" ? " Außerdem gibst du Draws eine Gratiskarte." : ""}`,
        loss,
        loss >= 2 ? "mittel" : "klein",
      );
    }
  }
  if ((d.kind === "bet" || d.kind === "raise") && d.opponents > 0) {
    const betAmount = d.amount;
    if (e < 0.25 && d.opponents >= 2)
      add(
        "Bluffs",
        "Bluff gegen mehrere Gegner",
        `${describe(d)}: Mit nur ${pct(e)} Equity gegen ${d.opponents} Gegner. Bluffs funktionieren am besten heads-up, gegen mehrere Gegner callt fast immer jemand.`,
        (betAmount * 0.4) / d.bb,
      );
    if (d.kind === "bet" && e > 0.65 && betAmount < d.pot * 0.3 && betAmount < d.stack)
      add(
        "Bet Sizing",
        "Value-Bet zu klein",
        `${describe(d)}: Du hast ${betAmount} in einen Pot von ${d.pot} gesetzt (${pct(betAmount / Math.max(1, d.pot))}). Mit ${pct(e)} Equity darfst du deutlich größer setzen (50 bis 75 % des Pots).`,
        (d.pot * 0.25 * (e - 0.4)) / d.bb,
        "klein",
      );
    if (d.kind === "raise" && e < d.potOdds && e < 0.3 && d.opponents === 1 && d.street === "river")
      add(
        "Bluffs",
        "Riskanter River-Bluff-Raise",
        `${describe(d)}: Ein Bluff-Raise am River muss sehr oft funktionieren. Mit ${pct(e)} Equity ist ein Fold meist günstiger.`,
        (betAmount * 0.3) / d.bb,
        "klein",
      );
  }
  return out;
}

/* ---------- Gesamtanalyse ---------- */

function ratio(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

export function analyze(hands: HandRecord[]): Analysis {
  let netChips = 0;
  let netBBTotal = 0;
  let vpip = 0,
    pfr = 0,
    threeBet = 0,
    threeBetOpp = 0,
    limps = 0,
    limpOpp = 0;
  let postBetsRaises = 0,
    postCalls = 0,
    postChecks = 0;
  let cbet = 0,
    cbetOpp = 0;
  let foldVsBet = 0,
    facedBet = 0;
  let sawFlop = 0,
    wtsd = 0,
    wonSd = 0;
  let decisions = 0;
  const mistakes: Mistake[] = [];
  const positions = new Map<string, PositionResult>();
  const streetErrors: Record<Street, number> = { preflop: 0, flop: 0, turn: 0, river: 0 };

  for (const h of hands) {
    netChips += h.heroNet;
    netBBTotal += h.heroNet / h.bb;
    const tableSize = h.players.length;
    const pre = h.decisions.filter((d) => d.street === "preflop");
    const voluntary = pre.some((d) => d.kind === "call" || d.kind === "raise" || d.kind === "bet");
    const raised = pre.some((d) => d.kind === "raise" || d.kind === "bet");
    if (voluntary) vpip++;
    if (raised) pfr++;
    const facing1 = pre.find((d) => d.raisesBefore === 1);
    if (facing1) {
      threeBetOpp++;
      if (facing1.kind === "raise") threeBet++;
    }
    const unopened = pre.find((d) => d.raisesBefore === 0 && d.position !== "BB");
    if (unopened) {
      limpOpp++;
      if (unopened.kind === "call") limps++;
    }

    const pos = positions.get(h.heroPosition) ?? {
      position: h.heroPosition,
      hands: 0,
      netBB: 0,
      vpip: 0,
    };
    pos.hands++;
    pos.netBB += h.heroNet / h.bb;
    if (voluntary) pos.vpip++;
    positions.set(h.heroPosition, pos);

    if (h.sawFlop) {
      sawFlop++;
      if (h.wentToShowdown) {
        wtsd++;
        if (h.wonShowdown) wonSd++;
      }
    }

    const wasAggressor = pre.length > 0 && pre[pre.length - 1].kind === "raise";
    const flopFirst = h.decisions.find((d) => d.street === "flop");
    if (wasAggressor && flopFirst && flopFirst.firstToBet && flopFirst.wasPreflopAggressor) {
      cbetOpp++;
      if (flopFirst.kind === "bet") cbet++;
    }

    for (const d of h.decisions) {
      decisions++;
      if (d.street !== "preflop") {
        if (d.kind === "bet" || d.kind === "raise") postBetsRaises++;
        if (d.kind === "call") postCalls++;
        if (d.kind === "check") postChecks++;
        if (d.toCall > 0) {
          facedBet++;
          if (d.kind === "fold") foldVsBet++;
        }
      }
      const ms = judgeDecision(d, tableSize);
      for (const m of ms) {
        mistakes.push(m);
        streetErrors[m.street]++;
      }
    }
  }

  const n = hands.length;
  const vpipR = ratio(vpip, n);
  const pfrR = ratio(pfr, n);
  const af =
    postCalls > 0 ? postBetsRaises / postCalls : postBetsRaises > 0 ? postBetsRaises : null;

  const stats: StatLine[] = [
    {
      key: "vpip",
      label: "VPIP",
      value: vpipR,
      sample: n,
      target: [0.2, 0.3],
      unit: "%",
      explain: "Wie oft du freiwillig Geld in den Pot steckst (Call oder Raise vor dem Flop).",
    },
    {
      key: "pfr",
      label: "PFR",
      value: pfrR,
      sample: n,
      target: [0.15, 0.24],
      unit: "%",
      explain: "Wie oft du vor dem Flop raist.",
    },
    {
      key: "3bet",
      label: "3-Bet",
      value: ratio(threeBet, threeBetOpp),
      sample: threeBetOpp,
      target: [0.05, 0.11],
      unit: "%",
      explain: "Wie oft du gegen ein Raise erneut erhöhst.",
    },
    {
      key: "limp",
      label: "Limp",
      value: ratio(limps, limpOpp),
      sample: limpOpp,
      target: [0, 0.05],
      unit: "%",
      explain: "Wie oft du in einen ungeöffneten Pot nur den Big Blind bezahlst.",
    },
    {
      key: "af",
      label: "Aggression",
      value: af,
      sample: postBetsRaises + postCalls,
      target: [1.8, 3.5],
      unit: "x",
      explain: "Postflop: (Bets + Raises) geteilt durch Calls.",
    },
    {
      key: "cbet",
      label: "C-Bet",
      value: ratio(cbet, cbetOpp),
      sample: cbetOpp,
      target: [0.5, 0.75],
      unit: "%",
      explain: "Wie oft du als Preflop-Raiser am Flop weitersetzt, wenn es zu dir gecheckt wird.",
    },
    {
      key: "fvb",
      label: "Fold vs. Bet",
      value: ratio(foldVsBet, facedBet),
      sample: facedBet,
      target: [0.35, 0.55],
      unit: "%",
      explain: "Wie oft du nach dem Flop gegen einen Einsatz foldest.",
    },
    {
      key: "wtsd",
      label: "WTSD",
      value: ratio(wtsd, sawFlop),
      sample: sawFlop,
      target: [0.24, 0.33],
      unit: "%",
      explain: "Wie oft du nach gesehenem Flop bis zum Showdown gehst.",
    },
    {
      key: "wsd",
      label: "W$SD",
      value: ratio(wonSd, wtsd),
      sample: wtsd,
      target: [0.5, 0.65],
      unit: "%",
      explain: "Wie oft du am Showdown gewinnst.",
    },
  ];

  /* ---- Leaks & Stärken ---- */
  const leaks: Leak[] = [];
  const strengths: string[] = [];
  const get = (k: string) => stats.find((s) => s.key === k)!;
  const enough = (s: StatLine, min: number) => s.value !== null && s.sample >= min;

  const v = get("vpip");
  const p = get("pfr");
  if (enough(v, 15)) {
    if (v.value! > 0.36)
      leaks.push({
        title: "Du spielst zu viele Hände",
        text: `Dein VPIP liegt bei ${pct(v.value!)}. Ziel an einem 6er-Tisch sind etwa 20 bis 30 %. Fold mehr schwache Offsuit-Hände, besonders aus früher Position.`,
        weight: 3 + (v.value! - 0.36) * 10,
      });
    else if (v.value! < 0.15)
      leaks.push({
        title: "Du spielst zu wenige Hände",
        text: `VPIP ${pct(v.value!)}: Du wartest zu sehr auf Premiumhände und lässt die Blinds kampflos liegen. Öffne am Button und im Cutoff deutlich weiter.`,
        weight: 2,
      });
    else strengths.push(`Solide Handauswahl (VPIP ${pct(v.value!)}).`);
  }
  if (enough(v, 15) && enough(p, 15) && v.value! - p.value! > 0.1)
    leaks.push({
      title: "Zu passiv vor dem Flop",
      text: `Zwischen VPIP (${pct(v.value!)}) und PFR (${pct(p.value!)}) liegen über 10 Prozentpunkte. Du callst und limpst oft, statt selbst zu raisen. Hände, die gut genug zum Mitspielen sind, sind meist auch gut genug zum Raisen.`,
      weight: 3 + (v.value! - p.value! - 0.1) * 10,
    });
  else if (enough(p, 15) && p.value! >= 0.13)
    strengths.push("Du spielst vor dem Flop mit Initiative (gutes Verhältnis von PFR zu VPIP).");

  const af2 = get("af");
  if (af2.value !== null && af2.sample >= 10) {
    if (af2.value < 1.2)
      leaks.push({
        title: "Postflop zu passiv",
        text: `Aggressionsfaktor ${af2.value.toFixed(1)}: Du callst viel mehr, als du setzt. Wer nur callt, kann nur mit der besten Hand gewinnen. Setze starke Hände und gute Draws selbst.`,
        weight: 3,
      });
    else if (af2.value > 5)
      leaks.push({
        title: "Postflop sehr aggressiv",
        text: `Aggressionsfaktor ${af2.value.toFixed(1)}: Achte darauf, dass deine Bets eine klare Absicht haben (Value oder Bluff mit Outs), sonst wird es gegen Calling Stations teuer.`,
        weight: 1.5,
      });
    else
      strengths.push(
        `Gute Balance aus Setzen und Callen nach dem Flop (AF ${af2.value.toFixed(1)}).`,
      );
  }

  const c = get("cbet");
  if (enough(c, 6)) {
    if (c.value! < 0.4)
      leaks.push({
        title: "Zu wenige Continuation Bets",
        text: `Als Preflop-Raiser setzt du am Flop nur in ${pct(c.value!)} der Fälle nach. Eine kleine C-Bet (ca. 1/3 bis 1/2 Pot) gewinnt oft sofort, besonders heads-up.`,
        weight: 2,
      });
    else if (c.value! > 0.85)
      leaks.push({
        title: "C-Bet fast automatisch",
        text: `C-Bet ${pct(c.value!)}: Gegen mehrere Gegner oder auf nassen Boards lieber auch mal checken.`,
        weight: 1,
      });
  }

  const f = get("fvb");
  if (enough(f, 10)) {
    if (f.value! > 0.65)
      leaks.push({
        title: "Du foldest zu oft gegen Bets",
        text: `Gegen einen Einsatz foldest du ${pct(f.value!)} der Zeit. Gegner können dich leicht rausbluffen. Prüfe die Pot Odds: Bei einer halben Pot-Bet brauchst du nur 25 % Equity.`,
        weight: 2.5,
      });
    else if (f.value! < 0.25)
      leaks.push({
        title: "Du callst zu viel",
        text: `Du foldest nur ${pct(f.value!)} gegen Bets. Ohne gute Hand oder Draw bezahlst du zu oft Value-Bets.`,
        weight: 2.5,
      });
  }

  const w = get("wtsd");
  const ws = get("wsd");
  if (enough(w, 12) && w.value! > 0.4 && enough(ws, 5) && ws.value! < 0.5)
    leaks.push({
      title: "Zu oft im Showdown mit der schlechteren Hand",
      text: `Du gehst in ${pct(w.value!)} der Flops zum Showdown, gewinnst dort aber nur ${pct(ws.value!)}. Lass marginale Hände am Turn und River öfter los.`,
      weight: 2.5,
    });
  if (enough(ws, 5) && ws.value! >= 0.55)
    strengths.push(`Am Showdown hast du meist die beste Hand (W$SD ${pct(ws.value!)}).`);

  // Leaks aus Fehlerkategorien
  const byCat = new Map<string, { count: number; loss: number }>();
  for (const m of mistakes) {
    const e = byCat.get(m.category) ?? { count: 0, loss: 0 };
    e.count++;
    e.loss += m.evLossBB;
    byCat.set(m.category, e);
  }
  const catTips: Record<string, string> = {
    "Calls ohne Odds":
      "Rechne vor jedem Call: Betrag zum Callen / (Pot + Betrag). Liegt deine Gewinnchance darunter, ist Fold richtig. Faustregel: Flush-Draw am Flop ca. 35 %, am Turn ca. 19 %.",
    "Zu viele Folds":
      "Du gibst Pots auf, in denen du genug Equity hattest. Bei kleinen Einsätzen der Gegner reichen oft schon 20 bis 30 % Gewinnchance für einen profitablen Call.",
    "Value verschenkt":
      "Wenn du vermutlich vorne liegst, setze! Gegner callen mit schwächeren Händen, die beim Check nichts zahlen.",
    "Preflop zu loose":
      "Halte dich an positionsabhängige Ranges: früh tight, spät weiter. Schwache Offsuit-Hände wie K7o oder J5o kosten auf Dauer Geld.",
    "Preflop zu tight":
      "Gute Hände nicht wegwerfen. Am Button und im Cutoff sind auch Suited Connectors und mittlere Asse profitable Opens.",
    Limpen:
      "Statt zu limpen: raisen oder folden. Ein Raise gewinnt oft sofort die Blinds und gibt dir die Initiative.",
    Bluffs:
      "Bluffe bevorzugt heads-up, in Position und mit Händen, die sich noch verbessern können.",
    "Bet Sizing":
      "Standard-Größen: Open 2,5 bis 3 BB, C-Bet 33 bis 50 % Pot, Value-Bets 50 bis 75 % Pot.",
    "Zu passiv": "Premiumhände aktiv spielen: 3-Bets bauen den Pot auf, wenn du vorne liegst.",
  };
  for (const [cat, e] of byCat) {
    if (e.count < 2 && e.loss < 4) continue;
    leaks.push({
      title: `${cat}: ${e.count}× (≈ ${e.loss.toFixed(1)} BB)`,
      text: catTips[cat] ?? "",
      weight: e.loss / 3 + e.count * 0.3,
    });
  }
  leaks.sort((a, b) => b.weight - a.weight);

  const totalEvLossBB = mistakes.reduce((a, m) => a + m.evLossBB, 0);
  const handsWithMistake = new Set(mistakes.map((m) => m.decision)).size;
  mistakes.sort((a, b) => b.evLossBB - a.evLossBB);

  return {
    hands: n,
    netChips,
    netBB: netBBTotal,
    bbPer100: n ? (netBBTotal / n) * 100 : 0,
    stats,
    mistakes,
    totalEvLossBB,
    decisions,
    goodDecisionRate: decisions ? 1 - handsWithMistake / decisions : 1,
    leaks,
    strengths,
    positions: ["UTG", "MP", "CO", "BTN", "SB", "BB"]
      .map((p) => positions.get(p))
      .filter((x): x is PositionResult => !!x),
    streetErrors,
    biggestPots: [...hands].sort((a, b) => Math.abs(b.heroNet) - Math.abs(a.heroNet)).slice(0, 5),
  };
}

/* ---------- Export als Text (z. B. zum Einfügen in einen Chat mit Claude) ---------- */

export function exportForCoach(hands: HandRecord[], a: Analysis): string {
  const lines: string[] = [];
  lines.push("# Texas Hold'em Session zur Analyse");
  lines.push(
    `Hände: ${a.hands} · Ergebnis: ${a.netBB.toFixed(1)} BB (${a.bbPer100.toFixed(1)} BB/100) · geschätzter EV-Verlust durch Fehler: ${a.totalEvLossBB.toFixed(1)} BB`,
  );
  lines.push("");
  lines.push("## Statistiken");
  for (const s of a.stats) {
    const val = s.value === null ? "n/a" : s.unit === "%" ? pct(s.value) : s.value.toFixed(2);
    lines.push(
      `- ${s.label}: ${val} (n=${s.sample}, Ziel ${s.unit === "%" ? `${pct(s.target[0])} bis ${pct(s.target[1])}` : `${s.target[0]} bis ${s.target[1]}`})`,
    );
  }
  lines.push("");
  lines.push("## Hand History (Held = 'Du')");
  for (const h of hands) {
    lines.push("");
    lines.push(
      `### Hand ${h.handNo} · ${h.heroPosition} · ${cardsText(h.heroCards)} · Ergebnis ${(h.heroNet / h.bb).toFixed(1)} BB`,
    );
    lines.push(
      `Spieler: ${h.players.map((p) => `${p.name} (${p.position}, ${p.startStack})`).join(", ")}`,
    );
    let street = "";
    let buf: string[] = [];
    const flush = () => {
      if (buf.length) lines.push(`${street}: ${buf.join(", ")}`);
      buf = [];
    };
    for (const act of h.actions) {
      if (act.street !== street) {
        flush();
        street = act.street;
        if (street !== "preflop") {
          const n = street === "flop" ? 3 : street === "turn" ? 4 : 5;
          lines.push(`Board (${street}): ${cardsText(h.board.slice(0, n))}`);
        }
      }
      const amt = act.kind === "fold" || act.kind === "check" ? "" : ` ${act.amount}`;
      buf.push(`${act.name} ${act.kind}${amt}${act.allIn ? " (all-in)" : ""}`);
    }
    flush();
    if (h.showdown.length)
      lines.push(
        `Showdown: ${h.showdown.map((s) => `${s.name} ${cardsText(s.cards)} (${s.handName})`).join(" | ")}`,
      );
    lines.push(`Gewinner: ${h.winners.map((w) => `${w.name} +${w.amount}`).join(", ")}`);
  }
  return lines.join("\n");
}
