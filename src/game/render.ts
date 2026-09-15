import { cumulative, pointAt, type Vec2 } from "./geometry";
import { laneOffset, roadWidth, type Network } from "./network";
import type { Simulation } from "./sim";
import type { Terrain } from "./terrain";
import { ROAD_SPECS, VEHICLE_SPECS, type Edge, type ParkingLot, type Sign } from "./types";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export type Overlay = "none" | "load" | "speed" | "wait";

export interface RenderOpts {
  camera: Camera;
  overlay: Overlay;
  hoverEdge?: string | null;
  selectedNode?: string | null;
  selectedEdge?: string | null;
  preview?: { pts: Vec2[]; type: keyof typeof ROAD_SPECS; valid: boolean } | null;
  snapPoint?: Vec2 | null;
  signs: Sign[];
  lots: ParkingLot[];
  showLabels: boolean;
  followVehicle?: number | null;
  night: number; // 0 day .. 1 night
}

export function worldToScreen(c: Camera, p: Vec2, w: number, h: number): Vec2 {
  return { x: (p.x - c.x) * c.zoom + w / 2, y: (p.y - c.y) * c.zoom + h / 2 };
}
export function screenToWorld(c: Camera, p: Vec2, w: number, h: number): Vec2 {
  return { x: (p.x - w / 2) / c.zoom + c.x, y: (p.y - h / 2) / c.zoom + c.y };
}

const GRASS = "#9a9263";
const GRASS_2 = "#8b8557";
const DIRT = "#b9a678";
const SCRUB = "#7d8358";
const WATER = "#5e7a74";

export class Renderer {
  terrainCanvas: HTMLCanvasElement | null = null;
  private terrainSeed = -1;

