# Multiseason-Feedback S1→S5 (Realistic Long-Run)

**Lauf:** S1–S5 vollautomatisch über `run-resilient-multiseason.ts` (season-by-season, fix-and-resume).
**Datum:** 28.06.2026
**Save:** `fresh-season-1-1782677167840` (S1-Draft-Start nach Spend-Policy-Fix)
**Output:** `outputs/realistic-5y/fresh-season-1-1782677167840-20260628-223008/`

## Pre-Fatigue-Fix Baseline (Buy/Sell abgeschlossen, Juli 2026)

Referenz für den nächsten Balancing-Block (Audit + Fatigue/Reha/Training):

| Metrik | Wert | Quelle |
| --- | ---: | --- |
| Save (Ende S2) | `fresh-season-1-1783539770321` | `outputs/s1-s2-transfer-smoke-2026-07-08T19-42-49/` |
| S2→S3 W-L Markt-P/L (vor Fix) | −60,5M (7 Verkäufe) | `outputs/next-season-2026-07-08T20-24-29/` |
| S2→S3 W-L Markt-P/L (nach Fresh-Buy-Tendenz) | −23,1M (4 Verkäufe) | `outputs/next-season-2026-07-08T21-20-05/` |
| Reha L1+ (Fix-Run S2 Preseason) | 2/32 | Fix-Run 29.06.2026 unten |
| Ø Fatigue S1–S5 | ~81 | v1 Realistic-Run |
| trainingMode none (S5 Ende) | 43 | v1 Realistic-Run |

Audit-Befehle:

```bash
npx tsx scripts/multiseason-final-audit.ts --save-id <save-id>
npx tsx scripts/export-fatigue-injury-audit.ts --save-id <save-id>
npx tsx scripts/dump-facility-levels.ts --save-id <save-id>
```


| Phase | Wie | Status |
| --- | --- | --- |
| S1 | `long-run-sandbox` STOP_AFTER=season_end, Draft via `picks-run` | 10/10 MD, `season_completed` |
| S2–S5 | Resilient Orchestrator (8 GB heap, kein Dev-Server) | `season-5 / season_completed` |
| S5 Champion | **The Chantry** (T-C) | 10 Matchdays resolved |

- `historyHasS1ToFinal = [season-1 … season-4]`, `seasonHistorySnapshots = 4` → volle Kette S1→S5.
- `openTechnicalBugs = []` am Laufende.
- **Slot-Policy (neu):** Unbesetzte Lineup-Slots blockieren nicht (`missing_slots` → WARN, kein Sim-Stop). Harte Blocker nur bei Duplikat/Form/Context.
- **Fixes während des Laufs:** Soft-Blocker-Filter (S1-Roster-Repair), Training-Modus-Backfill, V-D women-only Hard-Block + Saison-Ende-Repair.

## Gesamturteil pro Dimension

| Dimension | Urteil | Kurzfazit |
| --- | --- | --- |
| Ökonomie | **PASS** | 0 Teams negativ; Cash Σ 2.128 · Median 52 · max 153 (C-C) |
| Verträge | **PASS / WARN** | S5: 38 Renewals, 55 Exits; `contracts[]` leer im Terminal-Snapshot (S5 final) |
| GMs | **PASS** | 32/32 GMs, 0 Dismissals |
| Training/Potential | **PASS / WARN** | **100 % Potential ≥ CA (293/293)**; 43 Spieler ohne Trainingsmodus am Ende |
| Transfers/Identity | **PASS** | V-D + D-P Identity ok; ausgeglichenere Kadenz S2–S5 |
| Fatigue/Injury | **PASS / WARN** | Pipeline aktiv (2.715 Injury-Events kumuliert); Ø Fatigue 81, viele Teams bei 100 |
| Slot-Coverage/Lineups | **PASS** | 0 harte Slot-Blocker; offene Slots nur WARN |

---

## 1. Ökonomie — PASS

- `negativeCashTeams = 0` über den gesamten Lauf ✓
- `transferFinanceViolations = []`, `cashEconomyViolations = []` ✓
- Cash am Ende: min **6** (T-G) · Median **52** · max **153** (C-C) · Summe **2.128**
- S5: `totalPrizeMoney 1.431`, `totalSalary 1.540`, `aiMarketStatus applied`
- Kein extremes Cash-Hoarding wie im früheren UI-Lauf (max 153 vs. früher 357)

---

