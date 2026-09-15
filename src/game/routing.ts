import type { Network } from "./network";
import type { Edge } from "./types";

export function canTravel(e: Edge, fromNode: string): boolean {
  if (e.from === fromNode) return e.oneWay ? e.lanesFwd > 0 : e.lanesFwd > 0;
  if (e.to === fromNode) return !e.oneWay && e.lanesBwd > 0;
  return false;
}

export function otherNode(e: Edge, nodeId: string): string {
  return e.from === nodeId ? e.to : e.from;
}

interface RouteOpts {
  /** 0 = ignores congestion, 1 = fully avoids jams */
  awareness?: number;
}

/** A* over the road graph. Returns edge ids or null. */
export function findRoute(
  net: Network,
  start: string,
  goal: string,
  opts: RouteOpts = {},
): string[] | null {
  if (start === goal) return [];
  const aware = opts.awareness ?? 0.5;
  const goalNode = net.nodes.get(goal);
  const startNode = net.nodes.get(start);
  if (!goalNode || !startNode) return null;

  const h = (id: string) => {
    const n = net.nodes.get(id)!;
    return Math.hypot(n.pos.x - goalNode.pos.x, n.pos.y - goalNode.pos.y) / 33;
  };

  const open: { id: string; f: number }[] = [{ id: start, f: h(start) }];
  const gScore = new Map<string, number>([[start, 0]]);
  const cameFrom = new Map<string, { node: string; edge: string }>();
  const closed = new Set<string>();
  let guard = 0;

  while (open.length && guard++ < 20000) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    if (cur.id === goal) break;
    if (closed.has(cur.id)) continue;
    closed.add(cur.id);
    const g = gScore.get(cur.id) ?? Infinity;

    for (const e of net.edgesAt(cur.id)) {
      if (!canTravel(e, cur.id)) continue;
      if (e.blocked > 0) continue;
      const nxt = otherNode(e, cur.id);
      if (closed.has(nxt)) continue;
      const node = net.nodes.get(nxt);
      const jam = Math.min(2.5, e.stat.load);
      const speed = Math.max(8, e.speed) / 3.6;
      let cost = e.length / speed;
      cost *= 1 + aware * jam;
      if (node) {
        if (node.control === "signal") cost += 10;
        else if (node.control === "stop") cost += 4;
        else if (node.control === "yield") cost += 2;
        else if (node.control === "roundabout") cost += 3;
        if (node.crosswalk) cost += 2;
      }
      const tentative = g + cost;
      if (tentative < (gScore.get(nxt) ?? Infinity)) {
        gScore.set(nxt, tentative);
        cameFrom.set(nxt, { node: cur.id, edge: e.id });
        open.push({ id: nxt, f: tentative + h(nxt) });
      }
    }
  }

  if (!cameFrom.has(goal)) return null;
  const edges: string[] = [];
  let cur = goal;
  let guard2 = 0;
  while (cur !== start && guard2++ < 5000) {
    const step = cameFrom.get(cur);
    if (!step) return null;
    edges.unshift(step.edge);
    cur = step.node;
  }
  return edges;
}
