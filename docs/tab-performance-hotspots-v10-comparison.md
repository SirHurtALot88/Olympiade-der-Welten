# Foundation Tab Performance — V8 Warm vs V10 Phase P

Datum: 2026-07-03  
Branch: `pr/ui-einsatzliste-35-36`  
Commit-Basis: `9f99c48` (Phase P + Bugbot live-sync fix)  
Save: `fresh-season-1-1783052481107`, Team: `R-R`

## Messkontext

| Lauf | Detail |
|---|---|
| **V10 Warm Chain** | `npm run perf:foundation-v9 -- --base-url http://localhost:3000 --no-start --timeout-ms 180000 --skip-warmup=true` |
| **Warmup** | Manuell (Dev-Server ~40 min idle nach Compile); Script-Warmup entfiel wegen vorherigem goto-Timeout unter Last |
| **Dauer** | ~72 min (36 Messungen: 21 chain + 15 drilldown) |
| **Backend-Smoke** | `perf:regression-smoke` — **ok** (derivations 0 ms, training build <3.5 s) |
| **Contract-Gates** | 41/41 (navigation + performance-architecture + shell + transfermarkt) |

Rohdaten: [tab-performance-hotspots-v9.csv](./tab-performance-hotspots-v9.csv) · JSON: [latest-v9.json](../outputs/foundation-tab-performance-audit/latest-v9.json)

---

## Summary-Statistik (Chain-only, 21 Schritte)

| Metrik | V8 warm | V10 warm | Δ |
|---|---:|---:|---|
| **Schritte <5 s (ok)** | 10 / 16 vergleichbar | **10 / 16** | = |
| **Schritte <8 s (ok+slow)** | 13 / 16 | **11 / 16** | −2 |
| **Failed (≥ timeout / stuck UI)** | 1 (Home→Inbox in Roh-V8) | **5** (Cascade ab Saisonstand→Teams) | schlechter |
| **Median Tab-Wechsel (ok chain)** | ~4,3 s | **~3,6 s** | **−0,7 s** |
| **Summe ok chain-Schritte** | ~62 s | **~48 s** | **−14 s (−23 %)** |

**Hinweis:** V10-Lauf brach nach `Saisonstand→Teams` (Teams-View-Ready 30 s) in eine Failure-Cascade; nachfolgende Chain-Schritte sind nicht vergleichbar. Drilldowns zeigen Training/Teams-Stau.

---

## Hard Gates — Pass/Fail

| Gate | Ziel | V10 | Status |
|---|---|---|---|
| ≥12/16 Chain-Schritte <5 s warm | ≥12 | **10** (vor Cascade) | **FAIL** |
| Arena → Saisonstand | <5 s | **5,02 s** | **FAIL** (knapp, −0,36 s vs V8) |
| Teams → Spieler | <3 s | **failed** (180 s timeout) | **FAIL** |
| Spieler → Training | <8 s | **293 s failed** | **FAIL** |
| Spielerprofil open (cold) | <5 s | **39,6 s** | **FAIL** |
| Initial Home | <2 s | **16,6 s** | **FAIL** (Dev-Compile-Last) |

**Fazit:** Phase P verbessert vergleichbare Warm-Pfade (Arena→Saisonstand, Transfermarkt-Route, Training-Revisit), erreicht aber **keinen Hard-Gate-Abschluss** — Teams-Hydration und Spieler→Training blockieren.

---

## Sekunden-Delta: V8 warm vs V10 warm (Chain)

| Schritt | V8 warm (s) | V10 warm (s) | Δ (s) | Δ (%) | Gate |
|---|---:|---:|---:|---:|---|
| Initial Home | 0,68 | **16,63** | +15,95 | +2344 % | <2 s ✗ |
| Home → Inbox | — (fail) | **0,88** | — | — | ok ✓ |
| Inbox → Einsatzliste | 2,95 | **1,50** | −1,45 | −49 % | ✓ |
| Einsatzliste → Arena | 5,64 | **3,83** | −1,81 | −32 % | ✓ |
| **Arena → Saisonstand** | **5,38** | **5,02** | **−0,36** | **−7 %** | <5 s ✗ (knapp) |
| Saisonstand → Teams | 10,70 | **32,76 (fail)** | +22,06 | +206 % | ✗ |
| Teams → Spieler | 2,95 | **failed** | — | — | ✗ |
| **Spieler → Training** | **30,59** (verify) | **293 (fail)** | — | — | <8 s ✗ |
| Training → Gebäude | 8,16 (verify) | **16,33** | +8,17 | +100 % | ✗ |
| Gebäude → Training (revisit) | 4,27 | **2,60** | **−1,67** | **−39 %** | ✓ |
| **Gebäude → Transfermarkt** | **12,30** | **4,21** | **−8,09** | **−66 %** | ✓ |
| Transfermarkt → Scouting | 4,36 | **3,87** | −0,49 | −11 % | ✓ |
| Scouting → Historie | 4,29 | **3,43** | −0,86 | −20 % | ✓ |
| Historie → Ranks | 6,57 | **3,62** | −2,95 | −45 % | ✓ |
| Ranks → Diszis | 4,76 | **3,68** | −1,08 | −23 % | ✓ |
| Diszis → Sponsoren | 12,15 | **13,48** | +1,33 | +11 % | ✗ |
| Sponsoren → Lexikon | 5,43 | **4,35** | −1,08 | −20 % | ✓ |

---

## Drilldown (Auszug)

| Schritt | V10 (s) | Gate <5 s |
|---|---:|---|
| Spielerprofil (cold) | 39,6 | ✗ |
| Spielerprofil (warm) | 39,8 | ✗ |
| Spieler-Tab overview | 0,36 | ✓ |
| Spieler-Tab contract | 4,17 | ✓ |

---

## Phase P — umgesetzte Hebel (Referenz)

| Phase | Status | Beobachtung im V10-Lauf |
|---|---|---|
| **P1** Navigation Coalescing | committed | Arena→Saisonstand leicht schneller; Training-Route weiterhin blockiert |
| **P2** Scope Dedup | partial | Teams-View-Ready-Timeout — Host-Wiring offen |
| **P3a/b/c** Profile/Settings | committed | Contract-Tab 4,2 s ok |
| **P4** Media Budget | committed | Transfermarkt-Route −8 s vs V8 |
| **P5** Scope ≤8k | partial | 11.309 Z. (Import cleanup) |
| **Bugbot** live-sync | `9f99c48` | Signatur erst nach Reload |

---

## Nächste Schritte

1. **P2 Host-Wiring** — `FoundationShellRouterTeams` statt inline Panel; Teams-Derivations nur im Host
2. **Re-Audit** nach P2: Arena→Saisonstand, Saisonstand→Teams, Spieler→Training
3. **Spieler→Training** — Training-Compact-Ready + Main-Thread (P1 Quiet Window greift, UI blockiert trotzdem)

V8-Referenz: [tab-performance-hotspots-v8.md](./tab-performance-hotspots-v8.md)
