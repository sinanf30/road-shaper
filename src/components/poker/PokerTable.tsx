import { useEffect, useMemo, useRef, useState } from "react";
import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";
import {
  HERO,
  applyMove,
  legalActions,
  opponentRanges,
  positionOf,
  potTotal,
  startHand,
  type Move,
} from "@/poker/engine";
import { decideAI, AI_STYLES } from "@/poker/ai";
import { estimateEquity } from "@/poker/equity";
import { handName, preflopPercentile, handClass } from "@/poker/cards";
import { judgeDecision, type Mistake } from "@/poker/analysis";
import { adviseHero, startHandWords, STREET_DE } from "@/poker/coach";
import { GlossaryOverlay } from "./Glossary";
import type { GameState, HandRecord } from "@/poker/types";

interface Props {
  state: GameState;
  setState: (s: GameState) => void;
  onHandFinished: (h: HandRecord) => void;
  handsPlayed: number;
  sessionNetBB: number;
  onEndSession: () => void;
}

export function PokerTable({
  state,
  setState,
  onHandFinished,
  handsPlayed,
  sessionNetBB,
  onEndSession,
}: Props) {
  const [training, setTraining] = useState(true);
  const [autoNext, setAutoNext] = useState(false);
  const [speed, setSpeed] = useState(700);
  const [feedback, setFeedback] = useState<Mistake[] | null>(null);
  const [showGlossary, setShowGlossary] = useState(false);
  const savedHand = useRef(0);
  const s = state;
  const hero = s.players[HERO];
  const heroTurn = !s.handOver && s.toAct === HERO;

  // KI am Zug
  useEffect(() => {
    if (s.handOver || s.toAct === HERO || s.toAct < 0) return;
    const t = setTimeout(() => setState(applyMove(s, decideAI(s))), speed);
    return () => clearTimeout(t);
  }, [s, setState, speed]);

  // Hand beendet: speichern und Sofort-Feedback
  useEffect(() => {
    if (!s.handOver || !s.record || savedHand.current === s.handNo) return;
    savedHand.current = s.handNo;
    onHandFinished(s.record);
    const ms = s.record.decisions.flatMap((d) => judgeDecision(d, s.record!.players.length));
    setFeedback(ms);
  }, [s, onHandFinished]);

  useEffect(() => {
    if (!s.handOver || !autoNext || s.handNo === 0) return;
    const t = setTimeout(() => {
      setFeedback(null);
      setState(startHand(s));
    }, 3500);
    return () => clearTimeout(t);
  }, [s, autoNext, setState]);

  const next = () => {
    setFeedback(null);
    setState(startHand(s));
  };

  const pot = potTotal(s);
  const legal = heroTurn ? legalActions(s) : null;

  const equity = useMemo(() => {
    if (!heroTurn || !training) return null;
    return estimateEquity(hero.hole, s.board, opponentRanges(s, HERO), 1500);
  }, [heroTurn, training, hero.hole, s]);

  const n = s.players.length;
  const showAll = s.handOver && !!s.record && s.record.showdown.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#0b1410] text-zinc-100">
      {showGlossary && <GlossaryOverlay onClose={() => setShowGlossary(false)} />}
      {/* Kopfzeile */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-2 text-sm">
        <span className="font-display text-xl font-semibold tracking-wide text-amber-300">
          Hold'em Coach
        </span>
        <span className="text-zinc-400">
          Hand {s.handNo} · Blinds {s.config.smallBlind}/{s.config.bigBlind}
        </span>
        <span className={cn("font-mono", sessionNetBB >= 0 ? "text-emerald-400" : "text-red-400")}>
          {sessionNetBB >= 0 ? "+" : ""}
          {sessionNetBB.toFixed(1)} BB in {handsPlayed} Händen
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={training}
              onChange={(e) => setTraining(e.target.checked)}
            />
            Trainingsmodus
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={autoNext}
              onChange={(e) => setAutoNext(e.target.checked)}
            />
            Auto-Weiter
          </label>
          <select
            className="rounded border border-white/20 bg-black/40 px-1.5 py-0.5"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            aria-label="KI-Tempo"
          >
            <option value={1200}>KI langsam</option>
            <option value={700}>KI normal</option>
            <option value={250}>KI schnell</option>
          </select>
          <button
            onClick={() => setShowGlossary(true)}
            className="rounded-md border border-white/25 px-3 py-1 hover:bg-white/10"
          >
            Begriffe erklärt
          </button>
          <button
            onClick={onEndSession}
            className="rounded-md bg-amber-400 px-3 py-1 font-semibold text-zinc-900 hover:bg-amber-300"
          >
            Session beenden & analysieren
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-3 lg:flex-row">
        {/* Tisch */}
        <div className="flex-1">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-4xl sm:aspect-[16/9]">
            <div className="absolute inset-[10%_8%] sm:inset-[9%_6%] rounded-[50%] border-[10px] border-[#3b2a1a] bg-[radial-gradient(ellipse_at_center,#1f7a4a_0%,#145c37_60%,#0e4429_100%)] shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]" />
            {/* Board und Pot */}
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
              <div className="rounded-full bg-black/40 px-3 py-0.5 font-mono text-sm text-amber-200">
                Pot {pot}
              </div>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) =>
                  s.board[i] !== undefined ? (
                    <PlayingCard key={i} card={s.board[i]} size="md" />
                  ) : (
                    <div
                      key={i}
                      className="h-14 w-10 rounded-md border border-dashed border-white/15"
                    />
                  ),
                )}
              </div>
            </div>
            {/* Spieler */}
            {s.players.map((p, i) => {
              const theta = Math.PI / 2 + (i * 2 * Math.PI) / n;
              const left = 50 + 45 * Math.cos(theta);
              const top = 50 + 42 * Math.sin(theta);
              const isTurn = !s.handOver && s.toAct === p.seat;
              const reveal = p.isHuman || (showAll && !p.folded);
              const won = s.handOver && s.record?.winners.some((w) => w.seat === p.seat);
              const pos = positionOf(s, p.seat);
              return (
                <div
                  key={p.seat}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  <div className={cn("flex gap-0.5", p.folded && "opacity-30")}>
                    {p.hole.map((c, k) => (
                      <PlayingCard
                        key={k}
                        card={c}
                        hidden={!reveal}
                        size={p.isHuman ? "md" : "sm"}
                      />
                    ))}
                  </div>
                  <div
                    className={cn(
                      "min-w-[72px] rounded-lg border sm:min-w-[88px] px-2 py-1 text-center text-xs leading-tight shadow",
                      isTurn
                        ? "border-amber-300 bg-amber-950/80 ring-2 ring-amber-300"
                        : "border-white/15 bg-black/70",
                      won && "border-emerald-400 ring-2 ring-emerald-400",
                    )}
                  >
                    <div className="flex items-center justify-center gap-1 font-semibold">
                      {p.name}
                      {pos && (
                        <span
                          className={cn(
                            "rounded px-1 text-[10px]",
                            pos === "BTN" ? "bg-white text-zinc-900" : "bg-white/15 text-zinc-300",
                          )}
                        >
                          {pos}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-amber-200">{p.stack}</div>
                    {!p.isHuman && p.style && (
                      <div className="hidden text-[10px] text-zinc-400 sm:block">
                        {AI_STYLES[p.style].label}
                      </div>
                    )}
                  </div>
                  {p.betThisRound > 0 && !s.handOver && (
                    <div className="rounded-full bg-amber-500/90 px-2 font-mono text-[11px] font-semibold text-zinc-900">
                      {p.betThisRound}
                    </div>
                  )}
                  {p.allIn && !p.folded && (
                    <div className="text-[10px] font-bold text-red-400">ALL-IN</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Aktionsleiste */}
          <div className="mx-auto mt-2 max-w-4xl">
            {s.handNo === 0 ? (
              <button
                onClick={next}
                className="w-full rounded-lg bg-amber-400 py-3 text-lg font-semibold text-zinc-900"
              >
                Erste Hand austeilen
              </button>
            ) : s.handOver ? (
              <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/40 p-3">
                <div className="text-sm text-zinc-200">{s.message}</div>
                <button
                  onClick={next}
                  className="rounded-lg bg-amber-400 py-2 font-semibold text-zinc-900 hover:bg-amber-300"
                >
                  Nächste Hand {autoNext && "(automatisch …)"}
                </button>
              </div>
            ) : heroTurn && legal ? (
              <HeroControls
                key={`${s.handNo}-${s.record?.actions.length}`}
                state={s}
                legal={legal}
                onMove={(m) => setState(applyMove(s, m))}
              />
            ) : (
              <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-center text-sm text-zinc-400">
                {s.players[s.toAct]?.name ?? ""} ist am Zug …
              </div>
            )}
          </div>
        </div>

        {/* Seitenleiste */}
        <aside className="flex w-full flex-col gap-3 lg:w-80">
          {training && (
            <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-sm">
              <div className="mb-2 font-semibold text-amber-200">Trainer</div>
              {hero.hole.length === 2 ? (
                <TrainerPanel state={s} equity={equity} />
              ) : (
                <div className="text-zinc-400">Noch keine Karten.</div>
              )}
            </div>
          )}
          {feedback && s.handOver && (
            <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-sm">
              <div className="mb-1 font-semibold text-amber-200">Feedback zu dieser Hand</div>
              {feedback.length === 0 ? (
                <div className="text-emerald-300">Keine auffälligen Fehler. Gut gespielt!</div>
              ) : (
                <ul className="space-y-2">
                  {feedback.map((m, i) => (
                    <li key={i}>
                      <div className="font-medium text-red-300">
                        {STREET_DE[m.street]}: {m.title}
                      </div>
                      <div className="text-xs text-zinc-300">{m.detail}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <HandLog state={s} />
        </aside>
      </div>
    </div>
  );
}

function TrainerPanel({ state: s, equity }: { state: GameState; equity: number | null }) {
  const hero = s.players[HERO];
  const words = startHandWords(preflopPercentile(hero.hole));
  const advice = adviseHero(s, equity);
  const toneCls = (t: "good" | "ok" | "bad") =>
    t === "good" ? "text-emerald-300" : t === "ok" ? "text-sky-300" : "text-red-300";
  return (
    <div className="space-y-2 text-zinc-300">
      <div>
        <div className="text-xs text-zinc-400">Deine Starthand ({handClass(hero.hole)})</div>
        <div className={toneCls(words.tone)}>{words.label}</div>
      </div>
      {s.board.length > 0 && (
        <div>
          <div className="text-xs text-zinc-400">Was du gerade hast</div>
          <div>{handName([...hero.hole, ...s.board])}</div>
        </div>
      )}
      {advice ? (
        <div className="rounded-md border border-white/10 bg-black/30 p-2">
          <div className="text-xs text-zinc-400">Empfehlung</div>
          <div className={cn("font-semibold", toneCls(advice.tone))}>{advice.action}</div>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
            {advice.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : (
        !s.handOver && (
          <div className="text-xs text-zinc-400">
            Sobald du dran bist, bekommst du hier eine Empfehlung.
          </div>
        )
      )}
    </div>
  );
}

function HeroControls({
  state: s,
  legal,
  onMove,
}: {
  state: GameState;
  legal: ReturnType<typeof legalActions>;
  onMove: (m: Move) => void;
}) {
  const pot = potTotal(s);
  const hero = s.players[HERO];
  const isBet = s.currentBet === 0;
  const clampTo = (x: number) => {
    const step = s.config.smallBlind;
    const rounded = Math.round(x / step) * step;
    return Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, rounded));
  };
  const potRaise = (frac: number) => clampTo(s.currentBet + (pot + legal.toCall) * frac);
  const [amount, setAmount] = useState(() =>
    s.street === "preflop" && s.raisesThisRound === 0
      ? clampTo(s.config.bigBlind * 3)
      : s.street === "preflop"
        ? clampTo(s.currentBet * 3)
        : potRaise(0.5),
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "f") onMove({ type: "fold" });
      if (e.key === "c") onMove(legal.canCheck ? { type: "check" } : { type: "call" });
      if (e.key === "r" && legal.canRaise) onMove({ type: "raise", to: amount });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [legal, amount, onMove]);

  const presets =
    s.street === "preflop" && s.raisesThisRound === 0
      ? [
          { label: "2,5 BB", to: s.config.bigBlind * 2.5 },
          { label: "3 BB", to: s.config.bigBlind * 3 },
          { label: "4 BB", to: s.config.bigBlind * 4 },
        ]
      : [
          { label: "⅓ Pot", to: potRaise(1 / 3) },
          { label: "½ Pot", to: potRaise(0.5) },
          { label: "¾ Pot", to: potRaise(0.75) },
          { label: "Pot", to: potRaise(1) },
        ];

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-300/40 bg-black/50 p-3">
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => onMove({ type: "fold" })}
          className="rounded-lg bg-zinc-700 py-2.5 font-semibold hover:bg-zinc-600"
          title="Taste F"
        >
          Fold
        </button>
        <button
          onClick={() => onMove(legal.canCheck ? { type: "check" } : { type: "call" })}
          className="rounded-lg bg-sky-700 py-2.5 font-semibold hover:bg-sky-600"
          title="Taste C"
        >
          {legal.canCheck
            ? "Check"
            : `Call ${legal.callAmount}${legal.callAmount >= hero.stack ? " (All-in)" : ""}`}
        </button>
        <button
          disabled={!legal.canRaise}
          onClick={() => onMove({ type: "raise", to: amount })}
          className="rounded-lg bg-amber-500 py-2.5 font-semibold text-zinc-900 hover:bg-amber-400 disabled:opacity-40"
          title="Taste R"
        >
          {amount >= legal.maxRaiseTo ? "All-in" : isBet ? "Bet" : "Raise auf"} {amount}
        </button>
      </div>
      {legal.canRaise && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="range"
            min={legal.minRaiseTo}
            max={legal.maxRaiseTo}
            step={s.config.smallBlind}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="min-w-40 flex-1 accent-amber-400"
            aria-label="Einsatzhöhe"
          />
          <input
            type="number"
            min={legal.minRaiseTo}
            max={legal.maxRaiseTo}
            value={amount}
            onChange={(e) =>
              setAmount(
                Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Number(e.target.value) || 0)),
              )
            }
            className="w-20 rounded border border-white/20 bg-black/40 px-1.5 py-1 font-mono text-sm"
          />
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => setAmount(clampTo(p.to))}
              className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setAmount(legal.maxRaiseTo)}
            className="rounded border border-red-400/50 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
          >
            All-in
          </button>
        </div>
      )}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  sb: "Small Blind",
  bb: "Big Blind",
  fold: "foldet",
  check: "checkt",
  call: "callt",
  bet: "setzt",
  raise: "erhöht auf",
};

const HERO_LABEL: Record<string, string> = {
  ...KIND_LABEL,
  fold: "foldest",
  check: "checkst",
  call: "callst",
  bet: "setzt",
  raise: "erhöhst auf",
};

function HandLog({ state: s }: { state: GameState }) {
  const ref = useRef<HTMLDivElement>(null);
  const actions = s.record?.actions ?? [];
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [actions.length]);
  let lastStreet = "";
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-3 text-xs">
      <div className="mb-1 text-sm font-semibold text-amber-200">Verlauf</div>
      <div ref={ref} className="max-h-72 space-y-0.5 overflow-y-auto pr-1 font-mono">
        {actions.map((a, i) => {
          const header = a.street !== lastStreet && a.street !== "preflop";
          lastStreet = a.street;
          return (
            <div key={i}>
              {header && <div className="mt-1 text-amber-300/80">{a.street.toUpperCase()}</div>}
              <span className={a.seat === HERO ? "text-amber-200" : "text-zinc-300"}>
                {a.name}
              </span>{" "}
              {(a.seat === HERO ? HERO_LABEL : KIND_LABEL)[a.kind]}{" "}
              {a.kind !== "fold" && a.kind !== "check" ? a.amount : ""}
              {a.allIn ? " (all-in)" : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}
