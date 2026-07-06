# Foundation Tab Performance — V11 Baseline (Post Sprint I–N + P2 Teams Dedup)

Datum: 2026-07-06  
Branch: aktueller Working Tree  
Save (QA): `fresh-season-1-1783267090717-real-20260705`

## Architektur-Metriken (statisch)

| Metrik | V10 (2026-07-03) | V11 (2026-07-06) | Δ |
|---|---:|---:|---:|
| `use-foundation-shell-router-body-scope.tsx` | ~10.496 Z. | **~10.213 Z.** | **−283 Z.** |
| `FoundationShellRouterBody.tsx` | ~3.388 Z. | ~3.380 Z. | −8 Z. |

## Phase P2 — Teams Scope-Dedup (umgesetzt)

- **Neue Hooks:** `use-teams-contract-derivations.ts`, `use-teams-extended-panel-derivations.ts`
- **Erweitert:** `use-teams-panel-derivations.ts` (Roster-Spalten nur im Teams-Host)
- **Host:** `FoundationTeamsViewHost.tsx` berechnet Verträge, Extended-Panel, Roster-Spalten nur bei `activeView === "teams"`
- **Entfernt aus Scope:** tote HQ-Priority-Memos, doppeltes `rosterPlayersByOvr`, Contract-/AI-/Free-Agent-Memos, Scope-Hydration-State
- **Extrahiert:** `buildFoundationSeasonTableColumns()` → `season-table-column-defs.ts`

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

- Arena: Session-Cache für `arena-base` / Resolve (Abort on unmount bereits in `MatchdayArenaV2Client`)
- Home cold start: schwere Feeds hinter `shouldBuildHomeV2*` prüfen
- Monolith: weitere Handler-Cluster + Hook-Reconciliation Richtung ≤8k Scope

Referenz V10: [tab-performance-hotspots-v10-comparison.md](./tab-performance-hotspots-v10-comparison.md)

Siehe auch: [foundation-monolith-split-plan.md](./foundation-monolith-split-plan.md) — Gap zum 8k-Ziel Scope weiterhin ~2,2k Z. nach diesem Slice.
