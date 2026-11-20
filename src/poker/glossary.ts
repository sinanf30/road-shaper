export interface Term {
  term: string;
  short: string;
  long: string;
}

export const GLOSSARY: Term[] = [
  {
    term: "Big Blind (BB)",
    short: "Pflichteinsatz, gleichzeitig die Maßeinheit für Gewinne",
    long: "Zwei Spieler müssen vor jeder Hand einen Pflichteinsatz bringen: Small Blind (halb) und Big Blind (voll, hier 20 Chips). Gewinne und Verluste werden in Big Blinds gemessen, damit man Tische mit unterschiedlichen Einsätzen vergleichen kann. +10 BB heißt hier: 200 Chips gewonnen.",
  },
  {
    term: "Pot",
    short: "Alle Chips in der Mitte",
    long: "Die Summe aller Einsätze dieser Hand. Wer am Ende gewinnt, bekommt den Pot.",
  },
  {
    term: "Fold / Check / Call / Bet / Raise",
    short: "Die fünf möglichen Aktionen",
    long: "Fold: aussteigen. Check: nichts setzen, wenn niemand gesetzt hat. Call: den Einsatz eines Gegners mitgehen. Bet: als Erster setzen. Raise: einen Einsatz erhöhen.",
  },
  {
    term: "Preflop, Flop, Turn, River",
    short: "Die vier Setzrunden",
    long: "Preflop: nur deine zwei Karten. Flop: drei Gemeinschaftskarten. Turn: die vierte Karte. River: die fünfte und letzte Karte.",
  },
  {
    term: "Position (UTG, MP, CO, BTN, SB, BB)",
    short: "Wo du sitzt, also wann du handeln musst",
    long: "UTG (Under the Gun) handelt vor dem Flop zuerst, dann MP (Mitte), CO (Cutoff) und BTN (Button, der Dealer). Nach dem Flop handelt der Button als Letzter und sieht so, was alle anderen tun. Das ist ein großer Vorteil. Deshalb spielt man früh nur starke Hände und am Button deutlich mehr.",
  },
  {
    term: "Equity (Gewinnchance)",
    short: "Wie oft du die Hand gewinnen würdest",
    long: "Die Wahrscheinlichkeit, dass deine Hand am Ende vorne liegt. 30 % heißt: Würde man diese Situation 100-mal spielen, gewinnst du etwa 30-mal. Die App schätzt das, indem sie tausende mögliche Kartenverläufe durchspielt.",
  },
  {
    term: "Pot Odds (nötige Gewinnchance)",
    short: "Wie oft du gewinnen musst, damit Mitgehen sich lohnt",
    long: "Rechnung: Betrag zum Mitgehen geteilt durch (Pot + dieser Betrag). Beispiel: Du musst 50 zahlen, im Pot sind schon 150. Dann 50 / 200 = 25 %. Ist deine Gewinnchance höher als 25 %, lohnt sich das Mitgehen auf Dauer, sonst nicht. Das ist die wichtigste Rechnung im Poker.",
  },
  {
    term: "Starthand-Ranking (Top X %)",
    short: "Wie gut deine zwei Karten im Vergleich sind",
    long: "Top 5 % bedeutet: Nur 5 von 100 möglichen Starthänden sind besser oder gleich gut. Asse sind die Nummer 1, 72 ohne gleiche Farbe die schlechteste. Das „s“ in AKs heißt suited (gleiche Farbe), das „o“ offsuit (verschiedene Farben).",
  },
  {
    term: "Limpen",
    short: "Vor dem Flop nur den Big Blind mitgehen",
    long: "Gilt als schwacher Spielzug: Du zeigst keine Stärke und lässt alle billig mitspielen. Besser: erhöhen oder folden.",
  },
  {
    term: "3-Bet",
    short: "Eine Erhöhung nochmals erhöhen",
    long: "Der Big Blind zählt als erster Einsatz, das erste Raise als zweiter, das Re-Raise darauf ist die 3-Bet. Sie zeigt eine sehr starke Hand oder ist ein Bluff.",
  },
  {
    term: "C-Bet (Continuation Bet)",
    short: "Am Flop weitersetzen, nachdem man vorher erhöht hat",
    long: "Wer vor dem Flop erhöht hat, setzt am Flop oft weiter, auch wenn er nichts getroffen hat. Weil der Gegner meistens ebenfalls nichts getroffen hat, gewinnt das oft sofort.",
  },
  {
    term: "Value-Bet und Bluff",
    short: "Setzen, weil man vorne liegt, oder um den Gegner zum Aufgeben zu bringen",
    long: "Value-Bet: Du setzt mit einer guten Hand, damit schlechtere Hände dich bezahlen. Bluff: Du setzt mit einer schlechten Hand, damit bessere Hände aufgeben.",
  },
  {
    term: "Showdown",
    short: "Karten aufdecken am Ende",
    long: "Wenn nach dem River noch mindestens zwei Spieler dabei sind, werden die Karten gezeigt und die beste Hand gewinnt.",
  },
  {
    term: "EV-Verlust",
    short: "Wie viel ein Fehler im Durchschnitt kostet",
    long: "EV heißt Erwartungswert, also was eine Entscheidung im Schnitt bringt, wenn man sie sehr oft trifft. Ein EV-Verlust von 3 BB bedeutet: Diese Entscheidung kostet dich auf Dauer jedes Mal etwa 3 Big Blinds, auch wenn du die Hand zufällig gewonnen hast.",
  },
];

/** Kennzahlen in Alltagssprache. */
export const STAT_PLAIN: Record<string, { name: string; question: string }> = {
  vpip: {
    name: "Mitgespielte Hände (VPIP)",
    question: "Wie oft spielst du eine Hand freiwillig mit?",
  },
  pfr: { name: "Erhöht vor dem Flop (PFR)", question: "Wie oft erhöhst du vor dem Flop?" },
  "3bet": {
    name: "Re-Raise (3-Bet)",
    question: "Wie oft erhöhst du, wenn jemand vor dir erhöht hat?",
  },
  limp: {
    name: "Nur mitgegangen (Limp)",
    question: "Wie oft zahlst du vor dem Flop nur den Big Blind, statt zu erhöhen?",
  },
  af: {
    name: "Aggressivität (AF)",
    question:
      "Wie oft setzt oder erhöhst du nach dem Flop im Vergleich zum Mitgehen? 2,0 heißt: doppelt so oft setzen wie mitgehen.",
  },
  cbet: {
    name: "Weitergesetzt am Flop (C-Bet)",
    question: "Wie oft setzt du am Flop, nachdem du vor dem Flop erhöht hast?",
  },
  fvb: {
    name: "Aufgegeben gegen Einsatz",
    question: "Wie oft steigst du nach dem Flop aus, wenn ein Gegner setzt?",
  },
  wtsd: {
    name: "Bis zum Aufdecken (WTSD)",
    question: "Wie oft gehst du nach dem Flop bis zum Showdown?",
  },
  wsd: {
    name: "Am Showdown gewonnen (W$SD)",
    question: "Wie oft gewinnst du, wenn die Karten aufgedeckt werden?",
  },
};
