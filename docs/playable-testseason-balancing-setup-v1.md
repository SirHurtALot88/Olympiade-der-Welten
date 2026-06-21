# Playable Testseason Balancing Setup V1

Status: 2026-06-20  
Ziel: Vor einer echten Testseason mit Hell Raisers als User-Team werden Pick-Engine, Economy, Contracts, Board-Ziele und GM-Wirkung mit harten Guards abgesichert. Danach erst Clean-Save, echte AI-Picks und eine kontrollierte Season.

## Leitplanken

- Keine Quick-Minimum-Kader fuer AI-Teams. Alle AI-Teams muessen ueber die echte Pick-Engine draften.
- Hell Raisers bleiben fuer den User frei, solange explizit kein Auto-Pick fuer H-R angefordert wird.
- Keine Balancewerte blind drehen. Jede Balance-Aenderung braucht Report-Beleg und Abschlussnotiz.
- Keine Prisma-/Supabase-Writes in diesen Checks. Lokale Save-Writes fuer Test-Saves sind erlaubt.
- Bei RED nicht einfach abbrechen: Ursache markieren, Root-Fix machen, denselben Gate erneut laufen lassen.

## Aktueller Belegstand

- `outputs/full-clean-redraft-real-pick-20260620-105233/manager-ai-redraft-summary.md`: echter Redraft war `DRAFT_VALID`, `337` Picks, keine Teams unter Minimum, keine roten Stopps.
- `outputs/three-season-full-reset/three-season-playability-report.md`: drei Seasons liefen durch, `1891` Transfers, `0` negative Cash-Teams am Ende, aber Full-Churn/Persona/Market-Fit noch zu grob.
- `outputs/economy-mw-salary-verification.md`: MW/Gehalt-Trennung ist grundsaetzlich gruen, braucht aber einen Laufzeit-Guard gegen Ausreisser.
- `outputs/yellow-stations-v3-final-status.md`: Max14 und Coverage-Audits sind drin, aber Contract-Exit-Druck und Planner-Kaeufe brauchen weitere Schaerfung.

## Phase A: Guards vor jedem Testseason-Lauf

### BAL-01 Real Pick Engine Gate

Zweck: Sicherstellen, dass AI wirklich draftet und nicht nur Mindestkader auffuellt.

Basis:
- `scripts/fresh-pick-audit-10x.ts`
- `scripts/run-full-clean-redraft-v2.ts`
- `lib/ai/retool-ai2-pick-engine.ts`
- `lib/ai/ai-picks-run-service.ts`

Exports:
- `outputs/playable-testseason-readiness/<timestamp>/real-pick-gate-summary.md`
- `outputs/playable-testseason-readiness/<timestamp>/pick-quality.csv`
- `outputs/playable-testseason-readiness/<timestamp>/team-draft-economy.csv`
- `outputs/playable-testseason-readiness/<timestamp>/manager-pick-audit.csv`
- `outputs/playable-testseason-readiness/<timestamp>/red-flags.csv`

Acceptance:
- `DRAFT_VALID = true`.
- Insgesamt ca. `320-380` echte Picks/Deals, keine Quick-Minimum-Abkuerzung.
- Jedes AI-Team: Mindestkader erreicht, Max14 nicht ueberschritten.
- Rest-Cash nicht negativ und nicht absurd hoch. Richtwert: Cash > 100 ist mindestens YELLOW und muss mit Teamstrategie/Marktlage begruendet sein.
- Pro Team werden ausgegeben: Spieleranzahl, Rest-Cash, Gesamt-MW, Gehalt, POW/SPE/MEN/SOC Average.

Root-Fix bei Fail:
- Budget-Pacing, Need-Score, Planner-Final-Gate, Opt+1/Max14 oder Deal-Auswahl nachschaerfen.

### BAL-02 MW/Gehalt Escalation Guard

Zweck: Marktwert- und Gehaltsspruenge sofort sichtbar machen, bevor sie Saves zerstoeren.

Basis:
- `scripts/export-economy-mw-salary-verification.ts`
- `lib/player-formulas/market-value-engine.ts`
- `lib/player-formulas/salary-engine.ts`
- `lib/season/season-economy-factors.ts`

Neue/erweiterte Exports:
- `economy-spike-guard.md`
- `economy-spike-guard.csv`
- `season-market-value-delta.csv`
- `team-salary-sum-delta.csv`

Messwerte:
- Hoechster Spieler-MW.
- Hoechstes Spielergehalt.
- Hoechste Team-Gehaltssumme.
- Hoechster Team-Gesamt-MW.
- Veraenderung je Season und je Transition.

Acceptance:
- Keine `NaN`, `Infinity`, negativen Gehaelter oder negativen MW.
- RED, wenn ein Spieler-MW oder Gehalt in einer Transition mehr als `2.2x` gegenueber dem Vorseason-Max springt.
- RED, wenn einzelne Werte offensichtlich kaputt sind, z. B. MW/Gehalt deutlich ausserhalb der aktuellen Ligaskala.
- YELLOW, wenn Team-Gehalt oder Team-MW stark ueber Ligamedian liegt, aber durch Stars/GM/Strategie erklaerbar ist.

