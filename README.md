# Traffic Flow Sim

Detaillierter Entwicklungsprompt 💻🛣️

Prompt:

"Entwickle ein 2D Top Down Verkehrssimulationsspiel, das sich vollständig auf Straßenbau und Verkehrsfluss konzentriert. Städtebau, Zonierung, Gebäude oder Wirtschaftssimulation sind bewusst nicht Teil des Spiels. Der Spieler ist im Kern ein Verkehrsplaner, keine Bürgermeisterin.

1. Straßenbausystem

Straßentypen:

Landstraße (1 Spur pro Richtung, niedriges Tempolimit)

Hauptstraße (2 Spuren pro Richtung, mittleres Tempolimit)

Autobahn (2 bis 4 Spuren pro Richtung, kein Kreuzungsverkehr, hohes Tempolimit)

Einbahnstraßen als Umschaltoption für jeden Straßentyp

Rampen und Auf/Abfahrten als eigene Kategorie mit fixer Verbindungslogik zu Autobahnen

Bauwerkzeuge:

Freihand Zeichenmodus: Spieler zieht die Straße per Drag mit der Maus, das System berechnet automatisch eine geglättete Kurve entlang der Zugpunkte

Gerade Linie Modus mit Snap auf 15 oder 45 Grad Winkel, gehalten durch Shift Taste

Kreisbogen Modus für exakte Kurvenradien, mit Ziehpunkten für Start, Ende und Wölbung

Höhenverstellung pro Straßensegment (Brücke, Tunnel, ebenerdig), gesteuert über Bild hoch/runter Tasten während des Zeichnens oder über einen Höhenregler im UI

Snapping an bestehende Straßenenden und Knotenpunkte, visualisiert durch aufleuchtende Verbindungspunkte

Bearbeitungswerkzeuge (Upgrade statt Neubau):

Spur hinzufügen oder entfernen an bestehenden Segmenten per Klick auf ein Plus/Minus Symbol direkt an der Straße

Straßentyp nachträglich upgraden (Landstraße zu Hauptstraße) ohne die Straße abreißen zu müssen, das Spiel passt Geometrie und angrenzende Kreuzungen automatisch an

Radiergummi Werkzeug zum gezielten Entfernen einzelner Segmente, mit Warnhinweis falls dadurch Fahrzeuge ohne Route zurückbleiben

UI Aufbau:

Werkzeugleiste am unteren Bildschirmrand, thematisch gruppiert in Reiter: Straßen, Kreuzungen, Beschilderung, Parken, Ansicht

Jeder Straßentyp als eigenes Icon mit Kostenanzeige und Kapazitätsindikator (kleine Symbole für Spurenanzahl)

Beim Anwählen eines Straßentyps erscheint eine Kontextleiste mit Zusatzoptionen: Einbahnstraße an/aus, Geschwindigkeitsbegrenzung per Schieberegler, Baumbepflanzung an/aus, Fußgängerweg an/aus

Live Vorschau der Straße während des Zeichnens inklusive grober Kostenanzeige und roter Einfärbung bei ungültiger Platzierung (zu enger Radius, Kollision mit bestehender Bebauung)

Rückgängig/Wiederholen Funktion über Tastenkombination und sichtbare Buttons

2. Kreuzungslogik

Automatische Kreuzungsgenerierung an Schnittpunkten, mit manueller Nachbearbeitung durch den Spieler

Ampelsystem: Phasenschaltung per Zeitleiste editierbar, Spieler kann Grünphasen einzeln pro Richtung verlängern oder verkürzen, Vorschau zeigt simulierten Durchsatz in Fahrzeugen pro Minute

Kreisverkehr als eigenständiges Bauelement mit einstellbarer Anzahl an Zufahrten und Spurenanzahl im Kreis selbst

Vorfahrtsregeln (rechts vor links, Stoppschild, Vorfahrt gewähren) als Toggle direkt an jeder Kreuzungszufahrt

Zebrastreifen mit Fußgängeraufkommen, das den Verkehrsfluss realistisch bremst

3. Beschilderungssystem

Benannte Ein und Ausfahrten, die der Spieler frei betiteln kann (Textfeld im UI)

Farbcodierte Schilder: violett für Ausfahrten, blau für Einfahrten, grün für Ziele/Sehenswürdigkeiten

Automatische Wegweiser Generierung basierend auf den vergebenen Namen, sichtbar für die simulierten Fahrzeuge als Routingziel

4. Parkplatzsystem

Parkflächen als Rasterobjekt, das an Straßen andockt, mit einstellbarer Zeilen und Spaltenanzahl

Einzelne Stellplätze werden von Fahrzeugagenten gesucht und belegt, inklusive Ein und Ausparkverhalten mit Rückwärtsfahren

Auslastungsanzeige pro Parkfläche in Prozent

5. Verkehrssimulation

Fahrzeuge als individuelle Agenten mit eigenem Ziel, nicht nur als Partikeleffekt

Pathfinding über A* oder Flow Field, Neuberechnung bei Straßenänderungen in Echtzeit

Spurwechselverhalten basierend auf Zielspur, Geschwindigkeit des Vordermanns und Sicherheitsabstand

Verschiedene Fahrzeugtypen (PKW, LKW, Bus) mit unterschiedlicher Beschleunigung, Wendekreis und Spurbedarf

Stauentstehung als emergentes Verhalten aus Kapazitätsengpässen, nicht scriptet

6. Technischer Rahmen

Engine: Unity (2D URP) oder Godot 4

Straßennetz als Graph (Knoten und Kanten), jede Kante speichert Spurenanzahl, Richtung, Geschwindigkeitslimit, Höhenprofil

Fahrzeugagenten als leichte Objekte mit Object Pooling, um mehrere hundert gleichzeitige Fahrzeuge performant zu halten

Kreuzungslogik als separates State Machine System pro Knoten

Speicherformat: Straßennetz und Zustand als JSON oder Binärformat serialisierbar für Speicherstände

7. Visueller Stil

Realistische, satellitenbildartige Draufsicht statt Cartoon Optik

Erdige Farbpalette: Sandtöne, trockenes Gras, gedecktes Grün bei Bäumen und Büschen

Klare Vektorgrafik für Fahrbahnmarkierungen, Zebrastreifen und Beschilderung

Schattenwurf der Bäume und Fahrzeuge für leichte Tiefenwirkung trotz reiner Draufsicht

8. Zielgruppe und Spielgefühl

Spieler, die Freude an Optimierung, Effizienz und realistischer Verkehrsplanung haben. Der Reiz liegt im Lösen konkreter Durchsatzprobleme (Stau an einer bestimmten Kreuzung auflösen) statt im langfristigen Städtewachstum."

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://road-shaper.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7b755594-fcfb-4b81-83e1-8ee31f089448).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