## 2. Verträge — PASS / WARN

- S5 Saison-Ende: **38 Renewals**, **55 Contract-Exits**; `highContractRiskRows 125`, `pressureSellRows 210`.
- `contracts[]` im Terminal-Snapshot leer (`total 0`) — plausibel, weil S5 final und kein S6-Preseason lief.
- **UI-Prüfpunkt:** Save laden, eine Saison ins Preseason → `contracts[]` neu befüllt?

---

## 3. GMs — PASS

- 32/32 GM-Assignments, `influencePct` einheitlich **30 %**, **0 Dismissals**.
- Planner-Convergence zeigt weiterhin differenzierte Strategien (`win_now_push`, `depth_repair`, `roster_repair` je nach Team-Lage).

---

## 4. Training / Potential — PASS / WARN

- **Potential ≥ CA: 293 / 293 = 100 %** ✓
- Trainingsmodi am Ende: `leicht 223 / hart 11 / mittel 16 / none 43` — Backfill greift in Preseason, aber 43 ohne Modus bleiben (Neuzugänge/Edge-Cases).
- `avgFatigue 81`, `organicEver 39/293` — Fatigue/Injury-Pipeline läuft sichtbar.

### Fatigue/Injury (neu getrackt)

| Saison | Injury Events | Ø Fatigue |
| --- | ---: | ---: |
| S1 | 209 | 81 |
| S2 | 610 | 81 |
| S3 | 490 | 81 |
| S4 | 683 | 81 |
| S5 | 723 | 81 |

497/2984 Spieler mit `injuryHistory`. Report: `fatigue-injury-multiseason-report.md`.

**WARN:** Fatigue dauerhaft hoch (P90 oft 100) — Rotation/Recovery weiter beobachten.

---

## 5. Transfers / Identity — PASS

### Transferaktivität (`transferHistory`)

| Saison | Buy | Sell | Contract-Exit | Buy-Volumen |
| --- | --- | --- | --- | --- |
| S1 | 353 | 10 | 97 | 7.432 |
| S2 | 163 | 18 | 72 | 2.850 |
| S3 | 34 | 17 | 38 | 462 |
| S4 | 71 | 19 | 53 | 1.117 |
| S5 | 73 | 22 | 55 | 1.121 |

Kadenz deutlich gleichmäßiger als im früheren UI-Lauf (kein S4-Freeze, kein S5-Explosionsschub allein).

### Identity-Treue (Final-Audit)

- **D-P:** 6/6 gezählt weiblich (100 %) → **PASS** (Min 65 %, Ziel 75 %).
- **V-D:** 7/7 gezählt weiblich (100 %) → **PASS** (nach Hard-Block im Transfermarkt + Saison-Ende-Repair). Ein männliches **Animal** (Voliwolf) als erlaubte Pet-Ausnahme.

---

## 6. Slot-Coverage / Lineups — PASS

- **Policy:** Offene Slots = „Pech fürs Team“ — kein Sim-Stop.
- S5 Guard: `unresolvedSlotCoverage 0`, `hardCoverageUnresolved 0`, `depthWarningRows 54`.
- Preseason-Audit S2–S5: `lineup_autoprep_ok` regelmäßig **WARN** (z. B. 311 Team×MD offene Slots in S2), Lauf lief trotzdem durch.
- `lineupBlockers 32` in S5-Summary bezieht sich auf Slot-Warnungen im Audit-Kontext, nicht auf Matchday-Abbruch.

---

## UI-Prüfpunkte

Save `fresh-season-1-1782677167840` (S5, `season_completed`) laden:

1. **Teams/Ökonomie:** Keine negativen Cash-Werte; Roster 8–12.
2. **V-D & D-P:** Roster auf Identity prüfen (sollte clean sein).
3. **Preseason S6:** `contracts[]` neu, Transferfenster öffnet.
4. **Fatigue/Injury:** Verletzte + hohe Fatigue in Teams-UI sichtbar?
5. **Lineups:** Teams mit offenen Slots — spielen trotzdem (kein Hard-Block)?

## Empfohlene Folge-Tickets

1. **Trainingsmodus-Backfill** nach allen Markt-Käufen (43 `none` am Ende eliminieren). — *Tech, mittel.*
2. **Fatigue/Rotation balancen** (Ø 81, viele Teams max 100). — *Balance, mittel.*
3. **GM-`influencePct` variieren** statt konstant 30 %. — *Enhancement.*
4. **D-P Richtung 75 %-Ziel** im Draft/Markt aktiv halten (aktuell PASS, aber knapp am Ziel). — *Tuning, niedrig.*

