import { useRef } from "react";
import type { Engine } from "@/game/engine";
import { SCENARIOS } from "@/game/scenarios";
import { ROAD_SPECS, type RoadType } from "@/game/types";

interface Props {
  engine: Engine;
  refresh: () => void;
}

const fmtMoney = (n: number) =>
  `${Math.round(n).toLocaleString("de-DE")} €`;

const fmtClock = (s: number) => {
  const h = Math.floor(s / 3600) % 24;
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border px-4 py-3">
      <h3 className="mb-2 font-display text-sm uppercase tracking-widest text-primary">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}

function SmallBtn({
  onClick,
  children,
  active,
}: {
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2 py-1 text-[11px] transition-colors ${
        active
          ? "border-primary bg-primary/20 text-foreground"
          : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function SidePanel({ engine, refresh }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const s = engine.sim.stats;
  const edge = engine.selectedEdge ? engine.net.edges.get(engine.selectedEdge) : null;
  const node = engine.selectedNode ? engine.net.nodes.get(engine.selectedNode) : null;
  const lot = engine.lots.find((l) => l.id === engine.selectedEdge);
  const bottlenecks = engine.sim.bottlenecks();
  const follow = engine.followVehicle
    ? engine.sim.vehicles.find((v) => v.id === engine.followVehicle)
    : null;

  return (
    <aside className="pointer-events-auto flex h-full w-80 flex-col overflow-y-auto border-l border-border bg-card/92 backdrop-blur-sm">
      <Section title="Lage">
        <Row label="Uhrzeit" value={fmtClock(engine.sim.timeOfDay)} />
        <Row label="Fahrzeuge" value={`${s.vehicles}`} />
        <Row label="Ø Tempo" value={`${s.avgSpeed.toFixed(1)} km/h`} />
        <Row label="Ø Wartezeit" value={`${s.avgWait.toFixed(1)} s`} />
        <Row label="Im Stau" value={`${s.jammed}`} />
        <Row label="Angekommen" value={`${s.arrived}`} />
        <Row label="Budget" value={fmtMoney(engine.budget)} />
        <div className="mt-2">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Zufriedenheit</span>
            <span>{s.satisfaction}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-muted">
            <div
              className="h-full rounded bg-primary transition-all"
              style={{ width: `${s.satisfaction}%` }}
            />
          </div>
        </div>
      </Section>

      {engine.scenario && engine.scenario.id !== "sandbox" && (
        <Section title={engine.scenario.title}>
          <p className="mb-2 text-xs text-muted-foreground">{engine.scenario.brief}</p>
          <Row label="Ziel Ø Tempo" value={`${engine.scenario.goalSpeed} km/h`} />
          <Row label="Ziel Wartezeit" value={`≤ ${engine.scenario.goalWait} s`} />
          <Row
            label="Restzeit"
            value={`${Math.max(0, Math.round(engine.scenario.duration - engine.scenarioTime))} s`}
          />
          {engine.scenarioDone && (
            <div className="mt-2 rounded border border-primary/50 bg-primary/10 p-2 text-xs">
              <div className="font-display text-base">
                {"★".repeat(engine.scenarioDone.stars)}
                {"☆".repeat(3 - engine.scenarioDone.stars)}
              </div>
              {engine.scenarioDone.text}
            </div>
          )}
        </Section>
      )}

      {edge && (
        <Section title="Straße">
          <Row label="Typ" value={ROAD_SPECS[edge.type].label} />
          <Row label="Länge" value={`${edge.length.toFixed(0)} m`} />
          <Row label="Auslastung" value={`${Math.round(edge.stat.load * 100)} %`} />
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Spuren je Richtung</span>
            <SmallBtn onClick={() => { engine.changeLanes(edge.id, -1); refresh(); }}>−</SmallBtn>
            <span className="font-mono text-sm">{edge.lanesFwd}</span>
            <SmallBtn onClick={() => { engine.changeLanes(edge.id, 1); refresh(); }}>+</SmallBtn>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(Object.keys(ROAD_SPECS) as RoadType[]).map((rt) => (
              <SmallBtn
                key={rt}
                active={edge.type === rt}
                onClick={() => { engine.upgradeRoad(edge.id, rt); refresh(); }}
              >
                {ROAD_SPECS[rt].label}
              </SmallBtn>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <SmallBtn active={edge.oneWay} onClick={() => { engine.setOneWay(edge.id, !edge.oneWay); refresh(); }}>
              Einbahn
            </SmallBtn>
            <SmallBtn active={edge.bus} onClick={() => { edge.bus = !edge.bus; refresh(); }}>
              Busspur
            </SmallBtn>
            <SmallBtn active={edge.sidewalk} onClick={() => { edge.sidewalk = !edge.sidewalk; refresh(); }}>
              Fußweg
            </SmallBtn>
            <SmallBtn active={edge.trees} onClick={() => { edge.trees = !edge.trees; refresh(); }}>
              Bäume
            </SmallBtn>
          </div>
          <div className="mt-2">
            <div className="text-[11px] text-muted-foreground">Tempolimit {edge.speed} km/h</div>
            <input
              type="range"
              min={20}
              max={130}
              step={5}
              value={edge.speed}
              onChange={(ev) => { edge.speed = Number(ev.target.value); refresh(); }}
              className="w-full accent-primary"
            />
          </div>
          <input
            className="mt-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            placeholder="Straßenname"
            value={edge.name ?? ""}
            onChange={(ev) => { edge.name = ev.target.value; refresh(); }}
          />
          <div className="mt-2 flex gap-1">
            <SmallBtn onClick={() => { engine.eraseEdge(edge.id); engine.selectedEdge = null; refresh(); }}>
              Segment entfernen
            </SmallBtn>
          </div>
        </Section>
      )}

      {node && (
        <Section title="Knoten">
          <Row label="Zufahrten" value={`${engine.net.edgesAt(node.id).length}`} />
          <div className="mt-1 flex flex-wrap gap-1">
            {(
              [
                ["none", "Rechts vor links"],
                ["yield", "Vorfahrt gewähren"],
                ["stop", "Stopp"],
                ["signal", "Ampel"],
                ["roundabout", "Kreisverkehr"],
              ] as const
            ).map(([v, label]) => (
              <SmallBtn
                key={v}
                active={node.control === v}
                onClick={() => { engine.setNodeControl(node.id, v); refresh(); }}
              >
                {label}
              </SmallBtn>
            ))}
          </div>
          <div className="mt-2 flex gap-1">
            <SmallBtn active={node.crosswalk} onClick={() => { node.crosswalk = !node.crosswalk; refresh(); }}>
              Zebrastreifen
            </SmallBtn>
          </div>

          {node.control === "roundabout" && node.roundabout && (
            <div className="mt-2 space-y-1">
              <div className="text-[11px] text-muted-foreground">
                Radius {node.roundabout.radius} m · Spuren {node.roundabout.lanes}
              </div>
              <input
                type="range"
                min={8}
                max={32}
                value={node.roundabout.radius}
                onChange={(ev) => { node.roundabout!.radius = Number(ev.target.value); refresh(); }}
                className="w-full accent-primary"
              />
              <div className="flex gap-1">
                {[1, 2, 3].map((l) => (
                  <SmallBtn
                    key={l}
                    active={node.roundabout!.lanes === l}
                    onClick={() => { node.roundabout!.lanes = l; refresh(); }}
                  >
                    {l} Spur{l > 1 ? "en" : ""}
                  </SmallBtn>
                ))}
              </div>
            </div>
          )}

          {node.control === "signal" && node.signal && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Phasen
                </span>
                <SmallBtn
                  active={node.signal.adaptive}
                  onClick={() => { node.signal!.adaptive = !node.signal!.adaptive; refresh(); }}
                >
                  Verkehrsabhängig
                </SmallBtn>
              </div>
              {node.signal.phases.map((p, i) => (
                <div key={i} className="mb-2">
                  <div className="flex justify-between text-[11px]">
                    <span className={i === node.signal!.index ? "text-primary" : "text-muted-foreground"}>
                      Phase {i + 1} ({p.edges.length} Zufahrten)
                    </span>
                    <span className="font-mono">{p.green}s grün</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={60}
                    value={p.green}
                    onChange={(ev) => { p.green = Number(ev.target.value); refresh(); }}
                    className="w-full accent-primary"
                  />
                  <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-primary/70"
                      style={{
                        width: `${
                          i === node.signal!.index
                            ? Math.min(100, (node.signal!.timer / p.green) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              <Row
                label="Umlaufzeit"
                value={`${node.signal.phases.reduce((a, p) => a + p.green + node.signal!.amber, 0)} s`}
              />
              <Row
                label="Durchsatz (geschätzt)"
                value={`${Math.round(
                  node.signal.phases.reduce((a, p) => a + p.green * 0.5 * p.edges.length, 0),
                )} Fz/min`}
              />
              <div className="mt-1 text-[11px] text-muted-foreground">Grüne Welle Versatz {node.signal.offset}s</div>
              <input
                type="range"
                min={0}
                max={60}
                value={node.signal.offset}
                onChange={(ev) => { node.signal!.offset = Number(ev.target.value); refresh(); }}
                className="w-full accent-primary"
              />
            </div>
          )}

          <input
            className="mt-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
            placeholder="Name der Anschlussstelle"
            value={node.label ?? ""}
            onChange={(ev) => { node.label = ev.target.value; refresh(); }}
          />
        </Section>
      )}

      {lot && (
        <Section title="Parkfläche">
          <Row label="Plätze" value={`${lot.rows * lot.cols}`} />
          <Row label="Belegt" value={`${Math.round((lot.occupied / (lot.rows * lot.cols)) * 100)} %`} />
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Zeilen</span>
            <SmallBtn onClick={() => { lot.rows = Math.max(1, lot.rows - 1); refresh(); }}>−</SmallBtn>
            <span className="font-mono">{lot.rows}</span>
            <SmallBtn onClick={() => { lot.rows = Math.min(10, lot.rows + 1); refresh(); }}>+</SmallBtn>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Spalten</span>
            <SmallBtn onClick={() => { lot.cols = Math.max(1, lot.cols - 1); refresh(); }}>−</SmallBtn>
            <span className="font-mono">{lot.cols}</span>
            <SmallBtn onClick={() => { lot.cols = Math.min(16, lot.cols + 1); refresh(); }}>+</SmallBtn>
          </div>
        </Section>
      )}

      {follow && (
        <Section title="Fahrzeug im Blick">
          <Row label="Typ" value={follow.kind} />
          <Row label="Fahrstil" value={follow.style} />
          <Row label="Tempo" value={`${(follow.speed * 3.6).toFixed(0)} km/h`} />
          <Row label="Wartezeit gesamt" value={`${follow.totalWait.toFixed(0)} s`} />
          <Row label="Umplanungen" value={`${follow.reroutes}`} />
          <SmallBtn onClick={() => { engine.followVehicle = null; refresh(); }}>Nicht mehr folgen</SmallBtn>
        </Section>
      )}

      <Section title="Engpässe">
        {bottlenecks.length === 0 && (
          <p className="text-xs text-muted-foreground">Aktuell läuft alles flüssig.</p>
        )}
        {bottlenecks.map((b) => (
          <button
            key={b.edge.id}
            type="button"
            onClick={() => {
              engine.selectedEdge = b.edge.id;
              engine.camera.x = b.edge.pts[0].x;
              engine.camera.y = b.edge.pts[0].y;
              refresh();
            }}
            className="mb-1 block w-full rounded border border-border bg-card/60 px-2 py-1 text-left text-[11px] hover:border-primary/60"
          >
            <span className="text-foreground">{b.edge.name ?? ROAD_SPECS[b.edge.type].label}</span>
            <span className="block text-muted-foreground">
              {Math.round(b.load * 100)} % · {b.reason}
            </span>
          </button>
        ))}
      </Section>

      <Section title="Szenarien">
        <div className="space-y-1">
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => { engine.startScenario(sc); refresh(); }}
              className={`block w-full rounded border px-2 py-1.5 text-left text-[11px] transition-colors ${
                engine.scenario?.id === sc.id
                  ? "border-primary bg-primary/15"
                  : "border-border bg-card/60 hover:border-primary/60"
              }`}
            >
              <span className="font-display text-sm text-foreground">{sc.title}</span>
              <span className="block text-muted-foreground">{sc.brief}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Speichern">
        <div className="flex flex-wrap gap-1">
          <SmallBtn onClick={() => { engine.save(); refresh(); }}>Speichern</SmallBtn>
          <SmallBtn onClick={() => { engine.load(); refresh(); }}>Laden</SmallBtn>
          <SmallBtn
            onClick={() => {
              const blob = new Blob([engine.exportJson()], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "verkehrsnetz.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export
          </SmallBtn>
          <SmallBtn onClick={() => fileRef.current?.click()}>Import</SmallBtn>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (ev) => {
              const f = ev.target.files?.[0];
              if (!f) return;
              engine.importJson(await f.text());
              refresh();
            }}
          />
        </div>
      </Section>
    </aside>
  );
}
