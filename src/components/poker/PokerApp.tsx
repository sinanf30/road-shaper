import { useCallback, useEffect, useMemo, useState } from "react";
import { PokerTable } from "./PokerTable";
import { AnalysisView } from "./AnalysisView";
import { newGame } from "@/poker/engine";
import { AI_STYLES } from "@/poker/ai";
import { clearHands, loadHands, saveHand } from "@/poker/storage";
import type { AIStyleId, GameConfig, GameState, HandRecord } from "@/poker/types";
import { cn } from "@/lib/utils";

type Phase = "setup" | "play" | "analysis";

export function PokerApp() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [game, setGame] = useState<GameState | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [sessionHands, setSessionHands] = useState<HandRecord[]>([]);
  const [allHands, setAllHands] = useState<HandRecord[]>([]);

  useEffect(() => setAllHands(loadHands()), []);

  const start = (cfg: GameConfig) => {
    setGame(newGame(cfg));
    setSessionId(`${Date.now()}`);
    setSessionHands([]);
    setPhase("play");
  };

  const onHandFinished = useCallback(
    (h: HandRecord) => {
      setSessionHands((xs) => [...xs, h]);
      setAllHands((xs) => [...xs, h]);
      saveHand({ ...h, sessionId });
    },
    [sessionId],
  );

  const sessionNetBB = useMemo(
    () => sessionHands.reduce((a, h) => a + h.heroNet / h.bb, 0),
    [sessionHands],
  );

  if (phase === "analysis")
    return (
      <AnalysisView
        sessionHands={sessionHands}
        allHands={allHands}
        onBack={() => setPhase(game ? "play" : "setup")}
        onClearAll={() => {
          clearHands();
          setAllHands([]);
        }}
      />
    );

  if (phase === "play" && game)
    return (
      <PokerTable
        state={game}
        setState={setGame}
        onHandFinished={onHandFinished}
        handsPlayed={sessionHands.length}
        sessionNetBB={sessionNetBB}
        onEndSession={() => setPhase("analysis")}
      />
    );

  return (
    <Setup onStart={start} savedHands={allHands.length} onAnalyze={() => setPhase("analysis")} />
  );
}

function Setup({
  onStart,
  savedHands,
  onAnalyze,
}: {
  onStart: (c: GameConfig) => void;
  savedHands: number;
  onAnalyze: () => void;
}) {
  const [opponents, setOpponents] = useState(5);
  const [stackBB, setStackBB] = useState(100);
  const [styleMode, setStyleMode] = useState<"mixed" | AIStyleId>("mixed");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1410] px-4 py-10 text-zinc-100">
      <div className="w-full max-w-xl space-y-6 rounded-2xl border border-white/10 bg-black/40 p-6 shadow-xl">
        <div>
          <h1 className="font-display text-4xl font-semibold text-amber-300">Hold'em Coach</h1>
          <p className="mt-1 text-sm text-zinc-300">
            Spiel No-Limit Texas Hold'em gegen KI-Gegner. Jede deiner Entscheidungen wird
            mitgeschrieben und danach ausgewertet: Statistiken, typische Leaks und die teuersten
            Fehler mit konkreten Tipps.
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">1. Anzahl Gegner</div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setOpponents(n)}
                className={cn(
                  "flex-1 rounded-md border py-2",
                  opponents === n ? "border-amber-300 bg-amber-300/15" : "border-white/15",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="text-xs text-zinc-400">
            {opponents === 1 ? "Heads-up" : `${opponents + 1} Spieler am Tisch`}. Die Analyse ist
            auf 6er-Tische optimiert.
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">2. Startstack</div>
          <div className="flex gap-2">
            {[50, 100, 200].map((n) => (
              <button
                key={n}
                onClick={() => setStackBB(n)}
                className={cn(
                  "flex-1 rounded-md border py-2",
                  stackBB === n ? "border-amber-300 bg-amber-300/15" : "border-white/15",
                )}
              >
                {n} BB
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">3. Gegnertypen</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StyleButton
              active={styleMode === "mixed"}
              onClick={() => setStyleMode("mixed")}
              label="Gemischt"
              desc="Zufälliger Mix aller Typen"
            />
            {Object.values(AI_STYLES).map((st) => (
              <StyleButton
                key={st.id}
                active={styleMode === st.id}
                onClick={() => setStyleMode(st.id)}
                label={st.label}
                desc={st.description}
              />
            ))}
          </div>
        </div>

        <button
          onClick={() =>
            onStart({
              opponents,
              startingStack: stackBB * 20,
              smallBlind: 10,
              bigBlind: 20,
              styles: styleMode === "mixed" ? "mixed" : [styleMode],
            })
          }
          className="w-full rounded-lg bg-amber-400 py-3 text-lg font-semibold text-zinc-900 hover:bg-amber-300"
        >
          An den Tisch setzen
        </button>

        {savedHands > 0 && (
          <button onClick={onAnalyze} className="w-full text-sm text-amber-300 underline">
            Analyse aller {savedHands} gespeicherten Hände ansehen
          </button>
        )}

        <p className="text-xs text-zinc-500">
          Tastenkürzel am Tisch: F = Fold, C = Check/Call, R = Bet/Raise. Hände werden nur lokal in
          deinem Browser gespeichert.
        </p>
      </div>
    </div>
  );
}

function StyleButton({
  active,
  onClick,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border p-2 text-left",
        active ? "border-amber-300 bg-amber-300/15" : "border-white/15 hover:bg-white/5",
      )}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[11px] leading-snug text-zinc-400">{desc}</div>
    </button>
  );
}
