# Draft-Seite — Bau (18.11.)

Vorlage: `public/mockups/draft-modern-18-11.html`, Erklärung `docs/design/draft-modern-18-11.md` (Abschnitt 2). Code: `app/foundation/draft-modern/`.

## Bilder

Die Bilder zeigen die **echte Seite** im Produktions-Build (`npm run build`, `next start`), nicht das Mockup. Spielstand: eine Wegwerf-SQLite mit frischem Saison-1-Stand, Draft im Einzelschritt (`OLY_LIGA_DRAFT_MODUS=einzelschritt`), zwei Menschen (Chris, Franky), vorgefahrene KI-Picks. Kein echter Spielstand, kein Spielen lokal. Erzeugt mit `scripts/screenshot-draft-seite.ts` (`vorbereiten`, dann unter `flock /tmp/oly-aufnahme.lock` `aufnehmen`), 1920×1080 und 2560×1440, deviceScaleFactor 1.

| Bild | Zeigt |
|---|---|
| `01-ki-pickt-1920/2560`, `01b-pick-aufgedeckt-1920` | Live, Franky ist am Zug, der Draft wartet |
| `02-wartet-auf-franky-1920` | dasselbe, zweiter Stand |
| `03-du-bist-dran-1920/2560` | Chris am Zug: Vorschlag des GM, Brett, Mein Draft, Ticker |
| `04-nebel-aus-1920` | Scouting-Nebel aus |
| `05-pick-tafel-1920` | Pick-Tafel |
| `06-ueberspringen-1920` | Dialog Überspringen |
| `07-ki-pickt-fertig-1920` | nach Variante A: die KI pickt im Hintergrund fertig (Zwischenzustand vor dem Nachzug) |

Nicht aufgenommen: die Ergebnis-Ansicht und der eigentliche Nachzug. Der Prüfstand bringt die Teams nicht bis zum Mindestkader (`nicht_am_zug`), die Ergebnis-Ansicht erscheint deshalb nicht. Die Mockup-Bilder dazu liegen in `docs/design/draft-modern-18-11/`.

## Mockup vs. Bau

| Punkt | Mockup | Bau |
|---|---|---|
| Kopfleiste: Runde, Kette der 32 Wappen, Sitze, Tempo, Überspringen, „in n Picks“ | ja | drin |
| Am Zug mit Top 3 bzw. Vorschlag des GM, Grund-Tags, Fußzeile | ja | drin |
| Wartezustand („Franky wählt“) | ja | drin |
| Danach am Zug (sechs Picks, Top 3, Mensch-Zeilen) | ja | drin |
| Draft-Brett mit Filtern, Eignung-Leiste, „gefragt“, Blätter, „Alle Picks“ | ja | drin |
| Mein Draft: Spieler, Pick-Knopf, 14 Kaderplätze, Wunschliste, Auto-Pick | ja | drin |
| Live-Ticker | ja | drin |
| Pick-Tafel, Überspringen (A/B), Nachzug, Ergebnis | ja | drin (Ergebnis und Nachzug ohne Bild, s. o.) |
| Scouting-Nebel an/aus | ja | drin |
| Regieband-Kennzahlen | Runde, Pick, Transfertopf frei, Gehalt frei, Kader | angepasst: Runde, Picks, Kasse frei, Mein Kader — es gibt noch keinen Budget-Dienst |
| Zwei Budgets mit Gehaltsbalken | ja | fehlt: Hinweis „Gehaltsbudget folgt mit dem Budget-Dienst (Finanzen V2)“, Kasse und Pflichtreserve sind da |
| Taktgeber „Skittermind picken“ | Hauptaktion rechts oben | angepasst: führt über die Shell, im Prüfstand steht „Aktion läuft“, weil die Liga im Aufbau ist |
| Draft abbrechen (nur Gastgeber) | nicht im Mockup | ergänzt, im Regieband |
| Notkauf / Notfall-Hinweis | nicht im Mockup | entfernt: Ein Pick mit dem Grund `notkauf_mindestkader` erscheint als normaler KI-Pick (Chris: keine Notkäufe) |
| Drei Sitze (auch Ramona) | ja | Prüfstand nur mit zwei Menschen |

## Korrektur beim Bau

Die erste Aufnahme zeigte die Live-Ansicht einspaltig untereinander und den Knopf „Draft abbrechen“ ungestaltet. Es fehlten das Raster (`.dv`, `.lsp`, `#l-ich`, `#l-tick`) und die Knopf-Regel für das Regieband in `draft-modern.css`; beides ist nachgetragen, die Bilder oben sind danach entstanden.
