# Formkarten, Sponsoren, Gebäude, Transfers und GuV bleiben im Saisonstand leer — Befund

**Gemeldet von Chris** (Saisonstand, mit Bild): „schau dir bitte an dass endlich formkarten,
sponsoren, gebäude, transfers und GuV korrekt im saisonstand ausgewiesen werden!"

Auf dem Bild stehen in allen fünf Spalten Striche, während RANG, PUNKTE, BONUS, die vier Achsen,
MW, CASH und GEHÄLTER gefüllt sind. Es ist also kein Ladeproblem — die Zeile kommt an, fünf ihrer
Felder sind leer.

## Gemessen

Am gemeldeten Spielstand (`new-game-1785823388048-1hf25q`, Saison 2, Spieltag 5, 32 Teams).
`buildTeamSeasonOverviewRows` gebaut und Feld für Feld ausgezählt:

| Feld | belegt | Beispielwert |
|---|---|---|
| `salaryTotal` | **32 / 32** | 97,67 |
| `marketValueTotal` | **32 / 32** | 333,82 |
| `cash` | **32 / 32** | 5,32 |
| `transfersSeasonValue` | **32 / 32** | −318,04 |
| `sponsorTotal` | **0 / 32** | `null` |
| `guv` | **0 / 32** | `null` |
| `financeForm` | **0 / 32** | `null` |
| `buildingCost` | — | im Zeilenbau gar nicht enthalten |

Dazu die Gebäude getrennt nachgezählt: **9 von 32 Teams** haben Unterhalt > 0, zusammen 7,60. Die
Zahlen existieren also auch dort.

Und im gespeicherten Stand (`seasonState.standings[teamId]`) stehen überhaupt nur acht Felder:
`points, rank, startplatz, rankDiff, cashFc, cashTotal, matchdayBaselinePoints, matchdayBaselineId`.
Sponsor, GuV, Transfers, Formkarten kommen dort nicht vor — die Ansicht liest also Felder, die der
Schreiber nie füllt.

## Zwei verschiedene Fehler

**A — drei Spalten haben gar keine Quelle.** `sponsorTotal`, `guv` und `financeForm` sind im
Zeilenbau `null`, für jedes Team. Sie können nichts anzeigen, egal wie die Anzeige aussieht.

Besonders deutlich in `app/api/season/standings-overview/route.ts`: dort steht in beiden
Zusammenbau-Blöcken wörtlich

```
form: null,
rosterCount: null,
salaryTotal: null,
marketValueTotal: null,
```

`form: null` ist hart verdrahtet (Zeile 465 und 491) — die Formkarten-Spalte war nie angeschlossen.

**B — zwei Spalten haben Daten, die nicht ankommen.** `transfersSeasonValue` ist für alle 32 Teams
gefüllt, und das Panel-Modell bildet sogar ausdrücklich darauf ab
(`transferNet: row.transferNet ?? row.transfersSeasonValue ?? null`,
`use-season-v2-panel-model.ts:142`) — trotzdem steht in der Spalte ein Strich. Dasselbe bei den
Gebäuden: `computeTeamBuildingCost` rechnet den Unterhalt im Panel-Modell selbst aus, und neun Teams
haben einen Wert.

Für B fehlt der letzte Beleg: welcher der vier möglichen Zeilen-Pfade im Browser wirklich läuft
(`hydrateTeamOverviewSliceRows`, `buildLightweightTeamSeasonStandRows` zweimal, oder
`buildTeamSeasonOverviewRows`, siehe `use-season-stand-rows.ts:209-240`). Die leichten Pfade führen
weniger Felder mit — läuft im Spiel einer davon, erklärt das die Striche trotz vorhandener Daten.
**Das ist der nächste Messschritt**, und er entscheidet, ob B eine Zeile Verdrahtung ist oder mehr.

## Warum hier kein Fix steht

A und B brauchen verschiedene Eingriffe, und A rührt an Geld: Sponsoreinnahmen und GuV müssten im
Zeilenbau tatsächlich berechnet werden. Für die GuV existiert bereits **eine** verbindliche Quelle
(`lib/finance/season-end-guv.ts`, im Route-Kommentar ausdrücklich als „DIE EINE GuV" bezeichnet) —
die gehört angeschlossen, nicht nachgebaut. Sonst steht im Saisonstand wieder eine andere Zahl als
im Finanzen-Reiter, und genau das war schon einmal ein Bugreport.

## Was dagegen spricht

Der Befund erklärt A vollständig und B nur zur Hälfte. Wer B ohne den fehlenden Messschritt
„repariert", verdrahtet womöglich einen Pfad, der im Spiel gar nicht läuft — und die Spalte bleibt
leer, obwohl der Code richtig aussieht. Erst messen, welcher Pfad greift.