### BAL-03 Contract Renewal / Exit Gate

Zweck: Vertragslogik spielbar und transparent machen.

Basis:
- `lib/contracts/contract-renewal-service.ts`
- `lib/ai/ai-season-lifecycle-orchestrator.ts`
- Team-Drawer Contract-History

Regeln:
- Nur Spieler mit `LZ = 0` duerfen verlaengert werden.
- Spieler mit `LZ > 0` sind laufende Vertraege und duerfen nicht als Renewal behandelt werden.
- Auslaufende Vertraege zaehlen als Abgang/Verkauf.
- Bei Contract-Ende oder Release erhaelt das Team den aktuellen VK-Wert: `aktueller MW * Verkaufsfaktor`.
- AI entscheidet fuer jeden `LZ = 0` Spieler: verlaengern oder Abgang plus Ersatzplanung.

Exports:
- `contract-renewal-gate.csv`
- `contract-exit-value-ledger.csv`
- `renewal-vs-exit-ai-decisions.csv`

Acceptance:
- `0` Renewals fuer Spieler mit `LZ > 0`.
- Jeder `LZ = 0` Spieler ist nach Gate entweder verlaengert oder als Exit mit VK-Gutschrift verbucht.
- Kein AI-Team startet nach Preseason mit negativem Cash.
- Buyout/Expiry/Renewal tauchen in History, GuV und Team-Drawer nachvollziehbar auf.

### BAL-04 Board Objective Realism Gate

Zweck: Schwache Teams bekommen realistische Ziele statt unplausibler Top-10-Quests.

Basis:
- `lib/board/team-season-objectives-service.ts`
- Board Rating / Board Confidence / Vorseason Snapshot

Neue Regel:
- Top-10-Ziele nur, wenn mindestens eine Bedingung klar erfuellt ist:
  - Teamstaerke/Projektionsrang ist mindestens in Reichweite, z. B. Top 14.
  - Vorseason war nah genug dran.
  - Risk-/Gambler-GM erzwingt bewusst hohes Ziel, dann muss der Tooltip das als Risikoquelle nennen.
  - Boarddruck ist extrem und Ziel ist bewusst ambitioniert, aber dann darf es nicht als normales Ziel wirken.

Alternative Ziele fuer schwache Teams:
- Stabilisieren.
- Top 20 / Top 24.
- Kaderbasis verbessern.
- Formfarben abdecken.
- Gehaltsdruck kontrollieren.
- Spieltagsmedaille holen, wenn einzelne Diszi-Staerke passt.

Exports:
- `board-objective-realism.csv`
- `board-objective-tooltip-sources.csv`

Acceptance:
- `32/32` Teams haben Objectives.
- Keine Source-Duplikatketten.
- Bottom-8-Teams erhalten kein Top-10-Ziel ohne expliziten GM-/Boarddruck-Grund.
- Tooltip zeigt Projektion, Vorseason, Boarddruck und GM-Grund.

### BAL-05 GM Impact Gate

Zweck: GMs duerfen nicht nur Flavor sein. Ihre Wirkung muss messbar werden.

Basis:
- `scripts/export-manager-ai-validation-gate.ts`
- `scripts/export-ai-manager-doctrine-audit.ts`
- `scripts/export-ai-manager-apply-preview.ts`
- `lib/ai/ai-manager-doctrine-service.ts`
- `lib/ai/ai-manager-apply-service.ts`

Messfelder:
- Pick-Profil: teuer/guenstig, Star/Talent, Fit/Risiko, Klassen-/Race-Praeferenz.
- Vertragsprofil: Laufzeit, front/back/balanced, Cash-Puffer.
- Verkaufprofil: fruehe Sales, Star-Schutz, Cash-Reaktion.
- Training: Risiko, Rollenfokus, Diszi-Bedarf.
- Formkarten/Mutatoren: konservativ/aggressiv.

Exports:
- `gm-impact-scorecard.csv`
- `gm-pick-contract-training-correlation.csv`
- `gm-persona-decision-ledger.csv`

Acceptance:
- Jeder GM-Archetyp beeinflusst mindestens `3` Entscheidungsfamilien sichtbar.
- Kein GM-Profil bleibt nur Text ohne Pick-/Contract-/Training-Auswirkung.
- Scorecard markiert erwartete Persona-Tendenzen als GREEN/YELLOW/RED.

## Phase B: Kurz danach, aber vor 5-Season-Lauf

### BAL-06 Formkarten-/Trait-Balancing

Regeln:
- Kein Text `MVP Force` mehr.
- Angezeigt werden nur die wirklich ausgeloesten Traits.
- Trait-Bonus geht nur an Spieler, die einen der ausgeloesten Traits besitzen.
- Negative Formkarten duerfen in derselben Diszi nicht doppelt eskalieren.

Exports:
- `trait-trigger-ledger.csv`
- `formcard-risk-ledger.csv`
- `mutator-scoring-audit.md`

