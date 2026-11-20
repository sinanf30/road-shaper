import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { PokerApp } from "@/components/poker/PokerApp";

export const Route = createFileRoute("/poker")({
  head: () => ({
    meta: [
      { title: "Hold'em Coach: Texas Hold'em gegen KI mit Spielanalyse" },
      {
        name: "description",
        content:
          "Spiele No-Limit Texas Hold'em gegen KI-Gegner und erhalte danach eine Analyse deiner Spielweise mit Statistiken, Leaks und konkreten Tipps.",
      },
    ],
  }),
  component: PokerPage,
});

function PokerPage() {
  return (
    <main>
      <h1 className="sr-only">Hold'em Coach</h1>
      <ClientOnly
        fallback={
          <div className="flex h-screen items-center justify-center bg-[#0b1410] text-zinc-400">
            Tisch wird vorbereitet …
          </div>
        }
      >
        <PokerApp />
      </ClientOnly>
    </main>
  );
}
