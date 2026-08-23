# Marktwert-Herleitung (Punkt 6) — und Team-Power bleibt nachweislich aus der Wertung

**Gewünscht** 23.08.2026 von Chris: *„6+8 auch noch umsetzen, 7 hatten wir ja bewusst raus genommen
und eigentlich gibts aktuell keine team power die darf auch nicht im scoring vorkommen."*

**Punkt 8 war schon drin** (#648, Most-Improved-Herleitung mit den zwei Saisonhälften) — hier steht
deshalb 6, plus die Nachprüfung zur Team-Power.

**Status: gebaut.**

## Punkt 6 — woraus sich der Marktwert zusammensetzt

**Ich hatte im ursprünglichen Vorschlag behauptet, `player-economy-compare-service.ts` „habe die
Bestandteile schon". Das war falsch** — das ist ein Vergleichs-Report (Legacy gegen berechnet),
keine Zerlegung. Die echte Zerlegung liegt woanders:

`calculateMarketValueFromRankTable` (`lib/player-formulas/market-value-engine.ts:170`) rankt jeden
Spieler in **jeder** Disziplin gegen die ganze Liga, schlägt den Rang in
`references/formulas/rank-to-discipline-market-value.json` nach und summiert. Die Funktion liefert
`disciplineRanks` und `disciplineMarketValues` je Spieler zurück —
`computeLeagueMarketValueMapFromPlayers` (`league-market-value-snapshot.ts:57`) behält davon nur
`marketValueNew` und wirft den Rest weg. **Dasselbe Muster wie bei den Punkten 5 und 8: die
Herleitung wird gerechnet und auf dem Weg zur Anzeigezeile verworfen.**

### Am Live-Abbild nachgemessen, bevor gebaut wurde

`scripts/messe-marktwert-zerlegung.ts`, über **alle sieben Spielstände und je 2984 Spieler**:

```
Liga 2984 · ohne Zerlegung 0 · ohne gezeigten MW 0 · Abweichungen > 0,05: 0 (groesste 0.0100)
```

Die Summe der Rangbeiträge trifft den im Spiel gezeigten Marktwert (`resolvePlayerEconomyContract`)
auf **höchstens 0,01** genau. Der Hover erklärt also die Zahl, die danebensteht — keine zweite,
ähnliche.

Beispiel (Tidesprinter, `swnjlk`): 20 Disziplinen tragen bei, die stärksten fünf sind spurt (Rang
33, 5,52), fechten (33, 5,52), climbing (34, 5,49), time-trial (108, 4,23), hockey (249, 3,18) —
Rest 15 Disziplinen mit 26,46, Summe 44,40.

### Warum die Ableitung auf dem Server läuft

Die Rangtabelle ist **222 KB** und liegt heute in keinem Client-Bundle. Für einen Tooltip
hineinzuziehen wäre ein schlechter Tausch; eine gekürzte Fassung wäre schlimmer, weil sie eine
zweite, leicht andere Zahl ergäbe — genau das ist beim Verkaufswert schon einmal als schlechtere
Lösung verworfen worden (*„Eine zweite, leicht andere Zahl ist schlechter als eine offensichtlich
gleiche"*). Die Zerlegung kommt deshalb fertig aus dem Player-Directory-Slice, denselben Weg wie
`sellValueByPlayerId`.

**Nur Kaderspieler**, aus Größengründen gemessen: über alle 2984 Spieler wären es **1163 KB**, über
die 328 Kaderspieler **128 KB**. Für nicht gescoutete Spieler fällt der Eintrag weg (der Rang ist
Disziplinstärke und damit fog-gated), im Saison-Archiv ebenfalls (Projektions-Pfad ohne `players`).
In allen drei Fällen bleibt der Hover einfach aus.

### Die Zahlen gehen auf

Die Tabelle führt drei Nachkommastellen (5,245), gezeigt werden zwei. Die Sammelzeile trägt deshalb
**nicht** die roh aufaddierte Restsumme, sondern `Summe minus die gerundeten gezeigten Zeilen` —
nur so ergeben die sichtbaren Zahlen zusammen exakt die Summe darunter.

## Team-Power — nachgeprüft, und der Riegel saß an der falschen Stelle

**Deine Ansage stimmt: `TEAM_POWERS_ENABLED = false`** (`lib/lineups/team-powers.ts:635`), mit
dokumentiertem Kill-Pfad. `tests/team-powers-disabled.test.ts` hält das fest.

**Am Live-Abbild gemessen** (`scripts/messe-team-power-im-scoring.ts`): über alle sieben
Spielstände und 224 Teams werden **0 Power-Optionen** angeboten. Es liegen allerdings **2131
gespeicherte `teamPowers`** in den Spielständen, und in `n90y4m` tragen **13 Aufstellungs-Entwürfe**
weiter eine `teamPowerId`. Wirkungslos — aber vorhanden.

**Der Befund:** der bestehende Riegel prüft das *Modul*, nicht die *Wertung*. Die Wertung rechnet in
`lib/lineups/legacy-score-engine.ts:438`:

```ts
const totalScore = roundPreviewScore(prePowerScore + (teamPowerModifier ?? 0));
```

`teamPowerModifier` ist dort ein **Eingabewert**. Die Engine fragt den Schalter nicht; sie addiert,
was der Aufrufer ihr reicht. Kein Test lief bisher über die Kette und hielt fest, dass am Ende
nichts ankommt.

`tests/team-power-bleibt-aus-dem-scoring.test.ts` schließt das: Powers im Spielstand, `teamPowerId`
im Entwurf, Quelle ausdrücklich auf `"ready"` — und der Endscore ist derselbe wie ohne Powers.

**Nichts an der Mechanik geändert.** Der Schalter stand schon richtig; dazugekommen ist nur der
Nachweis, dass er auch dort greift, wo gerechnet wird.

## Geprüft

`tests/marktwert-herleitung.test.ts` (9 Fälle), `tests/marktwert-hover-kommt-vom-server.test.ts`
(6), `tests/team-power-bleibt-aus-dem-scoring.test.ts` (5).

**Drei Gegenproben, und die erste ist die lehrreichste:**

1. *Aufgeh-Eigenschaft.* Erste Fassung des Fixtures nahm eine gleichmäßige Reihe — dort heben sich
   die Rundungsfehler zufällig exakt auf, und die Gegenprobe blieb **grün**, auch mit der naiven
   Restsumme. Der Test hätte nichts bewacht. Mit Werten, die alle in dieselbe Richtung runden,
   fällt er jetzt echt: sichtbar 34,97 statt 34,96.
2. *Team-Power.* Erste Fassung ließ `disciplineId`/`disciplineSide` an den Einträgen weg; die
   Engine filterte alles heraus und lieferte `entries: []` und Score 0. Alle Nullen waren grün und
   belegten nichts. Ein eigener Fall hält jetzt fest, dass das Fixture überhaupt etwas wertet.
3. *Kette.* `herleitung: row.marketValueBreakdown` auf `null` gesetzt → der Kettenwächter fällt.

`tsc` leer · `ci:import-exists` (2341) · `ci:client-bundle-lint` (die 222-KB-Tabelle bleibt draußen)
· `ci:flow-smoke` (205) · Quelltext-Wächter (1998) · Render-Wächter (217) · `ci:quittungen` ok.

changelog: 2026-08-23-marktwert-erklaert-sich-selbst.json