---

### Daten-Artefakte

- Output-Dir: `outputs/realistic-5y/fresh-season-1-1782677167840-20260628-223008/`
- Summary: `multi-season-s1-s6-summary.json`
- Fatigue/Injury: `fatigue-injury-multiseason-report.md`, `fatigue-injury-s1-s6.csv`
- Orchestrator: `scripts/run-resilient-multiseason.ts`
- Audit: `scripts/multiseason-final-audit.ts --save-id fresh-season-1-1782677167840 [--history]`

---

## Fix-Run S1→S2 (Ökonomie/Training/Reha-Paket)

**Datum:** 29.06.2026  
**Save:** `fresh-season-1-1782721125368`  
**Output:** `outputs/s1-s2-preseason-fix-20260629-101836/`  
**Fixes aktiv:** Draft-Puffer ×0.5 · Deploy-Floor-Pass · dynamischer Repair-Cap · Reha/Training-Guard · AI+GM Trainingsklassen

### S1 Draft

| Kennzahl | Fix-Run | v2-Run (Referenz) |
| --- | ---: | ---: |
| Cash Σ nach Draft | **408.1** | ~800+ (höheres Hoarding) |
| Liga MW Σ | 7512 | — |
| Kader ≥Min | 32/32 | 32/32 |
| Kader ≥Opt | 30/32 | — |
| Audit | PASS 9 · WARN 1 · RED 1 (`draft_spend_plausible` S-S 74%) | — |

Teams wie **M-M (2.3)**, **Z-H (0.2)**, **H-R (11.7)** starten nach Draft fast blank — Puffer-Halbierung greift.

### S1 Saisonende

| Kennzahl | Fix-Run | v2-Run |
| --- | ---: | ---: |
| Champion | **Zero Heroes (Z-H)** | Golden Gladiators |
| Matchdays | 10/10 | 10/10 |
| Buys / Sells / Exits | **352 / 17 / 98** | 354 / 11 / 99 |
| Buy-Fees Σ | 7512 | — |
| Cash Σ | **3249.8** (min 39 · max 188) | ~2739 |
| Injuries | **114** | 198 |
| Audit | PASS 10 · WARN 3 · RED 0 | PASS 10 · WARN 3 · RED 0 |
| Facilities S1 | 4 Upgrades | fast 0 |

Injuries **−42 %** vs. v2. Cash-Hoarding S1-Ende weiterhin hoch (Preisgeld/Sponsoren), aber Draft-Start deutlich ausgeglichener.

### S2 Preseason (nach Transfers, MD1)

| Kennzahl | Fix-Run | v2-Run |
| --- | ---: | ---: |
| Cash Σ | **2060.7** | 2247 |
| Cash Median / Max | **~61 / 187** (C-S) | — |
| MW Σ | 6094.5 | — |
| Kader ≥Min / ≥Opt | **32/32 · 9/32** | — |
| S2 Buys / Sells | **55 / 8** (24 Markt + 31 Repair) | 45 / 14 |
| S2 Buy/Sell-Fees | **1052 / 199** | 708 / 409 |
| Audit Preseason | PASS 6 · WARN 1 · RED 0 | — |
| Ø-Fatigue Preseason | **0.5** (Reset ok) | — |
| Facilities aktiv | **30/32** Teams, 60 Events | 20/32 |
| Reha L1+ | **2/32** (D-P, Z-H) | 1/32 |
| Scouting / Analytics | 29 / 21 Liga-Summe | 17 / 15 |
| Deploy Median | **74.6 %** | — |
| Teams `needsDeploy` | **8** (G-G, D-L, D-P, H-R, R-C, T-C, T-G, V-D) | viele undeployed |

**Spot-Teams S2 Preseason:**

| Team | Cash | MW | Gehalt | S2-K/V | Kommentar |
| --- | ---: | ---: | ---: | --- | --- |
| **M-M** | **10.7** | 334.6 | 79.9 | 3/0 | Deploy stark (216 % Bucket), teures Team fast blank ✓ |
| **H-R** | 60.9 | 227.4 | 65.2 | 1/0 | Über Ziel 20–30, aber deutlich weniger als C-S |
| **Z-H** | 18.8 | 327.1 | 88.5 | 3/0 | Reha + Scouting gebaut |
| **C-S** | **186.6** | 174.5 | 48.1 | 0/0 | `strategic_hoard` — kein Deploy-Zwang |
| **G-G** | 103.6 | 189.5 | 57.8 | 0/0 | Deploy-Floor unmet (0 % Bucket) |

