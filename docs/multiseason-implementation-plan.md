# Multiseason Implementation Plan (pre–Audit S1→S5 v2)

**Ziel:** Alle seit dem Realistic-Run (28.06.2026) besprochenen Themen systematisch umsetzen, **bevor** der nächste Resilient-Audit-Lauf startet.

**Referenz-Lauf (Baseline):** `fresh-season-1-1782677167840` · Output `outputs/realistic-5y/fresh-season-1-1782677167840-20260628-223008/`  
**Feedback-Dokument:** [multiseason-feedback.md](./multiseason-feedback.md)

**Leitprinzipien**

1. **Integration vor Rebalancing** — Feedback-Loops reparieren, Zahlen erst danach feintunen.
2. **Buckets = Plan, Deploy = Pflicht** — Reserviertes Transfer-/Building-Budget muss ausgegeben werden, außer explizite Spar-Strategie.
3. **Buckets nach Liquidität** — Split auf projected cash (post-Sell), nicht auf „5 Cash am Saisonende“.
4. **Sparen = Opt-in** — `strategic_hoard` / `opportunity_striker` in Doctrine, nicht Planner-Leerlauf.

---

## Bereits erledigt (Baseline-Lauf, nicht wiederholen)

- [x] Slot-Policy: `missing_slots` → WARN, kein Sim-Stop
- [x] Soft-Blocker S1 Roster-Repair
- [x] Training-Modus-Backfill (Long-Run, partial)
- [x] V-D women-only Hard-Block + Saison-Ende-Repair
- [x] Resilient Orchestrator S1→S5
- [x] Diagnose-Script: `scripts/dump-facility-levels.ts`

---

## Phasen-Übersicht

| Phase | Fokus | Blockiert Audit? |
| --- | --- | --- |
| **0** | Audit-Instrumentierung | Nein (parallel möglich) |
| **1** | Kritische Bugs (Gebäude, Fatigue, Drift) | **Ja** |
| **2** | Ökonomie-Pipeline (Liquidität → Buckets → Deploy) | **Ja** |
| **3** | Verträge & Markt-Tiefe | **Ja** |
| **4** | Fatigue / Injury / Training | Empfohlen |
| **5** | Progression & Trainingsklassen | Empfohlen |
| **6** | GM / Board | Optional vor v2, empfohlen |
| **7** | Pre-Flight & Audit v2 | — |

**Audit v2 starten erst wenn Phase 1–3 abgeschlossen und Phase-0-Gates grün.**

---

## Phase 0 — Audit-Instrumentierung

Ziel: Messbarkeit für v1 vs. v2, ohne Gameplay-Änderung.

### MS-0.1 Facility- & Bucket-Metriken

- **Dateien:** `scripts/multiseason-final-audit.ts`, ggf. `scripts/dump-facility-levels.ts` einbinden
- **Lieferung:**
  - Pro Team: alle 8 Facility-Levels, Condition/Efficiency-Schnitt
  - Liga: `all_teams_all_facilities_zero` (32/32 → **RED**)
  - `facility_events_total`, Upgrades/Maintenance/Upkeep-Counts
  - `transfer_bucket_deploy_pct`, `building_bucket_deploy_pct` (wenn Reservations vorhanden)
  - `cash_to_mw_ratio` pro Team
- **Done:** `npx tsx scripts/multiseason-final-audit.ts --save-id …` druckt neue Sektionen

### MS-0.2 Preseason-Drift-Diagnose

- **Dateien:** neuer Check in Audit oder kleines Script
- **Lieferung:** Anzahl Kader-Spieler mit Attribut-Drift **nach oben** im Preseason-Tick (sollte 0 sein nach Phase 1)
- **Done:** Metrik im Audit-Output

---

## Phase 1 — Kritische Bugs (P0)

### MS-1.1 Gebäude: `build_new` bei Level 0

- **Problem:** Score ≥ 52 + L0 → fälschlich `downgrade_or_ignore_if_no_cash`; 0 Upgrades in 5 Seasons
- **Dateien:** `lib/ai/ai-team-management-preview-service.ts` (`buildBuildingPlan`)
- **Fix:** `currentLevel === 0 && score >= threshold && canSpend` → `build_new`; Downgrade nur bei `currentLevel > 0`
- **Tests:** `tests/ai-team-management-preview-service.test.ts` — L0 + hoher Recovery-Score → `build_new`
- **Done:** Manager-Preview auf Test-Save: mindestens 1 `buy_building`/`upgrade_building` mit `canApply: true`

### MS-1.2 Fatigue Reset Saisonstart

