import { type Card, freshDeck, shuffle, evaluate, handName, preflopPercentile } from "./cards";
import { estimateEquity, type OppRange } from "./equity";
import { AI_NAMES, randomStyle } from "./ai";
import type { GameConfig, GameState, HeroDecision, LoggedAction, Player, Street } from "./types";

export const HERO = 0;

/* ---------- Hilfsfunktionen ---------- */

export function seatsFrom(s: GameState, start: number): number[] {
  const n = s.players.length;
  const out: number[] = [];
  for (let i = 1; i <= n; i++) {
    const seat = (start + i) % n;
    if (!s.players[seat].sittingOut) out.push(seat);
  }
  return out;
}

function nextSeat(s: GameState, from: number, pred: (p: Player) => boolean): number {
  const n = s.players.length;
  for (let i = 1; i <= n; i++) {
    const seat = (from + i) % n;
    const p = s.players[seat];
    if (!p.sittingOut && pred(p)) return seat;
  }
  return -1;
}

const POSITION_NAMES: Record<number, string[]> = {
  2: ["BTN", "BB"],
  3: ["BTN", "SB", "BB"],
  4: ["BTN", "SB", "BB", "CO"],
  5: ["BTN", "SB", "BB", "UTG", "CO"],
  6: ["BTN", "SB", "BB", "UTG", "MP", "CO"],
};

export function positionOf(s: GameState, seat: number): string {
  const order = [s.button, ...seatsFrom(s, s.button).filter((x) => x !== s.button)];
  const names = POSITION_NAMES[order.length] ?? POSITION_NAMES[6];
  const idx = order.indexOf(seat);
  return idx >= 0 ? names[idx] : "";
}

export function potTotal(s: GameState): number {
  return s.players.reduce((a, p) => a + p.totalBet, 0);
}

const inHand = (p: Player) => !p.sittingOut && !p.folded;
const canAct = (p: Player) => inHand(p) && !p.allIn;

/* ---------- Spielstart ---------- */

function makeAI(seat: number, cfg: GameConfig, taken: Set<string>): Player {
  const style = cfg.styles === "mixed" ? randomStyle() : cfg.styles[(seat - 1) % cfg.styles.length];
  const pool = AI_NAMES.filter((n) => !taken.has(n));
  const name = pool[Math.floor(Math.random() * pool.length)] ?? `Bot ${seat}`;
  taken.add(name);
  return blankPlayer(seat, name, false, cfg.startingStack, style);
}

function blankPlayer(
  seat: number,
  name: string,
  isHuman: boolean,
  stack: number,
  style?: Player["style"],
): Player {
  return {
    seat,
    name,
    isHuman,
    style,
    stack,
    hole: [],
    folded: false,
    allIn: false,
    betThisRound: 0,
    totalBet: 0,
    acted: false,
    range: 1,
    post: 0,
    sittingOut: false,
  };
}

export function newGame(cfg: GameConfig): GameState {
  const taken = new Set<string>();
  const players: Player[] = [blankPlayer(0, "Du", true, cfg.startingStack)];
  for (let i = 1; i <= cfg.opponents; i++) players.push(makeAI(i, cfg, taken));
  return {
    config: cfg,
    players,
    button: Math.floor(Math.random() * players.length),
    sbSeat: 0,
    bbSeat: 0,
    deck: [],
    board: [],
    street: "preflop",
    toAct: -1,
    currentBet: 0,
    minRaise: cfg.bigBlind,
    raisesThisRound: 0,
    preflopAggressor: -1,
    handNo: 0,
    handOver: true,
    message: "",
    record: null,
    heroRebuys: 0,
    stacksAtStart: players.map((p) => p.stack),
  };
}

/* ---------- Einsätze ---------- */

function putIn(s: GameState, p: Player, amount: number) {
  const a = Math.min(amount, p.stack);
  p.stack -= a;
  p.betThisRound += a;
  p.totalBet += a;
  if (p.stack === 0) p.allIn = true;
  return a;
}

function log(
  s: GameState,
  p: Player,
  kind: LoggedAction["kind"],
  amount: number,
  potBefore: number,
) {
  s.record?.actions.push({
    seat: p.seat,
    name: p.name,
    street: s.street,
    kind,
    amount,
    allIn: p.allIn,
    potBefore,
  });
}

