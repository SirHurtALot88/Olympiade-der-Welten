# Kartenschmiede

Karten-Generator für Age of Fantasy Quest: Artwork hochladen, Werte eintragen, Karte erzeugen.
Läuft in der App unter **`/kartenschmiede`** (hinter demselben Login wie das Spiel).

| Datei | Inhalt |
|---|---|
| `seite.html` | Aufbau und Aussehen der Seite, sechs Seltenheitsrahmen |
| `regeln.js` | Seltenheiten, Schmiede-Formel (Punkte) und Duell-Simulator, ohne DOM, getestet in `tests/kartenschmiede.test.ts` |
| `katalog.js` | Tags, Fraktionen und Grundbestand der Datenbank (Fähigkeiten, Zauber, Gegenstände, Waffen); eigene Einträge liegen auf dem Server |
| `generator.js` | Würfelt Waffen, Gegenstände, Fähigkeiten und Zauber passend zur Seltenheit, bepreist nach der Formel |
| `datenbank.js` | Reiter „Datenbank“: Suche, Typ- und Tag-Filter, Generator, eigene Einträge |
| `app.js` | Reiter „Karten“: Werkstatt, Baukasten, Fähigkeiten-Datenbank, Simulator, Speichern, Karte als Text |
| `gruppe.js` | Reiter „Gruppe“: Helden-Lineups mit Budget, Fähigkeiten je Mitglied, Wellengröße, Druck |
| `szenarien.js` | Reiter „Szenarien“: Kampagne Moosgrab (Map 1–5 mit Tischskizze, Spielleiter-Blatt, Folgen), Zusatzmissionen aus Schauplatz × Ziel × Komplikation mit Alarmstufe, Gelände nach OPR, Tische bis 120 × 80 cm. Ohne DOM, getestet |
| `szenarien-ui.js` | Oberfläche dazu: Spieler- und Spielleiter-Ansicht (ohne Spoiler), Tischkarte als SVG, Wellenpunkte aus einer Gruppe, A4-Druckbogen, Speichern unter `kartenschmiede/szenarien/` |
| `spiel-motor.js` | Motor des Reiters „Spielen“: spielt eine Map als Schrittgraph ab (Bedingungen, Flags, Leisten, Runden, Ereignisse, Antwortwahl, Gegner mit verdeckten Zustandsstufen, Rückgängig). Ohne DOM, getestet |
| `spiel.js` | Reiter „Spielen“: Spielleiter-Schirm mit Schrittkarte, Vorlesetexten, NPC-Fenster, Audio-Cues (Upload unter `kartenschmiede/audio/`), Gegnerspalte mit +1/+2 und Spielstand unter `kartenschmiede/spielstaende/`. Tasten: Leertaste weiter, Backspace zurück, 1–4 Antwort, R Runde, A Cue, Tab/+/− Gegner |
| `kampagnen/<kampagne>/mapN.json` | Spieldaten je Map für den Reiter „Spielen“ (Moosgrab Map 1 und 2). Felder neben Schritten und Ereignissen: `probe` (Stufen ab 3/5 nach dem Wurf), Leisten-`schwellen`, Gegner-`tod`/`zusatz`/`info`, `lage` (Ziele, Flucht, Sonderregeln), `rundenwurf`, `tischplan`; Entfernungen in Kartenbreiten und Kartenlängen statt Zoll. Neue Maps in `lib/kartenschmiede/seite.ts` unter `SPIELMODUS_MAPS` eintragen. Konzept: `docs/design/moosgrab-spielmodus-konzept.md` |
| `charaktere.js` | Tabelle „Fertige Charaktere“ unter dem Erstellen: Vorlagen und gespeicherte Karten, sortier- und filterbar |
| `assets/`, `fonts/` | Beispielbilder aus Chris' Einheiten-Tabelle, Schriften (SIL OFL, über Fontsource) |
| `vendor/html-to-image.js` | PNG-Export (MIT, Version 1.11.11) |
| `comfyui/` | Workflows und Skript, um aus einem Mini-Foto lokal ein Artwork zu machen |

`lib/kartenschmiede/seite.ts` setzt alles zu einer HTML-Seite zusammen. Gespeicherte Karten liegen als JSON
in `kartenschmiede/` neben der SQLite, auf Hetzner also im Volume `oly-data`.

Eigenständige Datei ohne Server: `npx tsx scripts/kartenschmiede-eigenstaendig.ts kartenschmiede.html`
