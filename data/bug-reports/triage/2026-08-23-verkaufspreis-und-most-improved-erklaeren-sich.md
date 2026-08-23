# Verkaufspreis und „Most Improved" erklären sich jetzt selbst (Punkte 5 und 8)

**Gewünscht** 23.08.2026 von Chris: *„hast du noch vorschläge wo wir noch hovers gebrauchen könnten
… ich finde die sind eine sehr charmante lösung"* — und auf die Vorschlagsliste:
**„5-8 finde ich auch stark die kannst du dann im anschluss machen."**

**Status: 5 und 8 gebaut. 6 und 7 stehen noch aus** — sie brauchen echte Vorarbeit, siehe unten.

## Beide hatten dieselbe Ursache

Die Herleitung **existierte**, wurde beim Bau der Anzeigezeile aber nicht mitgereicht. Im Spiel
stand deshalb eine Zahl ohne Geschichte.

**Punkt 5 — Verkaufspreis.** `buildTransfermarktSaleFactorBreakdown` liefert Bracket, Rang darin,
Grundfaktor und Rangbonus. `transfermarkt-expected-sell-value.ts` rechnete das, benutzte den Preis
und warf den Rest weg. Der Hover zeigt jetzt:

```
Verkaufspreis — Malagor
  Saison-Marktwert                          71,04
  Grundfaktor        Bracket 9               0,94
  Rangbonus          Platz 1 von 12          +0,06
  = Verkaufsfaktor                            1,00
  ─────────────────────────────────────────────
  Preis                                     71,02
```

**Wichtig:** gezeigt wird die **bereinigte** Fassung (nach `applySellPricingPolicyToBreakdown`),
nicht die rohe. Die Ausführung nimmt die bereinigte; ein Hover auf der rohen verspräche Geld, das
nie ankommt — bei Ticket #44 lagen die beiden 31,78 gegen 37,39 auseinander. Ein Test hält das fest.

**Punkt 8 — „Most Improved".** Deine Meldung `pxoa72`: *„Wir brauchen noch eine erklärung wie Most
Improved Player sich zusammensetzt!"* Die alte Quittung hielt fest, warum nichts gebaut wurde: das
Award-System sei ein eigenes Vorhaben, und die Erklärung hänge daran, dass die Formel erst
festgeschrieben werde.

**Die Formel ist längst festgeschrieben** — in `most-improved-service.ts`, samt Begründung, warum
sie den Leistungs-**Trend** misst und nicht den Attribut-Zuwachs: der Award fällt in
`season_rewards`, die Entwicklung läuft erst in `player_development`. Zum Zeitpunkt der Ehrung hat
noch niemand etwas dazugewonnen (am Save nachgemessen: 0 von 2984 Spielern). Gerechnet wurde die
Herleitung immer; sie wurde nur auf dem Weg in die Ansicht weggeworfen — an **drei** Stellen
hintereinander. Jetzt:

```
So kommt die Zahl zustande — Wren
  Feldposition 1. Saisonhälfte   5 Auftritte    25,0
  Feldposition 2. Saisonhälfte   5 Auftritte    77,0
  ────────────────────────────────────────────────
  Veränderung                                  +52,0
```

Das **Award-System mit Icons im Spielerprofil**, das du im selben Atemzug wolltest, bleibt ein
eigenes Vorhaben. Die Erklärung, um die du ausdrücklich gebeten hast, steht.

## Was ich bewusst zurückgenommen habe

Eine erste Fassung hängte den Verkaufsfaktor auch an den **Verkaufsdialog**
(`ai-transfermarkt-sell-preview-service.ts`). Dort wird er heute von niemandem gelesen — das wäre
totes Feld gewesen. Zurückgenommen; die Spalte hängt an einer anderen Stelle.

## 6 und 7 stehen aus, und warum

**6 (Marktwert eines Spielers):** `player-economy-compare-service.ts` ist ein *Vergleichs*-Report
(Legacy gegen berechnet), keine Zerlegung des Marktwerts. Die Bestandteile müssten erst gefunden
oder benannt werden.

**7 (Team-Power in der Aufstellung):** `team-powers.ts` behandelt die Power-**Karten**, nicht die
aggregierte Teamstärke. Die Beiträge je Spieler liegen in der Aufstellungs-/Score-Engine; welche
Größe der Hover zeigen soll, ist eine eigene Frage.

Beide sind machbar, aber keins von beidem ist „das Vorhandene anzeigen" — deshalb getrennt, statt
sie hier halb mitzunehmen.

## Geprüft

`tests/herleitungen-werden-nicht-mehr-weggeworfen.test.ts`, 8 Fälle. **Gegenprobe:** ohne die
Durchreichung in der Kategorie-Zwischenstufe fällt der Fall „fällt in der Kategorie-Zwischenstufe
nicht heraus".

`tsc` leer · `ci:import-exists` (2318) · `ci:client-bundle-lint` · `ci:flow-smoke` (205) ·
Quelltext-Wächter (1938) · Render-Wächter (217).

changelog: 2026-08-23-verkaufspreis-und-most-improved-erklaeren-sich.json
