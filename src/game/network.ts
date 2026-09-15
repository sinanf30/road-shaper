import {
  cumulative,
  dist,
  polyLength,
  segIntersect,
  splitPoly,
  type Vec2,
} from "./geometry";
import { ROAD_SPECS, type Edge, type Node, type RoadType, type SignalConfig } from "./types";

let idc = 1;
const nid = (p: string) => `${p}${idc++}`;

export function resetIds() {
  idc = 1;
}

export class Network {
  nodes = new Map<string, Node>();
  edges = new Map<string, Edge>();
  /** node id -> edge ids */
  adj = new Map<string, string[]>();
  version = 0;

  clear() {
    this.nodes.clear();
    this.edges.clear();
    this.adj.clear();
    this.version++;
  }

  edgesAt(nodeId: string): Edge[] {
    return (this.adj.get(nodeId) ?? [])
      .map((id) => this.edges.get(id))
      .filter(Boolean) as Edge[];
  }

  private link(nodeId: string, edgeId: string) {
    const list = this.adj.get(nodeId) ?? [];
    if (!list.includes(edgeId)) list.push(edgeId);
    this.adj.set(nodeId, list);
  }

  private unlink(nodeId: string, edgeId: string) {
    const list = (this.adj.get(nodeId) ?? []).filter((e) => e !== edgeId);
    this.adj.set(nodeId, list);
  }

  addNode(pos: Vec2, level = 0): Node {
    const n: Node = {
      id: nid("n"),
      pos,
      level,
      control: "none",
      crosswalk: false,
    };
    this.nodes.set(n.id, n);
    this.adj.set(n.id, []);
    return n;
  }

