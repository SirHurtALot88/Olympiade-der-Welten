# Foundation Tab Performance — V6 vs V6.1

Datum: 2026-06-28

## Delta (Browser-Audit)

| Metrik | V6 gemessen | V6.1 gemessen | V6.1 Ziel |
| --- | ---: | ---: | --- |
| Initial Home | 10 000 ms | **110286 ms** | — |
| Spieler → Training | 89 000 ms | **113680 ms** | <15 000 ms |
| Training-Revisit | 25 500 ms | **81637 ms** | <3 000 ms |
| Teams | 37 000 ms | **58554 ms** | <10 000 ms |
| Transfermarkt | 12 000 ms | **13532 ms** | warm <20 ms |
| Sponsoren-Audit | fail/timeout | **120445 ms** (slow, Subtab-Klick aktiv) | ok (<10 s) |

## Hinweise zur Messung

- Audit lief auf frischem Dev-Server (Initial Home **110 s**); warme Wiederholung würde niedrigere Werte liefern.
- Saisonstand/Teams/Diszis teils durch `season-briefing-backdrop`-Modal blockiert (Klick-Intercept).
- `/api/singleplayer-state` (~40 s) tritt weiterhin bei Spieler→Training und Gebäude auf — Archive-Slice reduziert Last auf Saisonstand, nicht auf Auto-Persist-Konflikte.

## V6.1 Änderungen

- Archive-Sentinel + Snapshots-Slice-API statt Full-Reload auf Saisonstand/Diszis.
- Auto-Persist + Version-Poll während Tab-Wechsel pausiert.
- Training: Button-Nesting-Fix, initial Forecast-Batch 12.
- Transfermarkt: Browse-Index + Lazy-Hydration für Compact-Liste.

Rohdaten: [tab-performance-hotspots-v6.1.md](./tab-performance-hotspots-v6.1.md) · V6-Baseline: [tab-performance-hotspots-v6-comparison.md](./tab-performance-hotspots-v6-comparison.md)

