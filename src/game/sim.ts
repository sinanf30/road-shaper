import { pointAt, type Vec2 } from "./geometry";
import { laneCount, laneOffset, type Network } from "./network";
import { canTravel, findRoute, otherNode } from "./routing";
import {
  ROAD_SPECS,
  VEHICLE_SPECS,
  type DriverStyle,
  type Edge,
  type Incident,
  type ParkingLot,
  type Vehicle,
  type VehicleKind,
} from "./types";

let vid = 1;

const STYLE: Record<DriverStyle, { gap: number; speed: number; patience: number; reroute: number }> = {
  calm: { gap: 2.4, speed: 0.9, patience: 1.4, reroute: 0.2 },
  normal: { gap: 1.7, speed: 1.0, patience: 1.0, reroute: 0.5 },
  aggressive: { gap: 1.1, speed: 1.15, patience: 0.6, reroute: 0.85 },
};

export interface SimStats {
  vehicles: number;
  avgSpeed: number;
  avgWait: number;
  arrived: number;
  spawned: number;
  jammed: number;
  satisfaction: number;
  parked: number;
}

export interface Weather {
  kind: "clear" | "rain" | "fog" | "ice";
  factor: number;
}

const WEATHER: Record<Weather["kind"], number> = {
  clear: 1,
  rain: 0.85,
  fog: 0.75,
  ice: 0.65,
};

export class Simulation {
  net: Network;
  vehicles: Vehicle[] = [];
  incidents: Incident[] = [];
  lots: ParkingLot[] = [];
  timeOfDay = 8 * 3600; // seconds
  weather: Weather = { kind: "clear", factor: 1 };
  demand = 1;
  stats: SimStats = {
    vehicles: 0,
    avgSpeed: 0,
    avgWait: 0,
    arrived: 0,
    spawned: 0,
    jammed: 0,
    satisfaction: 100,
    parked: 0,
  };
  history: { t: number; speed: number; wait: number; count: number }[] = [];
  private spawnAcc = 0;
  private statAcc = 0;
  private buckets = new Map<string, Vehicle[]>();
  private nodeBusy = new Map<string, number>();
  private routeVersion = -1;
  maxVehicles = 900;

  constructor(net: Network) {
    this.net = net;
  }

  reset() {
    this.vehicles = [];
    this.incidents = [];
    this.stats = {
      vehicles: 0,
      avgSpeed: 0,
      avgWait: 0,
      arrived: 0,
      spawned: 0,
      jammed: 0,
      satisfaction: 100,
      parked: 0,
    };
    this.history = [];
  }

  /** Nodes that generate and absorb traffic (dead ends / map border stubs). */
  terminals(): string[] {
    const out: string[] = [];
    for (const [id, list] of this.net.adj) {
      if (list.length === 1 && this.net.nodes.has(id)) out.push(id);
    }
    return out;
  }

  /** Demand multiplier over the day (rush hours). */
  demandCurve(): number {
    const h = this.timeOfDay / 3600;
    const peak = (c: number, w: number, a: number) =>
      a * Math.exp(-((h - c) * (h - c)) / (2 * w * w));
    return 0.12 + peak(8, 1.1, 1) + peak(12.5, 1.0, 0.45) + peak(17.5, 1.3, 1.05) + peak(21, 1.4, 0.2);
  }

  pickKind(): VehicleKind {
    const r = Math.random();
    let acc = 0;
    for (const spec of Object.values(VEHICLE_SPECS)) {
      acc += spec.share;
      if (r <= acc) return spec.kind;
    }
    return "car";
  }

