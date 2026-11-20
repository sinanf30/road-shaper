import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";
import { analyze, exportForCoach, type Mistake, type StatLine } from "@/poker/analysis";
import type { HandRecord } from "@/poker/types";
import { STAT_INFO } from "@/poker/glossary";
import { STREET_DE } from "@/poker/coach";
import { GlossaryList } from "./Glossary";

const pct = (x: number) => `${Math.round(x * 100)} %`;

function fmtStat(s: StatLine) {
  if (s.value === null) return "n/a";
  return s.unit === "%" ? pct(s.value) : s.value.toFixed(1);
}

function statStatus(s: StatLine): "ok" | "low" | "high" | "na" {
  if (s.value === null || s.sample < 5) return "na";
  if (s.value < s.target[0]) return "low";
  if (s.value > s.target[1]) return "high";
  return "ok";
}

export function AnalysisView({
  sessionHands,
  allHands,
  onBack,
  onClearAll,
}: {
  sessionHands: HandRecord[];
  allHands: HandRecord[];
  onBack: () => void;
  onClearAll: () => void;
}) {
  const [scope, setScope] = useState<"session" | "all">(sessionHands.length ? "session" : "all");
  const hands = scope === "session" ? sessionHands : allHands;
  const a = useMemo(() => analyze(hands), [hands]);
  const [copied, setCopied] = useState(false);
  const [showAllMistakes, setShowAllMistakes] = useState(false);

  const curve = useMemo(() => {
    let cum = 0;
    return hands.map((h, i) => {
      cum += h.heroNet / h.bb;
      return { i: i + 1, bb: Math.round(cum * 10) / 10 };
    });
  }, [hands]);

  const exportText = () => exportForCoach(hands, a);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      download();
    }
  };
  const download = () => {
    const blob = new Blob([exportText()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `holdem-session-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const mistakes = showAllMistakes ? a.mistakes : a.mistakes.slice(0, 8);

  return (
    <div className="min-h-screen bg-[#0b1410] px-4 py-6 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-semibold text-amber-300">Deine Spielanalyse</h1>
          <div className="ml-auto flex flex-wrap gap-2 text-sm">
            <div className="flex overflow-hidden rounded-md border border-white/20">
              <button
                onClick={() => setScope("session")}
                className={cn("px-3 py-1", scope === "session" && "bg-white/15")}
              >
                Diese Session ({sessionHands.length})
              </button>
              <button
                onClick={() => setScope("all")}
                className={cn("px-3 py-1", scope === "all" && "bg-white/15")}
              >
                Alle Hände ({allHands.length})
              </button>
            </div>
            <button
              onClick={onBack}
              className="rounded-md bg-amber-400 px-3 py-1 font-semibold text-zinc-900"
            >
              Weiterspielen
            </button>
          </div>
        </header>

        {hands.length === 0 ? (
          <p className="text-zinc-400">
            Noch keine Hände gespielt. Spiel ein paar Hände und komm dann zurück.
          </p>
        ) : (
          <>
            {hands.length < 50 && (
              <p className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                Erst {hands.length} Hände: Die Statistiken schwanken bei kleinen Stichproben stark.
                Ab etwa 100 bis 200 Händen werden die Tendenzen aussagekräftig. Die Einzelfehler
                unten sind aber schon jetzt hilfreich.
              </p>
            )}

            {/* Kennzahlen */}
            <p className="text-sm text-zinc-300">
              Gewinne und Verluste werden in Big Blinds (BB) gemessen, also in Vielfachen des
              Pflichteinsatzes von 20 Chips. Grüne Zahlen liegen im guten Bereich, gelbe weichen ab.
              Unten auf der Seite sind alle Begriffe erklärt.
            </p>

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Kpi label="Hände" value={String(a.hands)} />
              <Kpi
                label="Ergebnis (in Big Blinds)"
                value={`${a.netBB >= 0 ? "+" : ""}${a.netBB.toFixed(1)} BB`}
                tone={a.netBB >= 0 ? "good" : "bad"}
              />
              <Kpi
                label="BB/100 (Ergebnis pro 100 Hände)"
                value={a.bbPer100.toFixed(1)}
                tone={a.bbPer100 >= 0 ? "good" : "bad"}
              />
              <Kpi
                label="Entscheidungen ohne Fehler"
                value={pct(a.goodDecisionRate)}
                tone={
                  a.goodDecisionRate >= 0.9 ? "good" : a.goodDecisionRate >= 0.8 ? undefined : "bad"
                }
              />
              <Kpi
                label="EV-Verlust (durch Fehler verschenkt)"
                value={`${a.totalEvLossBB.toFixed(1)} BB`}
                tone="bad"
              />
            </section>

            {curve.length > 1 && (
              <section className="rounded-lg border border-white/10 bg-black/30 p-3">
                <h2 className="mb-2 font-semibold">Verlauf in Big Blinds</h2>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={curve} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                      <CartesianGrid stroke="#ffffff14" vertical={false} />
                      <XAxis dataKey="i" stroke="#a1a1aa" fontSize={11} tickLine={false} />
                      <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} />
                      <ReferenceLine y={0} stroke="#ffffff40" />
                      <Tooltip
                        contentStyle={{
                          background: "#18181b",
                          border: "1px solid #3f3f46",
                          fontSize: 12,
                        }}
                        formatter={(v: number) => [`${v} BB`, "Ergebnis"]}
                        labelFormatter={(l) => `Hand ${l}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="bb"
                        stroke="#fbbf24"
                        strokeWidth={2}
                        isAnimationActive={false}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Leaks und Stärken */}
            <section className="grid gap-4 md:grid-cols-[2fr_1fr]">
              <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                <h2 className="mb-3 text-lg font-semibold">Deine größten Baustellen</h2>
                {a.leaks.length === 0 ? (
                  <p className="text-sm text-zinc-400">
                    Keine klaren Muster erkannt. Spiel mehr Hände für eine genauere Analyse.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {a.leaks.slice(0, 6).map((l, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-sm font-bold text-red-300">
                          {i + 1}
                        </span>
                        <div>
                          <div className="font-medium">{l.title}</div>
                          {l.text && <div className="text-sm text-zinc-300">{l.text}</div>}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                <h2 className="mb-3 text-lg font-semibold">Das machst du gut</h2>
                {a.strengths.length === 0 ? (
                  <p className="text-sm text-zinc-400">Noch nicht genug Daten.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {a.strengths.map((s, i) => (
                      <li key={i} className="text-emerald-300">
                        ✓ {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Statistiken */}
            <section className="rounded-lg border border-white/10 bg-black/30 p-4">
              <h2 className="mb-3 text-lg font-semibold">Deine Kennzahlen und was sie bedeuten</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {a.stats.map((s) => {
                  const st = statStatus(s);
                  return (
                    <div key={s.key} className="rounded-md border border-white/10 bg-black/30 p-3">
                      <div className="flex items-baseline justify-between">
                        <span>
                          <span className="font-medium">{s.label}</span>
                          {STAT_INFO[s.key] && STAT_INFO[s.key].full !== s.label && (
                            <span className="ml-1.5 text-[11px] text-zinc-500">
                              {STAT_INFO[s.key].full}
                            </span>
                          )}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-lg",
                            st === "ok" && "text-emerald-300",
                            (st === "low" || st === "high") && "text-amber-300",
                            st === "na" && "text-zinc-500",
                          )}
                        >
                          {fmtStat(s)}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400">
                        Guter Bereich{" "}
                        {s.unit === "%"
                          ? `${pct(s.target[0])} bis ${pct(s.target[1])}`
                          : `${s.target[0]} bis ${s.target[1]}`}{" "}
                        · n = {s.sample}
                        {st === "low" && " · zu niedrig"}
                        {st === "high" && " · zu hoch"}
                      </div>
                      <div className="mt-1 text-xs text-zinc-300">
                        {STAT_INFO[s.key]?.meaning ?? s.explain}
                        {st === "low" && STAT_INFO[s.key]?.low && (
                          <div className="mt-1 text-amber-200">{STAT_INFO[s.key].low}</div>
                        )}
                        {st === "high" && STAT_INFO[s.key]?.high && (
                          <div className="mt-1 text-amber-200">{STAT_INFO[s.key].high}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Fehler */}
            <section className="rounded-lg border border-white/10 bg-black/30 p-4">
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <h2 className="text-lg font-semibold">
                  Deine teuersten Fehler (anklicken für Erklärung)
                </h2>
                <span className="text-xs text-zinc-400">
                  Preflop {a.streetErrors.preflop} · Flop {a.streetErrors.flop} · Turn{" "}
                  {a.streetErrors.turn} · River {a.streetErrors.river}
                </span>
              </div>
              {a.mistakes.length === 0 ? (
                <p className="text-sm text-emerald-300">Keine Fehler gefunden. Stark!</p>
              ) : (
                <div className="space-y-2">
                  {mistakes.map((m, i) => (
                    <MistakeRow key={i} m={m} />
                  ))}
                  {a.mistakes.length > 8 && (
                    <button
                      onClick={() => setShowAllMistakes((x) => !x)}
                      className="text-sm text-amber-300 underline"
                    >
                      {showAllMistakes ? "Weniger anzeigen" : `Alle ${a.mistakes.length} anzeigen`}
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Positionen */}
            {a.positions.length > 0 && (
              <section className="rounded-lg border border-white/10 bg-black/30 p-4">
                <h2 className="mb-3 text-lg font-semibold">Ergebnis nach Position</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-zinc-400">
                      <tr>
                        <th className="py-1">Position</th>
                        <th>Hände</th>
                        <th>VPIP</th>
                        <th>Ergebnis</th>
                        <th>BB / Hand</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {a.positions.map((p) => (
                        <tr key={p.position} className="border-t border-white/5">
                          <td className="py-1 font-sans">{p.position}</td>
                          <td>{p.hands}</td>
                          <td>{pct(p.vpip / p.hands)}</td>
                          <td className={p.netBB >= 0 ? "text-emerald-300" : "text-red-300"}>
                            {p.netBB.toFixed(1)} BB
                          </td>
                          <td>{(p.netBB / p.hands).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  Normal: Am Button und im Cutoff gewinnst du am meisten, in den Blinds verlierst du
                  leicht.
                </p>
              </section>
            )}

            <section className="rounded-lg border border-white/10 bg-black/30 p-4">
              <h2 className="mb-3 text-lg font-semibold">Begriffe einfach erklärt</h2>
              <GlossaryList />
            </section>

            {/* Export */}
            <section className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-4">
              <h2 className="text-lg font-semibold">Tiefere Analyse mit Claude</h2>
              <p className="mt-1 text-sm text-zinc-300">
                Exportiere die komplette Hand History mit Statistiken und füge sie in einen Chat mit
                Claude ein. Dann bekommst du eine ausführliche, persönliche Besprechung einzelner
                Hände.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={copy}
                  className="rounded-md bg-amber-400 px-3 py-1.5 font-semibold text-zinc-900"
                >
                  {copied ? "Kopiert!" : "In Zwischenablage kopieren"}
                </button>
                <button
                  onClick={download}
                  className="rounded-md border border-white/20 px-3 py-1.5"
                >
                  Als Datei herunterladen
                </button>
                <button
                  onClick={() => {
                    if (confirm("Alle gespeicherten Hände löschen?")) onClearAll();
                  }}
                  className="ml-auto rounded-md border border-red-400/40 px-3 py-1.5 text-sm text-red-300"
                >
                  Gespeicherte Hände löschen
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="text-xs text-zinc-400">{label}</div>
      <div
        className={cn(
          "font-mono text-xl font-semibold",
          tone === "good" && "text-emerald-300",
          tone === "bad" && "text-red-300",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function MistakeRow({ m }: { m: Mistake }) {
  const [open, setOpen] = useState(false);
  const d = m.decision;
  return (
    <div className="rounded-md border border-white/10 bg-black/30">
      <button
        onClick={() => setOpen((x) => !x)}
        className="flex w-full flex-wrap items-center gap-3 p-2 text-left"
      >
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase",
            m.severity === "groß" && "bg-red-500/25 text-red-300",
            m.severity === "mittel" && "bg-amber-500/25 text-amber-300",
            m.severity === "klein" && "bg-zinc-500/25 text-zinc-300",
          )}
        >
          {m.severity}
        </span>
        <div className="flex gap-0.5">
          {d.cards.map((c, i) => (
            <PlayingCard key={i} card={c} size="sm" />
          ))}
        </div>
        {d.board.length > 0 && (
          <div className="flex gap-0.5 opacity-80">
            {d.board.map((c, i) => (
              <PlayingCard key={i} card={c} size="sm" />
            ))}
          </div>
        )}
        <div className="min-w-40 flex-1">
          <div className="text-sm font-medium">{m.title}</div>
          <div className="text-xs text-zinc-400">
            Hand {m.handNo} · Position {d.position} · {STREET_DE[m.street]}
          </div>
        </div>
        <span className="font-mono text-sm text-red-300">≈ −{m.evLossBB.toFixed(1)} BB</span>
      </button>
      {open && (
        <div className="border-t border-white/10 p-3 text-sm text-zinc-300">
          <p>{m.detail}</p>
          <p className="mt-2 text-xs text-zinc-400">
            Pot {d.pot} · zum Mitgehen {d.toCall} · deine Chips {d.stack} · Gegner {d.opponents} ·
            Gewinnchance {Math.round(d.equity * 100)} %
            {d.toCall > 0 && ` · nötig ${Math.round(d.potOdds * 100)} %`}
          </p>
        </div>
      )}
    </div>
  );
}
