# Foundation Tab Performance — V8 Warm vs Phase P (Post-Split)

Datum: 2026-07-02  
Branch: `pr/ui-einsatzliste-35-36`  
Commit-Basis: Phase P (Navigation Coalescing + Scope Dedup)

## Messkontext

| Lauf | Detail |
|---|---|
| **Browser-Tab-Audit (V10 full chain)** | Ausstehend — `npm run perf:foundation-v9 -- --base-url http://localhost:3000 --timeout-ms 120000` (Warm-Server, ~30–60 min) |
| **Backend-Smoke (Phase P0)** | `npm run perf:regression-smoke` — **ok** |
| **Contract-Gates** | 45/45 (performance-architecture + shell + transfermarkt + inbox + navigation-coalescing) |

### Regression-Smoke (2026-07-02, Phase P)

| Metrik | Wert | Budget |
|---|---:|---|
| derivations cache hit | **0 ms** | <50 ms |
| free-agent feed warm | **16 ms** | <500 ms |
| free-agent cold build | 1 169 ms | — |
| training page build | **1 232 ms** | <3 500 ms |

## Phase P — umgesetzte Hebel

| Phase | Änderung | Erwarteter Effekt |
|---|---|---|
| **P1** | `navigation-coalescing.ts` + `bindFoundationNavigationStart` → Auto-Persist-Pause; Version-Poll/`loadSave` skip während 4s Quiet Window | Weniger `/api/singleplayer-state`-Storms bei Tab-Wechsel |
| **P2** | `useSeasonStandRows` + `useTeamsViewRowDerivations` wired; ~260 Z. inline Memos entfernt | Weniger Main-Thread-Doppelarbeit; Scope **11 508 → 11 248 Z.** |
| **P3a** | Spielerprofil: `requestAnimationFrame` vor schwerem `buildPlayerDrawerDataFromGameState` | Skeleton/Loading-Panel schneller sichtbar |
| **P4** | `BudgetedMediaImage` für Spieler-Tab Team-Logos; `getRosterEntryCurrentSeasonSalary` exportiert | Portrait/Logo-Storm gedrosselt |
| **P5** | Scope-Reduktion (partial) | Gap 8k: **~3 248 Z.** verbleibend |

## Vergleichsziel (V8 best warm export — Referenz)

| Schritt | V8 warm | Phase-P-Ziel |
|---|---:|---:|
| Initial Home | 680 ms | <2 s |
| Arena → Saisonstand | 5 375 ms | <5 s |
| Teams → Spieler | 2 950 ms | <3 s |
| Spieler → Training | 30 593 ms (verify) | <8 s |

**Nächster Schritt:** V10 full chain audit nach Warmup committen; Ergebnisse in diese Tabelle eintragen.

Rohdaten-V9 (Cold/Broken): [tab-performance-hotspots-v9-comparison.md](./tab-performance-hotspots-v9-comparison.md)  
V8-Verify: [tab-performance-hotspots-v8-comparison.md](./tab-performance-hotspots-v8-comparison.md)