export function startHand(prev: GameState): GameState {
  const s: GameState = structuredClone(prev);
  const cfg = s.config;
  const taken = new Set(s.players.map((p) => p.name));

  // Pleite gegangene Bots ersetzen, Held kauft automatisch nach
  s.players = s.players.map((p) => {
    if (p.stack > 0) return p;
    if (p.isHuman) {
      s.heroRebuys++;
      return blankPlayer(p.seat, p.name, true, cfg.startingStack);
    }
    taken.delete(p.name);
    return makeAI(p.seat, cfg, taken);
  });

  for (const p of s.players) {
    p.hole = [];
    p.folded = false;
    p.allIn = false;
    p.betThisRound = 0;
    p.totalBet = 0;
    p.acted = false;
    p.range = 1;
    p.post = 0;
    p.sittingOut = p.stack <= 0;
  }

  s.handNo++;
  s.handOver = false;
  s.message = "";
  s.board = [];
  s.street = "preflop";
  s.deck = shuffle(freshDeck());
  s.button = nextSeat(s, s.button, () => true);
  const active = seatsFrom(s, s.button);
  const headsUp = active.length === 2;
  s.sbSeat = headsUp ? s.button : nextSeat(s, s.button, () => true);
  s.bbSeat = nextSeat(s, s.sbSeat, () => true);
  s.stacksAtStart = s.players.map((p) => p.stack);

  const hero = s.players[HERO];
  s.record = {
    handNo: s.handNo,
    timestamp: Date.now(),
    bb: cfg.bigBlind,
    heroSeat: HERO,
    heroPosition: positionOf(s, HERO),
    heroCards: [],
    board: [],
    players: s.players
      .filter((p) => !p.sittingOut)
      .map((p) => ({
        seat: p.seat,
        name: p.name,
        position: positionOf(s, p.seat),
        startStack: p.stack,
        style: p.style,
      })),
    actions: [],
    heroNet: 0,
    sawFlop: false,
    wentToShowdown: false,
    wonShowdown: false,
    showdown: [],
    winners: [],
    decisions: [],
  };

  // Karten austeilen
  for (let r = 0; r < 2; r++) {
    for (const seat of [...seatsFrom(s, s.button)]) s.players[seat].hole.push(s.deck.pop()!);
  }
  s.record.heroCards = hero.hole.slice();

  // Blinds
  const sb = s.players[s.sbSeat];
  const bb = s.players[s.bbSeat];
  putIn(s, sb, cfg.smallBlind);
  log(s, sb, "sb", sb.betThisRound, 0);
  putIn(s, bb, cfg.bigBlind);
  log(s, bb, "bb", bb.betThisRound, sb.betThisRound);

  s.currentBet = cfg.bigBlind;
  s.minRaise = cfg.bigBlind;
  s.raisesThisRound = 0;
  s.preflopAggressor = -1;
  s.toAct = nextSeat(s, s.bbSeat, canAct);
  if (s.toAct === -1 || roundComplete(s)) return advance(s);
  return s;
}

/* ---------- Aktionen ---------- */

export interface Legal {
  toCall: number;
  canCheck: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
}

export function legalActions(s: GameState, seat = s.toAct): Legal {
  const p = s.players[seat];
  const toCall = Math.max(0, s.currentBet - p.betThisRound);
  const maxRaiseTo = p.betThisRound + p.stack;
  const minRaiseTo = Math.min(maxRaiseTo, s.currentBet + s.minRaise);
  const othersCanAct = s.players.some((o) => o.seat !== seat && canAct(o));
  return {
    toCall,
    canCheck: toCall === 0,
    callAmount: Math.min(toCall, p.stack),
    canRaise: maxRaiseTo > s.currentBet && othersCanAct,
    minRaiseTo,
    maxRaiseTo,
  };
}

export type Move =
  { type: "fold" } | { type: "check" } | { type: "call" } | { type: "raise"; to: number };

export function opponentRanges(s: GameState, seat: number): OppRange[] {
  return s.players
    .filter((o) => o.seat !== seat && inHand(o))
    .map((o) => ({ pct: o.range, post: o.post }));
}

