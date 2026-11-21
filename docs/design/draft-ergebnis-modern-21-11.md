# Draft-Ergebnisseite „Draft beendet“ (Fable, 21.11.)

Mockup: `draft-ergebnis-modern-21-11.html` (läuft per Doppelklick; `?ansicht=liga` zeigt die Liga-Übersicht, `?still=1`
blendet die graue Mockup-Leiste aus). Bilder: `draft-ergebnis-01-team-1920.png`, `-02-liga-1920.png`, `-03-team-2560.png`.
Ersetzt die Ansicht `Ergebnis` in `app/foundation/draft-modern/DraftAnsichten.tsx`. Nichts im Repo ist angefasst.

## Was sich ändert

| Bereich | Heute | Entwurf |
|---|---|---|
| Links „Mein Kader nach dem Draft“ | Pick, Name, Ablöse, Gehalt; Zeilenhöhe füllt das Panel | Je Spieler: Pick, Portrait klein, Name/Klasse/Rasse, **OVR**, **POW/SPE/MEN/SOC als Note + Zahl**, **Top-3-Disziplinen mit Eignung**, **Vertragslaufzeit**, Gehalt, Ablöse. Zeile 2,3 bis 3,3 rem, 8 bis 14 Spieler ohne Scrollen. Fußzeile mit Ø und Summen. |
| Links unten (neu) | leer | **Kaderprofil**: Ø der vier Achsen gegen den Liga-Schnitt, die drei schwächsten Disziplinen als Marktbedarf, auslaufende Verträge je Saison, Abdeckung aller 20 Disziplinen (Spieler ab Eignung 45). |
| Mitte „Kaderstärke“ | gefällt | **Unverändert** (drei Kacheln, Rangleiste, 20 Disziplinen mit Rang). Darunter als optionale Ergänzung „meine besten 6“ der angeklickten Disziplin; kann ersatzlos entfallen. |
| Rechts „Kasse nach dem Draft“ | Ablösen, Kasse, ein Verweis | Kasse mit Balken (Startbudget → Ablösen → Rest), **Gehaltssumme je Saison** gegen den Gehaltstopf, **Budget & Freigabe** als Rechenweg bis zum **Restbudget für den Markt**, **Pflicht-/Optionalplätze** (8 + 6 Kästchen), **Vergleich in der eigenen Liga** (Rang von 16 bei Kaderstärke, Gehalt, Ablösen, Kasse, Kadergröße). |
| Umschalter | fehlt | „Mein Team ↔ Liga-Übersicht“: die linke Spalte wird zur Tabelle aller Teams (Liga 2 / Liga 1 / alle 32) mit Picks, Stärke, Ø OVR, teuerstem Pick, Ablösen, Gehalt, Kasse. Mitte und rechts bleiben stehen. |

Neue Designsystem-Regel ist eingebaut: beide Tabellen sortieren per Klick auf den Spaltenkopf, zweiter Klick dreht
(Pfeil im Kopf, auch per Tastatur).

## Warum so

- Die Seite beantwortet nach dem Draft drei Fragen: Wen habe ich? Wie stark bin ich? Was kann ich mir noch leisten?
  Heute beantwortet nur die Mitte ihre Frage.
- Das Restbudget steht als eine grüne Zahl am Ende eines sichtbaren Rechenwegs. Der Knopf „Zum Transfermarkt“ trägt
  dieselbe Zahl, und links steht daneben, wofür man sie ausgeben sollte (schwächste Disziplinen).
- Die Zeilenhöhe hängt an der Kadergröße, nicht an der Panelhöhe. Der freie Platz geht an das Kaderprofil.

## Datenquellen im Code

| Anzeige | Quelle |
|---|---|
| Pick, Runde, Ablöse, Gehalt | `ansicht.verlauf` (wie heute) |
| OVR, vier Achsen, Eignungen, Notenstufen | eigener Kader im Spielstand (`gameState.players`: `rating`, `coreStats`, `disciplineRatings`); `k.meinKader` trägt die Eignungen schon. Für den eigenen Kader gilt kein Nebel. |
| Vertragslaufzeit | `contractEndSeasonNumber` am Spieler (`lib/data/olyDataTypes.ts`) |
| Kaderstärke, Rang je Disziplin | `k.raenge`, `ansicht.teams[].kaderStaerke` (unverändert) |
| Gehaltssumme, Kasse, Ablösen je Team | `ansicht.teams[]`: `gehaltSumme`, `kasse`, `abloeseSumme`, `kader` |
| Pflicht-/Optionalplätze | `ansicht.regeln.minKader` (8) und `maxPicksJeTeam` (14) |
| Rücklage, Gehaltspuffer, Freigabe, Transfertopf | `lib/finance/vorstand-budgetfreigabe.ts` (`berechneVorstandBudgetStand`), Formeln aus `finanzkonzept-v2-budgets-18-11.md` |
| Liga-Übersicht | `ansicht.teams[]` plus `ansicht.verlauf` (teuerster Pick je Team) |

Im Mockup echt: Spieler, Portraits, Marktwert, Gehalt, Achsen, Eignungen, Teams, Wappen, Startbudgets, die
Rücklageformel. Erfunden: Pick-Nummern, Vertragslaufzeiten, die Werte der anderen 31 Teams, Gehaltstopf 74 C,
Freigabe 85 %, 20 Spieltage.

## Bauaufwand (grob, Sonnet)

- Kadertabelle mit Sortierung und Fußzeile, Zeilenhöhe: 0,5 Tag.
- Kasse rechts: 0,5 Tag, wenn `berechneVorstandBudgetStand` die vier Werte schon liefert; sonst 1 Tag.
- Kaderprofil und Liga-Übersicht: 0,5 bis 1 Tag. Ø OVR und Achsen der anderen Teams brauchen ein kleines Zusatzfeld in
  `liga-draft-ansicht.ts`.
- Tests (`data-testid` bleiben: `draft-ergebnis`, `draft-ergebnis-raenge`, `draft-weiter`, `draft-profil-link`),
  Screenshots: 0,5 Tag.
- Zusammen 2 bis 3 Tage. Keine Wertung berührt, 0 PixelLab-Generationen.

## Offene Fragen an Chris

1. Liga-Vergleich rechts: Rang in der **eigenen Liga** (16), die Kaderstärke in der Mitte bleibt **unter 32**. Passt die
   Mischung, oder soll die Mitte auch auf die eigene Liga umstellen?
2. Liga-Übersicht: dürfen Gehalt und Kasse der anderen Teams offen stehen, oder gilt dort der Nebel?
3. Optionale „besten 6“ unter der Kaderstärke: behalten oder weg?
4. Restbudget: soll bei 0 C ein Hinweis stehen, was den Topf öffnet (Verkäufe, Rücklage anzapfen)?

## Entscheidung Chris (21.11.) — Freigabe „kannst du so bauen“

- Abgenommen, mit einer Änderung: in der Kadertabelle **keine Noten-Kästchen (S/A/B/C…) neben POW/SPE/MEN/SOC**, die absoluten Zahlen reichen.
- Kaderstärke in der Mitte zeigt den Rang **in der eigenen Liga** (wie rechts), nicht unter 32.
- Gehalt und Kasse der anderen Teams in der Liga-Übersicht: offen (kein Nebel).
- „Meine besten 6“ unter der Kaderstärke: **behalten**.
