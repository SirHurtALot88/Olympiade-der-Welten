# Baseline: Disziplin-Bühne → vollwertiger 1:1-Ersatz der Matchday-Arena

**Status:** verbindliche Baseline / Umsetzungs-Backlog.
**Ziel:** Die Disziplin-Bühne soll die Matchday-Arena 1:1 ablösen und direkt anbinden können — Arena UND Bühne parallel nutzbar, beide liefern über eine gemeinsame Resolve-/Commit-Schicht identische, echte Ergebnisse (kein reiner Test-Modus mehr im Echt-Zweig).

## 0. Ist-Architektur in einem Satz

Die echte Auswertung läuft **Save → Kontexte → Engine → Apply**:
- `loadAllLocalLegacyLineupContexts()` — `lib/lineups/legacy-lineup-local-service.ts:745` — baut pro Team einen `LegacyLineupLoadedContext`.
- `buildLegacyMatchdayResolvePreview()` — `lib/resolve/legacy-matchday-resolve-engine.ts:216` — rechnet alles.
- `LegacyMatchdayResultApplyService.applyLegacyMatchdayResult()` — `lib/resolve/legacy-matchday-result-apply-service.ts:483` — committet ins GameState.
- Die Arena-UI (`MatchdayArenaNewLook.tsx`) ist **nur Visualisierung** dieser Preview (via `GET /api/matchday/arena-base` → `loadMatchdayArenaBase()`, `lib/foundation/matchday-arena-base-service.ts:179`).

Die Bühne rechnet dagegen heute eine **Parallel-Formel** (`discipline-stage-data.ts:52`, `computeSlot`: `net = base − base·fatigue/100·0.25 + Form-% + Jitter`), die es in der Engine so **nicht gibt**.

**Kernentscheidung:** Parallelrechnung streichen; die Bühne wird zweiter Renderer derselben `LegacyMatchdayResolvePreview`.

## 1. Feature-Paritäts-Matrix

### Score-Komponenten

