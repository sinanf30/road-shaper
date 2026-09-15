import { arcPath, dist, polyLength, minRadius, smoothPath, snapAngle, type Vec2 } from "./geometry";
import { Network, makeSignal, resetIds } from "./network";
import { Simulation } from "./sim";
import { generateTerrain, type Terrain } from "./terrain";
import {
  ROAD_SPECS,
  type Edge,
  type Node,
  type ParkingLot,
  type RoadType,
  type Sign,
} from "./types";
import type { Camera, Overlay } from "./render";

export type DrawMode = "free" | "straight" | "arc";
export type Tool =
  | { kind: "road"; type: RoadType; mode: DrawMode }
  | { kind: "select" }
  | { kind: "erase" }
  | { kind: "signal" }
  | { kind: "roundabout" }
  | { kind: "priority"; value: "none" | "yield" | "stop" }
  | { kind: "crosswalk" }
  | { kind: "sign"; signKind: Sign["kind"] }
  | { kind: "parking" }
  | { kind: "incident" };

export interface Scenario {
  id: string;
  title: string;
  brief: string;
  seed: number;
  budget: number;
  demand: number;
  goalSpeed: number;
  goalWait: number;
  duration: number;
  preset?: (net: Network) => void;
}

export interface Snapshot {
  nodes: Node[];
  edges: {
    id: string;
    from: string;
    to: string;
    pts: Vec2[];
    type: RoadType;
    lanesFwd: number;
    lanesBwd: number;
    oneWay: boolean;
    speed: number;
    level: number;
    trees: boolean;
    sidewalk: boolean;
    bus: boolean;
    name?: string;
  }[];
  lots: ParkingLot[];
  signs: Sign[];
  budget: number;
}

let lotId = 1;
let signId = 1;

export class Engine {
  net = new Network();
  sim = new Simulation(this.net);
  terrain: Terrain;
  seed: number;
  camera: Camera = { x: 1300, y: 950, zoom: 0.9 };
  tool: Tool = { kind: "road", type: "haupt", mode: "straight" };
  overlay: Overlay = "none";
  oneWay = false;
  drawLevel = 0;
  drawSpeed: number | null = null;
  speedMult = 1;
  paused = false;
  showLabels = true;
  budget = 2_000_000;
  spent = 0;
  signs: Sign[] = [];
  lots: ParkingLot[] = [];
  selectedNode: string | null = null;
  selectedEdge: string | null = null;
  followVehicle: number | null = null;
  scenario: Scenario | null = null;
  scenarioTime = 0;
  scenarioDone: { stars: number; text: string } | null = null;
  messages: { id: number; text: string; kind: "info" | "warn" }[] = [];
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private msgId = 1;

  constructor(seed = 7) {
    this.seed = seed;
    this.terrain = generateTerrain(seed);
    this.sim.lots = this.lots;
  }

  notify(text: string, kind: "info" | "warn" = "info") {
    this.messages.push({ id: this.msgId++, text, kind });
    if (this.messages.length > 4) this.messages.shift();
  }

