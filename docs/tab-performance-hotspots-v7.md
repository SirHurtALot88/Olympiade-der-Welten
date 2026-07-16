# Foundation Performance Hotspots V7

Datum: 2026-06-30

## Kurzfazit

- Initialer Home-Load: **1735 ms**
- Langsamster Tabwechsel: **Sponsoren** (48550 ms von Diszis)
- Geprüfte Tab-Schritte: 16 (inkl. Training-Revisit)
- Slow (>=8s): 15 · Failed: 0
- Save: `fresh-season-1-1782851790032`, Team: `A-A`
- Messung auf ruhiger Maschine (kein paralleler Long-Run-Sim, daher kein Version-Poll-Reload-Storm).
- Browser-Errors: Failed to execute 'importScripts' on 'WorkerGlobalScope': The script at 'http://127.0.0.1:3000/_next/static/chunks/lib_foundation_workers_player-directory-sort_worker_ts_082pu4s._.js' failed to load.; Failed to load resource: the server responded with a status of 409 (Conflict); Failed to load resource: the server responded with a status of 400 (Bad Request)

## Messwerte V7 (Rohdaten)

| Von | Nach | V7 ms | API Calls | Langsamste API | Status | Befund |
| --- | --- | ---: | ---: | --- | --- | --- |
| Home | Inbox | 391 | 0 | — | ok | — |
| Inbox | Einsatzliste | 8912 | 0 | — | slow | Tabwechsel >5s |
| Einsatzliste | Arena | 8965 | 0 | — | slow | Tabwechsel >5s |
| Arena | Saisonstand | 20640 | 0 | — | slow | Tabwechsel >5s |
| Saisonstand | Teams | 8910 | 0 | — | slow | Tabwechsel >5s |
| Teams | Spieler | 11751 | 0 | — | slow | Tabwechsel >5s |
| Spieler | Training | 17496 | 0 | — | slow | Tabwechsel >5s |
| Training | Gebäude | 11859 | 0 | — | slow | Tabwechsel >5s |
| Gebäude | Training (revisit) | 26888 | 9 | /api/season/warmup-derivations 9018ms | slow | Tabwechsel >5s |
| Gebäude | Transfermarkt | 26094 | 9 | /api/season/standings-overview 6213ms | slow | Tabwechsel >5s |
| Transfermarkt | Scouting | 27032 | 16 | /api/season/team-overview-slice 13618ms | slow | Tabwechsel >5s |
| Scouting | Historie | 9584 | 5 | /api/season/ratings-slice 6184ms | slow | Tabwechsel >5s |
| Historie | Ranks | 12613 | 2 | /api/season/warmup-derivations 5282ms | slow | Tabwechsel >5s |
| Ranks | Diszis | 36255 | 14 | /api/season/ratings-slice 9426ms | slow | Tabwechsel >5s |
| Diszis | Sponsoren | 48550 | 22 | /api/season/management-overview 9985ms | slow | Tabwechsel >5s |
| Sponsoren | Lexikon | 13623 | 0 | — | slow | Tabwechsel >5s |

## V7 Änderungen

- Audit-Harness verwirft das Season-Briefing-Modal vor jeder Navigation (kein Backdrop-Intercept mehr -> Diszis/Sponsoren messbar).
- Long-Run wird self-contained mit echtem Cash-Draft gefahren; Messung erfolgt ohne parallelen Sim, damit der 45s-Version-Poll nicht dauernd Full-Reloads triggert.

CSV: [tab-performance-hotspots-v7.csv](./tab-performance-hotspots-v7.csv)

Backend-Audit: [outputs/performance-audit-summary.md](../outputs/performance-audit-summary.md) via `npm run perf:audit`.