- **Problem:** Preseason carryover → Ø Fatigue ~81 dauerhaft
- **Dateien:** `lib/season/preseason-workflow-service.ts`
- **Fix:** `fatigue: 0` (oder dokumentierter Season-Stand), nicht `clamp(carryover)`
- **Tests:** Preseason-Workflow-Test
- **Done:** Nach Preseason-Tick rostered players `fatigue === 0`

### MS-1.3 Preseason-Drift: 3-Wege-Logik

- **Problem:** `driftTowardBaseline` für alle; widerspricht „aktiv schlechter“-Modell
- **Dateien:** `lib/season/preseason-workflow-service.ts`
- **Regeln:**
  - **Kader-Spieler:** kein Attribute-/MW-Baseline-Drift (Ergebnis = Saison-Ende-Organic)
  - **Freie Agenten:** langsame Recovery Richtung Baseline (fraction ~0,10–0,15)
  - **TM-Pool / ohne Team:** keine Attribute-Verluste
- **Tests:** neuer Test `preseason-player-drift-policy.test.ts`
- **Done:** MS-0.2 Metrik = 0 upward drift auf rostered

### MS-1.4 Facility Phase-Audit Gate

- **Dateien:** `lib/season/long-run-phase-audit.ts`
- **Gate:** Nach S2 Preseason: `facility_events_total > 0` ODER `teams_with_any_building >= 4` — sonst **RED**
- **Done:** Long-Run pausiert bei totalem Gebäude-Stillstand

---

## Phase 2 — Ökonomie-Pipeline (P1)

Design: **Liquidität → projected cash → Buckets → Deploy**

### MS-2.1 Liquiditäts-Phase (Preseason, vor Buckets)

- **Dateien:** neuer Service z. B. `lib/ai/ai-preseason-liquidity-service.ts`, Hook in Long-Run / Preseason
- **Logik:**
  - Wenn `cash < salaryFloor` oder `cash < emergencyMin` → `LIQUIDITY_MODE`
  - Profitable sells planen/ausführen (fee > Buchwert / MW-Peak-Heuristik)
  - Keine Käufe bis projected cash ≥ Floor
- **Done:** Team mit 5 Cash + hoher Gehaltslast declustered einen Sell-Plan im Preview

### MS-2.2 Net-Transfer-Planung

- **Dateien:** `lib/ai/ai-manager-apply-service.ts`, Types in `olyDataTypes.ts`
- **Felder:** `plannedSellProceeds`, `plannedBuyBudget`, `netTransferCash` (negativ = Netto-Verkäufer)
- **Done:** Manager-Preview zeigt net transfer pro Team

### MS-2.3 Buckets auf projected cash

- **Dateien:** `lib/ai/ai-team-management-preview-service.ts` (`buildBudgetPlan`)
- **Änderungen:**
  - Input: `projectedCash` nach Sell-Plan + Prize/Sponsor/Income
  - Salary-Buffer: Identity-gesteuert (0,5–1,0× erwartete Gehaltslast), **kein** 10–30 % Global-Reserve
  - Emergency: fix klein (5–8)
  - Rest: `buildingQuota` + `transferDeploy`
- **Done:** C-C-ähnliches Team: Buckets basieren auf projected, nicht End-Cash=5

### MS-2.4 Building Deploy-Obligation

- **Dateien:** `lib/ai/ai-manager-apply-service.ts`
- **Logik:** Nach MS-1.1: Top-Score-Facility bis `buildingBudget` erschöpft (Reha/TC priorisiert bei Fatigue)
- **Done:** `building_bucket_deploy_pct >= 50%` für Teams mit `buildingBudget > 5` (Median Liga)

### MS-2.5 Transfer Deploy-Obligation

- **Dateien:** `lib/ai/ai-market-plan-convergence-service.ts`, `lib/ai/chunked-redraft-topup-service.ts`
- **Logik:**
  - Fenster-Ende: wenn `spent < 70% transferDeploy` und **nicht** `strategic_hoard` → forced buys (Opt, Quality, Prospect)
  - `strategic_hoard` / `opportunity_striker` in Doctrine = Opt-out
- **Done:** Teams ohne Hoard-Doctrine deployen ≥70% Transfer-Bucket (Median S3–S5)

### MS-2.6 Cash/MW-Ratio Trigger

- **Dateien:** `lib/ai/ai-transfer-doctrine-layer.ts`, `chunked-redraft-topup-service.ts`
- **Logik:** `cash/teamMW > 0,8` → kein Pass-only; Push `win_now_push` / `depth_repair`
- **Done:** Audit: weniger Teams mit Ratio > 1,0 **und** 0 Buys in Folgesaison

### MS-2.7 Opportunistic Cycle (Doctrine)

