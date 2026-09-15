import type { Vec2 } from "./geometry";

export interface TerrainPatch {
  pos: Vec2;
  r: number;
  kind: "grass" | "dirt" | "scrub" | "water";
  seed: number;
}

export interface TerrainTree {
  pos: Vec2;
  r: number;
  tone: number;
}

export interface Terrain {
  width: number;
  height: number;
  patches: TerrainPatch[];
  trees: TerrainTree[];
  buildings: { pos: Vec2; w: number; h: number; angle: number; tone: number }[];
}

/** Deterministic pseudo random generator so maps are reproducible. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function generateTerrain(seed: number, width = 2600, height = 1900): Terrain {
  const r = rng(seed);
  const patches: TerrainPatch[] = [];
  const kinds: TerrainPatch["kind"][] = ["grass", "dirt", "scrub", "grass", "scrub"];
  for (let i = 0; i < 140; i++) {
    patches.push({
      pos: { x: r() * width, y: r() * height },
      r: 60 + r() * 220,
      kind: kinds[(r() * kinds.length) | 0],
      seed: r() * 1000,
    });
  }
  for (let i = 0; i < 3; i++) {
    patches.push({
      pos: { x: r() * width, y: r() * height },
      r: 90 + r() * 140,
      kind: "water",
      seed: r() * 1000,
    });
  }
  const trees: TerrainTree[] = [];
  for (let i = 0; i < 520; i++) {
    trees.push({
      pos: { x: r() * width, y: r() * height },
      r: 3 + r() * 4.5,
      tone: r(),
    });
  }
  const buildings: Terrain["buildings"] = [];
  for (let i = 0; i < 90; i++) {
    buildings.push({
      pos: { x: r() * width, y: r() * height },
      w: 12 + r() * 26,
      h: 10 + r() * 22,
      angle: r() * Math.PI,
      tone: r(),
    });
  }
  return { width, height, patches, trees, buildings };
}