### Training / Klassen

- AI setzt **Trainingsmodi + Trainingsklassen** via Manager-Plan (`set_player_training_classes`).
- Preseason-Audit: `training_manager_applied` PASS.
- Training-Modi (Snapshot nach wenigen S2-MDs): leicht **141**, hart **81**, mittel **62** — deutlich mehr Schonung vs. v2-Hard-Training-Welle.
- Vorsaison-Stress blockt Hard-Team-Intensity; Per-Player-Load deckelt bei `prevSeasonStress`.

### Offene Punkte (nächster Tuning-Schritt)

1. **8 Teams** unter Deploy-Floor — Deploy-Pass braucht härtere Erzwingung wenn Markt keine Käufe findet (G-G, R-C, T-C).
2. **C-S / strategic_hoard** — 187 Cash; Doctrine-Opt-out zu großzügig?
3. **Reha 2/32** — besser als v2, aber noch unter Ziel; Vorsaison-Bias braucht evtl. stärkeres Gewicht ab S3.
4. **Kader ≥Opt nur 9/32** — Repair/Markt füllt Min, Opt-Fill fehlt.
5. S2-Lauf lief nach Preseason-Checkpoint kurz weiter (MD6) — Save-State für Live-Tests ggf. frischen Preseason-Checkpoint nutzen.

### Reproduktion

```bash
export OUT=outputs/s1-s2-preseason-fix-$(date +%Y%m%d-%H%M%S)
OLY_LONG_RUN_OUTPUT_DIR="$OUT" OLY_LONG_RUN_STOP_AFTER=draft node --import tsx scripts/long-run-sandbox-s1-s6.ts
OLY_LONG_RUN_SAVE_ID=<id> OLY_LONG_RUN_FINAL_SEASON=1 OLY_LONG_RUN_STOP_AFTER=season_end OLY_LONG_RUN_OUTPUT_DIR="$OUT" node --import tsx scripts/long-run-sandbox-s1-s6.ts
OLY_LONG_RUN_SAVE_ID=<id> OLY_LONG_RUN_FINAL_SEASON=2 OLY_LONG_RUN_OUTPUT_DIR="$OUT" node --import tsx scripts/long-run-sandbox-s1-s6.ts
# Stop nach `long-run-feedback-preseason-<id>.md`
```

---

## Opt+Hoarder-Run S1→S2 (Planner-Target + Dynamic Reserve)

**Datum:** 29.06.2026  
**Save:** `fresh-season-1-1782726659026`  
**Output:** `outputs/s1-s2-opt-hoard-20260629-115049/`  
**Fixes aktiv:** `getTeamPlannerRosterTarget` · Convergence bis Planner-Target · `resolveTeamCashRunwayReserve` (~1× Gehalt für Hoarder) · `eco_round` nicht mehr Strategic-Hoard · Repair-Opt nur bei exhausted Convergence

### Vergleich S2 Preseason (nach Transfers)

| Kennzahl | Fix-Run | Opt+Hoarder | Ziel |
| --- | ---: | ---: | ---: |
| Kader ≥Min / ≥Opt | 32/32 · **9/32** | 32/32 · **9/32** | ≥28/32 Opt |
| Cash Σ | 2061 | **2292** | <2500 |
| Cash max (C-S) | **187** | **157** | ~45–70 |
| C-S Kader / Gehalt | 8/12 · 48 | **12/12 · 58** | Opt + ~1× Gehalt |
| C-S S2-Transfers | 0/0 | **Käufe ~86 Fees** | Deploy über Reserve |
| Emergency Repair | 31 Buys | **23 above_min_below_opt** in Repair-CSV | ≤5 Buys |
| Ø-Fatigue Preseason | 0.5 | **2.5** | Reset ok |
| Facilities aktiv | 30/32 | **24/32** | — |

### Was sich verbessert hat

- **C-S:** Erreicht Opt (12/12), kauft wieder (~86 Fees), Cash von 187 → 157 — `eco_round`-Deploy-Opt-out weg.
- **H-R / L-K / L-R:** Starkes Deploy (Cash 7–18 bei vollem Opt-Kader).
- Convergence-Logik zielt formal auf Planner-Target; Reserve-Formel im Budget-Plan aktiv.

