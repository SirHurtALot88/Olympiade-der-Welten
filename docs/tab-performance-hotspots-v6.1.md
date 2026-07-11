# Foundation Performance Hotspots V6.1

Datum: 2026-06-28

## Kurzfazit

- Initialer Home-Load: **110286 ms**
- Langsamster Tabwechsel: **Saisonstand** (195178 ms von Arena)
- Geprüfte Tab-Schritte: 16 (inkl. Training-Revisit)
- Save: `save-1782658020062-tvb2ly`, Team: `A-A`
- Browser-Errors: Failed to load resource: the server responded with a status of 400 (Bad Request); Failed to load resource: the server responded with a status of 500 (Internal Server Error)

Siehe [V6 vs V6.1 Vergleich](./tab-performance-hotspots-v6.1-comparison.md).

## Messwerte V6.1 (Rohdaten)

| Von | Nach | V6.1 ms | API Calls | Langsamste API | Status | Befund |
| --- | --- | ---: | ---: | --- | --- | --- |
| Home | Inbox | 30000 | 8 | /api/media/player-portrait/player-0002-kargath 4046ms | slow | Tabwechsel >5s |
| Inbox | Einsatzliste | 24804 | 0 | — | slow | Tabwechsel >5s |
| Einsatzliste | Arena | 95417 | 5 | /api/standings/preview 52126ms | slow | Tabwechsel >5s |
| Arena | Saisonstand | 195178 | 0 | — | failed | locator.waitFor: Timeout 120000ms exceeded.
Call log:
  - waiting for locator('[data-testid="foundation-season-v2"]').first() to be visible
 |
| Saisonstand | Teams | 58554 | 0 | — | failed | locator.waitFor: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-testid="foundation-teams-view"]').first() to be visible
 |
| Teams | Spieler | 100185 | 99 | /api/singleplayer-state 32374ms | slow | Tabwechsel >5s |
| Spieler | Training | 113680 | 3 | /api/singleplayer-state 40799ms | slow | Tabwechsel >5s |
| Training | Gebäude | 101929 | 2 | /api/singleplayer-state 29557ms | slow | Tabwechsel >5s |
| Gebäude | Training (revisit) | 81637 | 14 | /api/singleplayer-state 12967ms | slow | Tabwechsel >5s |
| Gebäude | Transfermarkt | 13532 | 0 | — | slow | Tabwechsel >5s |
| Transfermarkt | Scouting | 17117 | 0 | — | slow | Tabwechsel >5s |
| Scouting | Historie | 19677 | 2 | /api/singleplayer-state/version 4848ms | slow | Tabwechsel >5s |
| Historie | Ranks | 19838 | 0 | — | slow | Tabwechsel >5s |
| Ranks | Diszis | 120008 | 0 | — | failed | locator.click: Timeout 120000ms exceeded.
Call log:
  - waiting for getByTestId('foundation-nav-diszis')
    - locator resolved to <button type="button" class="foundation-sidebar-item" title="Disziplinen und Mutatoren." data-testid="foundation-nav-diszis">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div role="dialog" aria-modal="true" data-testid="season-briefing-backdrop" aria-labelledby="season-briefing-title" class="foundation-modal-backdrop season-briefing-backdrop">…</div> from <div class="foundation-shell-main">…</div> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div role="dialog" aria-modal="true" data-testid="season-briefing-backdrop" aria-labelledby="season-briefing-title" class="foundation-modal-backdrop season-briefing-backdrop">…</div> from <div class="foundation-shell-main">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    34 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div role="dialog" aria-modal="true" data-testid="season-briefing-backdrop" aria-labelledby="season-briefing-title" class="foundation-modal-backdrop season-briefing-backdrop">…</div> from <div class="foundation-shell-main">…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
 |
| Diszis | Sponsoren | 120445 | 5 | /api/singleplayer-state 72667ms | slow | Tabwechsel >5s |
| Sponsoren | Lexikon | 69031 | 5 | /api/singleplayer-state 19929ms | slow | Tabwechsel >5s |

CSV: [tab-performance-hotspots-v6.1.csv](./tab-performance-hotspots-v6.1.csv)

Backend-Audit: [outputs/performance-audit-summary.md](../outputs/performance-audit-summary.md) via `npm run perf:audit`.

