# Foundation Tab Performance — V8 Warm vs V10 (Phase P)

Datum: 2026-07-03  
Branch: `pr/ui-einsatzliste-35-36`  
Commit-Basis: Phase P + Bugbot live-sync (`9f99c48`)

## Messkontext

| Lauf | Detail |
|---|---|
| **V10 Warm Chain** | `npm run perf:foundation-v9 -- --base-url http://localhost:3000 --no-start --timeout-ms 120000 --skip-home-direct` |
| **Dauer** | ~27 min (Warmup + Chain + Drilldown) |
| **Save** | `save-1783053839918-k9dd6k`, Team `A-A` |
| **Initial Home** | 21,2 s (warm server, frischer Save — kein Cold-Compile, aber Save-Bootstrap) |
| **Backend-Smoke** | `perf:regression-smoke` ok (Phase P) |

## Summary

| Metrik | V8 warm | V10 warm | Δ |
|---|---:|---:|---|
| Chain-Schritte gesamt (nav) | 16 vergleichbar | 21 (inkl. Lineup v2, Cockpit) | — |
| Schritte **<5 s** (Chain, ohne START) | 8 / 16 | **14 / 21** | +6 absolut |
| Schritte **<8 s** (Chain) | 13 / 16 | **18 / 21** | — |
| Schritte **slow (≥8 s)** | 3 | **2** (Home→Inbox, Spieler→Training) |
| Schritte **failed** | 1 (Inbox) | 2 (Generator, Admin — Dev-Tabs) |
| **Median Tab-Wechsel** (Chain ok) | ~4,8 s | **~4,1 s** | **−0,7 s** |
| **Gesamt Chain-Zeit** (SUM nav, ohne START) | ~97 s | **~108 s** | +11 s (mehr Steps) |

## Delta — Kern-Nav (V8 warm vs V10)

| Schritt | V8 warm (s) | V10 warm (s) | Δ (s) | Δ (%) | Gate | Status |
|---|---:|---:|---:|---:|---|---|
| Initial Home | 0,68 | 21,16 | +20,5 | — | <2 s | fail (Save-Bootstrap) |
| Arena → Saisonstand | 5,38 | 6,17 | +0,79 | +15% | <5 s | **fail** → Q4 |
| Saisonstand → Teams | 10,70 | 3,32 | **−7,38** | **−69%** | <8 s | pass |
| Teams (revisit) | 2,96 | 3,29 | +0,33 | +11% | — | ok |
| Teams → Spieler | 2,95 | 4,50 | +1,55 | +53% | <3 s | **fail** → Q3 |
| Spieler → Training | 5,56* | 22,41 | +16,85 | +303% | **<8 s** | **fail** → **Q2** |
| Training → Gebäude | 5,55 | 5,00 | −0,55 | −10% | <8 s | pass |
| Gebäude → Training (revisit) | 4,27 | 3,24 | −1,03 | −24% | — | pass |
| Gebäude → Transfermarkt | 12,30 | 5,34 | **−6,96** | **−57%** | <8 s | pass |
| Transfermarkt → Scouting | 4,36 | 4,14 | −0,22 | −5% | — | ok |
| Diszis → Sponsoren | 12,15 | 7,99 | **−4,16** | **−34%** | <8 s | pass |

\*V8 warm chain; V8 verify war 30,6 s — V10 22,4 s ist besser als Verify, schlechter als V8 warm.

## Drilldown-Gates

| Schritt | V10 (s) | Gate | Status |
|---|---:|---|---|
| Spielerprofil (cold) | 20,57 | <5 s | **fail** → Q3b |
| Spielerprofil (warm) | 30,88 | — | slow (Media-Storm 72 API) |

## Gate-Matrix → Wellen

| Welle | Auslöser (V10) | Aktion |
|---|---|---|
| **Q1** Teams-Host | Strukturell (P2 offen); Saisonstand→Teams bereits pass | Host-Wiring trotzdem — Scope entlasten |
| **Q2** Training | Spieler→Training **22,4 s** ≥8 s | Training-Host / Hook aus Scope |
| **Q3** Spieler | Teams→Spieler 4,5 s ≥3 s; Profil cold 20,6 s | Players-Host + Profil async |
| **Q4** Netzwerk | Arena→Saisonstand 6,2 s ≥5 s | Prefetch / Media prüfen |
| **Q5** Scope | 11.310 Z. >8k | Context-Cleanup, Stubs entfernen |

Hard Gate **≥12/16 <5 s warm:** auf vergleichbarer 16er-Kernroute **8/16** — **nicht erreicht** (Initial Home + Inbox + Training + Arena→Saisonstand dominieren).

## Phase P — Hebel vs Messung

| Phase | Erwartung | V10 Beobachtung |
|---|---|---|
| P1 Quiet Window | Weniger API-Storms | Transfermarkt −57%, Saisonstand→Teams −69% |
| P2 Dedup (partial) | Teams Main-Thread | Saisonstand→Teams stark; Scope-Host noch offen |
| P3a Profil rAF | Profil <5 s | Cold 20,6 s — unzureichend |
| P4 Media Budget | Portrait-Storm | Teams revisit 31 API (Logos); Profil warm 72 API |

## Post-Q1 (2026-07-03)

| Änderung | Status |
|---|---|
| **Q1 Teams-Host** | `FoundationShellRouterTeams` in Body; Teams-Derivations → Host; `onHydrationPhaseChange` |
| **Q4 Router-Shell** | SeasonPreview, HistoryV2, MatchdayResult inline → Host-Router |
| **Q2 (partial)** | Training-Prefetch nur noch `requestIdleCallback` auf Spieler-Tab; **Training-Host offen** (22,4 s Gate) |
| **Q3 (partial)** | Profil rAF/hydrate vorhanden; **Players-Host offen** (Teams→Spieler 4,5 s) |
| **Q5** | Migration-Preview-Stub entfernt; Scope **11.372 Z.** / Body **6.837 Z.** |
| Re-Audit post-Q1 | Dev-Server nicht erreichbar während Lauf — V10-Baseline oben gültig |