### Was offen bleibt

1. **≥Opt weiterhin nur 9/32** — Markt-Convergence exhausted bei 23 Teams mit `above_min_below_opt`; Planner-Target allein reicht nicht, wenn Buy-Gates/Coverage blockieren.
2. **C-S Cash ~2,7× Gehalt** — Reserve senkt Puffer, aber Transfer-Budget wird nicht voll ausgeschöpft; Ziel ~1× Gehalt verfehlt.
3. **G-G / N-W / R-C** — weiter hoher Cash, 0 Preseason-Fees, unter Opt.
4. Liga-Cash Σ leicht **höher** als Fix-Run (2292 vs. 2061).

### Spot-Teams S2 Preseason

| Team | Kader | Cash | Gehalt | Fees | Kommentar |
| --- | ---: | ---: | ---: | ---: | --- |
| **C-S** | 12/12 | 157 | 58 | 86 | Opt ✓, deployt, Puffer noch zu hoch |
| **M-M** | 8/10 | 80 | 56 | 13 | Unter Opt, weniger blank als Fix (11) |
| **H-R** | 10/10 | 7 | 70 | 43 | Deploy stark ✓ |
| **G-G** | 8/12 | 155 | 47 | 0 | Hoard + kein Opt-Fill |

### Reproduktion

```bash
export OUT=outputs/s1-s2-opt-hoard-$(date +%Y%m%d-%H%M%S)
OLY_LONG_RUN_OUTPUT_DIR="$OUT" OLY_LONG_RUN_STOP_AFTER=draft node --import tsx scripts/long-run-sandbox-s1-s6.ts
OLY_LONG_RUN_SAVE_ID=<id> OLY_LONG_RUN_FINAL_SEASON=1 OLY_LONG_RUN_STOP_AFTER=season_end OLY_LONG_RUN_OUTPUT_DIR="$OUT" node --import tsx scripts/long-run-sandbox-s1-s6.ts
OLY_LONG_RUN_SAVE_ID=<id> OLY_LONG_RUN_FINAL_SEASON=2 OLY_LONG_RUN_OUTPUT_DIR="$OUT" node --import tsx scripts/long-run-sandbox-s1-s6.ts
```

Artefakte: `long-run-feedback-preseason-*.md`, `preseason-emergency-roster-repair-season-2/chunked-redraft-team-status.csv`

---

## Market-Slot Fast Audit (Liga-Quantile Bänder)

**Datum:** 29.06.2026  
**Clone:** `fresh-season-1-1782726659026` → `save-1782731406359-oykk53`  
**Output:** `outputs/pick-audit-preseason-20260629-131005/`  
**Pipeline:** S1-End-Clone · S2→S3 Preseason-Setup · Scenario (Cash ±20 % Median, Rank ±3) · `runMarketPlanConvergence` 2×4 · **kein** Emergency-Repair-Script

**Code:** `lib/ai/ai-market-slot-plan-service.ts` · Planner-Wiring non-S1 · Runway-Reserve als einziger Post-Kauf-Puffer · `scripts/pick-audit-preseason-fast.ts`

### Liga-Anker (FA-Pool)

| Quantil | MW |
| --- | ---: |
| q50 | 14.46 |
| q65 | 18.81 |
| q85 | 32.28 |

### Gesamt-KPIs

| Kennzahl | Wert | Ziel v1 |
| --- | ---: | --- |
| Teams ≥ Opt | **14/32** | realistisch, nicht 28/32 |
| Convergence Buys/Sells | 18 / 12 | — |
| Star-Lane &lt; q85 | **0** | PASS |
| G-G max Pick ≥ q65 bei spendable ≥ q65 | **56.14** | PASS |
| Repair-Buys (source=*repair*) | **2** | 0 (noch offen) |

### Spot-Teams vs. Opt+Hoarder-Run

| Team | Kader | Cash nach | Spendable vor | Buys | avg Pick MW | max Pick MW | ≥ Opt | vs. Opt+Hoarder |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| **C-S** | 12/12 | 185 | 133 | 2 | 20.2 | 25.8 | ✓ | kauft wieder, Cash höher als Ziel |
| **G-G** | 12/12 | 84 | 73 | 2 | 37.5 | **56.1** | ✓ | **Opt ✓ + 2 Käufe** (vorher 8/12, 0 Fees) |
| **M-M** | 10/9 | 24 | 0 | 0 | — | — | ✓ | bereits Opt, kein Cash-Headroom |
| **H-R** | 10/10 | 16 | 0 | 0 | — | — | ✓ | bereits Opt |

