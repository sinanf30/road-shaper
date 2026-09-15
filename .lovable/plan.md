# Verkehrssimulation – 2D Top-Down Browser-Spiel

Ein reines Verkehrsplanungs-Spiel im Browser: Straßen bauen, Kreuzungen optimieren, Staus auflösen. Kein Städtebau, keine Wirtschaft. Der Anspruch: tiefe, glaubwürdige Simulation und ständig etwas zu tun.

## Bauen

- Straßentypen: Landstraße (1 Spur/Richtung), Hauptstraße (2), Autobahn (2–4, kreuzungsfrei), Rampen/Auf- und Abfahrten, Einbahn-Schalter für jeden Typ
- Zeichenmodi: Freihand (automatisch geglättete Kurve), Gerade mit 15°/45°-Raster (Shift), Kreisbogen mit Zieh-Punkten für Start, Ende, Wölbung
- Höhe pro Segment: ebenerdig, Brücke, Tunnel (Bild hoch/runter oder Regler), mit Rampensteigung und Kostenaufschlag
- Snapping an Enden und Knoten, Verbindungspunkte leuchten auf; Winkel- und Radiusprüfung pro Straßentyp
- Live-Vorschau mit Kosten, Länge, erwarteter Kapazität; rot bei ungültiger Lage
- Unbegrenztes Rückgängig/Wiederholen per Tasten und Buttons
- Bearbeiten statt abreißen: Spuren per Plus/Minus am Segment, Typ-Upgrade mit automatischer Anpassung angrenzender Kreuzungen, Radiergummi mit Warnung bei verwaisten Fahrzeugen
- Zusatzoptionen je Straße: Tempolimit-Regler, Bäume, Fußweg, Standstreifen, Busspur, Abbiegespuren an Kreuzungszufahrten

## Kreuzungen und Regeln

- Automatische Kreuzungsgenerierung an Schnittpunkten, manuell nachbearbeitbar
- Spurverbindungs-Editor: jede Zufahrtsspur lässt sich per Ziehen einzelnen Abfahrtsspuren zuordnen (Abbiegeverbote, dedizierte Rechtsabbieger)
- Ampeln mit Phasen-Zeitleiste: Grünphasen je Richtung ziehen, Zwischenzeiten, Rechtsabbieger-Pfeil, Fußgängerphase; Vorschau zeigt Durchsatz in Fahrzeugen/Minute und Rückstaulänge
- Ampel-Intelligenz: fixe Phasen, verkehrsabhängige Schaltung (Sensoren an Zufahrten) und Grüne Welle über mehrere Ampeln mit Versatz-Regler
- Kreisverkehr mit einstellbaren Zufahrten, Spuren im Kreis, Turbokreisel-Option
- Vorfahrt pro Zufahrt: rechts vor links, Stopp, Vorfahrt gewähren
- Zebrastreifen und Fußgängerampeln mit echtem Fußgängeraufkommen, das Fahrzeuge bremst
- Blockier-Schutz: Fahrzeuge reservieren Konfliktpunkte und fahren nicht in eine volle Kreuzung ein (Gridlock entsteht nur bei echter Überlast)

## Verkehrsintelligenz

- Fahrzeuge sind einzelne Agenten mit Ziel, Route, Geduld und Fahrstil (vorsichtig, normal, aggressiv)
- Fahrzeugtypen: PKW, LKW, Bus, Lieferwagen, Motorrad, Einsatzfahrzeug – je eigene Beschleunigung, Bremsweg, Länge, Wendekreis, Spurbedarf
- Folgeverhalten nach IDM-Modell: realistisches Anfahren, Bremsen, Stop-and-Go-Wellen entstehen von selbst
- Spurwechsel nach MOBIL-Logik: Nutzen und Höflichkeit werden abgewogen, Reißverschluss beim Einfädeln, frühzeitiges Einordnen vor Abbiegungen
- Routen über A* mit Kosten aus Länge, Tempolimit, Ampelverzögerung und aktueller Auslastung; Fahrer kennen die Stadt unterschiedlich gut, manche weichen bei Stau aus, andere nicht
- Dynamische Umleitung: bei starkem Stau planen lernfähige Fahrer neu, wodurch sich Verkehr auf Alternativrouten verlagert
- Verkehrsnachfrage als Quelle-Ziel-Matrix mit Tagesverlauf: Morgen- und Abendspitze, Mittagsdelle, Nachtruhe; Zeitraffer 1x bis 16x, Pause
- Zwischenfälle: Unfälle mit gesperrter Spur, Baustellen, Falschparker, Busse an Haltestellen, Rettungsfahrzeuge mit Rettungsgasse
- Wetter (Regen, Nebel, Glätte) senkt Geschwindigkeit und Sicherheitsabstand
- Fußgänger und Radfahrer als eigene Agenten auf Wegen und Übergängen