- **Dateien:** `lib/ai/ai-manager-doctrine-service.ts`
- **Signale:** Rivalen cash-arm, eigenes Cash/MW hoch → All-in; nach Peak → `sell_if_offer` + Rebuy
- **Done:** Mindestens 2 Teams zeigen Sell-Buy-Zyklus über 2 Seasons im Audit-History

---

## Phase 3 — Verträge & Markt-Tiefe (P1)

### MS-3.1 Contract-Strategy → Renewal

- **Problem:** `aiManagerContractStrategies` geschrieben, Renewal liest nie
- **Dateien:** `lib/contracts/contract-renewal-service.ts`, `shouldAiRenewContract`
- **Done:** Strategy `extend_core` erhöht Renew-Wahrscheinlichkeit; Unit-Test

### MS-3.2 Pre-Tick Contract Review

- **Dateien:** Preseason-Workflow oder neuer Hook vor Markt
- **Logik:** Jeder `contractLength <= 1`: explizit `keep | release | sell_now`; Roster-Impact (unter Opt?)
- **Done:** Contract-Events loggen `decisionReason`

### MS-3.3 Renewal-Heuristik: Opt-Risiko

- **Dateien:** `contract-renewal-service.ts`
- **Logik:** Release der unter Opt führt → Renew-Bias; Replacement-Cost-Vergleich
- **Done:** Contract-Exits gesamt S1–S5 < 250 (Ziel vs. 315 Baseline)

### MS-3.4 Markt jenseits Min-Repair

- **Dateien:** `ai-market-plan-convergence-service.ts`, `ai-transfermarkt-preview-service.ts`
- **Logik:**
  - Injury/Fatigue-Cluster → Target `playerOpt`; bei Opt → +1 Depth
  - Emergency Repair nicht nur `playerMin` wenn Cash > X
- **Done:** < 11 Teams exakt am Min am S5-Ende (Baseline: 11/32)

---

## Phase 4 — Fatigue / Injury / Training Load (P1)

### MS-4.1 Reha Priority (früh)

- **Dateien:** `ai-team-management-preview-service.ts`
- **Logik:** `fatigueAvg >= 65` → Reha-Score-Bonus, Threshold 52 → 38 für `recovery_center`
- **Done:** Liga-Recovery-Level avg > 0 nach S3 (nicht Muss 50%, aber > 0)

### MS-4.2 Training-Modus differenziert

- **Dateien:** `lib/ai/ai-player-training-load-service.ts`
- **Logik:** Nicht pauschal `leicht` bei Fatigue ≥ 85 wenn Post-Reset; Stamm/Bank/GM-Profil
- **Done:** Trainingsmodi-Verteilung: `leicht < 60%` der rostered (Baseline: 223/293)

### MS-4.3 Trainingsmodus-Backfill (vollständig)

- **Dateien:** `lib/season/long-run-canonical.ts`, Markt-Apply-Hooks
- **Logik:** Nach **jedem** Roster-Add: `trainingMode ?? mittel`
- **Done:** 0 Spieler `trainingMode: none` am S5-Ende

---

## Phase 5 — Progression & Trainingsklassen (P1–P2)

### MS-5.1 Trainingsklasse Default

- **Dateien:** `lib/training/organic-season-progression.ts`, Backfill analog Modus
- **Fix:** `trainingClass ?? className ?? dynamic`
- **Done:** Engine und UI konsistent

### MS-5.2 AI Trainingsklassen pro Spieler

- **Dateien:** `ai-manager-apply-service.ts`, neuer Action oder Erweiterung `set_player_training_modes`
- **Mapping:** Team-Achse POW/SPE/MEN/SOC → Klassenprofile; Prospects gezielt
- **Done:** Manager setzt `trainingClass` für Roster in Preseason

### MS-5.3 trainingFocus ↔ Klassen

- **Dateien:** `organic-season-progression.ts` oder Training-Settings
- **Done:** `trainingFocus` beeinflusst `primaryTrainingClass`-Wahl

### MS-5.4 Trainingshistorie UI (optional v2.1)

- **Dateien:** `PlayerDetailDrawer.tsx`, `player-training-history.ts`
- **Done:** Spalte „Fokus“ (Klassen-Attribute) sichtbar

---

## Phase 6 — GM / Board (P2)

### MS-6.1 GM Reassignment Preseason

- **Dateien:** `long-run-canonical.ts`, `team-general-managers.ts`
- **Fix:** `withNormalizedTeamGeneralManagers` / Firing bei Saisonwechsel
- **Done:** `assignedSeasonId` aktuell für alle Teams

### MS-6.2 GM Mid-Season Fire