### Fazit

- **Markt-Bänder funktionieren:** G-G kauft im Core-Band (max 56 MW ≫ q65=19), kein Pseudo-Star unter q85.
- **C-S** deployt wieder mit höheren Pick-Preisen (avg ~20 vs. früher cheap tier ~15–20 Cap).
- **14/32 Opt** — besser als 9/32, aber noch nicht Liga-Ziel; viele Teams starteten bereits am/über Opt.
- **Offen:** 2 `ai_roster_fill`-Buys im Audit (kein dediziertes `--no-repair` im Convergence-Pfad); C-S Cash-Puffer weiter über 1× Gehalt.

### Reproduktion

```bash
export OUT=outputs/pick-audit-preseason-$(date +%Y%m%d-%H%M%S)
OLY_PICK_AUDIT_OUTPUT_DIR="$OUT" \
OLY_PICK_AUDIT_CLONE_FROM=fresh-season-1-1782726659026 \
node --import tsx scripts/pick-audit-preseason-fast.ts
```

Artefakte: `pick-audit-teams.csv`, `pick-audit-slots.csv`, `pick-audit-picks.csv`, `pick-audit-rejected.csv`, `pick-audit-summary.md`

---

## Audit v2 — Implementierung (Juli 2026)

**Status:** Balancing-Block implementiert (Audit-Instrumentierung, Reha/Training/Fatigue, Verträge). **Full S1→S5 Resilient-Run** steht als manueller Follow-up aus (~1–2h Laufzeit).

### Umgesetzt

| Bereich | Änderung |
| --- | --- |
| Audit | `multiseason-final-audit.ts`: `leagueKpis` (Reha, Fatigue, trainingMode none, deploy %) |
| Audit | `export-fatigue-injury-audit.ts`: `--save-id`, `--output-dir` |
| P0 | Facility-Gate RED bei `events=0 && teams<4`; Preseason-API `set_player_training_classes` |
| Reha | Stärkerer Score/Threshold, Budget-Reserve, Reha-first Deploy-Sort |
| Fatigue | Recovery 20→24, Load 12→11, Reha-Bonus L1 +3, Lineup-Rotation stärker |
| Training | Backfill bei Buy; differenzierter Modus bei hoher Fatigue |
| Verträge | `extend_core` → Renew auch bei Grenzfällen |

### Baseline KPI (Save Ende S2, vor neuem Lauf)

Save: `fresh-season-1-1783539770321` · `outputs/s1-s2-transfer-smoke-2026-07-08T19-42-49/`

| KPI | Baseline |
| --- | ---: |
| Reha L1+ | 0/32 |
| trainingMode none | 53 |
| Ø Fatigue (Preseason) | 0 |
| Facility events | 39 |
| Teams mit Gebäuden | 23/32 |

### Ziel KPI v2 (nach Resilient-Run)

| KPI | Ziel |
| --- | ---: |
| Reha L1+ | ≥ 8/32 |
| Ø Fatigue Saisonende | < 65 |
| trainingMode none | 0 |
| Contract-Exits S1–S5 | < 250 |

```bash
npx tsx scripts/run-resilient-multiseason.ts --fresh --seasons 5 --output-dir outputs/resilient-s1s5-<timestamp>
npx tsx scripts/multiseason-final-audit.ts --save-id <new-save> --history
npx tsx scripts/export-multiseason-rebuy-report.ts --save-id <new-save> --output-dir outputs/resilient-s1s5-<timestamp>
```

---

## Audit v3 — Fresh S1→S5 (Juli 2026)

**Status:** **SUCCESS** — Save `fresh-season-1-1783576078834`, Output [`outputs/resilient-s1s5-2026-07-09T07-50-00/`](outputs/resilient-s1s5-2026-07-09T07-50-00/), Audit [`outputs/multiseason-final-audit-fresh-season-1-1783576078834.json`](outputs/multiseason-final-audit-fresh-season-1-1783576078834.json).

S1–S5 `season_completed`. S5 pausierte einmal bei `roster_min_before_md1` (P-C 7/8) → Fix + Resume erfolgreich.