## Beschilderung und Wegweisung

- Ein- und Ausfahrten frei benennbar, Ziele und Sehenswürdigkeiten als Routing-Anker
- Farbcodierte Schilder: violett Ausfahrt, blau Einfahrt, grün Ziel
- Wegweiser werden automatisch aus den Namen erzeugt; fehlende oder falsche Beschilderung führt zu Fehlfahrten und Umwegen der Agenten
- Tempolimit-, Stopp-, Vorfahrt- und Überholverbotsschilder platzierbar

## Parken

- Parkflächen als Raster, docken an Straßen an, Zeilen und Spalten einstellbar, Ein- und Ausfahrt frei wählbar
- Parkhaus mit Ebenen als Variante
- Fahrzeuge suchen Stellplätze, parken ein und aus inklusive Rückwärtsfahren und Wartezeiten
- Parksuchverkehr: zu wenig Plätze erzeugt kreisende Fahrzeuge und zusätzlichen Stau
- Auslastung in Prozent, Anzeige der durchschnittlichen Suchdauer
- Straßenrandparken als Option, das eine Spur schmälert

## Analyse und Werkzeuge

- Heatmap-Ebenen: Auslastung, Durchschnittstempo, Wartezeit, Unfallschwerpunkte, Lärm, Abgase
- Kreuzungs-Inspektor: Durchsatz, maximale Rückstaulänge, Wartezeit je Zufahrt, Auslastungsgrad
- Fahrzeug-Kamera: einzelnem Agenten folgen und seine Route, sein Ziel und seine Wartezeiten sehen
- Zeitverlauf-Diagramme für Durchsatz und Durchschnittstempo, Vergleich vor/nach einem Umbau
- Engpass-Assistent listet die drei schlimmsten Staupunkte mit Ursache
- Simulationsvorschau: geplanten Umbau testen, ohne ihn sofort zu bezahlen

## Spielmodi und Fortschritt

- Sandkasten: freie Karte, Verkehr läuft automatisch, unbegrenztes Budget optional
- Kampagne mit Szenarien steigender Schwierigkeit: Kreuzung entschärfen, Autobahnanschluss bauen, Ortsdurchfahrt entlasten, Pendlerspitze bewältigen
- Bewertung pro Szenario mit Sternen nach Durchsatz, Durchschnittstempo, Wartezeit, Budget und Zufriedenheit
- Budget und laufende Unterhaltskosten pro Straßenkilometer und Ampel
- Zufriedenheitswert der Verkehrsteilnehmer als Gesamtnote
- Zufallsereignisse im laufenden Spiel: Großbaustelle, Veranstaltung mit Zusatzverkehr, Schulschluss
- Tägliche Zufallskarte als Herausforderung mit Bestenliste im Browser
- Karten-Editor-Grundlagen: Gelände, Wasser, Hügel, vorhandene Bebauung als Hindernis
- Speicherstände lokal, Export und Import als Datei

## Optik

Satellitenbildartige Draufsicht statt Cartoon. Erdige Palette: Sandtöne, trockenes Gras, gedecktes Grün. Scharfe Vektor-Markierungen für Fahrbahn, Zebrastreifen, Schilder. Weiche Schatten unter Bäumen und Fahrzeugen. Tag- und Nachtwechsel mit Scheinwerfern und Ampellicht. Werkzeugleiste unten mit Reitern: Straßen, Kreuzungen, Beschilderung, Parken, Analyse, Ansicht; Kontextleiste je Werkzeug; Inspektor-Panel rechts.

