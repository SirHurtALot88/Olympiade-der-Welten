# Foundation Tab Performance — V7 vs V8

Datum: 2026-07-01

## Delta (Browser-Audit)

| Metrik | V7 | V8 (Phase 0 baseline) | Δ |
| --- | ---: | ---: | ---: |
| Initial Home | 1 735 ms | **29 833 ms** | +1 618% (cold compile / frischer Save) |
| Failed Steps | 0 / 16 | **1 / 16** (Spieler → Training) | Training-Ready fehlte |
| OK Steps (<8 s) | 1 | **0** | — |
| Langsamster Wechsel | Sponsoren 48 550 ms | **Training 99 834 ms (fail)** | Audit-Timeout |
| Arena → Saisonstand | 20 640 ms | **47 120 ms** | +128% |
| Saisonstand → Teams | 8 910 ms | **11 052 ms** | +24% |
| Teams → Spieler | 11 751 ms | **17 010 ms** | +45% |
| Spieler → Training | 17 496 ms | **99 834 ms (fail)** | Timeout, kein `testId` |
| Gebäude → Training (revisit) | 26 888 ms | **13 835 ms** | **−49%** |
| Diszis → Sponsoren | 48 550 ms | **26 592 ms** | **−45%** |

## Klassifikation Top-Priority-Tabs (V8)

| Tab | V8 ms | Typ | Befund |
| --- | ---: | --- | --- |
| Teams | 11 052 (Saisonstand→Teams) | Main-Thread + Media | 0 schwere API; Portrait-Prefetch; `disciplineRankRows` für alle Teams |
| Spieler | 17 010 (Teams→Spieler) | Main-Thread | 0 API; Directory-Slice + Sort |
| Saisonstand | 47 120 (Arena→Saisonstand) | Network + Chunk | 27 API-Calls, `standings-overview` 11,3 s |
| Training | **fail** (Spieler→Training) | Main-Thread | Deferred-Skeleton ohne `testId`; Forecast-Block >60 s |

## V8 Fixes (Phase 1)

### Training (kritisch — Audit-Fail)
- `FoundationViewMount` für Training trägt jetzt `testId`/`id` → Ready-Signal sofort bei Tab-Aktivierung
- Entfernt `trainingPanelDeferred`-Gate, das Skeleton ohne `testId` zeigte
- `trainingLoadPlanByPlayerId`, Summaries und Row-Views nur bei `shouldBuildTrainingCompactView`

### Teams
- `shouldBuildDisciplineRanks` nicht mehr für Basis-Teams-View (nur Extended/Ranks/Prize)
- Leichte Area-Ranks aus `seasonStandRows.pps*` statt Full-Roster-Iteration
- `leaguePlayerHeatPools`: kein Full-League-Scan mehr auf Default-Portraits-Tab

### Saisonstand
- `teamOverviewSlice` prefetch auf Arena-Tab (`matchdayArena`)
- Idle-Prefetch `seasonV2`-Panel von Arena aus

### Querliegend
- `ppAreaRows` / `seasonFormBonusByTeamId` / `seasonDisciplineRankMaps` nur bei Views, die sie rendern
- Spieler→Training: Chunk-Prefetch `trainingCompact` bei aktivem Players-Tab

## Status vs Ziel (<5 s warm)

Alle 16 Schritte weiterhin **slow** oder **failed** in V8-Baseline. Hauptlast: Main-Thread in `FoundationPageClient` (~30k Zeilen) bei Tab-Wechsel ohne API, plus Season-Slice-Storm auf Saisonstand.

## Verify-Lauf (nach Phase-1-Fixes)

| Tab | V8 Baseline | V8 Verify | Δ |
| --- | ---: | ---: | ---: |
| Arena → Saisonstand | 47 120 ms | **12 763 ms** | **−73%** |
| Saisonstand → Teams | 11 052 ms | 61 772 ms | +459% (Media-Storm: 33 API, Logo 22 s) |
| Teams → Spieler | 17 010 ms | 18 879 ms | +11% |
| Spieler → Training | **fail (99 s)** | **30 593 ms** | Audit ok |
| Training → Gebäude | 42 955 ms | **8 156 ms** | **−81%** |
| Gebäude → Training (revisit) | 13 835 ms | 9 599 ms | **−31%** |
| Failed Steps | 1 | **0** | — |

## Tests & Audits

- `npm run perf:regression-smoke`
- Vitest: `foundation-performance-architecture`, `pp-area-form-bonus`, `use-player-directory-slice-cache`
- Re-Audit empfohlen nach Phase-1-Fixes

Rohdaten: [tab-performance-hotspots-v8.md](./tab-performance-hotspots-v8.md) · V7: [tab-performance-hotspots-v7.md](./tab-performance-hotspots-v7.md)