export function applyMove(prev: GameState, move: Move): GameState {
  const s: GameState = structuredClone(prev);
  const p = s.players[s.toAct];
  const legal = legalActions(s);
  const potBefore = potTotal(s);

  // Entscheidung des Helden für die Analyse festhalten
  if (p.isHuman && s.record) {
    const opps = opponentRanges(s, p.seat);
    const raiseTo = move.type === "raise" ? Math.min(move.to, legal.maxRaiseTo) : p.betThisRound;
    const d: HeroDecision = {
      handNo: s.handNo,
      street: s.street,
      position: positionOf(s, p.seat),
      cards: p.hole.slice(),
      board: s.board.slice(),
      pot: potBefore,
      toCall: legal.callAmount,
      stack: p.stack,
      bb: s.config.bigBlind,
      equity: estimateEquity(p.hole, s.board, opps, 1500),
      potOdds: legal.callAmount > 0 ? legal.callAmount / (potBefore + legal.callAmount) : 0,
      opponents: opps.length,
      raisesBefore: s.raisesThisRound,
      percentile: preflopPercentile(p.hole),
      wasPreflopAggressor: s.preflopAggressor === p.seat,
      firstToBet: s.currentBet === 0,
      kind:
        move.type === "raise"
          ? s.currentBet === 0
            ? "bet"
            : "raise"
          : move.type === "check"
            ? legal.canCheck
              ? "check"
              : "fold"
            : move.type === "call" && legal.toCall === 0
              ? "check"
              : move.type,
      amount:
        move.type === "call"
          ? legal.callAmount
          : move.type === "raise"
            ? raiseTo - p.betThisRound
            : 0,
      raiseTo,
    };
    s.record.decisions.push(d);
  }

  switch (move.type) {
    case "fold":
      p.folded = true;
      log(s, p, "fold", 0, potBefore);
      break;
    case "check":
      if (!legal.canCheck) {
        p.folded = true;
        log(s, p, "fold", 0, potBefore);
      } else log(s, p, "check", 0, potBefore);
      break;
    case "call": {
      if (legal.toCall === 0) {
        log(s, p, "check", 0, potBefore);
        break;
      }
      const paid = putIn(s, p, legal.toCall);
      log(s, p, "call", paid, potBefore);
      if (s.street === "preflop") p.range = Math.min(p.range, s.raisesThisRound > 0 ? 0.3 : 0.6);
      else p.post = Math.max(p.post, 1) as 1 | 2;
      break;
    }
    case "raise": {
      if (!legal.canRaise) {
        return applyMove(prev, legal.toCall > 0 ? { type: "call" } : { type: "check" });
      }
      const to = Math.max(legal.minRaiseTo, Math.min(move.to, legal.maxRaiseTo));
      const wasBet = s.currentBet === 0;
      putIn(s, p, to - p.betThisRound);
      const raiseSize = to - s.currentBet;
      if (raiseSize >= s.minRaise) s.minRaise = raiseSize;
      s.currentBet = Math.max(s.currentBet, to);
      s.raisesThisRound++;
      if (s.street === "preflop") {
        s.preflopAggressor = p.seat;
        p.range = Math.min(p.range, s.raisesThisRound >= 2 ? 0.08 : 0.22);
      } else p.post = 2;
      for (const o of s.players) if (o.seat !== p.seat) o.acted = false;
      log(s, p, wasBet ? "bet" : "raise", to, potBefore);
      break;
    }
  }
  p.acted = true;
  return advance(s);
}

/* ---------- Ablauf ---------- */

function roundComplete(s: GameState): boolean {
  const actors = s.players.filter(canAct);
  if (actors.length === 0) return true;
  if (actors.length === 1) {
    const a = actors[0];
    return a.betThisRound >= s.currentBet;
  }
  return actors.every((p) => p.acted && p.betThisRound === s.currentBet);
}

function advance(s: GameState): GameState {
  const live = s.players.filter(inHand);
  if (live.length === 1) {
    awardUncontested(s, live[0]);
    return s;
  }
  if (!roundComplete(s)) {
    s.toAct = nextSeat(s, s.toAct, canAct);
    return s;
  }
  // nächste Straße
  while (true) {
    if (s.street === "river") {
      showdown(s);
      return s;
    }
    nextStreet(s);
    if (s.players.filter(canAct).length >= 2) {
      s.toAct = nextSeat(s, s.button, canAct);
      return s;
    }
  }
}