## Technische Umsetzung

Unity/Godot sind hier nicht baubar – die Simulation läuft als HTML-Canvas-Spiel (React + TypeScript), das die gleiche Architektur nachbildet.

- Rendering: eigener Canvas-2D-Renderer mit Kamera (Pan/Zoom), Layern (Gelände, Straßen, Markierungen, Schatten, Fahrzeuge, Schilder, Overlay), Offscreen-Cache für statische Straßen, Kachel-Culling
- Datenmodell: Netz als gerichteter Spur-Graph. Kante speichert Spuren, Richtung, Tempolimit, Höhenprofil, Geometrie (Polyline aus Bezier/Bogen-Sampling), Verbindungsmatrix am Knoten
- Kurven: Catmull-Rom für Freihand, Winkel-Snap für Gerade, parametrischer Kreisbogen, Mindestradius je Typ
- Simulation: fester Tick (30 Hz) entkoppelt vom Rendering, Zeitraffer über Mehrfach-Ticks; Fahrzeuge in Object-Pools und typisierten Arrays für über tausend Agenten; Spatial-Hash für Nachbarsuche
- Verhalten: IDM (Folgefahren) + MOBIL (Spurwechsel) + Reißverschluss- und Kreuzungs-Reservierungslogik
- Routing: A* über den Spur-Graph mit Zeitkosten, Routen-Cache, hierarchische Vorberechnung für große Netze, inkrementelle Invalidierung bei Umbauten, Neuberechnung in Zeitscheiben über mehrere Ticks
- Kreuzungen: State Machine pro Knoten (Phasen, Sensoren, Vorfahrt, Kreisverkehr-Einfädeln), Konfliktpunkt-Matrix
- Nachfrage: Quelle-Ziel-Matrix mit Tageskurve, Spawner an Kartenrändern und Parkflächen
- Undo/Redo als Command-Stack auf Graph-Operationen
- Statistik-Ringpuffer je Kante und Knoten für Heatmaps und Diagramme
- Speichern: Netz und Zustand als JSON im Browser-Speicher, Export/Import als Datei, Versionsfeld für Kompatibilität
- Struktur: `src/game/` (graph, geometry, sim, routing, intersections, demand, stats, render), `src/components/game/` (Toolbar, Kontextleisten, Ampel-Editor, Inspektor, Diagramme), Spielseite auf `/`
- Performance-Ziel: 60 FPS Darstellung bei 1000+ aktiven Fahrzeugen auf Mittelklasse-Hardware

## Reihenfolge der Umsetzung

1. Canvas, Kamera, Gelände, Spur-Graph, Straßenzeichnen (Freihand, Gerade, Bogen) mit Snapping, Vorschau, Kosten
2. Kreuzungsgenerierung, Spurverbindungs-Editor, Upgrade/Radiergummi, Undo/Redo
3. Fahrzeugagenten, A*-Routing, IDM-Folgeverhalten, MOBIL-Spurwechsel, Fahrzeugtypen
4. Ampel-Editor mit Phasen, verkehrsabhängige Schaltung, Grüne Welle, Kreisverkehr, Vorfahrt, Zebrastreifen, Fußgänger
5. Beschilderung, benannte Ziele, Wegweiser-Routing
6. Parkflächen, Parkhaus, Ein-/Ausparken, Parksuchverkehr
7. Höhen: Brücken, Tunnel, Rampen, Autobahnanschlüsse
8. Nachfrage-Matrix mit Tagesverlauf, Zeitraffer, Zwischenfälle, Wetter
9. Analyse: Heatmaps, Inspektoren, Diagramme, Engpass-Assistent, Fahrzeug-Kamera
10. Kampagne, Bewertung, Budget, Zufallsereignisse, Tageskarte, Speichern/Laden
11. Visueller Feinschliff: Tag/Nacht, Schatten, Markierungen, Performance-Tuning

Der Umfang ist sehr groß. Ich baue in dieser Reihenfolge und liefere nach jedem Schritt etwas Spielbares, statt am Ende alles auf einmal.
