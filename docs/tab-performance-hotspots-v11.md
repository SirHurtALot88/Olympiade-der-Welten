# Foundation Tab Performance — V11 Baseline (Post Sprint I–N + P2 Teams Dedup)

Datum: 2026-07-07  
Branch: `pr/ui-einsatzliste-35-36`  
Save (QA): `fresh-season-1-1783267090717-real-20260705`

## Architektur-Metriken (statisch)

| Metrik | V10 (2026-07-03) | V11 (2026-07-06) | V11 Phase 3 Rest (2026-07-07) | V11 Phase 3 Final (2026-07-07) | Δ vs. 9.715 |
|---|---:|---:|---:|---:|---:|
| `use-foundation-shell-router-body-scope.tsx` | ~10.496 Z. | **9.715 Z.** | **9.160 Z.** | **7.854 Z.** | **−1.306 Z.** |
| `FoundationShellRouterBody.tsx` | ~3.388 Z. | **3.340 Z.** | **3.340 Z.** | **3.194 Z.** | **−146 Z.** |
| `foundation-table-column-defs.ts` | — | **135 Z.** | **135 Z.** | **135 Z.** | — |
| `season-table-column-defs.ts` | — | **76 Z.** | **76 Z.** | **76 Z.** | — |
| `use-foundation-table-preferences.ts` | — | — | **437 Z.** | **437 Z.** | neu |
| `foundation-game-flow-navigation.ts` | — | — | **150 Z.** | **150 Z.** | neu |
| `foundation-new-game-flow-handlers.ts` | — | — | **225 Z.** | **225 Z.** | neu |
| `foundation-global-next-actions.ts` | — | — | — | **180 Z.** | neu |
| `build-foundation-shell-router-body-props.ts` | — | — | — | **8 Z.** | neu |

## Phase P2 — Teams Scope-Dedup (umgesetzt)

- **Neue Hooks:** `use-teams-contract-derivations.ts`, `use-teams-extended-panel-derivations.ts`
- **Erweitert:** `use-teams-panel-derivations.ts` (Roster-Spalten nur im Teams-Host)
- **Host:** `FoundationTeamsViewHost.tsx` berechnet Verträge, Extended-Panel, Roster-Spalten nur bei `activeView === "teams"`
- **Entfernt aus Scope:** tote HQ-Priority-Memos, doppeltes `rosterPlayersByOvr`, Contract-/AI-/Free-Agent-Memos, Scope-Hydration-State
- **Extrahiert:** `buildFoundationSeasonTableColumns()` → `season-table-column-defs.ts`

## Phase 3 — Monolith-Split Richtung 8k (partial, 2026-07-06)

- **3a Table column defs:** `foundation-table-column-defs.ts` — Players, Transfer-History, Disziplin-Config, Disziplin-Ranks, Season-Compact-Presets; `orderedDisciplines` → `buildOrderedFoundationDisciplines()`
- **3c Inbox migration:** `FoundationShellRouterBody` → `FoundationShellRouterInboxV2` + `foundationInboxV2HostProps`; Legacy-`visibleInboxItems`/`inboxV2Items`-Memos aus Scope entfernt; Host nutzt `useInboxV2Derivations` (mode filter, grouping, quick actions)
- **3c Export barrel trim:** ~150-Z.-Re-Export-Block am Scope-Ende entfernt (Consumer nutzen `foundation-page-client-exports.ts`)
- **3d State context:** `useFoundationStateContextValue` verdrahtet; `FoundationStateProvider` in `FoundationPageClient`
- **3e Dead dynamic imports:** 18 ungenutzte `dynamic()`-Deklarationen entfernt (Panels leben in ShellRouter-Hosts); `next/dynamic` + `FoundationPanelSkeleton` aus Scope
- **3f Dead module helpers:** Duplikate/tote Modul-Helper entfernt (`abbreviateDisciplineName`, `SEASON_TOP_PLAYER_TEAM_TAG_COLORS`, `WarningList`, lokales `getTeamLogoModel` → `@/lib/data/mediaAssets`)
- **3g Season table layout:** `buildSeasonModeColumns`, `buildSeasonTablePinnedOffsets`, `scrollSeasonTableToColumn` → `season-table-column-defs.ts`
- **Gap zum 8k-Ziel (Scope):** ~1.715 Z.