### KPI v3 vs. Ziel

| KPI | Ziel v2 | Ergebnis v3 | Urteil |
| --- | ---: | ---: | --- |
| Reha L1+ | ≥ 8/32 | **12/32** | PASS |
| Ø Fatigue (S5 Ende) | < 65 | **70.3** | WARN (v1: ~81) |
| trainingMode none | 0 | **0** | PASS |
| Contract-Exits S1–S5 | < 250 | **365** | WARN |
| Teams mit Gebäuden | ≥ 4 | **31/32** | PASS |
| Facility events | > 0 | **317** | PASS |
| Rebuy-Paare (cross-season) | messen | **39** (20 Teams) | dokumentiert |
| Same-Season-Rebuy | 0 erwartet | **0** | PASS |

### Rebuy-Highlights (Top 3)

| Team | Spieler | Saisons gekauft |
| --- | --- | --- |
| L-K | Grossmutter Igid | S1, S3, S4, S5 (4×) |
| U-A | Cpt Sleepers | S1, S3, S4, S5 (4×) |
| C-C | Kyras | S3, S4, S5 (3×) |

Vollständiger Report: `outputs/resilient-s1s5-2026-07-09T07-50-00/multiseason-rebuy-report.json`

Resume bei Pause:
```bash
NODE_OPTIONS="--max-old-space-size=8192" OLY_LONG_RUN_ALLOW_DEV_SERVER=1 \
  npx tsx scripts/run-resilient-multiseason.ts \
  --save-id fresh-season-1-1783576078834 --seasons 5 \
  --output-dir outputs/resilient-s1s5-2026-07-09T07-50-00
```

### Speicher-Cleanup (Retention)

| Behalten | Grund |
| --- | --- |
| `outputs/s1-s2-transfer-smoke-2026-07-08T19-42-49/` | Letzter Buy/Sell-Smoke |
| `outputs/next-season-2026-07-08T21-20-05/` | Letzter S2→S3-Lauf |
| `outputs/multiseason-final-audit-fresh-season-1-1783539770321.json` | Referenz-Audit |
| `outputs/s1-draft-baseline.sqlite` | Draft-Baseline |
| Neuer Run `outputs/resilient-s1s5-*` | Aktueller v3-Lauf |

~18 GB alte `outputs/` gelöscht via `scripts/prune-old-outputs.ts --apply`.

### Neue Features in v3

| Feature | Datei | Kurz |
| --- | --- | --- |
| Rebuy-Report | `lib/season/multiseason-rebuy-report.ts` | Zählt `(team, player)`-Mehrfachkäufe über Saisons |
| Morale Memory v1 | `lib/morale/player-morale-service.ts` | Free Agents: früheres Team → block / +18% Gehalt / −6% bei Loyalität |
| `--fresh` Bootstrap | `scripts/run-resilient-multiseason.ts` | S1-Draft via `long-run-sandbox` STOP_AFTER=draft |

### Morale Memory v1 (bewusst MVP)

- **Gilt nur:** Free Agent kauft zurück bei **demselben** Team (`playerMoraleState.teamId === buyer`)
- **Block:** Morale <22 (ohne `loyal`-Trait) → `morale_refuses_former_team`
- **Premium:** Morale <34 → Gehalt ×1.18
- **Rabatt:** Morale ≥75 → Gehalt ×0.94
- **Offen:** Cross-Team-Groll, AI-Pick-Scoring, Verhandlungs-UI

### RED-Fix-Tabelle v3

| Audit-RED | Fix-Strategie | Status |
| --- | --- | --- |
| `facilities_active` | Reha-Score + Deploy (Phase 2) | implementiert, nach Run prüfen |
| `training_manager_applied` | Backfill bei Buy + Preseason-API | implementiert |
| `roster_min_before_md1` | Post-Preseason Emergency-Repair + `OLY_ENABLE_EMERGENCY_REPAIR=1` | **fix v3** (S5 P-C) |
| `organic_peak_net_corridor` | Auto-Tune organic (iterate profile) | S4 auto-tuned, continued |
| `identity_coherence` (V-D) | Season-end repair | long-run-canonical |
| Sonstige RED | Code-Fix + `RUN-PAUSED.json` | S5 P-C: emergency repair + resume OK |

*(KPI-Ergebnisse oben — Feintuning Fatigue/Contracts/Rebuy-Rate als Follow-up.)*