Acceptance:
- `0` MVP-Force-Texte in UI/Reports.
- Trait-Bonus-Summe entspricht Spieleranzahl mit getriggertem Trait * Bonus.
- Kein `-8` wird durch gleiche Diszi-Farbe ungewollt zu `-16`.

### BAL-07 AI Training / Levelups

Regeln:
- AI investiert Upgradepunkte taktisch, nicht stumpf ueberall `+1`.
- Entscheidungen beruecksichtigen Rolle, Teamstrategie, Diszi-Bedarf, Klassenprofil und Boarddruck.

Exports:
- `ai-training-spend-ledger.csv`
- `ai-levelup-role-fit.csv`

Acceptance:
- Kein globales Flat-Upgrade-Muster.
- Mindestens `70%` der AI-Upgrades passen zu Rolle/Strategie/Diszi-Bedarf.
- Keine absurden `+50` Spruenge.
- `xpSpent` ist nicht global `0`.

### BAL-08 Cash-/GuV-Reaktion und Personas

Regeln:
- Teams mit wiederholt schlechter GuV verkaufen frueher, senken Gehalt oder ersetzen guenstiger.
- Long-contract-Teams halten hoeheren Puffer.
- Cash-/Value-Teams handeln sichtbar aktiver.
- Star-/Win-now-Teams halten Stars laenger, verkaufen aber bei Board-/Cashdruck.
- Risky Teams duerfen enger fahren, aber nicht negativ in die Season starten.

Exports:
- `finance-reaction-ledger.csv`
- `persona-divergence.csv`
- `bad-guv-without-sale.csv`

Acceptance:
- Keine AI-Team-Season startet mit negativem Cash.
- Schlechte GuV ohne Verkauf wird deutlich seltener und als YELLOW markiert.
- Persona-Unterschiede sind im Report erkennbar, nicht nur im Namen.

### BAL-09 Saisonstand/Reports als Balancing-Dashboard

Jeder Sim-Lauf erzeugt automatisch:
- Kaeufe.
- Verkaeufe.
- Vertragsenden.
- Verlaengerungen.
- Cash.
- Gehalt.
- Gesamt-MW.
- GuV.
- Board Confidence.
- Morale.
- Formkarten-Nutzung.
- Trait-Ausloesungen.
- GM-Impact.
- Economy-Spike-Guard.

Zielordner:
- `outputs/playable-testseason-readiness/<timestamp>/`

## Ausfuehrungsreihenfolge

1. Guards implementieren/verkabeln: BAL-01 bis BAL-05.
2. `10x` echte Pick-Engine laufen lassen, ohne Season-Sim.
3. Jeden roten Pick-/Economy-/Contract-Fail direkt root-fixen und erneut laufen lassen.
4. Clean S1 Save vorbereiten:
   - Hell Raisers als User-Team.
   - H-R nicht automatisch picken.
   - Alle anderen Teams mit echter Pick-Engine.
5. Danach genau eine Season kontrolliert spielen/simulieren.
6. Transition nach Season 2 bis Kaeufe/Verkaeufe/Vertragsverlaengerungen pruefen.
7. Erst nach GREEN: laengerer 3- oder 5-Season-Lauf.

## Test- und Checkliste

Pflichtchecks:

```bash
npm run app:check-live
npm run project:audit-write-safety
```

Fokustests:

```bash
npm test -- tests/retool-ai2-pick-engine.test.ts tests/contract-renewal-service.test.ts tests/team-season-objectives-service.test.ts tests/ai-manager-doctrine-service.test.ts tests/ai-manager-apply-service.test.ts tests/ai-xp-spend-planner.test.ts tests/trait-training-signal.test.ts tests/matchday-mvp-scoring-service.test.ts tests/organic-season-progression.test.ts
```

Audit-Laeufe:

```bash
tsx scripts/fresh-pick-audit-10x.ts --runs 10
tsx scripts/export-economy-mw-salary-verification.ts
tsx scripts/export-manager-ai-validation-gate.ts
```

## Ampel

GREEN:
- Echter Pick-Lauf validiert.
- Keine negativen Cash-Starts.
- Keine MW/Gehalt-Spikes.
- Contracts sauber auf Renewal oder Exit geloest.
- Board-Ziele plausibel.
- GM-Wirkung messbar.

YELLOW:
- Spielbar, aber Tuning-Auffaelligkeit vorhanden.
- Beispiel: Cash zu hoch bei einzelnen Teams, Persona zu schwach, GuV-Reaktion zu spaet.

RED:
- Save/Economy korrupt.
- Draft invalid.
- Negative Cash zum Seasonstart.
- Renewal fuer `LZ > 0`.
- Unplausibler MW/Gehalt-Sprung.

## Nicht in diesen Block ziehen

- Kein UI-Overhaul ausser Report-/Gate-Anzeigen, die fuer Testseason noetig sind.
- Kein 5-Season-Full-Sim vor GREEN in der 1-Season-Vorbereitung.
- Keine neuen Gameplay-Features, solange Contracts, Economy, Board und GM-Wirkung nicht sauber belegt sind.
