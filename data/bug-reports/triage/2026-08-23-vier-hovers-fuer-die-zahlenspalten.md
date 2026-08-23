# Vier Hovers für die Zahlenspalten im Saisonstand

**Gewünscht** 23.08.2026 von Chris: *„hast du noch vorschläge wo wir noch hovers gebrauchen könnten
oder einbauen könnten ich finde die sind eine sehr charmante lösung mach mal vorschläge"* — und auf
die Vorschlagsliste: **„1-4 auf jeden fall direkt umsetzen"** (5–8 folgen danach).

**Status: gebaut.**

## Was dazukommt

| Spalte | Der Hover zeigt | Woher die Teile kommen |
|---|---|---|
| **Sponsoren** | Basis + Rangbonus + Saisonanteil = Gesamt | `sponsorBasis` / `sponsorRank` / `sponsorSeason` / `sponsorTotal` — lagen längst getrennt im Datensatz |
| **Transfers** | Verkäufe und Käufe getrennt, je mit Anzahl | `transferSellTotal` / `transferBuyTotal`, Zähler neu getrennt |
| **Gebäude** | jede gebaute Anlage mit Stufe und Unterhalt | `computeTeamBuildingUpkeepRows` — dieselben zwei Funktionen wie die Spaltensumme |
| **Cash** | die Bewegungen der Saison, „≈ Saisonende" | dieselben `guvPosten` wie die GuV-Spalte |

Alle vier zerlegen eine Zahl, deren **Teile bereits im Spielstand liegen**. Keiner rechnet etwas
Neues. Wo ein Teil fehlt, bleibt die Zeile leer, statt aus dem Rest eine Zahl zu erfinden — beim
Sponsor-Hover ist das ausdrücklich getestet: fehlt `sponsorTotal`, wird die Summe **nicht** aus den
Teilen gebildet, weil das eine andere Zahl wäre als die gespeicherte.

Der Transfer-Hover beantwortet nebenbei Chris' alte Beanstandung aus `ls9jfg` — *„so wären dann ein
paar Teams positiv und ein paar negativ. Hier sind alle 0 oder schlechter weil nur die Käufe drin
sind!"*. Die getrennten Summen lagen schon damals vor, sie waren nur nirgends zu sehen.

## Zwei Funde beim Bauen, beide ernster als die Hovers selbst

**1. Die drei Hovers aus #645 hätten im Spiel nie Daten gehabt.** `hoverKader` stand nur in
`use-season-v2-panel-model.ts` — und dieses Modell hängt am **nirgends gerenderten**
`FoundationSeasonV2Host`. Die wirklich gezeigte Tabelle baut ihre Zeilen in
`use-foundation-shell-router-body-scope.tsx`. Der Fehler wäre durch **jeden** Test gekommen: `tsc`
ist zufrieden (das Feld ist optional), die Ableitung ist einzeln geprüft, die Komponente rendert.
Nur im Spiel wäre der Hover leer geblieben. Genau davor warnt seit längerem der Kommentar an
`computeTeamBuildingCost`: *„waere die Rechnung dort privat geblieben, stuende sie zweimal im Code
und driftete auseinander."*

`tests/saisonstand-zeilen-beide-bauer-gleich.test.ts` hält jetzt fest, dass beide Bauer dieselben
ableitungstragenden Felder befüllen. Er liest den Quelltext — angemessen, weil das Problem **genau
eine Quelltext-Eigenschaft** ist: ein fehlender Zuweisungsausdruck in einer von zwei Dateien.

**2. Dieser Wächter wäre selbst nicht im Pflicht-Job gelaufen.** `fahre-quelltext-waechter.ts`
sammelt an der wörtlichen Signatur `readFileSync(join(process.cwd()` ein; meine erste Fassung legte
die Pfade in Konstanten und fiel lautlos aus der Auswahl. Aufrufe ausgeschrieben, Grund im
Kommentar. Auswahl 133 → 134 Dateien.

## Geprüft

`tests/saisonstand-hovers-zeigen-die-spieler.test.ts` wächst von 12 auf **20 Fälle** (Sponsor,
Transfers, Gebäude dazu). `tests/saisonstand-zeilen-beide-bauer-gleich.test.ts` mit 10 Fällen ist
neu. **Gegenprobe:** ohne die Zeile im gerenderten Bauer fällt der Zwei-Bauer-Wächter.

`tsc` leer · `ci:import-exists` (2320) · `ci:client-bundle-lint` · `ci:flow-smoke` (205) ·
Quelltext-Wächter (1940) · Render-Wächter (217) · Persistenz-Suiten (1375) · Akzent-Ratchet grün.

changelog: 2026-08-23-vier-hovers-fuer-die-zahlenspalten.json