  spawn(): boolean {
    const terms = this.terminals();
    if (terms.length < 2) return false;
    const origin = terms[(Math.random() * terms.length) | 0];
    let dest = terms[(Math.random() * terms.length) | 0];
    let guard = 0;
    while (dest === origin && guard++ < 10) dest = terms[(Math.random() * terms.length) | 0];
    if (dest === origin) return false;

    const styleRoll = Math.random();
    const style: DriverStyle = styleRoll < 0.25 ? "calm" : styleRoll < 0.85 ? "normal" : "aggressive";
    const route = findRoute(this.net, origin, dest, { awareness: STYLE[style].reroute });
    if (!route || !route.length) return false;

    const first = this.net.edges.get(route[0]);
    if (!first) return false;
    const dir: 1 | -1 = first.from === origin ? 1 : -1;
    const lanes = laneCount(first, dir);
    if (lanes < 1) return false;
    const lane = (Math.random() * lanes) | 0;
    const kind = this.pickKind();
    const spec = VEHICLE_SPECS[kind];

    // do not spawn on top of another vehicle
    const bucket = this.buckets.get(`${first.id}:${dir}:${lane}`) ?? [];
    if (bucket.some((v) => v.s < spec.length + 6)) return false;

    const veh: Vehicle = {
      id: vid++,
      kind,
      style,
      color: spec.color[(Math.random() * spec.color.length) | 0],
      edgeId: first.id,
      dir,
      lane,
      s: 0,
      speed: Math.min(first.speed / 3.6, 10),
      route,
      routeIdx: 0,
      destNode: dest,
      originNode: origin,
      wait: 0,
      totalWait: 0,
      age: 0,
      laneOffset: laneOffset(first, dir, lane),
      targetLane: lane,
      parkingId: null,
      parkTimer: 0,
      state: "drive",
      reroutes: 0,
      pos: first.pts[0],
      heading: 0,
      braking: false,
    };
    this.vehicles.push(veh);
    this.stats.spawned++;
    return true;
  }

  private rebuildBuckets() {
    this.buckets.clear();
    for (const v of this.vehicles) {
      if (v.state === "parked") continue;
      const key = `${v.edgeId}:${v.dir}:${v.lane}`;
      const list = this.buckets.get(key);
      if (list) list.push(v);
      else this.buckets.set(key, [v]);
    }
    for (const list of this.buckets.values()) list.sort((a, b) => a.s - b.s);
  }

  private leaderOf(v: Vehicle, lane = v.lane): Vehicle | null {
    const list = this.buckets.get(`${v.edgeId}:${v.dir}:${lane}`);
    if (!list) return null;
    let best: Vehicle | null = null;
    for (const o of list) {
      if (o === v) continue;
      if (o.s > v.s && (!best || o.s < best.s)) best = o;
    }
    return best;
  }

  private followerOf(v: Vehicle, lane: number): Vehicle | null {
    const list = this.buckets.get(`${v.edgeId}:${v.dir}:${lane}`);
    if (!list) return null;
    let best: Vehicle | null = null;
    for (const o of list) {
      if (o === v) continue;
      if (o.s < v.s && (!best || o.s > best.s)) best = o;
    }
    return best;
  }

  /** Is the given edge allowed to move through the node right now? */
  private hasGreen(nodeId: string, edgeId: string): boolean {
    const node = this.net.nodes.get(nodeId);
    if (!node || node.control !== "signal" || !node.signal) return true;
    const sig = node.signal;
    const phase = sig.phases[sig.index];
    if (!phase) return true;
    if (sig.timer > phase.green) return false; // amber/all-red
    return phase.edges.includes(edgeId);
  }

  private updateSignals(dt: number) {
    for (const node of this.net.nodes.values()) {
      if (node.control !== "signal" || !node.signal) continue;
      const sig = node.signal;
      const phase = sig.phases[sig.index];
      if (!phase) continue;
      sig.timer += dt;
      let green = phase.green;
      if (sig.adaptive) {
        // extend green if queue present, cut it short if empty
        const waiting = this.queueFor(node.id, phase.edges);
        const others = this.queueFor(
          node.id,
          sig.phases.flatMap((p, i) => (i === sig.index ? [] : p.edges)),
        );
        if (waiting > 2 && sig.timer < phase.green * 2) green = phase.green * 1.6;
        if (waiting === 0 && others > 0) green = Math.min(green, 5);
      }
      if (sig.timer > green + sig.amber) {
        sig.timer = 0;
        sig.index = (sig.index + 1) % sig.phases.length;
      }
    }
  }

