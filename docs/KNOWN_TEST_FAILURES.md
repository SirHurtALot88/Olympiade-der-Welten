# Bekannte Test-Failures — Triage (offen)

**Stand:** aufgenommen während der Form-Jitter/PP-Arbeit auf Branch
`claude/discipline-stage-tab`.

**Gesamtbild:** `npx vitest run` (voll) meldet **164 fehlgeschlagene Tests in
79 Dateien** von 2338 Tests (2174 grün). Diese Failures sind **breit über das
ganze Repo verteilt** (Character-Import, Retool-Extraktion, Transfermarkt,
Scouting, AI-Picks, Singleplayer-State, diverse UI-Contract-Snapshots,
Playwright) und **nicht** durch die Form-Jitter/PP-Änderung verursacht:

- Die tatsächlich betroffenen Suites (Scoring/Form/PP/Resolve/Points/Mapper/
  pp-area) wurden gezielt geprüft und zeigen **nur** die unten als
  „vorbestehend" markierten Failures.
- Ein Baseline-Volllauf (Stash aller Änderungen) wurde 1:1 gegen den Lauf MIT
  der Änderung gediffed. **Ergebnis: fehlgeschlagene Datei-Menge identisch
  (79 = 79).** Der einzige Test-Delta liegt komplett innerhalb der ohnehin
  roten, SQLite-gestützten `singleplayer-state.test.ts` (mal fallen andere
  Sub-Tests, mal nicht → flaky DB-Test-Reihenfolge; keine Berührung mit
  Scoring/PP). ⇒ **Die Form-Jitter/PP-Änderung fügt KEINE echten Failures hinzu.**
  Die Saison-Sims (`season-points-prize-regression`, `season-management-loop`,
  `organic-season-progression`, `matchday-summary`, `season-completion`) fallen
  auf BEIDEN Seiten gleich → vorbestehend.

**Noch zu klären (der eigentliche Zweck dieser Notiz):** Für jeden Block
entscheiden, ob es sich um
1. **echte Regressionen** (fixen),
2. **veraltete/obsolete Contract-Tests** (Test anpassen/entfernen), oder
3. **umgebungsabhängige/flaky Tests** (DB, Dateisystem, Playwright, Timeouts —
   evtl. aus dem Standard-Lauf ausklammern)
handelt.

---

## Verdächtig umgebungsabhängig / flaky (vermutlich irrelevant fürs Gameplay)

- `tests/ui-cockpit-playtest.spec.js` — Playwright-Spec (Browser)
- `tests/whole-season-dryrun-service.test.ts` — **Timeout 5000 ms** (Sim zu
  langsam; braucht evtl. höheres testTimeout)
- `tests/*-api.test.ts` (read-only/prisma-Routen): `ai-legacy-lineup-api`,
  `legacy-matchday-apply-api`, `legacy-matchday-preview-api`,
  `standings-apply-api`, `standings-preview-api`, `transfermarkt-free-agents-api`
- Extraktions-/Audit-Tools: `audit-retool-attribute-mapping`,
  `extract-retool-player-attributes`, `extract-retool-transfermarkt-columns`,
  `character-import-service`, `sync-catalog-player-transfermarkt`,
  `cash-prize-apply-contract`

## UI-Contract-Snapshots (prüfen: nur veraltete Markup-Erwartungen?)

`contract-offer-ui-contract`, `facilities-v2-ui-contract`,
`feature-audit-ui-contract`, `foundation-initial-compact-state`,
`foundation-league-leaders-ui-contract`, `foundation-lineup-v2-ui-contract`,
`foundation-performance-architecture`, `foundation-player-portrait-card`,
`foundation-scouting-ui-contract`, `foundation-sidebar-order`,
`foundation-training-facilities-ui-contract`, `gameplay-flow-scan-contract`,
`legacy-lineup` (draft-workspace-Contract), `legacy-lineup-velo-ui-contract`,
`matchday-arena-ui-contract`, `new-game-setup-ui-contract`,
`player-profile-ui-contract`, `preseason-workflow-ui-contract`,
`scouting-display-contract`, `season-standings-v2-ui-contract`,
`season-transition-ui-contract`, `velo-ui-components`

## Gameplay-/Service-Logik (am ehesten inhaltlich zu prüfen)

`ai-manager-apply-service`, `ai-market-quality-profile-service`,
`ai-needs-picks-compare-service`, `ai-picks-run-service`,
`ai-player-training-class-service`, `ai-transfer-window-session`,
`ai-transfermarkt-sell-preview`, `ai-legacy-lineup`,
`chunked-redraft-topup-service`, `data-adapter`, `draft-repair-economy`,
`form-card-plan-sync`, `legacy-lineup-lab`, `long-run-organic-progression-audit`,
`long-run-soft-blockers`, `market-value-apply`, `matchday-auto-run-service`,
`matchday-mvp-scoring-service`, `matchday-summary`, `media-assets`,
`new-game-setup-service`, `organic-season-progression`,
`organic-squad-draft-builder`, `organic-squad-weights`,
`planner-pool-performance`, `planner-post-opt-upgrade-policy`,
`player-detail-drawer`, `player-economy-compare-service`,
`player-stats-adapter`, `preseason-workflow-service`, `retool-ai2-pick-engine`,
`scouting-report-service`, `season-completion-service`,
`season-end-progression-preview`, `season-management-loop`,
`season-one-long-run-market-buy`, `season-points-prize-regression`,
`season-start-reset-service`, `season1-draft-spend-policy`, `singleplayer-state`,
`team-management-overview`, `training-facility-attribute-sim`,
`transfermarkt-local-service`

> Hinweis: `season-points-prize-regression`, `season-management-loop`,
> `organic-season-progression`, `matchday-summary`, `season-completion-service`
> sind Saison-Sims und könnten theoretisch auf Scoring/PP reagieren — der
> Baseline-Diff muss bestätigen, dass sie **schon vor** der Änderung rot waren.
