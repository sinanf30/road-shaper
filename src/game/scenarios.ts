import type { Network } from "./network";
import type { Scenario } from "./engine";

function road(net: Network, pts: [number, number][], type: Parameters<Network["build"]>[1]) {
  net.build(
    pts.map(([x, y]) => ({ x, y })),
    type,
  );
}

export const SCENARIOS: Scenario[] = [
  {
    id: "sandbox",
    title: "Sandkasten",
    brief: "Freies Bauen ohne Zeitdruck. Verkehr läuft nach Tagesgang, Budget großzügig.",
    seed: 7,
    budget: 20_000_000,
    demand: 1,
    goalSpeed: 40,
    goalWait: 15,
    duration: 0,
    preset: (net) => {
      road(net, [[300, 950], [2300, 950]], "haupt");
      road(net, [[1300, 200], [1300, 1700]], "haupt");
    },
  },
  {
    id: "crossing",
    title: "Die verstopfte Kreuzung",
    brief:
      "Zwei Hauptstraßen kreuzen sich. Entschärfe den Knoten mit Ampelphasen, Spuren oder einem Kreisverkehr.",
    seed: 21,
    budget: 1_200_000,
    demand: 1.5,
    goalSpeed: 32,
    goalWait: 12,
    duration: 240,
    preset: (net) => {
      road(net, [[250, 950], [2350, 950]], "haupt");
      road(net, [[1300, 150], [1300, 1750]], "haupt");
      road(net, [[700, 150], [700, 1750]], "land");
    },
  },
  {
    id: "bypass",
    title: "Ortsdurchfahrt entlasten",
    brief: "Der ganze Verkehr quält sich durch den Ort. Baue eine Umgehung und halte das Budget.",
    seed: 42,
    budget: 3_500_000,
    demand: 1.7,
    goalSpeed: 45,
    goalWait: 10,
    duration: 300,
    preset: (net) => {
      road(net, [[200, 950], [900, 950], [1500, 1000], [2400, 980]], "land");
      road(net, [[900, 950], [950, 400]], "land");
      road(net, [[1500, 1000], [1560, 1600]], "land");
    },
  },
  {
    id: "interchange",
    title: "Autobahnanschluss",
    brief:
      "Eine Autobahn läuft am Ort vorbei. Verbinde sie mit Rampen, ohne den Verkehr zu ersticken.",
    seed: 88,
    budget: 6_000_000,
    demand: 1.9,
    goalSpeed: 55,
    goalWait: 9,
    duration: 360,
    preset: (net) => {
      road(net, [[150, 500], [2450, 520]], "autobahn");
      road(net, [[250, 1400], [2300, 1420]], "haupt");
      road(net, [[1200, 1400], [1250, 1750]], "land");
    },
  },
  {
    id: "rush",
    title: "Pendlerspitze",
    brief: "Morgens strömt alles in eine Richtung. Halte den Durchsatz oben, bis die Spitze vorbei ist.",
    seed: 131,
    budget: 4_500_000,
    demand: 2.4,
    goalSpeed: 40,
    goalWait: 11,
    duration: 300,
    preset: (net) => {
      road(net, [[200, 400], [1200, 900], [2400, 900]], "haupt");
      road(net, [[200, 1500], [1200, 900]], "haupt");
      road(net, [[1200, 900], [1250, 1700]], "land");
    },
  },
];
