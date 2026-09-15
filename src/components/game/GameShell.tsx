import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Engine } from "@/game/engine";
import { SCENARIOS } from "@/game/scenarios";
import { Renderer, screenToWorld, type Camera } from "@/game/render";
import type { Vec2 } from "@/game/geometry";
import { dist } from "@/game/geometry";
import { Toolbar } from "./Toolbar";
import { SidePanel } from "./SidePanel";

function nightFactor(timeOfDay: number): number {
  const h = timeOfDay / 3600;
  if (h >= 7 && h <= 19) return 0;
  if (h > 19 && h < 21) return (h - 19) / 2;
  if (h > 5 && h < 7) return (7 - h) / 2;
  return 1;
}

export function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  if (!engineRef.current) {
    const e = new Engine(7);
    e.startScenario(SCENARIOS[0]);
    engineRef.current = e;
  }
  const engine = engineRef.current;
  const renderer = useMemo(() => new Renderer(), []);
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const drag = useRef<{
    mode: "none" | "pan" | "draw";
    raw: Vec2[];
    start: Vec2 | null;
    dir0: Vec2 | null;
    panStart: Vec2 | null;
    camStart: Camera | null;
  }>({ mode: "none", raw: [], start: null, dir0: null, panStart: null, camStart: null });
  const shiftRef = useRef(false);
  const mouseWorld = useRef<Vec2>({ x: 0, y: 0 });
  const previewRef = useRef<{ pts: Vec2[]; valid: boolean } | null>(null);
  const hoverEdge = useRef<string | null>(null);

  // main loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let uiAcc = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (!engine.paused) {
        acc += dt * engine.speedMult;
        let steps = 0;
        while (acc > 1 / 30 && steps < 24) {
          engine.sim.step(1 / 30);
          acc -= 1 / 30;
          steps++;
        }
        if (engine.scenario && engine.scenario.duration > 0 && !engine.scenarioDone) {
          engine.scenarioTime += dt * engine.speedMult;
          if (engine.scenarioTime >= engine.scenario.duration) engine.evaluateScenario();
        }
      }

      // follow camera
      if (engine.followVehicle != null) {
        const v = engine.sim.vehicles.find((x) => x.id === engine.followVehicle);
        if (v) {
          engine.camera.x += (v.pos.x - engine.camera.x) * 0.1;
          engine.camera.y += (v.pos.y - engine.camera.y) * 0.1;
        }
      }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const tool = engine.tool;
      renderer.draw(ctx, w, h, engine.net, engine.sim, engine.terrain, {
        camera: engine.camera,
        overlay: engine.overlay,
        hoverEdge: hoverEdge.current,
        selectedEdge: engine.selectedEdge,
        selectedNode: engine.selectedNode,
        preview:
          previewRef.current && tool.kind === "road"
            ? { pts: previewRef.current.pts, type: tool.type, valid: previewRef.current.valid }
            : null,
        snapPoint: tool.kind === "road" ? engine.snapCandidate(mouseWorld.current) : null,
        signs: engine.signs,
        lots: engine.lots,
        showLabels: engine.showLabels,
        followVehicle: engine.followVehicle,
        night: nightFactor(engine.sim.timeOfDay),
      }, engine.seed);

      uiAcc += dt;
      if (uiAcc > 0.25) {
        uiAcc = 0;
        setTick((t) => t + 1);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, renderer]);

  // keyboard
  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement)?.tagName === "INPUT") return;
      if (ev.key === "Shift") shiftRef.current = true;
      const ctrl = ev.ctrlKey || ev.metaKey;
      if (ctrl && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        ev.shiftKey ? engine.redo() : engine.undo();
        refresh();
      } else if (ctrl && ev.key.toLowerCase() === "y") {
        ev.preventDefault();
        engine.redo();
        refresh();
      } else if (ev.key === " ") {
        ev.preventDefault();
        engine.paused = !engine.paused;
        refresh();
      } else if (ev.key === "PageUp") {
        engine.drawLevel = Math.min(1, engine.drawLevel + 1);
        refresh();
      } else if (ev.key === "PageDown") {
        engine.drawLevel = Math.max(-1, engine.drawLevel - 1);
        refresh();
      } else if (ev.key === "Escape") {
        drag.current.mode = "none";
        previewRef.current = null;
        engine.selectedEdge = null;
        engine.selectedNode = null;
        engine.followVehicle = null;
        refresh();
      } else if (["1", "2", "3", "4"].includes(ev.key)) {
        const types = ["land", "haupt", "autobahn", "rampe"] as const;
        engine.tool = {
          kind: "road",
          type: types[Number(ev.key) - 1],
          mode: engine.tool.kind === "road" ? engine.tool.mode : "straight",
        };
        refresh();
      }
    };
    const up = (ev: KeyboardEvent) => {
      if (ev.key === "Shift") shiftRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [engine, refresh]);

  const toWorld = (ev: React.PointerEvent | React.WheelEvent): Vec2 => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return screenToWorld(
      engine.camera,
      { x: ev.clientX - rect.left, y: ev.clientY - rect.top },
      rect.width,
      rect.height,
    );
  };

  const onPointerDown = (ev: React.PointerEvent) => {
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    const p = toWorld(ev);
    const tool = engine.tool;
    if (ev.button === 1 || ev.button === 2 || tool.kind === "select") {
      drag.current = {
        mode: "pan",
        raw: [],
        start: null,
        dir0: null,
        panStart: { x: ev.clientX, y: ev.clientY },
        camStart: { ...engine.camera },
      };
      if (tool.kind === "select" && ev.button === 0) {
        const veh = engine.sim.vehicles.find((v) => dist(v.pos, p) < 4);
        if (veh) {
          engine.followVehicle = veh.id;
          engine.selectedEdge = null;
          engine.selectedNode = null;
          refresh();
          return;
        }
        const node = engine.pickNode(p, 12);
        if (node && engine.net.edgesAt(node.id).length > 1) {
          engine.selectedNode = node.id;
          engine.selectedEdge = null;
        } else {
          const lot = engine.lots.find((l) => dist(l.pos, p) < 20);
          const e = engine.pickEdge(p, 10);
          engine.selectedEdge = lot ? lot.id : (e?.id ?? null);
          engine.selectedNode = null;
        }
        refresh();
      }
      return;
    }
    if (ev.button !== 0) return;

    switch (tool.kind) {
      case "road": {
        const snap = engine.snapCandidate(p);
        drag.current = {
          mode: "draw",
          raw: [snap ?? p],
          start: snap ?? p,
          dir0: null,
          panStart: null,
          camStart: null,
        };
        break;
      }
      case "erase": {
        const e = engine.pickEdge(p, 10);
        if (e) {
          engine.eraseEdge(e.id);
          refresh();
        }
        break;
      }
      case "signal":
      case "roundabout":
      case "crosswalk":
      case "priority": {
        const node = engine.pickNode(p, 16);
        if (!node) break;
        if (tool.kind === "signal") engine.setNodeControl(node.id, "signal");
        else if (tool.kind === "roundabout") engine.setNodeControl(node.id, "roundabout");
        else if (tool.kind === "priority") engine.setNodeControl(node.id, tool.value);
        else {
          node.crosswalk = !node.crosswalk;
          engine.net.version++;
        }
        engine.selectedNode = node.id;
        refresh();
        break;
      }
      case "sign": {
        const label =
          tool.signKind === "speed"
            ? "50"
            : (window.prompt("Beschriftung des Schildes", "Zentrum") ?? "");
        if (label !== null) {
          engine.addSign(p, tool.signKind, label);
          refresh();
        }
        break;
      }
      case "parking": {
        const e = engine.pickEdge(p, 40);
        const angle = e
          ? Math.atan2(e.pts[1].y - e.pts[0].y, e.pts[1].x - e.pts[0].x)
          : 0;
        engine.addLot(p, angle);
        refresh();
        break;
      }
      case "incident": {
        const e = engine.pickEdge(p, 12);
        if (e) {
          engine.sim.incidents.push({
            id: `inc${Date.now()}`,
            edgeId: e.id,
            s: e.length / 2,
            kind: "accident",
            remaining: 90,
          });
          engine.notify("Unfall gemeldet – eine Spur blockiert", "warn");
          refresh();
        }
        break;
      }
    }
  };

  const onPointerMove = (ev: React.PointerEvent) => {
    const p = toWorld(ev);
    mouseWorld.current = p;
    const d = drag.current;

    if (d.mode === "pan" && d.panStart && d.camStart) {
      const dx = (ev.clientX - d.panStart.x) / engine.camera.zoom;
      const dy = (ev.clientY - d.panStart.y) / engine.camera.zoom;
      engine.camera.x = d.camStart.x - dx;
      engine.camera.y = d.camStart.y - dy;
      engine.followVehicle = null;
      return;
    }

    if (d.mode === "draw" && engine.tool.kind === "road") {
      const mode = engine.tool.mode;
      if (mode === "free") {
        if (!d.raw.length || dist(d.raw[d.raw.length - 1], p) > 6) d.raw.push(p);
      } else {
        d.raw = [d.start!, p];
        if (mode === "arc" && !d.dir0 && dist(d.start!, p) > 18) {
          const dx = p.x - d.start!.x;
          const dy = p.y - d.start!.y;
          const l = Math.hypot(dx, dy) || 1;
          d.dir0 = { x: dx / l, y: dy / l };
        }
      }
      let ctrl: Vec2 | null = null;
      if (mode === "arc" && d.dir0 && d.start) {
        const to = { x: p.x - d.start.x, y: p.y - d.start.y };
        const proj = to.x * d.dir0.x + to.y * d.dir0.y;
        ctrl = { x: d.start.x + d.dir0.x * proj, y: d.start.y + d.dir0.y * proj };
      }
      const pts = engine.previewPath(d.raw, mode, shiftRef.current, ctrl);
      const check = engine.validPath(pts, engine.tool.type);
      previewRef.current = { pts, valid: check.ok };
      return;
    }

    const e = engine.pickEdge(p, 10);
    hoverEdge.current = e?.id ?? null;
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (d.mode === "draw" && engine.tool.kind === "road" && previewRef.current) {
      const pts = previewRef.current.pts.slice();
      const snapEnd = engine.snapCandidate(pts[pts.length - 1]);
      if (snapEnd) pts[pts.length - 1] = snapEnd;
      engine.buildRoad(pts, engine.tool.type);
      refresh();
    }
    previewRef.current = null;
    drag.current = { mode: "none", raw: [], start: null, dir0: null, panStart: null, camStart: null };
  };

  const onWheel = (ev: React.WheelEvent) => {
    const before = toWorld(ev);
    const factor = ev.deltaY > 0 ? 0.88 : 1.14;
    engine.camera.zoom = Math.max(0.2, Math.min(4, engine.camera.zoom * factor));
    const after = toWorld(ev);
    engine.camera.x += before.x - after.x;
    engine.camera.y += before.y - after.y;
  };

  const cost =
    previewRef.current && engine.tool.kind === "road"
      ? engine.costOf(previewRef.current.pts, engine.tool.type, engine.drawLevel)
      : 0;

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      <div className="relative flex-1">
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
        />

        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-3">
          <div className="rounded-lg border border-border bg-card/90 px-4 py-2 backdrop-blur-sm">
            <h1 className="font-display text-xl tracking-wide text-foreground">
              Verkehrsplaner
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {engine.scenario?.title ?? "Sandkasten"} · Budget{" "}
              {Math.round(engine.budget).toLocaleString("de-DE")} €
            </p>
          </div>
          <div className="pointer-events-auto flex gap-1">
            <button
              type="button"
              onClick={() => { engine.undo(); refresh(); }}
              disabled={!engine.canUndo()}
              className="rounded-md border border-border bg-card/90 px-3 py-2 text-xs disabled:opacity-40"
            >
              ↶ Rückgängig
            </button>
            <button
              type="button"
              onClick={() => { engine.redo(); refresh(); }}
              disabled={!engine.canRedo()}
              className="rounded-md border border-border bg-card/90 px-3 py-2 text-xs disabled:opacity-40"
            >
              ↷ Wiederholen
            </button>
          </div>
        </div>

        {previewRef.current && (
          <div className="pointer-events-none absolute right-4 top-4 rounded-md border border-border bg-card/90 px-3 py-2 text-xs">
            Kosten ca. {cost.toLocaleString("de-DE")} €
            {!previewRef.current.valid && (
              <span className="ml-2 text-destructive">ungültig</span>
            )}
          </div>
        )}

        <div className="pointer-events-none absolute bottom-4 left-1/2 w-[min(1180px,94%)] -translate-x-1/2">
          <Toolbar engine={engine} refresh={refresh} />
        </div>

        <div className="pointer-events-none absolute bottom-4 left-4 space-y-1">
          {engine.messages.slice(-3).map((m) => (
            <div
              key={m.id}
              className={`rounded border px-3 py-1.5 text-xs ${
                m.kind === "warn"
                  ? "border-destructive/60 bg-destructive/15 text-foreground"
                  : "border-border bg-card/90 text-muted-foreground"
              }`}
            >
              {m.text}
            </div>
          ))}
        </div>
      </div>

      <SidePanel engine={engine} refresh={refresh} />
    </div>
  );
}
