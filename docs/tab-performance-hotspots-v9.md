# Foundation Performance Hotspots V9

Datum: 2026-07-03

## Kurzfazit

- Initialer Home-Load: **21157 ms**
- Mess-Schritte gesamt: **36** (Chain + Home-direct + Drilldowns)
- Slow (>=8s): 5 · Failed: 6 · Main-Thread-Hinweise: 9
- Save: `save-1783053839918-k9dd6k`, Team: `A-A`
- Langsamster Schritt: **Teamprofil (warm)** (246115 ms, Modus drilldown)
- Browser-Errors: Cannot read properties of undefined (reading 'has')

## Messwerte V9

| Modus | Von | Nach | ms | API | Langsamste API | Main-Thread | Status | Befund |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| chain | START | Home | 21157 | 0 | — | ja | slow | initial_load; Tabwechsel >5s; main_thread_heavy |
| chain | Home | Inbox | 8455 | 0 | — | ja | slow | Tabwechsel >5s; main_thread_heavy |
| chain | Inbox | Einsatzliste | 7393 | 4 | /api/lineups/legacy/ai-preview 63ms | nein | ok | Tabwechsel >5s |
| chain | Einsatzliste | Einsatzliste v2 | 2684 | 1 | /api/lineups/legacy/lab-context 280ms | nein | ok | — |
| chain | Einsatzliste v2 | Arena | 6171 | 2 | /api/lineups/legacy/ai-preview 28ms | nein | ok | Tabwechsel >5s |
| chain | Arena | Saisonstand | 6174 | 32 | /api/media/team-logo/P-C 176ms | nein | ok | Tabwechsel >5s |
| chain | Saisonstand | Teams | 3315 | 10 | /api/media/player-portrait/player-1630-chana 117ms | nein | ok | — |
| chain | Teams | Teams (revisit) | 3287 | 31 | /api/media/team-logo/V-V 1552ms | nein | ok | — |
| chain | Teams | Spieler | 4495 | 0 | — | nein | ok | — |
| chain | Spieler | Training | 22408 | 7 | /api/media/team-logo/V-W 3170ms | nein | slow | Tabwechsel >5s |
| chain | Training | Gebäude | 4999 | 0 | — | nein | ok | — |
| chain | Gebäude | Training (revisit) | 3237 | 0 | — | nein | ok | — |
| chain | Gebäude | Transfermarkt | 5340 | 14 | /api/transfermarkt/free-agents 1492ms | nein | ok | Tabwechsel >5s |
| chain | Transfermarkt | Scouting | 4142 | 2 | /api/transfermarkt/free-agents 635ms | nein | ok | — |
| chain | Scouting | Historie | 4360 | 1 | /api/transfermarkt/history 1327ms | nein | ok | — |
| chain | Historie | Ranks | 3913 | 0 | — | nein | ok | — |
| chain | Ranks | Diszis | 4021 | 0 | — | nein | ok | — |
| chain | Diszis | Sponsoren | 7989 | 1 | /api/season/prize-preview 2108ms | nein | ok | Tabwechsel >5s |
| chain | Sponsoren | Lexikon | 3525 | 0 | — | nein | ok | — |
| chain | Lexikon | Cockpit | 3147 | 0 | — | nein | ok | — |
| chain | Cockpit | Generator | 126345 | 0 | — | ja | failed | locator.waitFor: Timeout 120000ms exceeded.
Call log:
  - waiting for locator('[data-testid="foundation-generator"]').first() to be visible
; Tabwechsel >5s; main_thread_heavy |
| chain | Generator | Settings | 3384 | 0 | — | nein | ok | — |
| chain | Settings | Admin | 122498 | 0 | — | ja | failed | locator.waitFor: Timeout 120000ms exceeded.
Call log:
  - waiting for locator('[data-testid="foundation-admin"]').first() to be visible
; Tabwechsel >5s; main_thread_heavy |
| drilldown | Spieler | Spielerprofil (cold) | 20574 | 0 | — | ja | slow | Tabwechsel >5s; main_thread_heavy |
| drilldown | Spielerprofil | Spielerprofil (warm) | 30884 | 72 | /api/media/player-portrait/player-1230-lyrna 2819ms | nein | slow | Tabwechsel >5s |
| drilldown | Spielerprofil | Spieler-Tab overview | 354 | 0 | — | nein | ok | — |
| drilldown | Spielerprofil | Spieler-Tab details | 1607 | 0 | — | nein | ok | — |
| drilldown | Spielerprofil | Spieler-Tab contract | 3836 | 0 | — | nein | ok | — |
| drilldown | Spielerprofil | Spieler-Tab training | 2464 | 0 | — | nein | ok | — |
| drilldown | Spielerprofil | Spieler-Tab report | 2465 | 0 | — | nein | ok | — |
| drilldown | Spielerprofil | Spieler-Tab career | 2595 | 0 | — | nein | ok | — |
| drilldown | Teams | Teamprofil (cold) | 120007 | 0 | — | ja | failed | locator.click: Timeout 120000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Teamprofil' }).first()
; Tabwechsel >5s; main_thread_heavy |
| drilldown | Teamprofil | Teamprofil (warm) | 246115 | 0 | — | ja | failed | locator.click: Timeout 120000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Teamprofil' }).first()
    - waiting for" http://localhost:3000/foundation?view=teams&team=A-A" navigation to finish...
    - navigated to "http://localhost:3000/foundation?view=teams&team=A-A"
; Tabwechsel >5s; main_thread_heavy |
| drilldown | Teams | Teams-Tab Portraits | 120208 | 0 | — | ja | failed | locator.waitFor: Timeout 120000ms exceeded.
Call log:
  - waiting for locator('[data-testid="team-portraits-grid"]').first() to be visible
; Tabwechsel >5s; main_thread_heavy |
| drilldown | Teams | Teams-Tab Kader | 406 | 0 | — | nein | ok | — |
| drilldown | Teams | Teams-Tab Verträge | 123581 | 0 | — | ja | failed | locator.waitFor: Timeout 120000ms exceeded.
Call log:
  - waiting for locator('[data-testid="foundation-teams-view"][data-team-tab="contracts"]').first() to be visible
; Tabwechsel >5s; main_thread_heavy |

## Top-5 Hotspots

1. **Teamprofil (warm)** (drilldown): 246115 ms — Main-Thread
2. **Generator** (chain): 126345 ms — Main-Thread
3. **Teams-Tab Verträge** (drilldown): 123581 ms — Main-Thread
4. **Admin** (chain): 122498 ms — Main-Thread
5. **Teams-Tab Portraits** (drilldown): 120208 ms — Main-Thread

CSV: [tab-performance-hotspots-v9.csv](./tab-performance-hotspots-v9.csv)

V8-Vergleich: [tab-performance-hotspots-v9-comparison.md](./tab-performance-hotspots-v9-comparison.md)

