import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { GameShell } from "@/components/game/GameShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Verkehrsplaner – 2D Verkehrssimulation im Browser" },
      {
        name: "description",
        content:
          "Baue Straßen, Kreuzungen und Ampeln und löse Staus: eine detaillierte 2D-Verkehrssimulation mit eigenständigen Fahrzeugen, Routenwahl und Tagesverkehr.",
      },
      { property: "og:title", content: "Verkehrsplaner – 2D Verkehrssimulation" },
      {
        property: "og:description",
        content:
          "Straßenbau, Ampelphasen, Kreisverkehre und emergente Staus in einer Top-Down-Verkehrssimulation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main>
      <h1 className="sr-only">Verkehrsplaner – 2D Verkehrssimulation</h1>
      <ClientOnly
        fallback={
          <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
            Karte wird geladen …
          </div>
        }
      >
        <GameShell />
      </ClientOnly>
    </main>
  );
}