## Phase 3 Rest — Monolith-Split Richtung 8k (2026-07-07)

- **3h Table preferences:** `use-foundation-table-preferences.ts` — Spaltenbreiten, Presets, Resize/Drag, Sichtbarkeit, Transfermarkt-Advanced-Columns; `tableResizeState`/`tableDragState` in Hook
- **3i Game-flow navigation:** `foundation-game-flow-navigation.ts` — `createFoundationGameFlowNavigator` (`navigateToGameFlowStep`, `navigateToInboxItem`); Inbox form-board via `panel` (fix latent `targetPanel`-ReferenceError)
- **3j New-game-flow handlers:** `foundation-new-game-flow-handlers.ts` — `updateNewGameFlowStepStatus`, `dismissNewGameFlow`, `navigateSeasonSetupStep`
- **3k Season stand helpers:** `buildSeasonDisciplineRankMaps`, `buildCurrentAreaRanksByTeamId`, `buildArchivedSeasonDisciplineLeaderboards` → `season-stand-render-helpers.tsx`
- **3l Import cleanup:** `Link`, `Fragment`, `Suspense`, ungenutzte UI-Komponenten (`ClassIcon`, `VeloImpactStrip`, …), tote Table-Layout-Imports
- **Gap zum 8k-Ziel (Scope):** **~1.160 Z.** (9.160 → ≤8.000)

## Phase 3 Final — Monolith-Split 8k (2026-07-07)

- **3m Home V2 host:** `foundationHomeV2HostProps` → `FoundationShellRouterHomeV2` + `FoundationHomeV2Host`; inline `FoundationHomeV2Panel` aus Body entfernt; Home-Warnings/TodayCards/TopPlayers-Memos aus Scope entfernt (Host/`use-home-v2-overview-derivations.ts`)
- **3n Season V2 host:** `foundationSeasonV2HostProps` → `FoundationShellRouterSeasonV2` + `FoundationSeasonV2Host`; inline `FoundationSeasonV2Panel` aus Body entfernt; `seasonV2*`-Memos + `sortedSeasonStandRows` aus Scope entfernt
- **3o Global next:** `foundation-global-next-actions.ts` — `createUpdateInboxItemStatus`, `deriveGlobalNextUi`, `createTriggerGlobalNext`
- **3p Body props builder:** `build-foundation-shell-router-body-props.ts` — Scope delegiert an Builder
- **Gap zum 8k-Ziel (Scope):** **0 Z.** (7.854 ≤ 8.000)

## Performance-Gates (Ziel)

| Kette | V10 warm | Gate |
|---|---:|---|
| Arena → Saisonstand | 2,05 s | < 5 s, keine Regression vs. V10 |
| Saisonstand → Teams | 1,62 s | < 5 s |
| Teams → Spieler | 4,32 s | < 5 s |
| Home cold | — | < 5 s (Re-Audit ausstehend) |

## Re-Audit ausführen

Dev-Server starten, dann:

```bash
npm run perf:foundation-v9 -- --base-url http://localhost:3000 --no-start --timeout-ms 180000
npm run perf:regression-smoke
npx vitest run tests/foundation-performance-architecture.test.ts tests/*-ui-contract.test.ts
```

Ergebnisse in `docs/tab-performance-hotspots-v9.md` / `.csv` und diese Datei ergänzen.

## Offen (nächste Slices)

- Monolith Phase 3 Final: **Scope 7.854 Z. (≤8k)** — erledigt
- Perf Re-Audit: Dev-Server-Start (`tsx server.ts` / Next `prepare()`) lokal >3 min ohne Listen — Audit blockiert bis Server healthy

## Phase Q — Portrait-Batching + Home Cold + Cache-Wiring (2026-07-07)

### 1. Spielerprofil Portrait-Batching (P1)

- **`BudgetedMediaImage`:** Intersection-Observer (120px rootMargin) + bestehendes `portrait-load-budget` (max 4 concurrent); Prop `eager` für Hero-Portraits
- **`PlayerDetailDrawer`:** Hero-Portrait über `BudgetedMediaImage` mit `eager`
- **`FoundationShellRouterBody` Spieler-Tabelle:** rohe `<img>` → `BudgetedMediaImage` (lazy, viewport-gated) — behebt 79-Portrait-Sturm beim warm reopen (Zwischenschritt über Spieler-Tab)
- **`FoundationPlayersTableBody`:** ebenfalls `BudgetedMediaImage`