  private queueFor(nodeId: string, edgeIds: string[]): number {
    let n = 0;
    for (const v of this.vehicles) {
      if (v.speed > 2) continue;
      if (!edgeIds.includes(v.edgeId)) continue;
      const e = this.net.edges.get(v.edgeId);
      if (!e) continue;
      const endNode = v.dir === 1 ? e.to : e.from;
      if (endNode !== nodeId) continue;
      const remaining = v.dir === 1 ? e.length - v.s : e.length - v.s;
      if (remaining < 40) n++;
    }
    return n;
  }

  /** Simple priority check for stop/yield/roundabout nodes. */
  private conflictAt(v: Vehicle, nodeId: string): boolean {
    const node = this.net.nodes.get(nodeId);
    if (!node) return false;
    const busy = this.nodeBusy.get(nodeId) ?? 0;
    if (busy > (node.control === "roundabout" ? 3 : 1)) return true;
    if (node.control === "none" || node.control === "signal") return false;
    for (const o of this.vehicles) {
      if (o === v || o.state === "parked") continue;
      if (o.edgeId === v.edgeId) continue;
      const e = this.net.edges.get(o.edgeId);
      if (!e) continue;
      const endNode = o.dir === 1 ? e.to : e.from;
      if (endNode !== nodeId) continue;
      const remaining = e.length - o.s;
      if (remaining < 18 && o.speed > 1.2) return true;
    }
    return false;
  }

  /** Desired speed for a vehicle on its current edge. */
  private desiredSpeed(v: Vehicle, e: Edge): number {
    const spec = VEHICLE_SPECS[v.kind];
    const base = (e.speed / 3.6) * spec.speedFactor * STYLE[v.style].speed;
    return base * this.weather.factor * (e.blocked > 0 ? 0.35 : 1);
  }

  /** IDM acceleration. */
  private idm(v: Vehicle, e: Edge, gap: number, leaderSpeed: number): number {
    const spec = VEHICLE_SPECS[v.kind];
    const v0 = this.desiredSpeed(v, e);
    const T = STYLE[v.style].gap * (this.weather.kind === "clear" ? 1 : 1.3);
    const s0 = 2 + spec.length * 0.2;
    const dv = v.speed - leaderSpeed;
    const sStar = s0 + Math.max(0, v.speed * T + (v.speed * dv) / (2 * Math.sqrt(spec.accel * spec.brake)));
    const free = 1 - Math.pow(v.speed / Math.max(1, v0), 4);
    const inter = gap > 0 ? Math.pow(sStar / Math.max(0.5, gap), 2) : 4;
    return spec.accel * (free - inter);
  }

  private tryLaneChange(v: Vehicle, e: Edge) {
    const lanes = laneCount(e, v.dir);
    if (lanes < 2) return;
    const spec = VEHICLE_SPECS[v.kind];
    const remaining = e.length - v.s;
    // Lane needed for the next turn: prefer outer lane before junctions
    let desired = v.lane;
    const leader = this.leaderOf(v);
    const leaderGap = leader ? leader.s - v.s - spec.length : Infinity;
    if (leaderGap < 25 && v.speed < this.desiredSpeed(v, e) * 0.7) {
      // overtake urge
      for (const cand of [v.lane + 1, v.lane - 1]) {
        if (cand < 0 || cand >= lanes) continue;
        const cl = this.leaderOf(v, cand);
        const gap = cl ? cl.s - v.s - spec.length : Infinity;
        if (gap > leaderGap + 12) desired = cand;
      }
    }
    if (remaining < 70 && lanes > 1) {
      // move towards the rightmost lane for exits at junctions
      const next = this.net.edges.get(v.route[v.routeIdx + 1] ?? "");
      if (next && next.type !== "autobahn" && v.lane > 0) desired = Math.max(0, v.lane - 1);
    }
    if (desired === v.lane) return;
    // safety check (MOBIL-style)
    const fol = this.followerOf(v, desired);
    const lead = this.leaderOf(v, desired);
    const backGap = fol ? v.s - fol.s - VEHICLE_SPECS[fol.kind].length : Infinity;
    const frontGap = lead ? lead.s - v.s - spec.length : Infinity;
    const need = 6 + v.speed * 0.6;
    if (backGap > need * 0.8 && frontGap > need) {
      v.lane = desired;
      v.targetLane = desired;
    }
  }

