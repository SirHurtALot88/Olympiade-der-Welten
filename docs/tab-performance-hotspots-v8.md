# Foundation Performance Hotspots V8

Datum: 2026-07-01

## Kurzfazit

- Initialer Home-Load: **680 ms**
- Langsamster Tabwechsel: **Inbox** (180079 ms von Home)
- Geprüfte Tab-Schritte: 17 (inkl. Training-Revisit)
- Slow (>=8s): 3 · Failed: 1
- Save: `fresh-season-1-1782945000789`, Team: `A-A`
- Messung auf ruhiger Maschine (kein paralleler Long-Run-Sim, daher kein Version-Poll-Reload-Storm).
- Browser-Errors: Failed to load resource: the server responded with a status of 409 (Conflict)

## Messwerte V8 (Rohdaten)

| Von | Nach | V8 ms | API Calls | Langsamste API | Status | Befund |
| --- | --- | ---: | ---: | --- | --- | --- |
| Home | Inbox | 180079 | 0 | — | failed | locator.waitFor: Timeout 180000ms exceeded.
Call log:
  - waiting for locator('[data-testid="foundation-inbox-v2"]').first() to be visible
 |
| Inbox | Einsatzliste | 2953 | 0 | — | ok | — |
| Einsatzliste | Arena | 5640 | 0 | — | ok | Tabwechsel >5s |
| Arena | Saisonstand | 5375 | 0 | — | ok | Tabwechsel >5s |
| Saisonstand | Teams | 10703 | 0 | — | slow | Tabwechsel >5s |
| Teams | Teams (revisit) | 2960 | 0 | — | ok | — |
| Teams | Spieler | 2950 | 0 | — | ok | — |
| Spieler | Training | 5564 | 0 | — | ok | Tabwechsel >5s |
| Training | Gebäude | 5552 | 0 | — | ok | Tabwechsel >5s |
| Gebäude | Training (revisit) | 4267 | 0 | — | ok | — |
| Gebäude | Transfermarkt | 12300 | 0 | — | slow | Tabwechsel >5s |
| Transfermarkt | Scouting | 4360 | 0 | — | ok | — |
| Scouting | Historie | 4294 | 0 | — | ok | — |
| Historie | Ranks | 6565 | 0 | — | ok | Tabwechsel >5s |
| Ranks | Diszis | 4760 | 0 | — | ok | — |
| Diszis | Sponsoren | 12153 | 0 | — | slow | Tabwechsel >5s |
| Sponsoren | Lexikon | 5429 | 0 | — | ok | Tabwechsel >5s |

## V8 Änderungen

- Top-Priority-Optimierungen: Teams, Spieler, Saisonstand, Training (siehe V8-comparison vs V7).

CSV: [tab-performance-hotspots-v8.csv](./tab-performance-hotspots-v8.csv)

V7-Baseline: [tab-performance-hotspots-v8-comparison.md](./tab-performance-hotspots-v8-comparison.md)

Backend-Audit: [outputs/performance-audit-summary.md](../outputs/performance-audit-summary.md) via `npm run perf:audit`.

