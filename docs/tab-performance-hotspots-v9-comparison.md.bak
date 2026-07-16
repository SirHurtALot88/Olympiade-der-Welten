# Foundation Tab Performance — V8 vs V9

Datum: 2026-07-02

## Sequenzielle Chain (V8-vergleichbar)

| Von | Nach | V8 ms | V9 ms | Δ | Status V9 |
| --- | --- | ---: | ---: | ---: | --- |
| START | Home | 680 | **89184** | +88504 | slow |
| Home | Inbox | 180079 | **67996** | -112083 | slow |
| Inbox | Einsatzliste | 2953 | **33121** | +30168 | slow |
| Einsatzliste | Einsatzliste v2 | — | **34707** | — | slow |
| Einsatzliste v2 | Arena | — | **50110** | — | slow |
| Arena | Saisonstand | 5375 | **80579** | +75204 | slow |
| Saisonstand | Teams | 10703 | **48632** | +37929 | failed |
| Teams | Teams (revisit) | 2960 | **37012** | +34052 | failed |
| Teams | Spieler | 2950 | **15826** | +12876 | slow |
| Spieler | Training | 5564 | **110688** | +105124 | slow |
| Training | Gebäude | 5552 | **66353** | +60801 | slow |
| Gebäude | Training (revisit) | 4267 | **22246** | +17979 | slow |
| Gebäude | Transfermarkt | 12300 | **29809** | +17509 | slow |
| Transfermarkt | Scouting | 4360 | **25218** | +20858 | slow |
| Scouting | Historie | 4294 | **13190** | +8896 | slow |
| Historie | Ranks | 6565 | **9725** | +3160 | slow |
| Ranks | Diszis | 4760 | **10281** | +5521 | slow |
| Diszis | Sponsoren | 12153 | **24538** | +12385 | slow |
| Sponsoren | Lexikon | 5429 | **10919** | +5490 | slow |
| Lexikon | Cockpit | — | **10795** | — | slow |
| Cockpit | Generator | — | **14692** | — | slow |
| Generator | Settings | — | **97021** | — | failed |
| Settings | Admin | — | **10729** | — | slow |

## Neue V9-Abdeckung

- **Home-direct cold/warm** pro Nav-Tab (20 Tabs)
- **Drilldowns:** Spielerprofil cold/warm, 6 Untertabs, Teamprofil cold/warm, 3 Teams-Untertabs, Deep-Link
- **Admin-Gruppe:** Cockpit, Generator, Settings, Admin

## Optimierungs-Backlog (V9-verifiziert)

| Prio | Hotspot | V9 ms | Typ | Hebel |
| --- | --- | ---: | --- | --- |
| P0 | Initial Home / Cold Compile | 89 184 | Main-Thread + HMR | Warm server vor Audit; Monolith-Split wiederherstellen (~8k Parent) |
| P0 | Training (Chain) | 110 688 | API | `/api/singleplayer-state` 44s — Auto-Persist/Version-Poll während Navigation pausieren |
| P0 | Spielerprofil cold open | 96 463 | API | `player-sheet` + `buildPlayerDrawerDataFromGameState`; Skeleton-first |
| P0 | Settings-Tab | 97 021 | Main-Thread | Team-Settings-Panel lazy; schwere GM/Identity-Memos gaten |
| P1 | Arena → Saisonstand | 80 579 | API | `standings-overview` / singleplayer-state Storm (46s); Archive-Slice + Prefetch |
| P1 | Teams-Tab Ready | 48 632 (failed) | Main-Thread | `foundation-teams-view` timeout — Teams-Hydration + Portrait-Prefetch |
| P1 | Saisonstand → Teams | 48 632 | Main-Thread | Wie V8: kein API, schwerer Render — `buildTeamDetailDrawerData` defer |
| P2 | Spieler-Tab contract | 94 478 (failed) | Main-Thread | Anker `#player-drawer-market` fehlt bei Free Agents — UI/Ready-Fix |
| P2 | Teamprofil open | failed | Main-Thread | Button „Teamprofil“ nicht klickbar nach Teams-fail — Teams-Tab zuerst stabilisieren |
| P2 | Portrait-Storm | — | Network | 33 API bei Einsatzliste→v2; Media-Budget (`portrait-load-budget`) |

### Spieler-Untertabs (nach geladenem Profil)

| Tab | ms | Status |
| --- | ---: | --- |
| Stats (overview) | 341 | ok |
| Details | 4 307 | ok |
| Vertrag (contract) | 94 478 | failed |
| Entwicklung (training) | 33 741 | slow |
| Report | 4 342 | ok |
| Karriere (career) | 3 866 | ok |

Historische OVR/PPS/Karriere-Daten: **Karriere-Tab lädt in ~4s** nach Profil-Hydration — Funktionalität intakt, aber **Profil-Open selbst ist der Flaschenhals** (~96s cold).

### Messhinweise

- Lauf: **64 min**, `--skip-warmup`, frischer Dev-Server (kein Warmup) → Initial Home 89s ist Cold-Compile, nicht warm-path.
- Home-direct-Phase: **keine Zeilen** (Navigation-Timeout nach langer Chain) — erneut mit `--skip-home-direct` oder frischem Browser-Kontext.
- Browser-Errors: `getRosterEntryCurrentSeasonSalary is not a function`, 409 Conflict auf Persist.