  // ---------- history ----------
  snapshot(): Snapshot {
    return {
      nodes: [...this.net.nodes.values()].map((n) => ({
        ...n,
        pos: { ...n.pos },
        signal: n.signal ? { ...n.signal, phases: n.signal.phases.map((p) => ({ ...p, edges: [...p.edges] })) } : undefined,
      })),
      edges: [...this.net.edges.values()].map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        pts: e.pts.map((p) => ({ ...p })),
        type: e.type,
        lanesFwd: e.lanesFwd,
        lanesBwd: e.lanesBwd,
        oneWay: e.oneWay,
        speed: e.speed,
        level: e.level,
        trees: e.trees,
        sidewalk: e.sidewalk,
        bus: e.bus,
        name: e.name,
      })),
      lots: this.lots.map((l) => ({ ...l })),
      signs: this.signs.map((s) => ({ ...s, pos: { ...s.pos } })),
      budget: this.budget,
    };
  }

  restore(s: Snapshot) {
    this.net.clear();
    for (const n of s.nodes) {
      this.net.nodes.set(n.id, { ...n, pos: { ...n.pos } });
      this.net.adj.set(n.id, []);
    }
    for (const e of s.edges) {
      const edge = this.net.addEdge(e.from, e.to, e.pts, e.type, {
        lanesFwd: e.lanesFwd,
        lanesBwd: e.lanesBwd,
        oneWay: e.oneWay,
        speed: e.speed,
        level: e.level,
        trees: e.trees,
        sidewalk: e.sidewalk,
        bus: e.bus,
        name: e.name,
      });
      edge.id = e.id;
    }
    // reindex edge ids
    const byId = new Map<string, Edge>();
    for (const e of this.net.edges.values()) byId.set(e.id, e);
    this.net.edges = byId;
    this.net.adj.clear();
    for (const n of this.net.nodes.keys()) this.net.adj.set(n, []);
    for (const e of this.net.edges.values()) {
      this.net.adj.get(e.from)?.push(e.id);
      this.net.adj.get(e.to)?.push(e.id);
    }
    this.lots = s.lots.map((l) => ({ ...l }));
    this.sim.lots = this.lots;
    this.signs = s.signs.map((x) => ({ ...x, pos: { ...x.pos } }));
    this.budget = s.budget;
    this.net.version++;
  }

  pushHistory() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.snapshot());
    this.restore(prev);
    this.notify("Rückgängig");
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.snapshot());
    this.restore(next);
    this.notify("Wiederholt");
  }

  canUndo() {
    return this.undoStack.length > 0;
  }
  canRedo() {
    return this.redoStack.length > 0;
  }

  // ---------- building ----------
  previewPath(raw: Vec2[], mode: DrawMode, shift: boolean, arcCtrl?: Vec2 | null): Vec2[] {
    if (raw.length < 2) return raw;
    if (mode === "straight") {
      const a = raw[0];
      let b = raw[raw.length - 1];
      if (shift) b = snapAngle(a, b, 15);
      return [a, b];
    }
    if (mode === "arc") {
      const a = raw[0];
      const b = raw[raw.length - 1];
      const ctrl = arcCtrl ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      return arcPath(a, ctrl, b);
    }
    return smoothPath(raw);
  }

  costOf(pts: Vec2[], type: RoadType, level: number): number {
    const base = polyLength(pts) * ROAD_SPECS[type].costPerMeter;
    const mult = level > 0 ? 2.4 : level < 0 ? 3.1 : 1;
    return Math.round(base * mult);
  }

  validPath(pts: Vec2[], type: RoadType): { ok: boolean; reason?: string } {
    if (polyLength(pts) < 8) return { ok: false, reason: "Zu kurz" };
    const r = minRadius(pts);
    if (r < ROAD_SPECS[type].minRadius * 0.55)
      return { ok: false, reason: "Kurvenradius zu eng" };
    return { ok: true };
  }

  buildRoad(pts: Vec2[], type: RoadType): boolean {
    const check = this.validPath(pts, type);
    if (!check.ok) {
      this.notify(check.reason ?? "Ungültig", "warn");
      return false;
    }
    const cost = this.costOf(pts, type, this.drawLevel);
    if (cost > this.budget) {
      this.notify("Budget reicht nicht", "warn");
      return false;
    }
    this.pushHistory();
    const created = this.net.build(pts, type, {
      oneWay: this.oneWay,
      level: this.drawLevel,
      speed: this.drawSpeed ?? undefined,
    });
    if (!created.length) {
      this.undoStack.pop();
      return false;
    }
    this.budget -= cost;
    this.spent += cost;
    return true;
  }

  eraseEdge(id: string) {
    const e = this.net.edges.get(id);
    if (!e) return;
    const affected = this.sim.vehicles.filter((v) => v.route.includes(id)).length;
    this.pushHistory();
    this.net.removeEdge(id);
    this.budget += Math.round(e.length * ROAD_SPECS[e.type].costPerMeter * 0.2);
    if (affected > 0) this.notify(`${affected} Fahrzeuge müssen neu geroutet werden`, "warn");
  }

  changeLanes(id: string, delta: number) {
    const e = this.net.edges.get(id);
    if (!e) return;
    const spec = ROAD_SPECS[e.type];
    const next = Math.max(1, Math.min(spec.maxLanes, e.lanesFwd + delta));
    if (next === e.lanesFwd) return;
    const cost = Math.round(e.length * spec.costPerMeter * 0.4 * Math.abs(delta));
    if (delta > 0 && cost > this.budget) {
      this.notify("Budget reicht nicht", "warn");
      return;
    }
    this.pushHistory();
    e.lanesFwd = next;
    if (!e.oneWay) e.lanesBwd = next;
    this.budget -= delta > 0 ? cost : -Math.round(cost * 0.3);
    this.net.version++;
  }

  upgradeRoad(id: string, type: RoadType) {
    const e = this.net.edges.get(id);
    if (!e || e.type === type) return;
    const spec = ROAD_SPECS[type];
    const cost = Math.round(e.length * spec.costPerMeter * 0.7);
    if (cost > this.budget) {
      this.notify("Budget reicht nicht", "warn");
      return;
    }
    this.pushHistory();
    e.type = type;
    e.lanesFwd = spec.lanes;
    e.lanesBwd = e.oneWay ? 0 : spec.lanes;
    e.speed = spec.speed;
    this.budget -= cost;
    for (const n of [e.from, e.to]) this.net.refreshControl(n);
    this.net.version++;
  }

  setOneWay(id: string, value: boolean) {
    const e = this.net.edges.get(id);
    if (!e) return;
    this.pushHistory();
    e.oneWay = value;
    e.lanesBwd = value ? 0 : e.lanesFwd;
    this.net.version++;
  }

  setNodeControl(id: string, control: Node["control"]) {
    const n = this.net.nodes.get(id);
    if (!n) return;
    this.pushHistory();
    n.control = control;
    if (control === "signal") n.signal = makeSignal(n, this.net.edgesAt(id), n.signal);
    else n.signal = undefined;
    if (control === "roundabout") {
      n.roundabout = n.roundabout ?? { radius: 14, lanes: 1 };
      const cost = 180_000;
      if (cost <= this.budget) this.budget -= cost;
    } else n.roundabout = undefined;
    this.net.version++;
  }

  addLot(pos: Vec2, angle: number) {
    const cost = 60_000;
    if (cost > this.budget) {
      this.notify("Budget reicht nicht", "warn");
      return;
    }
    this.pushHistory();
    this.lots.push({
      id: `p${lotId++}`,
      pos,
      angle,
      rows: 3,
      cols: 6,
      edgeId: null,
      occupied: 0,
      name: `Parkplatz ${this.lots.length + 1}`,
    });
    this.sim.lots = this.lots;
    this.budget -= cost;
  }

  addSign(pos: Vec2, kind: Sign["kind"], text: string) {
    this.pushHistory();
    this.signs.push({ id: `s${signId++}`, pos, kind, text, value: 50 });
    this.budget -= 4000;
  }

  pickEdge(p: Vec2, maxDist = 12): Edge | null {
    let best: Edge | null = null;
    let bd = maxDist;
    for (const e of this.net.edges.values()) {
      for (let i = 1; i < e.pts.length; i++) {
        const a = e.pts[i - 1];
        const b = e.pts[i];
        const ab = { x: b.x - a.x, y: b.y - a.y };
        const l2 = ab.x * ab.x + ab.y * ab.y || 1;
        let t = ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2;
        t = Math.max(0, Math.min(1, t));
        const d = dist({ x: a.x + ab.x * t, y: a.y + ab.y * t }, p);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
    }
    return best;
  }

  pickNode(p: Vec2, maxDist = 14): Node | null {
    let best: Node | null = null;
    let bd = maxDist;
    for (const n of this.net.nodes.values()) {
      const d = dist(n.pos, p);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  snapCandidate(p: Vec2): Vec2 | null {
    const n = this.pickNode(p, 12);
    if (n) return n.pos;
    const e = this.pickEdge(p, 8);
    if (e) {
      let best: Vec2 | null = null;
      let bd = 8;
      for (let i = 1; i < e.pts.length; i++) {
        const a = e.pts[i - 1];
        const b = e.pts[i];
        const ab = { x: b.x - a.x, y: b.y - a.y };
        const l2 = ab.x * ab.x + ab.y * ab.y || 1;
        let t = ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2;
        t = Math.max(0, Math.min(1, t));
        const pt = { x: a.x + ab.x * t, y: a.y + ab.y * t };
        const d = dist(pt, p);
        if (d < bd) {
          bd = d;
          best = pt;
        }
      }
      return best;
    }
    return null;
  }

  // ---------- persistence ----------
  save(slot = "auto") {
    const data = { ...this.snapshot(), seed: this.seed, timeOfDay: this.sim.timeOfDay };
    try {
      localStorage.setItem(`traffic-save-${slot}`, JSON.stringify(data));
      this.notify("Gespeichert");
    } catch {
      this.notify("Speichern fehlgeschlagen", "warn");
    }
  }

  load(slot = "auto"): boolean {
    try {
      const raw = localStorage.getItem(`traffic-save-${slot}`);
      if (!raw) return false;
      const data = JSON.parse(raw) as Snapshot & { seed: number; timeOfDay: number };
      resetIds();
      this.seed = data.seed ?? this.seed;
      this.terrain = generateTerrain(this.seed);
      this.restore(data);
      this.sim.reset();
      this.sim.timeOfDay = data.timeOfDay ?? 8 * 3600;
      this.notify("Geladen");
      return true;
    } catch {
      return false;
    }
  }

  exportJson(): string {
    return JSON.stringify({ ...this.snapshot(), seed: this.seed }, null, 2);
  }

  importJson(text: string) {
    try {
      const data = JSON.parse(text) as Snapshot & { seed: number };
      resetIds();
      this.seed = data.seed ?? this.seed;
      this.terrain = generateTerrain(this.seed);
      this.restore(data);
      this.sim.reset();
      this.notify("Importiert");
    } catch {
      this.notify("Datei konnte nicht gelesen werden", "warn");
    }
  }

  startScenario(sc: Scenario) {
    resetIds();
    this.scenario = sc;
    this.scenarioTime = 0;
    this.scenarioDone = null;
    this.seed = sc.seed;
    this.terrain = generateTerrain(sc.seed);
    this.net.clear();
    this.signs = [];
    this.lots = [];
    this.sim.lots = this.lots;
    this.sim.reset();
    this.sim.demand = sc.demand;
    this.budget = sc.budget;
    this.spent = 0;
    this.undoStack = [];
    this.redoStack = [];
    sc.preset?.(this.net);
    this.notify(sc.title);
  }

  evaluateScenario() {
    const sc = this.scenario;
    if (!sc) return;
    const s = this.sim.stats;
    let stars = 0;
    if (s.avgSpeed >= sc.goalSpeed * 0.7 && s.avgWait <= sc.goalWait * 1.5) stars = 1;
    if (s.avgSpeed >= sc.goalSpeed * 0.85 && s.avgWait <= sc.goalWait * 1.2) stars = 2;
    if (s.avgSpeed >= sc.goalSpeed && s.avgWait <= sc.goalWait) stars = 3;
    this.scenarioDone = {
      stars,
      text:
        stars === 0
          ? "Ziel verfehlt – zu viel Stau."
          : stars === 3
            ? "Perfekt geplant!"
            : "Läuft, aber da geht mehr.",
    };
  }
}
