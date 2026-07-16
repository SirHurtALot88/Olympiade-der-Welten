# Multi-Season Long-Run — Timings (für Perf/UX-Review)

Quelle: resilienter Lauf `run-resilient-multiseason.ts --fresh --seasons 3` mit
`OLY_ORGANIC_SQUAD_BUILDER=1` (Save `fresh-season-1-1783852445087`, Ausgabe
`outputs/resilient-sellfix-*`). Zahlen aus den `[autoprep]`/`[slot-audit]`/`[season-end-xp]`-Markern
im `run.log` und den `long-run-season-N-autoprep-readiness.json`-mtimes (= Season-Matchday-Start).

## Headline

| | Dauer |
|---|---|
| **Voller Season-Cycle** (Matchdays + Season-End + nächste Preseason/Draft) | **~32–34 min** |
| S1-Start → S2-Start | 32.7 min |
| S2-Start → S3-Start | 34.0 min |
| Gesamt 3 Seasons (2 Übergänge) | ~72 min |

Per-Season 7 min wären das Ziel — real sind es ~32 min. **Der Löwenanteil ist NICHT instrumentiert.**

## Was instrumentiert ist (klein — zusammen ~45 s/Season)

| Phase | S1 | S2 | S3 |
|---|---|---|---|
| Autoprep „prep complete" (Lineups aller 10 MD + Formcards + Preflight) | 35.0 s | 40.7 s | 35.4 s |
| Matchday-Lineups total (Teilmenge von Autoprep) | 32.6 s | 38.1 s | 32.8 s |
| Slot-Audit (10 MD) | 6.7 s | 8.4 s | 7.8 s |
| Season-End-XP league recalc | 1.46 s | 1.46 s | 1.45 s |
| **S1-Draft** (nur S1, aus separatem Draft-only-Lauf) | preview **17.5 s** + execute **38.1 s** | – | – |

## Die Lücke: ~30 min/Season ohne Timing-Marker  ← hier liegt das Perf-Problem

Season-Cycle ~32 min − instrumentierte ~45 s = **~31 min pro Season völlig un-instrumentiert.**
Diese Phasen emittieren KEINE elapsed-Marker im Log (nur Count-Summaries):

1. **Match-Simulation** — das eigentliche Ausspielen der 10 Matchdays (Fixtures resolven, Ergebnisse,
   Standings-Apply). Kein Timing-Marker vorhanden.
2. **Preseason Draft/Konvergenz** (`[transfer-window] season-N preseason s1-draft-batch teams=32`) —
   Re-Draft/Rebuild aller Teams zwischen den Seasons. Nur Count (`picks:109`), keine Dauer.
3. **Season-End Transfer-Window (Sells)** (`[transfer-window] season-N summary engine unified=… repair=…`)
   — nur Engine-Counts, keine Dauer.
4. **Roster-Repair** — Summary zeigt **repair=23 (S1) / 22 (S2) / 20 (S3)** Teams, die Emergency-Roster-
   Repair durchlaufen. Das ist viel ( tied an den Kader-Kollaps vor dem Renewal-Fix) und potentiell ein
   Hotspot: pro Team eigener Plan+Apply-Zyklus.
5. Sponsor-Settlement, Facility-Verarbeitung, Contract-Tick, DB-Persist/Audit-IO.

## Empfehlung für den UX/Perf-Agent

- **Zuerst instrumentieren, dann optimieren.** Phase-Timer (`Date.now()`-Bracket → `console.error`
  wie die bestehenden `[autoprep]`-Marker) um: (a) Match-Sim je Matchday, (b) Preseason draft-batch je
  Season, (c) Season-End Sell-Session, (d) Roster-Repair-Schleife. Dann sieht man die echte Verteilung
  der 31 min.
- **Verdächtige Hotspots** (Hypothesen): der Preseason-Rebuild + Roster-Repair (20–23 Teams je einzeln
  planend/kaufend) und die Match-Sim skalieren mit 32 Teams × 10 MD × Fixtures. Der S1-Draft-Execute
  (38 s sequenziell über 32 Teams) ist ein bekanntes Muster — dieselbe Sequenzialität steckt vermutlich
  im Preseason-Rebuild.
- Der **Renewal-Fix** (Keeper bleiben, weniger Re-Draft) sollte `repair=` und die Preseason-Rebuild-Last
  senken — nach dem Fix erneut messen (der `resilient-allfix-*`-Lauf).

## Rohdaten-Marker (Beispiele aus run.log)

```
prep complete elapsed=35001ms / 40672ms / 35445ms          (Autoprep je Season)
matchday 10/10 … done total=32562ms / 38110ms / 32787ms    (Lineups je Season)
slot-audit season-N 10/10 … total=6676ms / 8379ms / 7823ms
league recalc done in 1455ms / 1464ms / 1454ms             (Season-End-XP)
[transfer-window] season-1 summary engine unified=9 legacy=0 repair=23
picks-run done: previewMs=17554 executeMs=38104 (S1-Draft, separater Lauf)
```
