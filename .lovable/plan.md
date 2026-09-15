# Verkehrssimulation – 2D Top-Down Browser-Spiel

Ein reines Verkehrsplanungs-Spiel im Browser: Straßen bauen, Kreuzungen optimieren, Staus auflösen. Kein Städtebau, keine Wirtschaft.

## Was der Spieler bekommt

**Bauen**
- Straßentypen: Landstraße (1 Spur/Richtung), Hauptstraße (2), Autobahn (2–4, kreuzungsfrei), Rampen/Auf- und Abfahrten, Einbahn-Schalter für jeden Typ
- Zeichenmodi: Freihand (automatisch geglättete Kurve), Gerade mit 15°/45°-Raster (Shift), Kreisbogen mit Zieh-Punkten
- Höhe pro Segment: ebenerdig, Brücke, Tunnel (Bild hoch/runter oder Regler)
- Snapping an bestehende Enden und Knoten, Verbindungspunkte leuchten auf
- Live-Vorschau mit Kosten; rot bei ungültiger Lage (zu enger Radius, Kollision)
- Rückgängig/Wiederholen per Tasten und Buttons

**Bearbeiten statt abreißen**
- Plus/Minus direkt an der Straße für Spuren
- Typ-Upgrade (Landstraße → Hauptstraße), Geometrie und Kreuzungen passen sich an
- Radiergummi für einzelne Segmente, mit Warnung bei verwaisten Fahrzeugen

**Kreuzungen**
- Entstehen automatisch an Schnittpunkten, manuell nachbearbeitbar
- Ampeln mit editierbarer Phasen-Zeitleiste und Durchsatz-Vorschau (Fahrzeuge/Minute)
- Kreisverkehr als eigenes Element (Zufahrten, Spuren im Kreis einstellbar)
- Vorfahrt pro Zufahrt: rechts vor links, Stopp, Vorfahrt gewähren
- Zebrastreifen mit Fußgängeraufkommen, das den Fluss bremst

**Beschilderung**
- Ein-/Ausfahrten frei benennbar
- Farbcodierung: violett Ausfahrt, blau Einfahrt, grün Ziel
- Wegweiser werden automatisch aus den Namen erzeugt und dienen als Routingziel

**Parken**
- Parkflächen als Raster, docken an Straßen an, Zeilen/Spalten einstellbar
- Fahrzeuge suchen Stellplätze, parken ein und aus (inkl. Rückwärtsfahren)
- Auslastung in Prozent pro Fläche

**Verkehr**
- Fahrzeuge als einzelne Agenten mit eigenem Ziel (PKW, LKW, Bus mit je eigener Beschleunigung, Wendekreis, Spurbedarf)
- Routensuche über A*, Neuberechnung bei Umbauten
- Spurwechsel nach Zielspur, Vordermann-Tempo und Sicherheitsabstand
- Staus entstehen emergent aus Engpässen

**Spielmodi**
- Sandkasten: freie Karte, Verkehr läuft automatisch
- Szenarien: vorgegebene Karten mit Durchsatzzielen und Bewertung
- Speicherstände lokal im Browser

## Optik

Satellitenbildartige Draufsicht statt Cartoon. Erdige Palette: Sandtöne, trockenes Gras, gedecktes Grün. Scharfe Vektor-Markierungen für Fahrbahn, Zebrastreifen, Schilder. Weiche Schatten unter Bäumen und Fahrzeugen für Tiefe. Werkzeugleiste unten, Reiter: Straßen, Kreuzungen, Beschilderung, Parken, Ansicht; Kontextleiste je Werkzeug.

## Technische Umsetzung

Unity/Godot sind hier nicht baubar – die Simulation läuft stattdessen als HTML-Canvas-Spiel (React + TypeScript), das die gleiche Architektur nachbildet.

- Rendering: eigener Canvas-2D-Renderer mit Kamera (Pan/Zoom), Layern (Untergrund, Straßen, Markierungen, Schatten, Fahrzeuge, UI-Overlay) und Dirty-Rect/Offscreen-Cache für statische Straßen
- Datenmodell: Straßennetz als Graph. Kante speichert Spuren, Richtung, Tempolimit, Höhenprofil, Geometrie (Polyline aus Bezier/Bogen-Sampling). Knoten halten Kreuzungstyp und Verbindungsmatrix
- Kurven: Catmull-Rom-Glättung für Freihand, Winkel-Snap für Gerade, parametrischer Kreisbogen; Mindestradius-Prüfung pro Straßentyp
- Simulation: fester Tick (z. B. 30 Hz) entkoppelt vom Rendering; Fahrzeuge als typisierte Arrays/Pool-Objekte für mehrere hundert Agenten; Car-Following-Modell (IDM-artig) plus Spurwechsel-Regeln
- Routing: A* über den Kanten-Graph mit Kosten aus Länge/Tempolimit/Auslastung; Routen-Cache, Invalidierung bei Netzänderung
- Kreuzungen: State Machine pro Knoten (Ampelphasen, Vorfahrt, Kreisverkehr-Einfädeln), Konfliktpunkt-Reservierung gegen Blockierung
- Höhen: z-Ebene pro Segment; Kreuzung wird nur erzeugt, wenn Ebenen gleich sind (sonst Brücke/Tunnel)
- Undo/Redo als Command-Stack auf Graph-Operationen
- Speichern: Netz und Zustand als JSON, Persistenz im Browser-Speicher, Export/Import als Datei
- Struktur: `src/game/` (graph, geometry, sim, routing, intersections, render), `src/components/game/` (Toolbar, Kontextleisten, Ampel-Editor, Inspector), Spielseite auf `/`

## Reihenfolge der Umsetzung

1. Canvas, Kamera, Gelände, Graph-Modell, Straßenzeichnen (alle drei Modi) mit Snapping und Vorschau
2. Kreuzungsgenerierung, Bearbeiten/Upgrade/Radiergummi, Undo/Redo
3. Fahrzeugagenten, Routing, Car-Following, Spurwechsel
4. Ampel-Editor, Kreisverkehr, Vorfahrt, Zebrastreifen
5. Beschilderung und benannte Ziele, Parkflächen mit Ein-/Ausparken
6. Höhen (Brücke/Tunnel), Rampen/Autobahnanschlüsse
7. Sandkasten + Szenarien mit Zielen, Statistiken, Speichern/Laden, visueller Feinschliff

Der Umfang ist groß; ich baue in dieser Reihenfolge und liefere nach jedem Schritt etwas Spielbares.