| # | Feature | Arena (Engine) — Quelle | Bühne heute | Delta |
|---|---|---|---|---|
| 1 | Aufstellung = echtes Lineup (Slots, d1/d2) | `context.existingDraft.entries` aus `seasonState.lineupDrafts`; `legacy-lineup-local-service.ts:738` | Fehlt — Top-N nach `disciplineRatings` (`discipline-stage-data.ts:108-111`) | Pflicht |
| 2 | Grundwert pro Spieler | `disciplineScores`, `legacy-score-engine.ts:126-136` | Hat (aus `disciplineRatings`, gerundet) | ~ok |
| 3 | Fatigue | multiplikativ `fatigue.multiplier` (`legacy-score-engine.ts:133-136`) | Abweichend (eigene 25-%-Formel) | Pflicht ersetzen |
| 4 | Verletzung | `injuryMultiplier` (`legacy-score-engine.ts:137-144`) | Fehlt (nur Fake-Injury im Random-Test) | Pflicht |
| 5 | Morale | `moraleMultiplier` via `buildPlayerMoralePerformanceMap` (Engine :268) | Fehlt | Pflicht |
| 6 | Captain (+50 % auf Final-Beitrag) | `legacy-score-engine.ts:200-224` | Fehlt | Pflicht |
| 7 | Form-Cards 0/2/4/8 | `FORM_CARD_VALUES` `legacy-lineup-modifiers.ts:12`; `calculateFormModifierForSide` :628 | Fehlt (eigener „formSwing" + Jitter) | Pflicht ersetzen |
| 8 | Intensität Push/Conserve (+3/−2) | `INTENSITY_SCORE_MODIFIER` `legacy-score-engine.ts:21-25` | Fehlt (nur Random-„Push") | Pflicht |
| 9 | Slot-Rollen-Modifier | `calculateSideSlotRoleModifierTotal` (`matchday-slot-roles.ts`; Engine :280) | Fehlt | Pflicht |
| 10 | Mutator-Traits: 2/Spieltag+Seite, +6/Treffer, +0,3 PP | `buildMatchdayMutatorTraitsBySide` `legacy-lineup-modifiers.ts:361`; `calculateMutatorModifierForSide` :697, PP :752 | Nur Random-Test, eigener Seed | Pflicht (Echt-Modus) |
| 11 | Team-Power aktiv (Self-Boost %) | `calculateTeamPowerModifierForSide` (`team-powers.ts`); Engine :260-280 | Fehlt | Pflicht |
| 12 | Team-Power passiv (always-on %) | `calculatePassiveTeamPowerBonus` (Engine :363) | Fehlt | Pflicht |
| 13 | Team-Power-Debuffs (cross-team) | `applyTeamPowerDebuffs` + `selectDebuffTargets` (`legacy-matchday-resolve-engine.ts:37-124`) | Fehlt (nur teamübergreifend berechenbar) | Pflicht |
| 14 | Rang → Saisonpunkte | `getRankToPointsValue` (`lib/resolve/rank-to-points.ts:118`, `references/sheets/rank-to-points.json`) | Fehlt | Pflicht |
| 15 | Player-Points-Verteilung (PP je Spieler) | `distributeRankPointsToPlayers` (`rank-to-points.ts:146`) | Fehlt | Pflicht |

### Anzeige / UX

| Feature | Arena — Quelle | Bühne | Delta |
|---|---|---|---|
| Phasen-Reveal (Slots→Push→Form→Mutator→Captain→Power→Finale→Ergebnis) | `MATCHDAY_ARENA_PHASES` (`lib/season/matchday-arena-presenter.ts:3-12`) | Fehlt (eigene Dramaturgie) | Pflicht (Datenäquivalenz) |
| PP pro Spieler | `PlayerPerformancePreview.pointsAwarded` (Engine :598) | Fehlt | Pflicht |
| End-Screen Disziplin (Rang, Team-Punkte) | `DisciplineResolvePreview.teamResults.teamPoints` (Engine :541-554) | Fehlt | Pflicht |
| End-Screen Spieltag (d1+d2+Summen) | `preview.teamResults.{d1Points,d2Points,totalPoints}` (Engine :756-767) | Fehlt | Pflicht |
| Top-10-Player je Disziplin / MVP | `topPlayers` (`isTop10`, `isMvpCandidate`, Engine :609-614); UI `MatchdayResultNewLook.tsx:203,642` | Fehlt | Pflicht |
| Rank-Changes → Saisonstand | `buildStandingsPreview`, `briefingStandings` (`matchday-arena-base-service.ts:34`), `buildArenaTeamRankMap` | Fehlt | Pflicht |
| Highlights (bester Spieler, engster Abstand, fehlendes Lineup) | `highlightCandidates` (Engine :616-696) | Fehlt | Optional |
| Multiplayer-Reveal-Sync | `lib/foundation/matchday-arena-reveal-sync.ts` | Fehlt | Optional (Phase 2) |
| Warnings/Status (`missing_lineups`, `missing_scores` …) | `ResolvePreviewStatus` (Engine :153-178) | Fehlt | Pflicht für Echtbetrieb |

## 2. Baseline-Definition

**Pflicht (Definition „gleichwertig") — Echt-Modus nutzt die VOLLE Engine, keine eigene Rechnung:**

1. Input = echte `LegacyLineupLoadedContext`s (Lineup, Modifiers, Form-Cards, Captain, Team-Powers, Fatigue/Injury/Morale).
2. Rechnung = ausschließlich `buildLegacyMatchdayResolvePreview()` (Zeilen 1–15). Die Bühne rechnet **nichts** selbst; sie zeigt `entries[].{baseValue, fatigueAdjustedValue, captainBonus, mutatorBonus, finalPlayerScore, pointsAwarded}`.
3. Ausgabe: PP pro Spieler, End-Screen je Disziplin, End-Screen Spieltag (beide Disziplinen + Summen), Top-10 + MVP, Rank-Changes/Saisonstand.
4. Commit über die bestehende Apply-Schicht — die Bühne schreibt **nie** selbst, sie triggert dieselben Endpunkte wie die Arena.

**Optional (nicht Baseline):** Highlights-Karten, Reveal-Sync (Multiplayer), „Dein Lauf"-Sparkline, Teilen-Recap, zusätzliche Modifier-Animationen.

**Bleibt Test-Modus:** „🎲 Random-Test" mit eigenem Seed (`pickMutatorTraits`, `rollMods()`) — explizit als „nicht echt" gelabelt. Der heutige vereinfachte „Echte Werte"-Modus **entfällt** und wird durch den Engine-Modus ersetzt. Duplizierte Trait-Listen/Konstanten (`DisciplineStageArena.tsx:45-57`) durch Importe aus `legacy-lineup-modifiers.ts` ersetzen.

## 3. Architektur-Empfehlung: Wiederverwendung, keine Parallelrechnung

**Variante A — Bühne konsumiert die fertige Arena-Base** (nicht die Engine direkt im Client, sondern denselben Server-Pfad wie die Arena):

- **Daten:** `GET /api/matchday/arena-base?includeDetails=true` (`app/api/matchday/arena-base/route.ts` → `loadMatchdayArenaBase()`, `lib/foundation/matchday-arena-base-service.ts:179`). Liefert `resolvePreview` (gecacht via `arena-preview-cache`), `standingsPreview`, `briefingStandings`, `scoreSummary`. Parität ist damit **per Konstruktion** garantiert — Arena und Bühne lesen dasselbe Objekt.
- **Mapping-Schicht (neu):** `lib/foundation/discipline-stage/discipline-stage-from-preview.ts` — mappt `DisciplineResolvePreview` (eine Disziplin) auf das Bridge-Payload: `val = entry.baseValue`, Mods additiv als Deltas (`fatigueAdjustedValue − baseValue` = Fatigue, Morale-Delta, `captainBonus`, `mutatorBonus`), Team-Level-Mods (Form-Cards, Intensität, Power, Debuffs) separat. Muss so schneiden, dass `Σ(net) + Team-Mods = teamResult.score` exakt aufgeht (Engine liefert alle Summanden als Zahlen — nie neu rechnen).
- **Ersetzt:** `buildDisciplineStageModel`/`computeSlot` (`discipline-stage-data.ts:52,80`) im Echt-Modus komplett (Datei bleibt nur für Random-Test).
- **Props:** `FoundationDisciplineStageHost` braucht `saveId/seasonId/matchdayId/teamId` (heute nur `gameState + selectedTeamId`, `FoundationShellRouterBody.tsx:2922-2927`) — analog `FoundationMatchdayArenaPanel`.

**Direkte Anbindung / Flow:**

- **Arena heute im Flow:** Shell-View `FoundationShellRouterBody.tsx:223` (`FoundationMatchdayArenaPanel`), Daten via `arena-base`; „Weiter" = `onAdvanceMatchday` (`MatchdayArenaV2Client.tsx:24`).
- **Wer schreibt:** ausschließlich `applyLegacyMatchdayResult()` (`legacy-matchday-result-apply-service.ts:483`) — schreibt `matchdayResults` (Status `preview_applied`), `playerPerformances`, Standings-Refresh; **idempotent** (Duplikat-Check :601). Erreichbar über `POST /api/resolve/legacy-matchday-apply`, orchestriert im Flow-Controller `runLocalMatchdayAutoRun()` (`lib/season/matchday-auto-run-service.ts:425`; Resolve :164, Apply :804; API `POST /api/season/matchday-auto-run`, Advance `POST /api/season/advance-matchday`).
- **Parallelbetrieb ohne Doppel-Schreiben:** Bühne bekommt eigenen Shell-View „Bühnen-Auswertung": 1. `arena-base` laden (read-only Preview), 2. nach Reveal denselben `matchday-auto-run`-Endpoint aufrufen wie die Arena. Da Apply idempotent ist und `resultApplied` sichtbar (`matchday-arena-base-service.ts:94-98,126`): **wer zuerst committet, gewinnt; die zweite Ansicht zeigt nur das persistierte Ergebnis** (`status: "resolved"`). Zwei austauschbare Renderer über identischer Resolve-/Commit-Schicht — kein Fork, keine zweite Wahrheit.

## 4. Umsetzungsschritte (je Schritt ≈ 1 PR, priorisiert)

- **S1 — Engine-Preview in die Bühne (Fundament).** Neue `discipline-stage-from-preview.ts`; `DisciplineStageArena` lädt `arena-base?includeDetails=true`, Echt-Modus rendert `DisciplineResolvePreview`; Modell-Check zeigt Engine-Summanden. Dateien: `DisciplineStageArena.tsx`, neu Mapping, `FoundationDisciplineStageHost.tsx`, `FoundationShellRouterBody.tsx` (Props). Risiko: mittel. Test: Vitest „Σ Bühnen-Netto == `teamResult.score`" gegen `tests/legacy-matchday-resolve.test.ts`-Fixtures.
- **S2 — Player-Points-Anzeige.** `pointsAwarded`/`mutatorPpsBonus` je Spieler ins Payload + Anzeige (React-Overlay, Szenen-HTML unangetastet). Risiko: niedrig. Test: PP-Summe je Team == `teamPoints`.
- **S3 — End-Screen Disziplin.** React-Overlay: Rang, Team-Score, `teamPoints` (`getRankToPointsValue`), Breakdown (Form/Captain/Power/Mutator wie `getMatchdayArenaPhaseBreakdown`). Risiko: niedrig.
- **S4 — End-Screen Spieltag (d1+d2+Summen) + Top-10 + MVP.** Aus `preview.teamResults` + `disciplinePreviews[].topPlayers`; Optik nach `MatchdayResultNewLook.tsx:203,642`. Risiko: niedrig.
- **S5 — Rank-Changes → Saisonstand.** `standingsPreview` + `briefingStandings`; „vorher → nachher" (`formatArenaRankDelta`). Risiko: niedrig.
- **S6 — Spieltags-Flow-Anbindung (Drop-in).** View „Bühne als Auswertung": d1→d2→Gesamt, Commit → `POST /api/season/matchday-auto-run` (identisch zur Arena), `resultApplied`-Guard, `onAdvanceMatchday`. Risiko: **hoch** (schreibend) — mitigiert durch Idempotenz + `dryRun` zuerst. Test: `scripts/smoke-local-season-loop.ts`-Muster; ein Spieltag über die Bühne committen, GameState-Diff mit Arena-Commit vergleichen (muss identisch sein).
- **S7 — Aufräumen/Absichern.** Duplizierte Konstanten durch Importe ersetzen; alten Echt-Modus (`computeSlot`, `seededJitter`) entfernen; Random-Test klar labeln. Golden-Master: Engine-Preview → Payload → Rück-Summe.
- **Optional danach:** Highlights (S8), Reveal-Sync (S9), Szenen-Modifier-Animationen (S10).

## 5. Risiken & Fallen

1. **Determinismus:** Bühne würfelt Mutatoren mit eigenem Seed (`DisciplineStageArena.tsx:173`), Engine mit `buildMatchdayMutatorTraitsBySide` (saveId/seasonId/matchdayId). Echt-Modus zwingend Engine-Seed. `seededJitter` (`discipline-stage-data.ts:42`) hat kein Engine-Pendant → ersatzlos raus.
2. **Szenen-Slot-Zahlen:** Bridge kürzt/füllt Spieler bei abweichendem `playerCount` (`val: 0`). Team-Summe muss aus der Engine (Overlay) kommen, nicht aus der Szenen-Summe.
3. **Additiv vs. multiplikativ:** Szenen `val + Σmods`; Engine multiplikativ (Fatigue/Injury/Morale) + prozentual (Team-Power). Mapping liefert **Deltas** (nicht Prozente), Team-Level-Mods separat; Engine-Rundungen (`roundPreviewScore`, `legacy-score-engine.ts:17`) übernehmen, nie neu runden.
4. **Cross-Team-Effekte:** Team-Power-Debuffs erst nach Ranking aller Teams bekannt — komplettes `DisciplineResolvePreview` muss vor dem Reveal vorliegen (kein pro-Team-Streaming).
5. **iframe-Bridge-Grenzen:** Bridge patcht `genPlayers` in 20 HTML-Dateien; jede Payload-Erweiterung ×20. Daher End-Screens/PP als **React-Overlay** im Host, Szenen-Payload minimal halten.
6. **Doppel-Commit:** mitigiert durch Idempotenz (`legacy-matchday-result-apply-service.ts:601`) + `resultApplied`-Flag; Commit-Button bei `resultApplied === true` deaktivieren.
7. **Status ≠ ready:** Engine liefert `missing_lineups/missing_scores/…` (`resolveSideStatus`, Engine :153). Echt-Modus muss diese Zustände anzeigen statt still Top-N zu raten.
8. **Performance:** `includeDetails=true` = Full-Resolve + Standings, gecacht via `arena-preview-cache` mit `contentSignature`. Bühne nutzt denselben Cache-Key automatisch über arena-base.

## Kurzfazit

Kein einziges Score-Feature wird neu implementiert — alles existiert in `legacy-score-engine.ts` / `legacy-matchday-resolve-engine.ts` / `rank-to-points.ts`. Die Arbeit ist: (a) Props/Daten-Routing zur Bühne, (b) Preview→Szenen-Payload-Mapping, (c) Overlay-UI für PP/End-Screens/Standings, (d) Anbindung an den bestehenden `matchday-auto-run`-Commit-Pfad. Die Parallel-Formel in `discipline-stage-data.ts` ist die einzige zu löschende Altlast.
