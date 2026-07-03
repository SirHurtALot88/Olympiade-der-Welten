# Foundation Performance Hotspots V9

Datum: 2026-07-03

## Kurzfazit

- Initialer Home-Load: **16627 ms**
- Mess-Schritte gesamt: **36** (Chain + Home-direct + Drilldowns)
- Slow (>=8s): 5 · Failed: 11 · Main-Thread-Hinweise: 13
- Save: `fresh-season-1-1783052481107`, Team: `R-R`
- Langsamster Schritt: **Teamprofil (warm)** (365019 ms, Modus drilldown)
- Browser-Errors: getRosterEntryCurrentSeasonSalary is not a function; page.goto: Timeout 180000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/foundation?view=homeV2&team=R-R&saveId=fresh-season-1-1783052481107", waiting until "domcontentloaded"
; getRosterEntryCurrentSeasonSalary is not defined; ./app/foundation/FoundationShellRouterBody.tsx:6493:19
Unexpected token. Did you mean `{'}'}` or `&rbrace;`?
  6491 |           ) : null}
  6492 |
> 6493 |           ) : null}
       |                   ^
  6494 |
  6495 |           {isTransferMarketViewActive ? (
  6496 |           <FoundationTransfermarktV2Panel

Parsing ecmascript source code failed

Import traces:
  Client Component Browser:
    ./app/foundation/FoundationShellRouterBody.tsx [Client Component Browser]
    ./app/foundation/FoundationPageClient.tsx [Client Component Browser]
    ./app/foundation/FoundationPageClient.tsx [Server Component]
    ./app/foundation/page.tsx [Server Component]

  Client Component SSR:
    ./app/foundation/FoundationShellRouterBody.tsx [Client Component SSR]
    ./app/foundation/FoundationPageClient.tsx [Client Component SSR]
    ./app/foundation/FoundationPageClient.tsx [Server Component]
    ./app/foundation/page.tsx [Server Component]; Failed to load resource: the server responded with a status of 500 (Internal Server Error)

## Messwerte V9

| Modus | Von | Nach | ms | API | Langsamste API | Main-Thread | Status | Befund |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| chain | START | Home | 16627 | 0 | — | ja | slow | initial_load; Tabwechsel >5s; main_thread_heavy |
| chain | Home | Inbox | 879 | 0 | — | nein | ok | — |
| chain | Inbox | Einsatzliste | 1504 | 0 | — | nein | ok | — |
| chain | Einsatzliste | Einsatzliste v2 | 2601 | 0 | — | nein | ok | — |
| chain | Einsatzliste v2 | Arena | 3831 | 0 | — | nein | ok | — |
| chain | Arena | Saisonstand | 5020 | 0 | — | ja | ok | Tabwechsel >5s; main_thread_heavy |
| chain | Saisonstand | Teams | 32759 | 0 | — | ja | failed | locator.waitFor: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-testid="foundation-teams-view"]').first() to be visible
; Tabwechsel >5s; main_thread_heavy |
| chain | Teams | Teams (revisit) | 180008 | 0 | — | ja | failed | locator.click: Timeout 180000ms exceeded.
Call log:
  - waiting for getByTestId('foundation-nav-teams')
; Tabwechsel >5s; main_thread_heavy |
| chain | Teams | Spieler | 180005 | 0 | — | ja | failed | locator.click: Timeout 180000ms exceeded.
Call log:
  - waiting for getByTestId('foundation-nav-players')
; Tabwechsel >5s; main_thread_heavy |
| chain | Spieler | Training | 293248 | 0 | — | ja | failed | locator.waitFor: Timeout 180000ms exceeded.
Call log:
  - waiting for locator('[data-testid="foundation-training-compact"]').first() to be visible
; Tabwechsel >5s; main_thread_heavy |
| chain | Training | Gebäude | 16332 | 2 | /api/season/ratings-slice 2184ms | nein | slow | Tabwechsel >5s |
| chain | Gebäude | Training (revisit) | 2595 | 10 | /api/media/player-portrait/player-0678-ithuriel 168ms | nein | ok | — |
| chain | Gebäude | Transfermarkt | 4207 | 6 | /api/media/player-portrait/player-2093-reefstalker 99ms | nein | ok | — |
| chain | Transfermarkt | Scouting | 3866 | 1 | /api/transfermarkt/free-agents 43ms | nein | ok | — |
| chain | Scouting | Historie | 3434 | 1 | /api/transfermarkt/history 1027ms | nein | ok | — |
| chain | Historie | Ranks | 3624 | 0 | — | nein | ok | — |
| chain | Ranks | Diszis | 3678 | 0 | — | nein | ok | — |
| chain | Diszis | Sponsoren | 13482 | 1 | /api/season/prize-preview 1840ms | nein | slow | Tabwechsel >5s |
| chain | Sponsoren | Lexikon | 4354 | 0 | — | nein | ok | — |
| chain | Lexikon | Cockpit | 4203 | 1 | /api/season/prize-preview 1379ms | nein | ok | — |
| chain | Cockpit | Generator | 182233 | 0 | — | ja | failed | locator.waitFor: Timeout 180000ms exceeded.
Call log:
  - waiting for locator('[data-testid="foundation-generator"]').first() to be visible
; Tabwechsel >5s; main_thread_heavy |
| chain | Generator | Settings | 4502 | 0 | — | nein | ok | — |
| chain | Settings | Admin | 182421 | 0 | — | ja | failed | locator.waitFor: Timeout 180000ms exceeded.
Call log:
  - waiting for locator('[data-testid="foundation-admin"]').first() to be visible
; Tabwechsel >5s; main_thread_heavy |
| drilldown | Spieler | Spielerprofil (cold) | 39594 | 29 | /api/season/player-directory-slice 3555ms | nein | slow | Tabwechsel >5s |
| drilldown | Spielerprofil | Spielerprofil (warm) | 39779 | 4 | /api/media/player-portrait/player-2586-krass-thul 3764ms | nein | slow | Tabwechsel >5s |
| drilldown | Spielerprofil | Spieler-Tab overview | 360 | 0 | — | nein | ok | — |
| drilldown | Spielerprofil | Spieler-Tab details | 1520 | 0 | — | nein | ok | — |
| drilldown | Spielerprofil | Spieler-Tab contract | 4166 | 0 | — | nein | ok | — |
| drilldown | Spielerprofil | Spieler-Tab training | 2392 | 0 | — | nein | ok | — |
| drilldown | Spielerprofil | Spieler-Tab report | 2390 | 0 | — | nein | ok | — |
| drilldown | Spielerprofil | Spieler-Tab career | 1709 | 0 | — | nein | ok | — |
| drilldown | Teams | Teamprofil (cold) | 180038 | 0 | — | ja | failed | locator.click: Timeout 180000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Teamprofil' }).first()
; Tabwechsel >5s; main_thread_heavy |
| drilldown | Teamprofil | Teamprofil (warm) | 365019 | 0 | — | ja | failed | locator.click: Timeout 180000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Teamprofil' }).first()
; Tabwechsel >5s; main_thread_heavy |
| drilldown | Teams | Teams-Tab Portraits | 180006 | 0 | — | ja | failed | locator.click: Timeout 180000ms exceeded.
Call log:
  - waiting for getByTestId('foundation-subnav-portraits')
; Tabwechsel >5s; main_thread_heavy |
| drilldown | Teams | Teams-Tab Kader | 180006 | 0 | — | ja | failed | locator.click: Timeout 180000ms exceeded.
Call log:
  - waiting for getByTestId('foundation-subnav-roster')
; Tabwechsel >5s; main_thread_heavy |
| drilldown | Teams | Teams-Tab Verträge | 180009 | 0 | — | ja | failed | locator.click: Timeout 180000ms exceeded.
Call log:
  - waiting for getByTestId('foundation-subnav-contracts')
    - waiting for" http://localhost:3000/foundation?view=teams&team=R-R" navigation to finish...
    - navigated to "http://localhost:3000/foundation?view=teams&team=R-R"
; Tabwechsel >5s; main_thread_heavy |

## Top-5 Hotspots

1. **Teamprofil (warm)** (drilldown): 365019 ms — Main-Thread
2. **Training** (chain): 293248 ms — Main-Thread
3. **Admin** (chain): 182421 ms — Main-Thread
4. **Generator** (chain): 182233 ms — Main-Thread
5. **Teamprofil (cold)** (drilldown): 180038 ms — Main-Thread

CSV: [tab-performance-hotspots-v9.csv](./tab-performance-hotspots-v9.csv)

V8-Vergleich: [tab-performance-hotspots-v9-comparison.md](./tab-performance-hotspots-v9-comparison.md)

