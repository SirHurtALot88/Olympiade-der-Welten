# Unified Pick Plan — S1 als Basis, S2 gleiches Picking + Sell

## Ausgangslage

- **S1 Draft** (`ai-needs-picks-compare-service` + `ai-picks-run-service`) lief stabil: Budget, Verträge, Lane-Plan, kein Stars+Filler-Kliff.
- **S2+ Markt** nutzte separaten Pfad (`pickCandidateForSlot`, `strategicBuyScore`) → schlechtere Picks, Orchestration blockierte Verkäufe.
- **Falscher Weg:** S1 an Market-Engine hängen → Regression. **Richtiger Weg:** Compare-Pick-Logik = Wahrheit für alle Käufe; S2 nur + Sell/Renew davor.

## Zielbild

```
Unified Pick Core (Compare-Logik)
    ├── S1: FA-Draft (unverändert, über picks-run)
    └── S2+: Transfermarkt-Käufe (dieselbe planTeamPicks-Logik)
              ↑ nach Sell/Renew am Preseason-Start
```

Draft und Markt-Käufe sind **keine zwei Systeme** — nur unterschiedliche **Pools** (FA vs. Markt) und **Phasen** (S1 ohne Sell, S2 mit Sell zuerst).

---

## Phase 1 — S1 Baseline sichern ✅

**Ziel:** Alter Compare-Draft ist wieder aktiv und messbar.

- [x] S1-Engine-Integration zurückgenommen (`ai-draft-engine-pick-service` entfernt, Compare = HEAD)
- [ ] Fresh-Save S1-Draft-Audit (`scripts/s1-draft-fresh-audit.ts`)
- [ ] KPIs dokumentieren: Teams@Min, Teams@Opt, MW-Verteilung, Vertragslängen, Quality Gate

**Erfolg:** Gate pass, keine Stars+Filler-Kliff, Verträge ≠ pauschal 1 Jahr.

---

## Phase 2 — Unified Pick Core extrahieren

**Ziel:** Eine API, die die **Compare-Pick-Planung** für beliebige Team/Step-Kombinationen anbietet.

**Neu:** `lib/ai/unified-pick-planner-service.ts`

```typescript
planUnifiedTeamPicks({
  saveId, seasonId, teamId,
  steps,
  runMode: "default" | "season1_optimum_execute",
  excludedPlayerIds?, draftSeed?,
}) → { plannedPicks, warnings, blockingReasons }
```

- Intern: `buildAiNeedsPicksCompare` / `buildTeamEntry` (keine Duplikation der 7600 Zeilen)
- Tests: `tests/unified-pick-planner.test.ts` — Parität mit direktem Compare-Aufruf

**Erfolg:** S1 und S2 können dieselbe Funktion aufrufen; S1-Picks unverändert.

---

## Phase 3 — S2 Markt auf Unified Core + Sell

**Ziel:** S2 kauft wie S1; Verkauf/Verlängern davor.

1. **`ai-market-plan-preview-service`:** `chooseBuyCandidates` → bei S2+ `planUnifiedTeamPicks` statt `pickCandidateForSlot` (Feature-Flag `OLY_UNIFIED_PICK=1`, Default an)
2. **Verträge:** `recommendContractOfferForPlayer` bleibt in Apply — Compare-PlannedPick liefert Kandidaten, Apply setzt Vertrag wie S1
3. **Transfer-Window:** Sell-first → Buy mit `cashAfterSell` (Cash-Recovery-Gates aus Referenz `ai-budget-deploy-service`, schrittweise reaktivieren)
4. **Renew vs Sell:** Preseason-Phase (später): auslaufende Verträge → Renew ODER Sell, dann Unified Buy

**Deprecate für Käufe (Referenz behalten):**

- `market-pick-engine/pick-step.ts` für Buy-Auswahl (Brackets/Envelope weiter für Diagnose)
- Separates `strategicBuyScore`-First in Preview

**Erfolg:** S2-Käufe qualitativ ≈ S1; Schulden-Teams verkaufen und kaufen in einer Session.

---

## Testplan

| Schritt | Command |
|---------|---------|
| S1 Baseline | `npm run ai:s1-draft-audit` |
| Unified Unit | `npm test -- tests/unified-pick-planner.test.ts` |
| S2 Smoke (Phase 3) | `npm test -- tests/ai-transfer-window-session.test.ts` |
| S1→S2 (später) | `npm run ai:pick-audit-fresh-s1-s2` mit `OLY_UNIFIED_PICK=1` |

---

## Nicht in Scope (jetzt)

- Compare-API löschen (bleibt Diagnose)
- Chunked-redraft / fast-draft Pfade
- Volle Engine-Parität ohne Compare-Regeln