  private advanceToNextEdge(v: Vehicle, e: Edge): boolean {
    const nodeId = v.dir === 1 ? e.to : e.from;
    const nextId = v.route[v.routeIdx + 1];
    if (!nextId) return false;
    const next = this.net.edges.get(nextId);
    if (!next) return false;
    const dir: 1 | -1 = next.from === nodeId ? 1 : -1;
    const lanes = laneCount(next, dir);
    if (lanes < 1) return false;
    let lane = Math.min(v.lane, lanes - 1);
    // Entry must be free
    const bucket = this.buckets.get(`${next.id}:${dir}:${lane}`) ?? [];
    const spec = VEHICLE_SPECS[v.kind];
    const blocked = bucket.some((o) => o.s < spec.length + 3);
    if (blocked) {
      const alt = [...Array(lanes).keys()].find((l) => {
        const b = this.buckets.get(`${next.id}:${dir}:${l}`) ?? [];
        return !b.some((o) => o.s < spec.length + 3);
      });
      if (alt === undefined) return false;
      lane = alt;
    }
    v.edgeId = next.id;
    v.dir = dir;
    v.lane = lane;
    v.targetLane = lane;
    v.s = 0;
    v.routeIdx++;
    this.nodeBusy.set(nodeId, (this.nodeBusy.get(nodeId) ?? 0) + 1);
    next.stat.flow++;
    return true;
  }

  private maybeReroute(v: Vehicle) {
    if (v.reroutes > 3) return;
    if (Math.random() > STYLE[v.style].reroute * 0.5) return;
    const e = this.net.edges.get(v.edgeId);
    if (!e) return;
    const from = v.dir === 1 ? e.to : e.from;
    const route = findRoute(this.net, from, v.destNode, {
      awareness: STYLE[v.style].reroute,
    });
    if (route && route.length) {
      v.route = [v.edgeId, ...route];
      v.routeIdx = 0;
      v.reroutes++;
    }
  }