  private buildTerrain(terrain: Terrain) {
    const c = document.createElement("canvas");
    c.width = terrain.width;
    c.height = terrain.height;
    const g = c.getContext("2d")!;
    g.fillStyle = GRASS;
    g.fillRect(0, 0, c.width, c.height);
    for (const p of terrain.patches) {
      const grd = g.createRadialGradient(p.pos.x, p.pos.y, 0, p.pos.x, p.pos.y, p.r);
      const col = p.kind === "grass" ? GRASS_2 : p.kind === "dirt" ? DIRT : p.kind === "scrub" ? SCRUB : WATER;
      grd.addColorStop(0, col);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(p.pos.x, p.pos.y, p.r, 0, Math.PI * 2);
      g.fill();
    }
    // subtle noise
    g.globalAlpha = 0.07;
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = i % 2 ? "#000" : "#fff";
      g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
    }
    g.globalAlpha = 1;
    for (const b of terrain.buildings) {
      g.save();
      g.translate(b.pos.x, b.pos.y);
      g.rotate(b.angle);
      g.fillStyle = "rgba(0,0,0,0.22)";
      g.fillRect(-b.w / 2 + 3, -b.h / 2 + 3, b.w, b.h);
      g.fillStyle = b.tone > 0.5 ? "#a8a191" : "#94897a";
      g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      g.strokeStyle = "rgba(0,0,0,0.25)";
      g.lineWidth = 1;
      g.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
      g.restore();
    }
    for (const t of terrain.trees) {
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.beginPath();
      g.arc(t.pos.x + t.r * 0.5, t.pos.y + t.r * 0.6, t.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = t.tone > 0.6 ? "#5c6b42" : t.tone > 0.3 ? "#4f5f3a" : "#67714a";
      g.beginPath();
      g.arc(t.pos.x, t.pos.y, t.r, 0, Math.PI * 2);
      g.fill();
    }
    this.terrainCanvas = c;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    net: Network,
    sim: Simulation,
    terrain: Terrain,
    opts: RenderOpts,
    seed: number,
  ) {
    if (this.terrainSeed !== seed || !this.terrainCanvas) {
      this.buildTerrain(terrain);
      this.terrainSeed = seed;
    }
    const cam = opts.camera;
    ctx.save();
    ctx.fillStyle = "#6f6a4c";
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    if (this.terrainCanvas) ctx.drawImage(this.terrainCanvas, 0, 0);

    const edges = [...net.edges.values()].sort((a, b) => a.level - b.level);

    // shadows for elevated roads
    for (const e of edges) {
      if (e.level <= 0) continue;
      ctx.save();
      ctx.translate(4, 5);
      strokePoly(ctx, e.pts, roadWidth(e) + 2, "rgba(0,0,0,0.3)");
      ctx.restore();
    }

    // asphalt
    for (const e of edges) {
      const spec = ROAD_SPECS[e.type];
      const width = roadWidth(e);
      if (e.level < 0) {
        strokePoly(ctx, e.pts, width + 3, "rgba(30,26,22,0.55)");
        strokePoly(ctx, e.pts, width, "#35322f");
      } else {
        strokePoly(ctx, e.pts, width + 2.4, spec.edge);
        strokePoly(ctx, e.pts, width, spec.asphalt);
      }
    }

    // lane markings
    if (cam.zoom > 0.35) {
      for (const e of edges) drawMarkings(ctx, e);
    }

    // overlay heatmap
    if (opts.overlay !== "none") {
      for (const e of edges) {
        const val =
          opts.overlay === "load"
            ? Math.min(1, e.stat.load)
            : opts.overlay === "speed"
              ? 1 - Math.min(1, (e.stat.speedN ? e.stat.speedSum / e.stat.speedN : e.speed / 3.6) / (e.speed / 3.6))
              : Math.min(1, e.stat.load * 1.3);
        const col = heat(val);
        strokePoly(ctx, e.pts, roadWidth(e) + 1, col);
      }
    }

    // intersections
    for (const node of net.nodes.values()) {
      const es = net.edgesAt(node.id);
      if (es.length < 2) continue;
      const r = Math.max(...es.map((e) => roadWidth(e))) / 2 + 1.2;
      ctx.beginPath();
      ctx.arc(node.pos.x, node.pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = node.level < 0 ? "#35322f" : "#464340";
      ctx.fill();
      if (node.control === "roundabout" && node.roundabout) {
        ctx.beginPath();
        ctx.arc(node.pos.x, node.pos.y, node.roundabout.radius, 0, Math.PI * 2);
        ctx.lineWidth = node.roundabout.lanes * 3.6;
        ctx.strokeStyle = "#464340";
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(node.pos.x, node.pos.y, Math.max(2, node.roundabout.radius - node.roundabout.lanes * 1.8), 0, Math.PI * 2);
        ctx.fillStyle = "#70764c";
        ctx.fill();
      }
      if (node.crosswalk) drawCrosswalks(ctx, net, node.id);
    }

    // parking lots
    for (const lot of opts.lots) drawLot(ctx, lot);

    // signals
    for (const node of net.nodes.values()) {
      if (node.control !== "signal" || !node.signal) continue;
      const es = net.edgesAt(node.id);
      for (const e of es) {
        const green = node.signal.phases[node.signal.index]?.edges.includes(e.id) ?? false;
        const amber = green && node.signal.timer > (node.signal.phases[node.signal.index]?.green ?? 0);
        const at = e.to === node.id ? e.pts[e.pts.length - 1] : e.pts[0];
        const prev = e.to === node.id ? e.pts[e.pts.length - 2] : e.pts[1];
        const dx = at.x - prev.x;
        const dy = at.y - prev.y;
        const l = Math.hypot(dx, dy) || 1;
        const back = { x: at.x - (dx / l) * 8, y: at.y - (dy / l) * 8 };
        const side = { x: -dy / l, y: dx / l };
        const off = roadWidth(e) / 2 + 1.6;
        ctx.beginPath();
        ctx.arc(back.x + side.x * off, back.y + side.y * off, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = amber ? "#e8a33d" : green ? "#5fc16a" : "#d9452f";
        ctx.fill();
      }
    }

    // stop / yield markers
    for (const node of net.nodes.values()) {
      if (node.control !== "stop" && node.control !== "yield") continue;
      ctx.beginPath();
      ctx.arc(node.pos.x, node.pos.y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = node.control === "stop" ? "#c0392b" : "#e0c060";
      ctx.globalAlpha = 0.8;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // incidents
    for (const inc of sim.incidents) {
      const e = net.edges.get(inc.edgeId);
      if (!e) continue;
      const { p } = pointAt(e.pts, e.cum, inc.s);
      ctx.fillStyle = inc.kind === "accident" ? "#d9452f" : "#e9a63c";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // vehicles
    const night = opts.night;
    for (const v of sim.vehicles) {
      if (v.state === "parked") continue;
      const spec = VEHICLE_SPECS[v.kind];
      ctx.save();
      ctx.translate(v.pos.x, v.pos.y);
      ctx.rotate(v.heading);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      roundRect(ctx, -spec.length / 2 + 0.6, -spec.width / 2 + 0.8, spec.length, spec.width, 0.7);
      ctx.fill();
      ctx.fillStyle = v.kind === "emergency" ? "#d94f3d" : v.color;
      roundRect(ctx, -spec.length / 2, -spec.width / 2, spec.length, spec.width, 0.7);
      ctx.fill();
      if (cam.zoom > 0.9) {
        ctx.fillStyle = "rgba(20,24,28,0.55)";
        roundRect(ctx, -spec.length * 0.12, -spec.width / 2 + 0.25, spec.length * 0.34, spec.width - 0.5, 0.3);
        ctx.fill();
        if (v.braking) {
          ctx.fillStyle = "#ff5533";
          ctx.fillRect(-spec.length / 2, -spec.width / 2, 0.5, spec.width);
        }
        if (night > 0.35) {
          ctx.fillStyle = `rgba(255,236,180,${0.25 * night})`;
          ctx.beginPath();
          ctx.moveTo(spec.length / 2, -spec.width / 2);
          ctx.lineTo(spec.length / 2 + 12, -spec.width * 1.6);
          ctx.lineTo(spec.length / 2 + 12, spec.width * 1.6);
          ctx.lineTo(spec.length / 2, spec.width / 2);
          ctx.fill();
        }
      }
      ctx.restore();
      if (opts.followVehicle === v.id) {
        ctx.beginPath();
        ctx.arc(v.pos.x, v.pos.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#f2e6c2";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // signs
    if (opts.showLabels) for (const s of opts.signs) drawSign(ctx, s, cam.zoom);

    // hover / selection
    if (opts.hoverEdge) {
      const e = net.edges.get(opts.hoverEdge);
      if (e) strokePoly(ctx, e.pts, roadWidth(e) + 1.5, "rgba(245,230,180,0.25)");
    }
    if (opts.selectedEdge) {
      const e = net.edges.get(opts.selectedEdge);
      if (e) strokePoly(ctx, e.pts, roadWidth(e) + 2.5, "rgba(120,200,255,0.35)");
    }
    if (opts.selectedNode) {
      const n = net.nodes.get(opts.selectedNode);
      if (n) {
        ctx.beginPath();
        ctx.arc(n.pos.x, n.pos.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(120,200,255,0.8)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // connection candidates
    for (const [id, list] of net.adj) {
      if (list.length !== 1) continue;
      const n = net.nodes.get(id);
      if (!n) continue;
      ctx.beginPath();
      ctx.arc(n.pos.x, n.pos.y, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(240,220,160,0.5)";
      ctx.fill();
    }

    // preview
    if (opts.preview && opts.preview.pts.length > 1) {
      const spec = ROAD_SPECS[opts.preview.type];
      const width = spec.lanes * 2 * spec.laneWidth;
      strokePoly(
        ctx,
        opts.preview.pts,
        width,
        opts.preview.valid ? "rgba(230,225,205,0.45)" : "rgba(220,70,50,0.5)",
      );
    }
    if (opts.snapPoint) {
      ctx.beginPath();
      ctx.arc(opts.snapPoint.x, opts.snapPoint.y, 4, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffe9a8";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    ctx.restore();

    // night tint
    if (night > 0.02) {
      ctx.fillStyle = `rgba(16,22,44,${night * 0.45})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

function strokePoly(ctx: CanvasRenderingContext2D, pts: Vec2[], width: number, color: string) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.stroke();
}

function offsetPoly(pts: Vec2[], off: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    out.push({ x: pts[i].x + (-dy / l) * off, y: pts[i].y + (dx / l) * off });
  }
  return out;
}

function drawMarkings(ctx: CanvasRenderingContext2D, e: Edge) {
  const spec = ROAD_SPECS[e.type];
  ctx.save();
  // centre line
  if (!e.oneWay) {
    const p = e.pts;
    ctx.setLineDash(spec.markings === "dashed" ? [4, 5] : []);
    strokePoly(ctx, p, 0.35, spec.markings === "highway" ? "#e8e3cf" : "#e5dfc6");
  }
  // lane dividers
  ctx.setLineDash([3, 4]);
  for (const dir of [1, -1] as const) {
    const lanes = e.oneWay ? (dir === 1 ? e.lanesFwd : 0) : dir === 1 ? e.lanesFwd : e.lanesBwd;
    for (let l = 1; l < lanes; l++) {
      const off = laneOffset(e, dir, l) - (dir === 1 ? spec.laneWidth / 2 : -spec.laneWidth / 2);
      strokePoly(ctx, offsetPoly(e.pts, off), 0.25, "rgba(232,227,207,0.75)");
    }
  }
  ctx.setLineDash([]);
  // edge lines
  const half = roadWidth(e) / 2 - 0.35;
  strokePoly(ctx, offsetPoly(e.pts, half), 0.28, "rgba(238,233,214,0.65)");
  strokePoly(ctx, offsetPoly(e.pts, -half), 0.28, "rgba(238,233,214,0.65)");
  ctx.restore();
}

function drawCrosswalks(ctx: CanvasRenderingContext2D, net: Network, nodeId: string) {
  const node = net.nodes.get(nodeId)!;
  for (const e of net.edgesAt(nodeId)) {
    const at = e.to === nodeId ? e.pts[e.pts.length - 1] : e.pts[0];
    const prev = e.to === nodeId ? e.pts[e.pts.length - 2] : e.pts[1];
    const dx = at.x - prev.x;
    const dy = at.y - prev.y;
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l;
    const uy = dy / l;
    const base = { x: node.pos.x - ux * (roadWidth(e) / 2 + 2), y: node.pos.y - uy * (roadWidth(e) / 2 + 2) };
    const half = roadWidth(e) / 2;
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.rotate(Math.atan2(uy, ux));
    ctx.fillStyle = "rgba(240,236,220,0.8)";
    for (let i = -half + 0.5; i < half; i += 1.4) ctx.fillRect(-1.4, i, 2.8, 0.7);
    ctx.restore();
  }
}

function drawLot(ctx: CanvasRenderingContext2D, lot: ParkingLot) {
  const cellW = 5.2;
  const cellH = 2.6;
  const w = lot.cols * cellW;
  const h = lot.rows * cellH;
  ctx.save();
  ctx.translate(lot.pos.x, lot.pos.y);
  ctx.rotate(lot.angle);
  ctx.fillStyle = "#4b4844";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = "rgba(236,231,212,0.6)";
  ctx.lineWidth = 0.2;
  for (let c = 0; c <= lot.cols; c++) {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + c * cellW, -h / 2);
    ctx.lineTo(-w / 2 + c * cellW, h / 2);
    ctx.stroke();
  }
  for (let r = 1; r < lot.rows; r++) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2 + r * cellH);
    ctx.lineTo(w / 2, -h / 2 + r * cellH);
    ctx.stroke();
  }
  // parked cars
  let left = lot.occupied;
  for (let r = 0; r < lot.rows && left > 0; r++) {
    for (let c = 0; c < lot.cols && left > 0; c++, left--) {
      ctx.fillStyle = ["#b9b3a4", "#8d9aa6", "#8a6a4e", "#5b6470"][(r * lot.cols + c) % 4];
      ctx.fillRect(-w / 2 + c * cellW + 0.6, -h / 2 + r * cellH + 0.5, cellW - 1.2, cellH - 1);
    }
  }
  ctx.restore();
}

function drawSign(ctx: CanvasRenderingContext2D, s: Sign, zoom: number) {
  const colors: Record<Sign["kind"], string> = {
    exit: "#7a4ea8",
    entry: "#2f5fa8",
    dest: "#2f7a4a",
    speed: "#f2efe4",
    stop: "#b5372a",
    yield: "#e0c060",
  };
  const w = Math.max(14, s.text.length * 2.6);
  ctx.save();
  ctx.translate(s.pos.x, s.pos.y);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(-w / 2 + 0.6, -3 + 0.8, w, 6);
  ctx.fillStyle = colors[s.kind];
  ctx.fillRect(-w / 2, -3, w, 6);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 0.3;
  ctx.strokeRect(-w / 2 + 0.5, -2.5, w - 1, 5);
  if (zoom > 0.7) {
    ctx.fillStyle = s.kind === "speed" ? "#222" : "#fff";
    ctx.font = "3.4px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.kind === "speed" ? `${s.value ?? 50}` : s.text, 0, 0.2);
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function heat(v: number): string {
  const t = Math.max(0, Math.min(1, v));
  const r = Math.round(60 + t * 190);
  const g = Math.round(190 - t * 160);
  const b = Math.round(120 - t * 90);
  return `rgba(${r},${g},${b},0.5)`;
}

export { cumulative };
