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
| `charaktere.js` | Tabelle „Fertige Charaktere“ unter dem Erstellen: Vorlagen und gespeicherte Karten, sortier- und filterbar |
| `assets/`, `fonts/` | Beispielbilder aus Chris' Einheiten-Tabelle, Schriften (SIL OFL, über Fontsource) |
| `vendor/html-to-image.js` | PNG-Export (MIT, Version 1.11.11) |
| `comfyui/` | Workflows und Skript, um aus einem Mini-Foto lokal ein Artwork zu machen |

`lib/kartenschmiede/seite.ts` setzt alles zu einer HTML-Seite zusammen. Gespeicherte Karten liegen als JSON
in `kartenschmiede/` neben der SQLite, auf Hetzner also im Volume `oly-data`.

Eigenständige Datei ohne Server: `npx tsx scripts/kartenschmiede-eigenstaendig.ts kartenschmiede.html`