  step(dt: number) {
    const net = this.net;
    this.timeOfDay = (this.timeOfDay + dt * 60) % 86400;
    this.weather.factor = WEATHER[this.weather.kind];
    this.updateSignals(dt);
    this.rebuildBuckets();
    this.nodeBusy.clear();

    // incidents
    for (const inc of this.incidents) {
      inc.remaining -= dt;
      const e = net.edges.get(inc.edgeId);
      if (e) e.blocked = Math.max(0, inc.remaining);
    }
    this.incidents = this.incidents.filter((i) => i.remaining > 0);

    // network changed -> refresh routes lazily
    if (net.version !== this.routeVersion) {
      this.routeVersion = net.version;
      for (const v of this.vehicles) {
        if (!net.edges.has(v.edgeId)) {
          v.state = "leaving";
          continue;
        }
        const valid = v.route.every((id) => net.edges.has(id));
        if (!valid) {
          const e = net.edges.get(v.edgeId)!;
          const from = v.dir === 1 ? e.to : e.from;
          const r = findRoute(net, from, v.destNode, { awareness: 0.5 });
          if (r) {
            v.route = [v.edgeId, ...r];
            v.routeIdx = 0;
          } else v.state = "leaving";
        }
      }
    }

    const done: Vehicle[] = [];
    let speedSum = 0;
    let jammed = 0;
    let waitSum = 0;

    for (const v of this.vehicles) {
      const e = net.edges.get(v.edgeId);
      if (!e || v.state === "leaving") {
        done.push(v);
        continue;
      }
      v.age += dt;

      if (v.state === "parking") {
        v.parkTimer -= dt;
        v.speed = Math.max(0, v.speed - 4 * dt);
        if (v.parkTimer <= 0) {
          v.state = "parked";
          const lot = this.lots.find((l) => l.id === v.parkingId);
          if (lot) lot.occupied = Math.min(lot.rows * lot.cols, lot.occupied + 1);
          done.push(v);
          this.stats.parked++;
        }
        continue;
      }

      this.tryLaneChange(v, e);

      const spec = VEHICLE_SPECS[v.kind];
      const leader = this.leaderOf(v);
      let gap = Infinity;
      let leaderSpeed = 30;
      if (leader) {
        gap = leader.s - v.s - spec.length;
        leaderSpeed = leader.speed;
      }

      // node constraint at the end of the edge
      const endNode = v.dir === 1 ? e.to : e.from;
      const node = net.nodes.get(endNode);
      const toEnd = e.length - v.s;
      const isLast = v.routeIdx >= v.route.length - 1;
      let nodeStop = false;
      if (node && toEnd < 90) {
        if (!this.hasGreen(endNode, e.id)) nodeStop = true;
        else if (node.control === "stop" && v.speed > 0.6 && toEnd < 8) nodeStop = true;
        else if ((node.control === "yield" || node.control === "roundabout") && toEnd < 16 && this.conflictAt(v, endNode))
          nodeStop = true;
        else if (node.crosswalk && toEnd < 12 && Math.random() < 0.002) nodeStop = true;
        if (!isLast && toEnd < 6) {
          const nextId = v.route[v.routeIdx + 1];
          const next = net.edges.get(nextId ?? "");
          if (next) {
            const dir: 1 | -1 = next.from === endNode ? 1 : -1;
            const b = this.buckets.get(`${next.id}:${dir}:${Math.min(v.lane, laneCount(next, dir) - 1)}`) ?? [];
            if (b.some((o) => o.s < spec.length + 3)) nodeStop = true;
          }
        }
      }
      if (nodeStop) {
        const stopGap = Math.max(0, toEnd - 2.5);
        if (stopGap < gap) {
          gap = stopGap;
          leaderSpeed = 0;
        }
      }
      // incidents on this edge
      for (const inc of this.incidents) {
        if (inc.edgeId !== e.id) continue;
        const d = (v.dir === 1 ? inc.s : e.length - inc.s) - v.s;
        if (d > 0 && d < gap && v.lane === 0) {
          gap = Math.max(0, d - 3);
          leaderSpeed = 0;
        }
      }

      const a = Math.max(-spec.brake * 1.4, Math.min(spec.accel, this.idm(v, e, gap, leaderSpeed)));
      v.braking = a < -0.8;
      v.speed = Math.max(0, v.speed + a * dt);
      v.s += v.speed * dt;

      if (v.speed < 1.5) {
        v.wait += dt;
        v.totalWait += dt;
        if (v.wait > 6) jammed++;
        if (v.wait > 25) this.maybeReroute(v);
      } else v.wait = 0;

      if (v.s >= e.length) {
        if (isLast) {
          done.push(v);
          this.stats.arrived++;
          continue;
        }
        v.s = e.length;
        if (!this.advanceToNextEdge(v, e)) {
          v.s = e.length - 0.1;
          v.speed = 0;
        }
      }

      // render position
      const cur = net.edges.get(v.edgeId)!;
      const sAlong = v.dir === 1 ? v.s : cur.length - v.s;
      const { p, t } = pointAt(cur.pts, cur.cum, sAlong);
      const off = laneOffset(cur, v.dir, v.lane);
      const nx = -t.y;
      const ny = t.x;
      const sign = v.dir === 1 ? 1 : -1;
      v.laneOffset += (off - v.laneOffset) * Math.min(1, dt * 3);
      v.pos = { x: p.x + nx * v.laneOffset, y: p.y + ny * v.laneOffset };
      v.heading = Math.atan2(t.y * sign, t.x * sign);

      speedSum += v.speed;
      waitSum += v.totalWait;
      cur.stat.speedSum += v.speed;
      cur.stat.speedN++;
    }

    if (done.length) {
      const set = new Set(done);
      this.vehicles = this.vehicles.filter((v) => !set.has(v));
    }

    // spawning
    const rate = this.demandCurve() * this.demand * 2.6;
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.vehicles.length < this.maxVehicles) this.spawn();
    }

    // stats
    const n = this.vehicles.length;
    this.stats.vehicles = n;
    this.stats.avgSpeed = n ? (speedSum / n) * 3.6 : 0;
    this.stats.avgWait = n ? waitSum / n : 0;
    this.stats.jammed = jammed;
    const jamRatio = n ? jammed / n : 0;
    this.stats.satisfaction = Math.max(
      0,
      Math.round(100 - jamRatio * 120 - Math.min(40, this.stats.avgWait * 1.2)),
    );

    // per-edge load (rolling)
    this.statAcc += dt;
    if (this.statAcc > 1) {
      this.statAcc = 0;
      const counts = new Map<string, number>();
      for (const v of this.vehicles) counts.set(v.edgeId, (counts.get(v.edgeId) ?? 0) + 1);
      for (const e of net.edges.values()) {
        const cap = Math.max(1, ((e.lanesFwd + e.lanesBwd) * e.length) / 12);
        const load = (counts.get(e.id) ?? 0) / cap;
        e.stat.load = e.stat.load * 0.7 + load * 0.3;
        e.stat.speedSum *= 0.7;
        e.stat.speedN *= 0.7;
      }
      this.history.push({
        t: this.timeOfDay,
        speed: this.stats.avgSpeed,
        wait: this.stats.avgWait,
        count: n,
      });
      if (this.history.length > 240) this.history.shift();
    }
  }

  /** Worst congestion spots for the bottleneck assistant. */
  bottlenecks(): { edge: Edge; load: number; reason: string }[] {
    const list = [...this.net.edges.values()]
      .map((e) => ({ edge: e, load: e.stat.load, reason: reasonFor(this.net, e) }))
      .filter((x) => x.load > 0.35)
      .sort((a, b) => b.load - a.load);
    return list.slice(0, 3);
  }

  triggerIncident(kind: "accident" | "works") {
    const edges = [...this.net.edges.values()];
    if (!edges.length) return null;
    const e = edges[(Math.random() * edges.length) | 0];
    const inc: Incident = {
      id: `i${vid++}`,
      edgeId: e.id,
      s: e.length * (0.2 + Math.random() * 0.6),
      kind,
      remaining: kind === "accident" ? 90 : 240,
    };
    this.incidents.push(inc);
    return inc;
  }
}

function reasonFor(net: Network, e: Edge): string {
  const endNode = net.nodes.get(e.to);
  const lanes = e.lanesFwd + e.lanesBwd;
  if (e.blocked > 0) return "Blockiert durch Zwischenfall";
  if (endNode?.control === "signal") return "Rückstau vor Ampel";
  if (endNode?.control === "stop") return "Stoppschild bremst den Fluss";
  if (lanes <= 2) return "Zu wenig Spuren für die Nachfrage";
  return "Hohe Auslastung";
}

export { STYLE, ROAD_SPECS, canTravel, otherNode };