function nextStreet(s: GameState) {
  for (const p of s.players) {
    p.betThisRound = 0;
    p.acted = false;
  }
  s.currentBet = 0;
  s.minRaise = s.config.bigBlind;
  s.raisesThisRound = 0;
  s.deck.pop(); // Burn
  const order: Street[] = ["preflop", "flop", "turn", "river"];
  s.street = order[order.indexOf(s.street) + 1];
  const n = s.street === "flop" ? 3 : 1;
  for (let i = 0; i < n; i++) s.board.push(s.deck.pop()!);
  if (s.record) {
    s.record.board = s.board.slice();
    if (s.street === "flop" && !s.players[HERO].folded && !s.players[HERO].sittingOut)
      s.record.sawFlop = true;
  }
}

function finishHand(s: GameState) {
  s.handOver = true;
  s.toAct = -1;
  if (s.record) {
    s.record.board = s.board.slice();
    s.record.heroNet = s.players[HERO].stack - s.stacksAtStart[HERO];
  }
}

function awardUncontested(s: GameState, winner: Player) {
  // Nicht gecallten Überschuss zurückgeben ist implizit, da der Gewinner alles bekommt.
  const pot = potTotal(s);
  winner.stack += pot;
  s.message = `${winner.name} gewinnt ${pot} (alle anderen haben gefoldet)`;
  s.record?.winners.push({ seat: winner.seat, name: winner.name, amount: pot });
  finishHand(s);
}

function showdown(s: GameState) {
  const live = s.players.filter(inHand);
  const scores = new Map<number, number>();
  for (const p of live) scores.set(p.seat, evaluate([...p.hole, ...s.board]));

  // Side Pots
  const contributors = s.players.filter((p) => p.totalBet > 0);
  const levels = [...new Set(contributors.map((p) => p.totalBet))].sort((a, b) => a - b);
  const winnings = new Map<number, number>();
  let prev = 0;
  for (const level of levels) {
    const slice = level - prev;
    const potPart = contributors.reduce(
      (a, p) => a + Math.min(slice, Math.max(0, p.totalBet - prev)),
      0,
    );
    const eligible = live.filter((p) => p.totalBet >= level);
    prev = level;
    if (potPart === 0) continue;
    if (eligible.length === 0) {
      // Überschuss (niemand mehr berechtigt) geht an den, der ihn gesetzt hat
      const owner = contributors.find((p) => p.totalBet >= level)!;
      winnings.set(owner.seat, (winnings.get(owner.seat) ?? 0) + potPart);
      continue;
    }
    const best = Math.max(...eligible.map((p) => scores.get(p.seat)!));
    const winners = eligible.filter((p) => scores.get(p.seat) === best);
    // Restchips an den ersten Gewinner links vom Button
    const ordered = seatsFrom(s, s.button).filter((seat) => winners.some((w) => w.seat === seat));
    const share = Math.floor(potPart / winners.length);
    let rest = potPart - share * winners.length;
    for (const seat of ordered) {
      const add = share + (rest > 0 ? 1 : 0);
      if (rest > 0) rest--;
      winnings.set(seat, (winnings.get(seat) ?? 0) + add);
    }
  }

  for (const [seat, amt] of winnings) s.players[seat].stack += amt;

  const parts: string[] = [];
  for (const [seat, amt] of winnings) {
    const p = s.players[seat];
    if (!inHand(p)) continue;
    parts.push(`${p.name} gewinnt ${amt} mit ${handName([...p.hole, ...s.board])}`);
    s.record?.winners.push({ seat, name: p.name, amount: amt });
  }
  s.message = parts.join(" · ");

  if (s.record) {
    s.record.wentToShowdown = inHand(s.players[HERO]);
    s.record.wonShowdown = s.record.wentToShowdown && (winnings.get(HERO) ?? 0) > 0;
    s.record.showdown = live.map((p) => ({
      seat: p.seat,
      name: p.name,
      cards: p.hole.slice(),
      handName: handName([...p.hole, ...s.board]),
      won: winnings.get(p.seat) ?? 0,
    }));
  }
  s.street = "river";
  finishHand(s);
}

export function isShowdownVisible(s: GameState, seat: number): boolean {
  return !!s.record && s.handOver && s.record.showdown.some((e) => e.seat === seat);
}

export function bestHandText(cards: Card[], board: Card[]): string {
  return board.length ? handName([...cards, ...board]) : "";
}