### 2. Home cold start (P2)

- **Office-Gates:** HQ-Inbox/Finance/Morale/Readiness/Player-Demands nur bei `homeV2Tab === "office"`
- **Overview-Defer (Phase Q Rest):** `homeV2OverviewHeavyReady` via `requestIdleCallback` — League-Heat-Pools + Top-Player-Forecasts erst nach erstem Idle (max 1,5 s)
- **Heat-Pool-Gate:** `shouldBuildFoundationLeagueHeatPools` für `homeV2` nur Overview + `homeV2OverviewHeavyReady`

### 3. Cache-Wiring (Rest)

- **`clearPrefetchedMatchdayArenaBaseKeys`** neben `invalidateMatchdayArenaSessionCache` in Matchday-Handlers
- **Training-Refresh:** `setCachedPlayerProfileData` in `refreshOpenPlayerProfileAfterTrainingChange`
- **Save-Wechsel:** `invalidatePlayerProfileSessionCache` + `invalidatePlayerAttributeSheetCache` in `loadSave` (`use-foundation-persistence-actions.ts`)

### 4. Runtime-Fixes (Foundation 500)

- Import `shouldBuildTeamsView` direkt aus `teams-view-derivations.ts`
- Prefetch-Arena: `selectedTeamId` statt TDZ `activeManagerTeamId`
- `createTriggerGlobalNext` nach `useFoundationCrossTabMatchdayLineup` (saubere Hook-Reihenfolge, kein Ref-Workaround)
- Tote `seasonTopPlayerRows`-Memos + `shouldBuildSeasonTopPlayerRows`-Gate entfernt
- `aiNeedsEngine`: Guard bei leerem `disciplineScores`

### 5. Portrait-Einheitlichkeit (Phase Q Fixes)

- **`FoundationPlayerPortraitCard`:** `BudgetedMediaImage` (eager bei Hero/high priority)
- **Scouting:** `ScoutingPriorityQueue` lazy, `ScoutingReportPanel` eager
- **Transfer-Sell-Modal:** `BudgetedMediaImage eager`

### Patterns (Portrait + Session-Cache)

| Use-Case | Komponente | Invalidierung |
|---|---|---|
| Listen/Grids (>6 Portraits) | `BudgetedMediaImage` lazy | — |
| Hero / Modal (1 Portrait) | `BudgetedMediaImage eager` | — |
| Team-Logos / Icons | raw `<img>` ok | — |
| Arena API bundles | `matchday-arena-session-cache` | Matchday-Advance + Prefetch-Dedupe-Clear |
| Profil-Drawer-Daten | `player-profile-session-cache` | Save-Wechsel, Signatur-Mismatch |
| Attribute-Sheet fetch | `hydrate-player-attribute-sheet` cache | Save-Wechsel |

### Re-Audit

- **Tests:** 36/36 grün (Cache, UI-Contracts, `ai-needs-engine`, `foundation-performance-architecture`, Home V2)
- **Perf-Audit:** Blockiert — `tsx server.ts` startet lokal nicht innerhalb 6 min (kein Listen auf :3000). Erwarteter Gewinn (Referenz V9): Spielerprofil warm 13,2 s / 79 APIs → ~4–8 sichtbare Portrait-Requests; START→Home schneller durch Idle-Defer

## Phase P — Arena + Spielerprofil (2026-07-07)

- **Arena session cache:** `matchday-arena-session-cache.ts` — `arena-base` + Resolve-Preview über Tab-Remount hinweg; Prefetch via `prefetchMatchdayArenaBase` (Lineup/Arena); Invalidierung in `cockpit-matchday-handlers.ts` nach Matchday-Advance/Auto-Run
- **Spielerprofil session cache:** `player-profile-session-cache.ts` + Attribute-Sheet-Cache in `hydrate-player-attribute-sheet.ts`; warm reopen ohne Re-Hydration bei gleicher Signatur

Referenz V10: [tab-performance-hotspots-v10-comparison.md](./tab-performance-hotspots-v10-comparison.md)

Siehe auch: [foundation-monolith-split-plan.md](./foundation-monolith-split-plan.md) — Gap zum 8k-Ziel Scope ~1,16k Z. nach Table-Prefs + Game-Flow + Season-Helper-Slice.
