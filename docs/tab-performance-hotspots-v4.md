# Foundation Performance Hotspots V4

Datum: 2026-06-28

## Kurzfazit

- Initialer Home-Load: **25191 ms**
- Langsamster Tabwechsel: **Historie** (96877 ms von Scouting)
- Geprüfte Tabs: 15
- Browser-Errors: Failed to load resource: the server responded with a status of 400 (Bad Request); Failed to load resource: the server responded with a status of 403 (Forbidden)

## Messwerte V4

| Von | Nach | V4 ms | API Calls | Langsamste API | Status | Befund |
| --- | --- | ---: | ---: | --- | --- | --- |
| Home | Inbox | 12249 | 6 | /api/media/player-portrait/player-2070-vel-shara 2959ms | slow | Tabwechsel >5s |
| Inbox | Einsatzliste | 9541 | 0 | — | slow | Tabwechsel >5s |
| Einsatzliste | Arena | 12676 | 2 | /api/lineups/legacy/ai-batch-apply 3351ms | slow | Tabwechsel >5s |
| Arena | Saisonstand | 28093 | 3 | /api/singleplayer-state 6847ms | slow | Tabwechsel >5s |
| Saisonstand | Teams | 25490 | 7 | /api/singleplayer-state/version 108ms | slow | Tabwechsel >5s |
| Teams | Spieler | 20755 | 63 | /api/media/player-portrait/player-1596-misty 4472ms | slow | Tabwechsel >5s |
| Spieler | Training | 34595 | 12 | /api/singleplayer-state 7607ms | slow | Tabwechsel >5s |
| Training | Gebäude | 52095 | 1 | /api/singleplayer-state 8678ms | slow | Tabwechsel >5s |
| Gebäude | Transfermarkt | 10677 | 0 | — | slow | Tabwechsel >5s |
| Transfermarkt | Scouting | 8891 | 1 | /api/singleplayer-state/version 6ms | slow | Tabwechsel >5s |
| Scouting | Historie | 96877 | 0 | — | failed (pre-fix) | Panel war per `getViewClass("history")` bei `historyV2` versteckt — behoben |
| Historie | Ranks | 10942 | 0 | — | slow | Tabwechsel >5s |
| Ranks | Diszis | 38685 | 1 | /api/season/standings-overview 10842ms | slow | Tabwechsel >5s |
| Diszis | Sponsoren | 83961 | 10 | /api/media/team-logo/H-R 17503ms | slow | Tabwechsel >5s |
| Sponsoren | Lexikon | 60345 | 1 | /api/singleplayer-state/version 6547ms | slow | Tabwechsel >5s |

## Vergleich zu V3

- V3-Fokus: paginierte Historie/Markt, Arena-Entkopplung, Recap lazy.
- V4 ergänzt: **Sponsoren**-Navigation (Preisgeld-Untertab getrennt), Quick-Win `shouldLoadPrizePreviewFeed` nur auf Preisgeld-Subtab.
- Monolith [`FoundationPageClient.tsx`](../app/foundation/FoundationPageClient.tsx) rendert weiterhin viele Panels per `foundation-section-hidden` statt Unmount.

## Rest-Hotspots (statisch + Messung)

1. Frischer Dev-Reload/Home bleibt schwer (HMR + großer Client).
2. Arena-Server-Previews können nach Tabwechsel nachlaufen (V3 offen).
3. Markt-Free-Agents oft 1–2s+ trotz Limit.
4. Portraits/Logos feuern bei Tabellenwechseln breit.

## Prioritäten

| Prio | Thema | Hebel |
| --- | --- | --- |
| P0 | Sponsoren-Tab ohne Preisgeld-Fetch | erledigt in V4 (`prizeFinanceTab === "prize"`) |
| P0 | Transferhistorie v2 Panel sichtbar | erledigt (`getViewClass("history", "historyV2")`) |
| P1 | FoundationPageClient entmounten / lazy routes | kleinere DOM-Fläche pro Tab |
| P1 | Arena-Preview serverseitig abbrechen/cachen | weniger Nachlauf nach Tabwechsel |
| P2 | Marktfilter serverseitig enger | weniger Free-Agent-Payload |

CSV: [tab-performance-hotspots-v4.csv](./tab-performance-hotspots-v4.csv)

Backend-Audit: [`outputs/performance-audit-summary.md`](../outputs/performance-audit-summary.md) via `npm run perf:audit`.

Top-Backend-Hotspots (aktiver Save, 2026-06-28):

| Phase | Dauer | Severity |
| --- | ---: | --- |
| training page build | 59.3 s | blockierend |
| AI market preview | 2.5 s | langsam |
| transfermarkt free-agent feed | 2.0 s | langsam |
| contract renewal preview | 1.2 s | langsam |

Audit-Fund: Transferhistorie v2 nutzte `getViewClass("history")` statt `historyV2` — Panel blieb per CSS versteckt. Fix in V4-Lauf ergänzt.