- **Logik:** Board confidence < 1 → sofort entlassen (auch S1)
- **Done:** > 0 Dismissals in langem Lauf wenn Boards unzufrieden

### MS-6.3 Honeymoon & Influence

- **Logik:** Neuer GM +3 confidence (Cap 5); `influencePct` 20–50 % nach Board-Confidence
- **Done:** `influencePct` nicht mehr konstant 30 %

---

## Phase 7 — Pre-Flight & Audit Simulation v2

### MS-7.1 Unit / Integration Tests

```bash
npm test -- tests/ai-team-management-preview-service.test.ts
npm test -- tests/preseason-workflow-service.test.ts
npm test -- tests/flow-blocker-routing.test.ts
npm test -- tests/organic-season-progression.test.ts
# + neue Tests aus Phase 1–3
```

### MS-7.2 Preflight auf frischem Save

```bash
npx tsx scripts/multiseason-final-audit.ts --save-id fresh-season-1-1782677167840
npx tsx scripts/dump-facility-levels.ts --save-id fresh-season-1-1782677167840
```

### MS-7.3 Resilient Run S1→S5

```bash
npx tsx scripts/run-resilient-multiseason.ts --save-id fresh-season-1-1782677167840
```

Neuer Output-Ordner mit Timestamp dokumentieren.

### MS-7.4 Post-Run Reports

```bash
npx tsx scripts/multiseason-final-audit.ts --save-id <new-save-id> --history
npx tsx scripts/dump-facility-levels.ts --save-id <new-save-id>
# fatigue-injury Report falls Script vorhanden
```

`docs/multiseason-feedback.md` für v2-Lauf aktualisieren.

---

## Erfolgs-KPIs Audit v2 (vs. Baseline)

| KPI | Baseline v1 | Ziel v2 |
| --- | ---: | --- |
| Teams alle Facilities L0 | 32/32 | **0/32** (min. 1 Gebäude Liga-weit) |
| `facility_events_total` | 0 | **> 100** |
| Ø Fatigue (rostered) | ~81 | **< 55** |
| Spieler `trainingMode: none` | 43 | **0** |
| Contract-Exits S1–S5 | ~315 | **< 250** |
| Teams exakt am Min (8) | 11 | **< 6** |
| Teams cash/MW > 0,8 ohne Buys | viele | **< 8** |
| GM Dismissals | 0 | **> 0** wenn Board pressure |
| Transfer-Bucket deploy (Median) | ~0% | **≥ 70%** (ohne hoard doctrine) |
| Team-MW decline ≥20 | 19/32 | **< 12/32** |

---

## Abhängigkeitsgraph (Kurz)

```
MS-1.1 (build_new) ──► MS-2.4 (building deploy)
MS-1.2 (fatigue reset) ──► MS-4.1 (reha priority sinnvoll)
MS-2.1 (liquidity) ──► MS-2.3 (buckets) ──► MS-2.5 (transfer deploy)
MS-3.1 (contract wiring) ──► MS-3.2 (pre-tick review)
MS-0.* parallel überall
Phase 7 erst nach Phase 1–3 complete
```

---

## Arbeitsreihenfolge für Agent (empfohlen)

1. MS-0.1, MS-0.2 (Audit erweitern)
2. MS-1.1 → MS-1.2 → MS-1.3 → MS-1.4
3. MS-2.1 → MS-2.2 → MS-2.3 → MS-2.4 → MS-2.5 → MS-2.6 → MS-2.7
4. MS-3.1 → MS-3.2 → MS-3.3 → MS-3.4
5. MS-4.1 → MS-4.2 → MS-4.3
6. MS-5.1 → MS-5.2 → MS-5.3 (MS-5.4 optional)
7. MS-6.1 → MS-6.2 → MS-6.3
8. MS-7.1 → MS-7.4

**Checkpoint nach Schritt 2:** Mini-Long-Run S1→S2 — Facilities > 0, Fatigue reset sichtbar.  
**Checkpoint nach Schritt 4:** S1→S3 — Transfers/Contracts/Deploy-Metriken prüfen.  
**Full Run:** Schritt 8.

---

## Offene Entscheidungen (defaults im Plan)

| Frage | Default im Plan |
| --- | --- |
| Fatigue exakt 0 oder Season-Stand? | **0** |
| Transfer deploy Pflicht | **70%** ohne hoard |
| Emergency cash fix | **5–8** |
| Facility RED gate | all zero nach S2 |

Bei Abweichung Plan hier anpassen, dann umsetzen.

---

*Erstellt: 28.06.2026 · Nächster Schritt: Phase 0 + MS-1.1 beginnen.*
