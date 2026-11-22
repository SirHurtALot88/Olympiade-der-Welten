# KI-Nebel: die KI bewertet nach ihrem Wissensstand (21.11.)

Chris, 21.11., wörtlich: „bei KI -> Option A! das wäre das Ziel oder es müsste zumindest leicht verschleiert sein, weil es soll ja das Draften nicht kaputt machen, aber vllt werden die Werte dann etwas schwammig“.

Ausgangsbefund (`docs/design/ki-merkliste-21-11.md`, Runde 2): `toOrganicPlayerView` las die wahren `disciplineRatings` und das versteckte Potenzial jedes Kandidaten, unabhängig vom Scouting. Der Mensch sieht nur den Nebel.

## Ansatz

Code: `lib/ai/ki-nebel.ts`, eingehängt in `buildOrganicDraftFrame` (`lib/ai/organic-squad/draft-adapter.ts`). Dieser Rahmen ist der einzige Weg, auf dem Kandidaten bewertet werden: Draft (`liga-draft-ki`), Käufe (`ai-market-plan-apply-service`) und KI-Merkliste (`ki-merkliste.ts`) laufen alle durch ihn.

- **Wissensstufe** = `getEffectiveScoutingLevel` des Menschen (Scouting-Büro des Teams + Sicherheit aus `scoutIntelByTeamId` bzw. automatischem Potenzial-Aufdecken, Stufe 0 bis 5), nur mit je Plan einmal gebauten Nachschlagetabellen statt je Kandidat durchsucht. Eigener Kader und Stufe 5 sind exakt. Schaltet der Spielstand den Fog of War aus (`scenarioMeta.scoutingNebelAus`), ist alles exakt.
- **Unschärfe statt Bereichsmitte:** Sicht = wahr + (gemeinsame Verzerrung des Spielers + Rauschen je Disziplin) x Stärke. Hash über (Saison, Team, Spieler, Attribut), kein `Math.random`; dieselbe Saison liefert dieselbe Sicht, eine neue Saison eine neue. Amplituden je Stufe wie die Marktanzeige (`getSharedBiasAmplitude` 3,5 / 2,5 / 1,75 / 1 / 0,5 / 0 und `getDisciplineNoiseAmplitude` 8 / 6 / 4,5 / 3 / 1,5 / 0): unbekannt größer als beobachtet.
- **Klemme auf den Bereich der Stufe:** das Ergebnis wird auf den Bereich geklemmt, der den wahren Wert enthält und so breit ist wie beim Menschen (10er unbekannt, 5er Stufe 1 bis 4). Die KI weiß also nie genauer als „Bereich“. Das Potenzial wird auf wahr ± `getScoutingUncertainty(Stufe)` geklemmt (16 / 10 / 8 / 6 / 4 / 3), die Spanne, die der Mensch sieht.
- **Bewusst exakt:** die vier Achsen-Summen POW/SPE/MEN/SOC (der Mensch sieht sie seit 21.11. als Zahl), Marktwert und Gehalt.
- **Abweichung vom Menschen, ehrlich:** der Mensch sieht den Bereich seiner eigenen, zusätzlich zur Mitte gestauchten Schätzung (`buildScoutedDisciplineTiers`, Genauigkeitsfaktor 0,42 bis 0,88). Dieselbe Klemme für die KI hätte alle Kandidaten zur Mitte gezogen; die KI klemmt deshalb auf den Bereich um den wahren Wert. Bereichsbreite und Stufe sind dieselben, die Lage ist näher an der Wahrheit.
- **Schalter:** `OLY_KI_NEBEL=0` = bisheriges Verhalten bit-identisch (wahre Werte, getestet). `OLY_KI_NEBEL_STAERKE=<Zahl>` = Vielfaches der Amplituden (Standard `KI_NEBEL_STAERKE_STANDARD` = 1, 0 = aus).
- **Nicht angefasst:** Wertung/Arena, Intel-Bonus im Kauf-Ranking (`ai-market-plan-apply-service.ts`), Aufstellung eigener Spieler (eigene sind bekannt).

## Gewählte Stärke: 1 (Amplituden wie die Marktanzeige)

Begründung: 1 ist dieselbe „Schwammigkeit“, die ein Mensch bei gleicher Stufe sieht, und lässt die Kaderstärke unangetastet. Stärke 3 (dreifaches Rauschen, durch die Bereichsklemme begrenzt) ändert die Kaderstärke ebenfalls nicht messbar, hat also keinen Vorteil; 1 ist der erklärbare Wert.

## Messung

`scripts/miss-ki-nebel.ts <Saat>`: neuer Liga-Draft aus Saison-1-Start, 32 KI-Teams (kein Mensch), Wegwerf-SQLite, Draft-Saat gleich je Saat A bzw. B. Kaderstärke = je Disziplin Mittel der besten 6 des Kaders (wahre Werte), dann Mittel über 20 Disziplinen; Fehlkauf = bewertetes Top-5-Disziplinmittel mindestens 5 über dem wahren.

