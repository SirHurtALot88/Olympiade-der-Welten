# Kartenschmiede

Karten-Generator für Age of Fantasy Quest: Artwork hochladen, Werte eintragen, Karte erzeugen.
Läuft in der App unter **`/kartenschmiede`** (hinter demselben Login wie das Spiel).

| Datei | Inhalt |
|---|---|
| `seite.html` | Aufbau und Aussehen der Seite, sechs Seltenheitsrahmen |
| `regeln.js` | Seltenheiten, Schmiede-Formel (Punkte) und Duell-Simulator, ohne DOM, getestet in `tests/kartenschmiede.test.ts` |
| `app.js` | Oberfläche: Werkstatt, Baukasten, Simulator, Speichern |
| `assets/`, `fonts/` | Beispielbilder aus Chris' Einheiten-Tabelle, Schriften (SIL OFL, über Fontsource) |
| `vendor/html-to-image.js` | PNG-Export (MIT, Version 1.11.11) |
| `comfyui/` | Workflows und Skript, um aus einem Mini-Foto lokal ein Artwork zu machen |

`lib/kartenschmiede/seite.ts` setzt alles zu einer HTML-Seite zusammen. Gespeicherte Karten liegen als JSON
in `kartenschmiede/` neben der SQLite, auf Hetzner also im Volume `oly-data`.

Eigenständige Datei ohne Server: `npx tsx scripts/kartenschmiede-eigenstaendig.ts kartenschmiede.html`
