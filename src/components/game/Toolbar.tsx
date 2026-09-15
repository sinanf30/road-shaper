import { useState } from "react";
import type { Engine, Tool } from "@/game/engine";
import { ROAD_SPECS, type RoadType } from "@/game/types";
import type { Overlay } from "@/game/render";

const TABS = ["Straßen", "Kreuzungen", "Schilder", "Parken", "Analyse", "Ansicht"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  engine: Engine;
  refresh: () => void;
}

function Btn({
  active,
  onClick,
  children,
  title,
  wide,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-left text-xs leading-tight transition-colors ${
        wide ? "min-w-40" : ""
      } ${
        active
          ? "border-primary bg-primary/20 text-foreground"
          : "border-border bg-card/70 text-muted-foreground hover:border-primary/60 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function Toolbar({ engine, refresh }: Props) {
  const [tab, setTab] = useState<Tab>("Straßen");
  const tool = engine.tool;

  const setTool = (t: Tool) => {
    engine.tool = t;
    refresh();
  };

  return (
    <div className="pointer-events-auto rounded-xl border border-border bg-card/90 backdrop-blur-sm shadow-lg">
      <div className="flex items-center gap-1 border-b border-border px-2 pt-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-t-md px-3 py-1.5 font-display text-sm tracking-wide transition-colors ${
              tab === t
                ? "bg-primary/20 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex max-h-44 flex-wrap items-start gap-2 overflow-y-auto p-3">
        {tab === "Straßen" && (
          <>
            {(Object.keys(ROAD_SPECS) as RoadType[]).map((rt) => {
              const spec = ROAD_SPECS[rt];
              const active = tool.kind === "road" && tool.type === rt;
              return (
                <Btn
                  key={rt}
                  wide
                  active={active}
                  onClick={() =>
                    setTool({
                      kind: "road",
                      type: rt,
                      mode: tool.kind === "road" ? tool.mode : "straight",
                    })
                  }
                >
                  <span className="block font-display text-sm text-foreground">{spec.label}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {"▮".repeat(spec.lanes)} · {spec.speed} km/h · {spec.costPerMeter} €/m
                  </span>
                </Btn>
              );
            })}
            <div className="mx-1 h-12 w-px bg-border" />
            {(["free", "straight", "arc"] as const).map((m) => (
              <Btn
                key={m}
                active={tool.kind === "road" && tool.mode === m}
                onClick={() =>
                  setTool({
                    kind: "road",
                    type: tool.kind === "road" ? tool.type : "haupt",
                    mode: m,
                  })
                }
              >
                {m === "free" ? "Freihand" : m === "straight" ? "Gerade (Shift = Raster)" : "Kreisbogen"}
              </Btn>
            ))}
            <div className="mx-1 h-12 w-px bg-border" />
            <Btn
              active={engine.oneWay}
              onClick={() => {
                engine.oneWay = !engine.oneWay;
                refresh();
              }}
            >
              Einbahnstraße
              <span className="block text-[11px] text-muted-foreground">
                {engine.oneWay ? "an" : "aus"}
              </span>
            </Btn>
            <div className="rounded-md border border-border bg-card/70 px-3 py-2 text-xs">
              <div className="mb-1 text-muted-foreground">Höhe</div>
              <div className="flex gap-1">
                {[
                  { v: -1, l: "Tunnel" },
                  { v: 0, l: "Ebene" },
                  { v: 1, l: "Brücke" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => {
                      engine.drawLevel = o.v;
                      refresh();
                    }}
                    className={`rounded px-2 py-1 ${
                      engine.drawLevel === o.v
                        ? "bg-primary/25 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border bg-card/70 px-3 py-2 text-xs">
              <div className="mb-1 text-muted-foreground">
                Tempolimit{" "}
                {engine.drawSpeed ??
                  (tool.kind === "road" ? ROAD_SPECS[tool.type].speed : 50)}{" "}
                km/h
              </div>
              <input
                type="range"
                min={20}
                max={130}
                step={5}
                value={engine.drawSpeed ?? (tool.kind === "road" ? ROAD_SPECS[tool.type].speed : 50)}
                onChange={(ev) => {
                  engine.drawSpeed = Number(ev.target.value);
                  refresh();
                }}
                className="w-40 accent-primary"
              />
            </div>
            <Btn active={tool.kind === "erase"} onClick={() => setTool({ kind: "erase" })}>
              Radiergummi
            </Btn>
            <Btn active={tool.kind === "select"} onClick={() => setTool({ kind: "select" })}>
              Auswählen / Bearbeiten
            </Btn>
          </>
        )}

        {tab === "Kreuzungen" && (
          <>
            <Btn active={tool.kind === "signal"} onClick={() => setTool({ kind: "signal" })}>
              Ampel setzen
              <span className="block text-[11px] text-muted-foreground">Phasen im Inspektor</span>
            </Btn>
            <Btn active={tool.kind === "roundabout"} onClick={() => setTool({ kind: "roundabout" })}>
              Kreisverkehr
              <span className="block text-[11px] text-muted-foreground">180.000 €</span>
            </Btn>
            {(["none", "yield", "stop"] as const).map((v) => (
              <Btn
                key={v}
                active={tool.kind === "priority" && tool.value === v}
                onClick={() => setTool({ kind: "priority", value: v })}
              >
                {v === "none" ? "Rechts vor links" : v === "yield" ? "Vorfahrt gewähren" : "Stoppschild"}
              </Btn>
            ))}
            <Btn active={tool.kind === "crosswalk"} onClick={() => setTool({ kind: "crosswalk" })}>
              Zebrastreifen
            </Btn>
            <Btn active={tool.kind === "select"} onClick={() => setTool({ kind: "select" })}>
              Knoten inspizieren
            </Btn>
          </>
        )}

        {tab === "Schilder" && (
          <>
            {(
              [
                ["exit", "Ausfahrt (violett)"],
                ["entry", "Einfahrt (blau)"],
                ["dest", "Ziel (grün)"],
                ["speed", "Tempolimit"],
                ["stop", "Stopp"],
                ["yield", "Vorfahrt gewähren"],
              ] as const
            ).map(([k, label]) => (
              <Btn
                key={k}
                active={tool.kind === "sign" && tool.signKind === k}
                onClick={() => setTool({ kind: "sign", signKind: k })}
              >
                {label}
              </Btn>
            ))}
          </>
        )}

        {tab === "Parken" && (
          <>
            <Btn active={tool.kind === "parking"} onClick={() => setTool({ kind: "parking" })}>
              Parkfläche anlegen
              <span className="block text-[11px] text-muted-foreground">60.000 €, Raster einstellbar</span>
            </Btn>
            <div className="text-xs text-muted-foreground">
              Fläche anklicken und im Inspektor Zeilen und Spalten anpassen.
            </div>
          </>
        )}

        {tab === "Analyse" && (
          <>
            {(
              [
                ["none", "Keine Ebene"],
                ["load", "Auslastung"],
                ["speed", "Tempo"],
                ["wait", "Wartezeit"],
              ] as [Overlay, string][]
            ).map(([o, label]) => (
              <Btn
                key={o}
                active={engine.overlay === o}
                onClick={() => {
                  engine.overlay = o;
                  refresh();
                }}
              >
                {label}
              </Btn>
            ))}
            <Btn active={tool.kind === "incident"} onClick={() => setTool({ kind: "incident" })}>
              Zwischenfall auslösen
            </Btn>
            <Btn
              onClick={() => {
                engine.sim.triggerIncident("works");
                refresh();
              }}
            >
              Baustelle zufällig
            </Btn>
          </>
        )}

        {tab === "Ansicht" && (
          <>
            <Btn
              active={engine.showLabels}
              onClick={() => {
                engine.showLabels = !engine.showLabels;
                refresh();
              }}
            >
              Beschilderung zeigen
            </Btn>
            {([0.5, 1, 2, 4, 8, 16] as const).map((m) => (
              <Btn
                key={m}
                active={engine.speedMult === m && !engine.paused}
                onClick={() => {
                  engine.speedMult = m;
                  engine.paused = false;
                  refresh();
                }}
              >
                {m}× Zeit
              </Btn>
            ))}
            <Btn
              active={engine.paused}
              onClick={() => {
                engine.paused = !engine.paused;
                refresh();
              }}
            >
              {engine.paused ? "Weiter" : "Pause"}
            </Btn>
            <Btn
              onClick={() => {
                const kinds = ["clear", "rain", "fog", "ice"] as const;
                const i = kinds.indexOf(engine.sim.weather.kind);
                engine.sim.weather.kind = kinds[(i + 1) % kinds.length];
                refresh();
              }}
            >
              Wetter:{" "}
              {{ clear: "klar", rain: "Regen", fog: "Nebel", ice: "Glätte" }[engine.sim.weather.kind]}
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}
