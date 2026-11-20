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

/** Kennzahlen: was sie zeigen und was ein zu hoher oder zu niedriger Wert bedeutet. */
export const STAT_INFO: Record<
  string,
  { full: string; meaning: string; low: string; high: string }
> = {
  vpip: {
    full: "Voluntarily Put money In Pot",
    meaning:
      "Zeigt, wie viele Hände du freiwillig mitspielst (vor dem Flop mitgehen oder erhöhen). Der Pflichteinsatz im Big Blind zählt nicht.",
    low: "Du spielst sehr wenige Hände. Gegner merken das und weichen dir aus, wenn du endlich setzt.",
    high: "Du spielst zu viele Hände. Mit schwachen Karten landest du oft in Pots, die du verlierst.",
  },
  pfr: {
    full: "Pre-Flop Raise",
    meaning:
      "Zeigt, wie oft du vor dem Flop erhöhst. Sollte nur wenig unter deinem VPIP liegen: Wenn du mitspielst, dann meist mit einer Erhöhung.",
    low: "Du gehst oft nur mit statt zu erhöhen. Damit gibst du die Kontrolle über die Hand ab.",
    high: "Du erhöhst sehr oft, auch mit schwachen Händen.",
  },
  "3bet": {
    full: "Dritter Einsatz (Re-Raise)",
    meaning:
      "Zeigt, wie oft du nochmals erhöhst, wenn jemand vor dem Flop schon erhöht hat. Der Big Blind ist Einsatz 1, das Raise Einsatz 2, deine Erhöhung darauf die 3-Bet.",
    low: "Du gehst gegen Erhöhungen fast nur mit. Mit sehr starken Händen solltest du nochmals erhöhen.",
    high: "Du erhöhst gegen Raises sehr oft. Das wird teuer, wenn der Gegner wirklich stark ist.",
  },
  limp: {
    full: "Limp",
    meaning:
      "Zeigt, wie oft du vor dem Flop nur den Big Blind bezahlst, obwohl noch niemand erhöht hat. Sollte nahe 0 % liegen.",
    low: "",
    high: "Du limpst oft. Besser: Gute Hände erhöhen, schwache Hände folden.",
  },
  af: {
    full: "Aggression Factor",
    meaning:
      "Zeigt nach dem Flop das Verhältnis von Setzen und Erhöhen zu Mitgehen. 2,0 heißt: Du setzt oder erhöhst doppelt so oft, wie du nur mitgehst.",
    low: "Du gehst meist nur mit. Wer nur mitgeht, kann nur mit der besten Hand gewinnen, nie dadurch, dass der Gegner aufgibt.",
    high: "Du setzt sehr oft. Achte darauf, dass jede Bet einen Grund hat.",
  },
  cbet: {
    full: "Continuation Bet",
    meaning:
      "Zeigt, wie oft du am Flop weitersetzt, nachdem du vor dem Flop erhöht hast und es zu dir gecheckt wird.",
    low: "Du gibst nach deiner Erhöhung oft auf. Eine kleine Bet am Flop gewinnt häufig sofort, weil der Gegner meist auch nichts getroffen hat.",
    high: "Du setzt fast immer weiter. Gegen mehrere Gegner lieber auch mal checken.",
  },
  fvb: {
    full: "Fold vs. Bet",
    meaning: "Zeigt, wie oft du nach dem Flop aussteigst, wenn ein Gegner setzt.",
    low: "Du gehst fast immer mit und bezahlst so oft bessere Hände.",
    high: "Du gibst zu schnell auf. Gegner können dich leicht wegbluffen.",
  },
  wtsd: {
    full: "Went To ShowDown",
    meaning:
      "Zeigt, wie oft du bis zum Aufdecken der Karten dabei bleibst, wenn du den Flop gesehen hast.",
    low: "Du steigst oft vor dem Ende aus. Prüfe, ob du gute Hände zu früh weggibst.",
    high: "Du gehst sehr oft bis zum Ende mit, auch mit mittelmäßigen Händen.",
  },
  wsd: {
    full: "Won $ at ShowDown",
    meaning: "Zeigt, wie oft du gewinnst, wenn die Karten aufgedeckt werden.",
    low: "Am Ende hast du oft die schlechtere Hand. Lass schwache Hände am Turn und River öfter los.",
    high: "Am Ende hast du meist die beste Hand. Vielleicht kannst du etwas mutiger spielen.",
  },
};
