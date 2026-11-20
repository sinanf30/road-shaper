import type { Card } from "./cards";

export type Street = "preflop" | "flop" | "turn" | "river";

export type AIStyleId = "tag" | "lag" | "station" | "rock" | "maniac";

export interface AIStyle {
  id: AIStyleId;
  label: string;
  description: string;
  /** Preflop-Openrange als Anteil aller Hände (ohne Positionsbonus). */
  openRange: number;
  /** Range, mit der gegen ein Raise gecallt wird. */
  callRange: number;
  /** Range für 3-Bets. */
  threeBetRange: number;
  /** Wahrscheinlichkeit, mit starker Hand zu setzen statt zu checken/callen. */
  aggression: number;
  /** Bluff-Frequenz bei schwacher Hand ohne Einsatz vor sich. */
  bluff: number;
  /** Toleranz beim Callen (Equity darf um so viel unter den Pot Odds liegen). */
  stickiness: number;
}

export interface Player {
  seat: number;
  name: string;
  isHuman: boolean;
  style?: AIStyleId;
  stack: number;
  hole: Card[];
  folded: boolean;
  allIn: boolean;
  betThisRound: number;
  totalBet: number;
  acted: boolean;
  /** Geschätzte Range (Perzentil) aus Sicht der anderen, für Equity-Berechnung. */
  range: number;
  /** Postflop gezeigte Stärke: 0 keine, 1 gecallt, 2 gesetzt/geraist. */
  post: 0 | 1 | 2;
  sittingOut: boolean;
}

export type ActionKind = "fold" | "check" | "call" | "bet" | "raise" | "sb" | "bb";

export interface LoggedAction {
  seat: number;
  name: string;
  street: Street;
  kind: ActionKind;
  /** Gesamter Einsatz in dieser Setzrunde nach der Aktion (bei bet/raise) bzw. gezahlter Betrag (call). */
  amount: number;
  allIn: boolean;
  potBefore: number;
}

export interface HeroDecision {
  handNo: number;
  street: Street;
  position: string;
  cards: Card[];
  board: Card[];
  pot: number;
  toCall: number;
  stack: number;
  bb: number;
  equity: number;
  potOdds: number;
  opponents: number;
  /** Anzahl Raises in dieser Setzrunde vor der Entscheidung (Preflop: Big Blind zählt nicht). */
  raisesBefore: number;
  percentile: number;
  wasPreflopAggressor: boolean;
  firstToBet: boolean;
  kind: "fold" | "check" | "call" | "bet" | "raise";
  amount: number;
  /** Gesamter Einsatz in dieser Runde nach der Aktion. */
  raiseTo: number;
}

export interface ShowdownEntry {
  seat: number;
  name: string;
  cards: Card[];
  handName: string;
  won: number;
}

export interface HandRecord {
  handNo: number;
  timestamp: number;
  bb: number;
  heroSeat: number;
  heroPosition: string;
  heroCards: Card[];
  board: Card[];
  players: {
    seat: number;
    name: string;
    position: string;
    startStack: number;
    style?: AIStyleId;
  }[];
  actions: LoggedAction[];
  heroNet: number;
  sawFlop: boolean;
  wentToShowdown: boolean;
  wonShowdown: boolean;
  showdown: ShowdownEntry[];
  winners: { seat: number; name: string; amount: number }[];
  decisions: HeroDecision[];
}

export interface GameConfig {
  opponents: number;
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  styles: AIStyleId[] | "mixed";
}

export interface GameState {
  config: GameConfig;
  players: Player[];
  button: number;
  sbSeat: number;
  bbSeat: number;
  deck: Card[];
  board: Card[];
  street: Street;
  toAct: number;
  currentBet: number;
  minRaise: number;
  raisesThisRound: number;
  preflopAggressor: number;
  handNo: number;
  handOver: boolean;
  message: string;
  record: HandRecord | null;
  heroRebuys: number;
  stacksAtStart: number[];
}