| Größe | A: aus | A: Stärke 1 | A: Stärke 3 | B: aus | B: Stärke 1 | B: Stärke 3 |
|---|---:|---:|---:|---:|---:|---:|
| Picks | 388 | 388 | 388 | 383 | 383 | 383 |
| Kaderstärke Ø (beste 6) | 45,456 | 45,545 | 45,493 | 45,269 | 45,688 | 45,479 |
| schwächstes Team | 37,29 | 37,62 | 37,79 | 37,34 | 38,78 | 37,88 |
| Kader min / Ø / max | 9 / 12,16 / 14 | 9 / 12,16 / 14 | 9 / 12,16 / 14 | 9 / 12,00 / 14 | 9 / 12,00 / 14 | 9 / 12,00 / 14 |
| Teams unter Pflichtkader 8 | 0 | 0 | 0 | 0 | 0 | 0 |
| Diszis mit solidem Spieler, Ø (min) | 10,25 (2) | 10,09 (0) | 10,25 (0) | 10,50 (3) | 10,59 (2) | 10,72 (1) |
| Fehlkäufe (>= 5 über wahr) | 0 | 1 von 388 | - | 0 | 2 von 383 | - |
| mittlere Überbewertung des Gepickten | 0,51 | 0,72 | 1,25 | 0,47 | 0,74 | 1,21 |
| Laufzeit je Pick Ø (Einzelschritt, 1 Pick je Aufruf) | 454-517 ms | 477-524 ms | - | 510 ms | 478-530 ms | - |

Befund:
- **Kaderstärke unverändert** (Stärke 1: +0,2 % bzw. +0,9 % gegenüber heute, also kein Verlust; Stärke 3: +0,1 % bzw. +0,5 %). Die Kaufbewertung hängt stark an Achsen-Summen, Marktwert und Kasse, die exakt bleiben; die Disziplinwerte entscheiden nur die Passung. Der Nebel kostet das Draften deshalb nichts, die Picks ändern sich aber (die Teamverteilung unterscheidet sich je Lauf).
- **Keine Kaderlücken:** kein Team unter dem Pflichtkader, Kadergrößen identisch (9 bis 14); der Draft läuft in allen Läufen vollständig durch.
- **Disziplin-Abdeckung** (Disziplinen mit mindestens einem Spieler über `SOLIDE_THRESHOLD`) schwankt je Team stark, auch ohne Nebel (min 2 bzw. 3); mit Nebel liegt das schwächste Team bei 0 bzw. 2, der Durchschnitt unverändert (10,1 bis 10,7 gegen 10,3 bis 10,5). Das ist ein Maß für die Streuung der Teams, kein Zeichen einer Lücke: das Team mit 0 hat Kaderstärke 37,6, den Ligaschnitt der schwächsten.
- **Fehlkäufe:** die Bereichsklemme begrenzt die Überbewertung je Spieler auf unter 10; gemessen sind es 0,3 bis 0,5 % der Picks mit 5 oder mehr, im Mittel überbewertet die KI ihre Picks um 0,7 Punkte (Auswahlverzerrung: sie nimmt, was ihr zu gut erscheint).
- **Laufzeit:** „Vor zu meinem Pick“ (`scripts/miss-draft-ki-tempo.ts --vor --nur-folge`, 31 KI-Picks, Mittel aus mehreren Läufen): aus 1,3 bis 1,6 s, mit Nebel 1,6 bis 1,7 s, also unter der 2-s-Grenze. Ohne Zwischenspeicher lag der Nebel bei 1,8 s (+0,45 s); die Sicht wird deshalb je Disziplin-Objekt des Spielers, Saison, Team, Stufe und Stärke gemerkt (geprüft über eine Summe der wahren Werte). Einzelschritt-Draft: kein Unterschied (Ø 477 gegen 454 bis 517 ms je Pick).
- **Fit-Quote:** nicht eigens gemessen; die Theme-Passung (`computeThemeFit`) hängt nicht an den verdeckten Werten und ist unverändert.

Die KI scoutet über Merkliste und Scouting-Plätze (Runde 2 der KI-Merkliste); gescoutete Spieler steigen in der Stufe (Sicherheit 100 bei Büro 0 = Stufe 4, Rauschen 1,5 / 0,5, Bereich 5er), mit Büro-Ausbau bis exakt. Der Test „weiß mit Scouting mehr“ belegt die kleinere Abweichung.

## Tests

`tests/ki-nebel.test.ts`: deterministisch; Rauschwert immer im Bereich des Menschen (10er/5er, Potenzial in der Spanne); neue Saison = andere Sicht; eigene Spieler exakt, gescoutete näher an der Wahrheit; Schalter und Fog-of-War-Einstellung aus = keine Sicht; ohne Sicht bit-identisch wie bisher und mit Sicht ändern sich nur Disziplinwerte und Potenzial; Stärke skaliert. Dazu laufen alle Tests zu `ai-`, `draft`, `organic`, `market`, `transfer`, `scout`, `merkliste` und `economy-cashflow-invariant` unverändert grün (1602 Tests); Wertungs-Fingerabdruck `GESAMT eaafed96150e` unverändert.