  /** Existing node within radius, matching level. */
  findNode(pos: Vec2, radius: number, level: number): Node | null {
    let best: Node | null = null;
    let bd = radius;
    for (const n of this.nodes.values()) {
      if (n.level !== level) continue;
      const d = dist(n.pos, pos);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  addEdge(
    from: string,
    to: string,
    pts: Vec2[],
    type: RoadType,
    opts: Partial<Edge> = {},
  ): Edge {
    const spec = ROAD_SPECS[type];
    const cum = cumulative(pts);
    const e: Edge = {
      id: nid("e"),
      from,
      to,
      pts,
      cum,
      length: cum[cum.length - 1],
      type,
      lanesFwd: opts.lanesFwd ?? spec.lanes,
      lanesBwd: opts.oneWay ? 0 : (opts.lanesBwd ?? spec.lanes),
      oneWay: opts.oneWay ?? false,
      speed: opts.speed ?? spec.speed,
      level: opts.level ?? this.nodes.get(from)?.level ?? 0,
      trees: opts.trees ?? type !== "autobahn",
      sidewalk: opts.sidewalk ?? (type === "haupt" || type === "land"),
      bus: opts.bus ?? false,
      blocked: 0,
      name: opts.name,
      stat: { flow: 0, speedSum: 0, speedN: 0, load: 0 },
    };
    this.edges.set(e.id, e);
    this.link(from, e.id);
    this.link(to, e.id);
    this.version++;
    return e;
  }

  removeEdge(id: string) {
    const e = this.edges.get(id);
    if (!e) return;
    this.edges.delete(id);
    this.unlink(e.from, id);
    this.unlink(e.to, id);
    for (const nId of [e.from, e.to]) {
      if ((this.adj.get(nId) ?? []).length === 0) {
        this.nodes.delete(nId);
        this.adj.delete(nId);
      } else {
        this.refreshControl(nId);
      }
    }
    this.version++;
  }

  /** Split an edge at arc lengths, creating intermediate nodes. Returns node ids in order. */
  splitEdgeAt(edgeId: string, cuts: number[]): string[] {
    const e = this.edges.get(edgeId);
    if (!e) return [];
    const pieces = splitPoly(e.pts, cuts);
    if (pieces.length < 2) return [];
    const ids: string[] = [];
    let prev = e.from;
    this.edges.delete(edgeId);
    this.unlink(e.from, edgeId);
    this.unlink(e.to, edgeId);
    pieces.forEach((piece, i) => {
      const last = i === pieces.length - 1;
      const endNode = last ? e.to : this.addNode(piece[piece.length - 1], e.level).id;
      if (!last) ids.push(endNode);
      this.addEdge(prev, endNode, piece, e.type, {
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
      prev = endNode;
    });
    for (const id of ids) this.refreshControl(id);
    this.refreshControl(e.from);
    this.refreshControl(e.to);
    return ids;
  }

  /**
   * Build a road along a polyline: snaps ends, splits crossing edges,
   * creates intersections automatically.
   */
  build(
    ptsIn: Vec2[],
    type: RoadType,
    opts: { oneWay?: boolean; level?: number; lanes?: number; speed?: number } = {},
  ): Edge[] {
    const level = opts.level ?? 0;
    const pts = ptsIn.slice();
    if (polyLength(pts) < 4) return [];
    const snapR = 9;

    // Intersections with existing edges at the same level.
    type Hit = { sNew: number; edgeId: string; sOld: number; p: Vec2 };
    const hits: Hit[] = [];
    if (type !== "autobahn") {
      for (const e of this.edges.values()) {
        if (e.level !== level || e.type === "autobahn") continue;
        let accNew = 0;
        for (let i = 1; i < pts.length; i++) {
          const a1 = pts[i - 1];
          const a2 = pts[i];
          const segN = dist(a1, a2);
          let accOld = 0;
          for (let j = 1; j < e.pts.length; j++) {
            const b1 = e.pts[j - 1];
            const b2 = e.pts[j];
            const segO = dist(b1, b2);
            const x = segIntersect(a1, a2, b1, b2);
            if (x) hits.push({ sNew: accNew + x.t * segN, edgeId: e.id, sOld: accOld + x.u * segO, p: x.p });
            accOld += segO;
          }
          accNew += segN;
        }
      }
    }

    // Split existing edges, remember node at each hit.
    const byEdge = new Map<string, Hit[]>();
    for (const h of hits) {
      const l = byEdge.get(h.edgeId) ?? [];
      l.push(h);
      byEdge.set(h.edgeId, l);
    }
    const crossNodes: { sNew: number; nodeId: string; p: Vec2 }[] = [];
    for (const [edgeId, list] of byEdge) {
      const sorted = [...list].sort((a, b) => a.sOld - b.sOld);
      const cuts = sorted.map((h) => h.sOld);
      const newIds = this.splitEdgeAt(edgeId, cuts);
      newIds.forEach((nodeId, i) => {
        const h = sorted[i];
        if (h) crossNodes.push({ sNew: h.sNew, nodeId, p: h.p });
      });
    }

    // Start / end node: snap to existing nodes or split an existing edge.
    const startNode = this.nodeForEndpoint(pts[0], snapR, level);
    const endNode = this.nodeForEndpoint(pts[pts.length - 1], snapR, level);
    pts[0] = this.nodes.get(startNode)!.pos;
    pts[pts.length - 1] = this.nodes.get(endNode)!.pos;

    crossNodes.sort((a, b) => a.sNew - b.sNew);
    const pieces = splitPoly(pts, crossNodes.map((c) => c.sNew));
    const created: Edge[] = [];
    let prev = startNode;
    pieces.forEach((piece, i) => {
      const last = i === pieces.length - 1;
      const node = last ? endNode : crossNodes[i]?.nodeId;
      if (!node) return;
      // snap piece ends to node positions
      piece[0] = this.nodes.get(prev)!.pos;
      piece[piece.length - 1] = this.nodes.get(node)!.pos;
      if (prev === node) return;
      created.push(
        this.addEdge(prev, node, piece, type, {
          oneWay: opts.oneWay,
          level,
          lanesFwd: opts.lanes ?? ROAD_SPECS[type].lanes,
          lanesBwd: opts.oneWay ? 0 : (opts.lanes ?? ROAD_SPECS[type].lanes),
          speed: opts.speed,
        }),
      );
      prev = node;
    });
    for (const n of [startNode, endNode, ...crossNodes.map((c) => c.nodeId)])
      this.refreshControl(n);
    this.version++;
    return created;
  }

  private nodeForEndpoint(p: Vec2, snapR: number, level: number): string {
    const existing = this.findNode(p, snapR, level);
    if (existing) return existing.id;
    // snap onto an existing edge -> split it (T junction)
    for (const e of this.edges.values()) {
      if (e.level !== level) continue;
      let acc = 0;
      for (let i = 1; i < e.pts.length; i++) {
        const a = e.pts[i - 1];
        const b = e.pts[i];
        const ab = { x: b.x - a.x, y: b.y - a.y };
        const l2 = ab.x * ab.x + ab.y * ab.y || 1;
        let t = ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2;
        t = Math.max(0, Math.min(1, t));
        const proj = { x: a.x + ab.x * t, y: a.y + ab.y * t };
        const d = dist(proj, p);
        const sHere = acc + t * Math.sqrt(l2);
        if (d < snapR && sHere > 3 && sHere < e.length - 3) {
          const ids = this.splitEdgeAt(e.id, [sHere]);
          if (ids[0]) return ids[0];
        }
        acc += Math.sqrt(l2);
      }
    }
    return this.addNode(p, level).id;
  }

  /** Give a node a sensible default control depending on degree. */
  refreshControl(nodeId: string) {
    const n = this.nodes.get(nodeId);
    if (!n) return;
    const es = this.edgesAt(nodeId);
    if (es.length <= 2) {
      if (n.control === "signal" || n.control === "roundabout") {
        n.control = "none";
        n.signal = undefined;
        n.roundabout = undefined;
      }
      return;
    }
    const heavy = es.some((e) => e.type === "haupt" || e.type === "autobahn");
    if (n.control === "none") n.control = heavy ? "signal" : "yield";
    if (n.control === "signal") n.signal = makeSignal(n, es, n.signal);
  }

  /** Approach direction angle of an edge into a node. */
  approachAngle(e: Edge, nodeId: string): number {
    const pts = e.pts;
    if (e.to === nodeId) {
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      return Math.atan2(b.y - a.y, b.x - a.x);
    }
    const a = pts[1];
    const b = pts[0];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  totalLength(): number {
    let l = 0;
    for (const e of this.edges.values()) l += e.length;
    return l;
  }
}

/** Build/refresh signal phases by pairing opposite approaches. */
export function makeSignal(
  node: Node,
  edges: Edge[],
  old?: SignalConfig,
): SignalConfig {
  const withAngle = edges.map((e) => {
    const pts = e.pts;
    const isTo = e.to === node.id;
    const a = isTo ? pts[pts.length - 2] : pts[1];
    const b = node.pos;
    return { e, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  });
  const used = new Set<string>();
  const phases: { edges: string[]; green: number }[] = [];
  for (const w of withAngle) {
    if (used.has(w.e.id)) continue;
    const group = [w.e.id];
    used.add(w.e.id);
    for (const o of withAngle) {
      if (used.has(o.e.id)) continue;
      let diff = Math.abs(w.angle - o.angle);
      while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
      if (Math.abs(diff - Math.PI) < 0.5 || diff < 0.35) {
        group.push(o.e.id);
        used.add(o.e.id);
      }
    }
    phases.push({ edges: group, green: 18 });
  }
  if (old) {
    // keep previously tuned durations where the group still exists
    phases.forEach((p, i) => {
      const prev = old.phases[i];
      if (prev) p.green = prev.green;
    });
  }
  return {
    phases,
    index: old?.index ?? 0,
    timer: old?.timer ?? 0,
    amber: old?.amber ?? 3,
    adaptive: old?.adaptive ?? false,
    offset: old?.offset ?? 0,
  };
}

export function laneOffset(e: Edge, dir: 1 | -1, lane: number): number {
  const w = ROAD_SPECS[e.type].laneWidth;
  if (e.oneWay) {
    const total = e.lanesFwd;
    return (lane - (total - 1) / 2) * w;
  }
  return dir === 1 ? (lane + 0.5) * w : -(lane + 0.5) * w;
}

export function laneCount(e: Edge, dir: 1 | -1): number {
  if (e.oneWay) return e.lanesFwd;
  return dir === 1 ? e.lanesFwd : e.lanesBwd;
}

export function roadWidth(e: Edge): number {
  const w = ROAD_SPECS[e.type].laneWidth;
  return (e.oneWay ? e.lanesFwd : e.lanesFwd + e.lanesBwd) * w;
}
