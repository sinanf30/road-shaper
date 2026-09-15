export interface Vec2 {
  x: number;
  y: number;
}

export const v = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Vec2): Vec2 => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
export const perp = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x });
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const angleOf = (a: Vec2): number => Math.atan2(a.y, a.x);

/** Total length of a polyline. */
export function polyLength(pts: Vec2[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

/** Cumulative arc lengths, same length as pts. */
export function cumulative(pts: Vec2[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + dist(pts[i - 1], pts[i]));
  return out;
}

/** Point + tangent at arc length s along a polyline. */
export function pointAt(pts: Vec2[], cum: number[], s: number): { p: Vec2; t: Vec2 } {
  const total = cum[cum.length - 1];
  const sc = Math.max(0, Math.min(total, s));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < sc) i++;
  const segLen = cum[i] - cum[i - 1] || 1;
  const f = (sc - cum[i - 1]) / segLen;
  return {
    p: lerp(pts[i - 1], pts[i], f),
    t: norm(sub(pts[i], pts[i - 1])),
  };
}

/** Distance of point to a polyline plus the arc length of the closest point. */
export function closestOnPoly(
  pts: Vec2[],
  p: Vec2,
): { dist: number; s: number; point: Vec2 } {
  let best = { dist: Infinity, s: 0, point: pts[0] };
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const ab = sub(b, a);
    const l2 = ab.x * ab.x + ab.y * ab.y || 1;
    let t = ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = lerp(a, b, t);
    const d = dist(proj, p);
    if (d < best.dist) best = { dist: d, s: acc + t * Math.sqrt(l2), point: proj };
    acc += Math.sqrt(l2);
  }
  return best;
}

/** Segment/segment intersection; returns params along each segment. */
export function segIntersect(
  a1: Vec2,
  a2: Vec2,
  b1: Vec2,
  b2: Vec2,
): { t: number; u: number; p: Vec2 } | null {
  const r = sub(a2, a1);
  const s = sub(b2, b1);
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 1e-9) return null;
  const qp = sub(b1, a1);
  const t = (qp.x * s.y - qp.y * s.x) / denom;
  const u = (qp.x * r.y - qp.y * r.x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u, p: add(a1, mul(r, t)) };
}

/** Catmull-Rom smoothing of a raw drag path. */
export function smoothPath(raw: Vec2[], samplesPerSeg = 6): Vec2[] {
  if (raw.length < 3) return raw.slice();
  const p = [raw[0], ...raw, raw[raw.length - 1]];
  const out: Vec2[] = [];
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2];
    for (let j = 0; j < samplesPerSeg; j++) {
      const t = j / samplesPerSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(raw[raw.length - 1]);
  return simplify(out, 1.2);
}

/** Drop points that are very close together. */
export function simplify(pts: Vec2[], minDist = 2): Vec2[] {
  if (pts.length < 2) return pts.slice();
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    if (dist(out[out.length - 1], pts[i]) >= minDist) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Circular arc through start and end with a bulge control point. */
export function arcPath(a: Vec2, ctrl: Vec2, b: Vec2, samples = 24): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const mt = 1 - t;
    out.push({
      x: mt * mt * a.x + 2 * mt * t * ctrl.x + t * t * b.x,
      y: mt * mt * a.y + 2 * mt * t * ctrl.y + t * t * b.y,
    });
  }
  return out;
}

/** Smallest curve radius found along a polyline (meters). */
export function minRadius(pts: Vec2[]): number {
  let min = Infinity;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const ab = dist(a, b);
    const bc = dist(b, c);
    const ca = dist(c, a);
    const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
    if (area < 1e-6) continue;
    const r = (ab * bc * ca) / (4 * area);
    if (r < min) min = r;
  }
  return min;
}

export function snapAngle(from: Vec2, to: Vec2, stepDeg: number): Vec2 {
  const d = sub(to, from);
  const l = len(d);
  const step = (stepDeg * Math.PI) / 180;
  const a = Math.round(Math.atan2(d.y, d.x) / step) * step;
  return { x: from.x + Math.cos(a) * l, y: from.y + Math.sin(a) * l };
}

/** Split a polyline at given arc lengths. */
export function splitPoly(pts: Vec2[], cuts: number[]): Vec2[][] {
  const cum = cumulative(pts);
  const total = cum[cum.length - 1];
  const sorted = [...new Set(cuts.filter((c) => c > 0.5 && c < total - 0.5))].sort(
    (a, b) => a - b,
  );
  if (!sorted.length) return [pts.slice()];
  const pieces: Vec2[][] = [];
  let current: Vec2[] = [pts[0]];
  let ci = 0;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const segLen = dist(pts[i - 1], pts[i]);
    while (ci < sorted.length && sorted[ci] <= acc + segLen) {
      const f = (sorted[ci] - acc) / (segLen || 1);
      const cp = lerp(pts[i - 1], pts[i], f);
      current.push(cp);
      pieces.push(current);
      current = [cp];
      ci++;
    }
    current.push(pts[i]);
    acc += segLen;
  }
  pieces.push(current);
  return pieces.filter((p) => polyLength(p) > 0.5);
}
