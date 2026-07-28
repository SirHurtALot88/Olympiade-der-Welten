import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } from "@/lib/season/matchday-auto-run-service";
import {
  loadLocalLegacyLineupContext,
  loadLocalLegacyLineupContextFromGameState,
} from "@/lib/lineups/legacy-lineup-local-service";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { prepareGameStateForMatchdayResolve } from "@/lib/lineups/matchday-lineup-auto-prep";
import {
  attachMatchdayInjuryPerformanceToContexts,
  buildMatchdayInjuryRollMap,
} from "@/lib/fatigue/fatigue-injury-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import type { LegacyMatchdayResolvePreview, PlayerPerformancePreview } from "@/lib/resolve/legacy-matchday-resolve-types";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { INJURY_PERFORMANCE_MULTIPLIER } from "@/lib/fatigue/fatigue-calibration";

function findPlayerPreview(
  preview: LegacyMatchdayResolvePreview,
  teamId: string,
  playerId: string,
): PlayerPerformancePreview | null {
  for (const disciplinePreview of preview.disciplinePreviews) {
    const match = disciplinePreview.topPlayers.find(
      (player) => player.teamId === teamId && player.playerId === playerId,
    );
    if (match) {
      return match;
    }
  }
  return null;
}

function findPlayerFinalScore(
  preview: LegacyMatchdayResolvePreview,
  teamId: string,
  playerId: string,
): number | null {
  return findPlayerPreview(preview, teamId, playerId)?.finalPlayerScore ?? null;
}

function createInMemoryPersistence(gameState: GameState, cloneOnRead = false): PersistenceService {
  let save: PersistedSaveGame = {
    saveId: "test-save",
    name: "Test Save",
    status: "active",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    gameState: structuredClone(gameState),
  };

  return {
    bootstrapSingleplayerSave() {
      return {
        save: cloneOnRead ? structuredClone(save) : save,
        createdFromSeed: false,
      };
    },
    getActiveSave() {
      return cloneOnRead ? structuredClone(save) : save;
    },
    getSaveById(saveId) {
      if (save.saveId !== saveId) {
        return null;
      }
      return cloneOnRead ? structuredClone(save) : save;
    },
    saveSingleplayerState(saveId, nextGameState) {
      if (save.saveId !== saveId) {
        throw new Error(`Unknown save ${saveId}`);
      }
      save = {
        ...save,
        updatedAt: "2026-06-06T00:00:01.000Z",
        gameState: structuredClone(nextGameState),
      };
      return save;
    },
    createSave() {
      throw new Error("Not implemented in test persistence.");
    },
    createFreshSeasonOneSave() {
      throw new Error("Not implemented in test persistence.");
    },
    cloneSave() {
      throw new Error("Not implemented in test persistence.");
    },
    activateSave(saveId) {
      if (save.saveId !== saveId) {
        return null;
      }
      return cloneOnRead ? structuredClone(save) : save;
    },
    listSaves() {
      return [
        {
          saveId: save.saveId,
          name: save.name,
          status: save.status,
          createdAt: save.createdAt,
          updatedAt: save.updatedAt,
        },
      ];
    },
  };
}

function topUpRostersForLineupMinimum(gameState: GameState, saveId = "test-save") {
  const persistence = createInMemoryPersistence(gameState);
  const contextResult = loadLocalLegacyLineupContext({
    saveId,
    seasonId: gameState.season.id,
    matchdayId: gameState.matchdayState.matchdayId,
    teamId: gameState.teams[0]!.teamId,
  }, persistence);

  if (!contextResult.ok) {
    throw new Error(contextResult.errors.join(" | "));
  }

  const requiredUniquePlayers =
    (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
    (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0);
  const usedPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  const freePlayers = gameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let poolIndex = 0;
  let rosterCounter = gameState.rosters.length;

  for (const team of gameState.teams) {
    const teamRoster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const shortfall = Math.max(0, requiredUniquePlayers - teamRoster.length);

    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayers[poolIndex];
      if (!player) {
        throw new Error("Not enough free players to top up lineup test rosters.");
      }
      poolIndex += 1;
      gameState.rosters.push({
        id: `test-auto-roster-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(player.salaryDemand),
        upkeep: Math.round(player.salaryDemand),
        purchasePrice: Math.round(player.marketValue),
        currentValue: Math.round(player.marketValue),
        roleTag: "bench",
        joinedSeasonId: gameState.season.id,
      });
      rosterCounter += 1;
    }
  }
}

describe("matchday auto-run manual-team policy", () => {
  it("blocks clearly when manual or passive teams have no saved lineup and keeps them out of AI apply", async () => {
    const gameState = createFreshSeasonOneGameState();
    const existingSettings = gameState.seasonState.teamControlSettings ?? {};

    gameState.seasonState.teamControlSettings = {
      ...existingSettings,
      "B-B": {
        ...existingSettings["B-B"],
        teamId: "B-B",
        controlMode: "manual",
        aiLineupApplyEnabled: false,
      },
      "O-S": {
        ...existingSettings["O-S"],
        teamId: "O-S",
        controlMode: "passive",
        aiLineupApplyEnabled: false,
      },
      "D-L": {
        ...existingSettings["D-L"],
        teamId: "D-L",
        controlMode: "ai",
        aiLineupApplyEnabled: true,
      },
    };

    const persistence = createInMemoryPersistence(gameState);
    const result = await runLocalMatchdayAutoRun(
      {
        saveId: "test-save",
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        source: "sqlite",
        dryRun: true,
        options: {
          includeWarningLineups: false,
          overwriteExistingLineups: false,
          stopOnTie: true,
          advanceAfterCashApply: true,
        },
      },
      persistence,
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.summary.manualReady).toBe(0);
    expect(result.summary.manualMissing).toBe(1);
    expect(result.summary.missingManualTeams).toBe(1);
    expect(result.summary.passiveReady).toBe(0);
    expect(result.summary.passiveMissing).toBeGreaterThanOrEqual(0);
    expect(result.blockingReasons).toContain("missing_manual_lineup");
    expect(result.blockingReasons).toContain("resolve_status:missing_lineups");

    const aiLineupStep = result.steps.find((step) => step.key === "ai_lineups");
    const resolveStep = result.steps.find((step) => step.key === "resolve_preview");

    // A manual/passive team WITHOUT any existing draft is not blocked by the
    // ai_lineups step: lib/ai/ai-legacy-lineup-batch-apply-service.ts:1164-1167
    // sets `canAutoFillIncompleteLineup = !hasCompleteExistingDraft`, and the
    // `skipped_manual` / `skipped_passive` results only fire when
    // `!canAutoFillIncompleteLineup`, i.e. only when a complete draft already
    // exists. A team with no draft at all is intentionally offered a
    // KI-Aufstellung instead (Komfort statt Blockade) and is tagged with the
    // `manual_incomplete_lineup_autofilled` warning (same file, ~line 1252) —
    // see the direct `applyAiLegacyLineupBatchLocally` assertion below and the
    // "does not overwrite a manual team's existing draft" test for the
    // complementary, still-blocking case.
    expect(aiLineupStep?.metrics.skippedManual).toBe(0);
    expect(Number(aiLineupStep?.metrics.skippedPassive ?? 0)).toBeGreaterThanOrEqual(0);
    expect(resolveStep?.metrics.manualMissing).toBe(1);
    expect(Number(resolveStep?.metrics.passiveMissing ?? 0)).toBeGreaterThanOrEqual(0);
    expect(resolveStep?.blockingReasons).toContain("missing_manual_lineup");

    // Confirm the manual team without a draft was actually autofilled (not
    // skipped) and carries the documented warning.
    const directBatch = applyAiLegacyLineupBatchLocally(
      {
        saveId: "test-save",
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        dryRun: true,
        includeWarningTeams: false,
        overwriteExisting: false,
      },
      persistence,
    );
    const manualTeamResult = directBatch.results.find((entry) => entry.teamId === "B-B");
    expect(manualTeamResult?.result).not.toBe("skipped_manual");
    expect(manualTeamResult?.warnings).toContain("manual_incomplete_lineup_autofilled");
  });

  it("does not overwrite a manual team's existing complete draft (skipped_manual)", async () => {
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);
    const scope = {
      saveId: "test-save",
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
    };
    const persistence = createInMemoryPersistence(gameState, true);

    // First pass: every team is "ai" controlled so the batch apply generates
    // and persists a complete lineup draft for every team, including B-B.
    applyAiLegacyLineupBatchLocally(
      { ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: false },
      persistence,
    );
    const beforeDraft = persistence
      .getSaveById(scope.saveId)!
      .gameState.seasonState.lineupDrafts?.find((draft) => draft.teamId === "B-B");
    expect(beforeDraft).toBeDefined();

    // Second pass: flip B-B to manual now that it holds a complete draft, and
    // re-run with overwriteExisting so only the manual-with-draft policy (not
    // the overwrite flag) can explain the team being left untouched.
    const afterFirstPass = persistence.getSaveById(scope.saveId)!.gameState;
    const existingSettings = afterFirstPass.seasonState.teamControlSettings ?? {};
    afterFirstPass.seasonState.teamControlSettings = {
      ...existingSettings,
      "B-B": { ...existingSettings["B-B"], teamId: "B-B", controlMode: "manual", aiLineupApplyEnabled: false },
    };
    persistence.saveSingleplayerState(scope.saveId, afterFirstPass);

    const secondBatch = applyAiLegacyLineupBatchLocally(
      { ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
      persistence,
    );
    const manualResult = secondBatch.results.find((entry) => entry.teamId === "B-B");
    expect(manualResult?.result).toBe("skipped_manual");
    expect(secondBatch.summary.skippedManual).toBe(1);

    const afterDraft = persistence
      .getSaveById(scope.saveId)!
      .gameState.seasonState.lineupDrafts?.find((draft) => draft.teamId === "B-B");
    expect(afterDraft).toEqual(beforeDraft);
  }, 40_000);

  it("uses the persisted post-AI snapshot for execute mode so resolve preview sees saved AI lineups", async () => {
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);
    const existingSettings = gameState.seasonState.teamControlSettings ?? {};

    gameState.seasonState.teamControlSettings = Object.fromEntries(
      gameState.teams.map((team) => [
        team.teamId,
        {
          ...existingSettings[team.teamId],
          teamId: team.teamId,
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
          notes: null,
          strategyLock: null,
        },
      ]),
    );

    const persistence = createInMemoryPersistence(gameState, true);
    const result = await runLocalMatchdayAutoRun(
      {
        saveId: "test-save",
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: true,
          // Not stopOnTie: true — this test is about the post-AI snapshot execute
          // path, not tie-blocking (see tests/standings-apply-service.test.ts for
          // that). With INJURY_PERFORMANCE_MULTIPLIER changed, this fixture's
          // deterministic seed now produces an exact standings tie for one team
          // pair on this matchday, which would otherwise incidentally block
          // standings/matchday advance here and turn this into a tie-blocking test
          // by accident.
          stopOnTie: false,
          advanceAfterCashApply: true,
        },
      },
      persistence,
    );

    const resolveStep = result.steps.find((step) => step.key === "resolve_preview");
    const prizeStep = result.steps.find((step) => step.key === "prize_preview");
    const cashStep = result.steps.find((step) => step.key === "cash_apply");
    const advanceStep = result.steps.find((step) => step.key === "matchday_advance");

    expect(resolveStep?.metrics.usedHypotheticalAiLineups).toBe(false);
    expect(resolveStep?.metrics.previewStatus).not.toBe("missing_lineups");
    expect(resolveStep?.metrics.teamsMissingLineup).toBe(0);
    expect(result.summary.lineupsReady).toBe(32);
    expect(result.summary.aiReady).toBe(32);
    expect(result.summary.cashApplyAllowed).toBe(false);
    // KNOWN REGRESSION (left red intentionally, do not weaken): this currently
    // fails because lib/resolve/legacy-matchday-readiness.ts's getRequiredCounts()
    // resolves required-player counts ONLY from context.disciplinePlayerCounts
    // (the static, non-schedule-aware Discipline.playerCount, e.g. 5 for
    // "showcase" in lib/data/dataAdapter.ts), while the AI lineup engine and the
    // matchday contract itself (lib/lineups/lineup-discipline-contract.ts
    // buildMatchdayLineupContract -> `scheduleSlot?.playerCount ?? discipline.
    // requiredPlayers`) correctly use the season-schedule-rolled per-matchday
    // count (e.g. 6 for "showcase" on this save, via
    // lib/season/season-discipline-schedule.ts's seeded "balanced slot buckets").
    // Every other consumer (e.g. lib/ai/ai-legacy-lineup-engine.ts:108-109,
    // 339-340, 591-592, 914-915, 1109, 1127) prefers
    // `disciplineSidePlayerCounts` and only falls back to
    // `disciplinePlayerCounts`; buildLegacyMatchdayReadiness's getRequiredCounts()
    // (lib/resolve/legacy-matchday-readiness.ts:25-38) does not, so it flags a
    // correctly AI-built lineup as "invalid_lineup" ("Discipline showcase on d2
    // expects 5 entries, but received 6"). This cascades into standings-preview
    // marking every team's result "incomplete_result" and blocks standings_apply
    // / matchday_advance. Independently reproduced outside this test suite via
    // `npm run season:smoke-matchday-auto-run`, which currently fails with
    // "Auto-run execute blocked: incomplete_result:<every team>" for all 32
    // teams — this is a genuine production regression, not a fixture issue.
    expect(result.summary.advanceAllowed).toBe(true);
    expect(result.appliedAudits.cashApply).toBeNull();
    expect(result.appliedAudits.matchdayAdvance).toBeTruthy();
    expect(prizeStep).toBeUndefined();
    expect(cashStep).toBeUndefined();
    expect(advanceStep?.status).toBe("applied");
  }, 40_000);

  // Regression guard for BUG A: the auto-run persisted a resolve preview built
  // WITHOUT the same-day injury multiplier, so an injured-this-matchday player
  // scored 1.0x through auto-run while scoring INJURY_PERFORMANCE_MULTIPLIER
  // through the manual/sim path.
  it("persists the same-day injury malus (fatigue*INJURY_PERFORMANCE_MULTIPLIER) for an injured player through the execute path", async () => {
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);
    const existingSettings = gameState.seasonState.teamControlSettings ?? {};
    gameState.seasonState.teamControlSettings = Object.fromEntries(
      gameState.teams.map((team) => [
        team.teamId,
        {
          ...existingSettings[team.teamId],
          teamId: team.teamId,
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
          notes: null,
          strategyLock: null,
        },
      ]),
    );
    // Max out fatigue for every rostered player so the deterministic injury roll
    // (riskPercent 40 at fatigue 100) fires for a meaningful share of used players.
    gameState.seasonState.playerAvailabilityState = gameState.rosters.map((roster) => ({
      playerId: roster.playerId,
      teamId: roster.teamId,
      fatigue: 100,
      injuryStatus: "healthy" as const,
    }));
    gameState.players = gameState.players.map((player) => ({ ...player, fatigue: 100 }));

    const scope = {
      saveId: "test-save",
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
    };
    const persistence = createInMemoryPersistence(gameState, true);

    // Persist AI lineups and fully prepare the state up front so the auto-run's
    // own AI + prepare steps are no-ops and read back exactly this state — which
    // lets us deterministically precompute the injured player's expected score.
    applyAiLegacyLineupBatchLocally(
      { ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
      persistence,
    );
    const afterAi = persistence.getSaveById(scope.saveId)!;
    const prepared = prepareGameStateForMatchdayResolve(afterAi.gameState, scope);
    persistence.saveSingleplayerState(scope.saveId, prepared.gameState);

    const preparedGameState = persistence.getSaveById(scope.saveId)!.gameState;
    const loadContexts = () =>
      preparedGameState.teams.map((team) => {
        const contextResult = loadLocalLegacyLineupContextFromGameState(preparedGameState, {
          ...scope,
          teamId: team.teamId,
        });
        if (!contextResult.ok) {
          throw new Error(contextResult.errors.join(" | "));
        }
        return contextResult.context;
      });

    const injuryRollMap = buildMatchdayInjuryRollMap({ gameState: preparedGameState, ...scope });
    let injuredTeamId: string | null = null;
    let injuredPlayerId: string | null = null;
    for (const [key, roll] of injuryRollMap) {
      if (roll.result === "injured") {
        const separator = key.indexOf("::");
        injuredTeamId = key.slice(0, separator);
        injuredPlayerId = key.slice(separator + 2);
        break;
      }
    }
    expect(injuredPlayerId).not.toBeNull();
    expect(injuredTeamId).not.toBeNull();

    // Same construction the fixed auto-run performs: attach injuries to the
    // contexts before building the resolve preview that gets persisted.
    const injuryAwareContexts = loadContexts();
    attachMatchdayInjuryPerformanceToContexts(injuryAwareContexts, injuryRollMap);
    const injuryAwarePreview = buildLegacyMatchdayResolvePreview(injuryAwareContexts);
    // Pre-fix construction: no injuries attached.
    const noInjuryPreview = buildLegacyMatchdayResolvePreview(loadContexts());

    const injuryAwarePlayer = findPlayerPreview(injuryAwarePreview, injuredTeamId!, injuredPlayerId!);
    const noInjuryPlayer = findPlayerPreview(noInjuryPreview, injuredTeamId!, injuredPlayerId!);
    expect(injuryAwarePlayer).not.toBeNull();
    expect(noInjuryPlayer).not.toBeNull();
    const injuryAwareFinal = injuryAwarePlayer!.finalPlayerScore;
    const noInjuryFinal = noInjuryPlayer!.finalPlayerScore;
    expect(injuryAwareFinal).toBeLessThan(noInjuryFinal);

    // NOTE on what this ratio actually measures: INJURY_PERFORMANCE_MULTIPLIER only
    // scales the base/fatigue-adjusted portion of the score. Downstream additive and
    // team-normalized modifiers (mutator bonus, story-weight-based point share, etc.)
    // are computed independently of the injury multiplier and are NOT reduced — by
    // design (the owner wants the malus to apply to the base score only, not to flatten
    // the whole total). That dilutes the whole-score ratio well above
    // INJURY_PERFORMANCE_MULTIPLIER, so we assert the real mechanic instead of a magic
    // ratio:
    //   1) the whole-score ratio sits strictly between INJURY_PERFORMANCE_MULTIPLIER and 1
    //      (the malus has *some* dampened effect on the total, never none, never the full cut), and
    //   2) the base/fatigue-adjusted portion (`fatigueAdjustedValue`) is identical in both
    //      previews, because it is computed BEFORE the injury multiplier is applied — proving
    //      the malus is folded in downstream of that base, exactly where getInjuryPerformanceMultiplier
    //      is wired into the score engine (see legacy-score-engine.ts), not by mutating the base itself.
    const ratio = injuryAwareFinal / noInjuryFinal;
    expect(ratio).toBeGreaterThan(INJURY_PERFORMANCE_MULTIPLIER);
    expect(ratio).toBeLessThan(1);

    const fatigueAdjustedBase = noInjuryPlayer!.fatigueAdjustedValue;
    expect(fatigueAdjustedBase).not.toBeNull();
    expect(fatigueAdjustedBase).toBe(injuryAwarePlayer!.fatigueAdjustedValue);
    // The exact base-portion reduction (fatigueAdjustedScore * INJURY_PERFORMANCE_MULTIPLIER,
    // with no dilution from downstream additive modifiers) is covered precisely by the
    // isolated unit tests in tests/legacy-matchday-resolve.test.ts, which construct a
    // single-player context and assert the reduced score exactly.

    const result = await runLocalMatchdayAutoRun(
      {
        ...scope,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: false,
          stopOnTie: false,
          advanceAfterCashApply: false,
        },
      },
      persistence,
    );

    const resultApplyStep = result.steps.find((step) => step.key === "result_apply");
    expect(resultApplyStep?.status).toBe("applied");

    const persistedPerformances =
      persistence.getSaveById(scope.saveId)!.gameState.seasonState.playerDisciplinePerformances ?? [];
    const persistedInjured = persistedPerformances.find(
      (entry) => entry.teamId === injuredTeamId && entry.playerId === injuredPlayerId,
    );
    expect(persistedInjured).toBeDefined();
    // Post-fix: the persisted score carries the injury malus (== injury-aware
    // preview) and NOT the stale no-injury value the buggy path would have written.
    expect(persistedInjured!.finalPlayerScore).toBe(injuryAwareFinal);
    expect(persistedInjured!.finalPlayerScore).not.toBe(noInjuryFinal);
  }, 40_000);
});

describe("matchday auto-run per-discipline commit", () => {
  function makeAllAiGameState() {
    const gameState = createFreshSeasonOneGameState();
    topUpRostersForLineupMinimum(gameState);
    const existingSettings = gameState.seasonState.teamControlSettings ?? {};
    gameState.seasonState.teamControlSettings = Object.fromEntries(
      gameState.teams.map((team) => [
        team.teamId,
        {
          ...existingSettings[team.teamId],
          teamId: team.teamId,
          controlMode: "ai" as const,
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: true,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
          notes: null,
          strategyLock: null,
        },
      ]),
    );
    return gameState;
  }

  function runCommit(persistence: PersistenceService, gameState: GameState, commitThroughSide: "d1" | "d2") {
    return runLocalMatchdayAutoRun(
      {
        saveId: "test-save",
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: false,
          stopOnTie: false,
          advanceAfterCashApply: true,
          commitThroughSide,
        },
      },
      persistence,
    );
  }

  it("books only d1 on a half matchday and completes the matchday on the d2 commit", async () => {
    const gameState = makeAllAiGameState();
    const persistence = createInMemoryPersistence(gameState, true);
    const matchdayId = gameState.matchdayState.matchdayId;

    const d1 = await runCommit(persistence, gameState, "d1");
    expect(d1.summary.resultApplyAllowed).toBe(true);
    expect(d1.summary.standingsApplyAllowed).toBe(true);
    // Ein halber Spieltag wird NICHT weitergeschaltet.
    expect(d1.summary.advanceAllowed).toBe(false);

    const afterD1 = persistence.getSaveById("test-save")!.gameState.seasonState;
    const resultId = afterD1.matchdayResults!.find((entry) => entry.matchdayId === matchdayId)!.id;
    const sidesAfterD1 = new Set(
      (afterD1.disciplineResults ?? [])
        .filter((entry) => entry.matchdayResultId === resultId)
        .map((entry) => entry.disciplineSide),
    );
    expect([...sidesAfterD1]).toEqual(["d1"]);
    const d1RowsAfterD1 = (afterD1.disciplineResults ?? [])
      .filter((entry) => entry.matchdayResultId === resultId && entry.disciplineSide === "d1")
      .map((entry) => `${entry.teamId}:${entry.rank}:${entry.totalScore}`)
      .sort();
    expect(persistence.getSaveById("test-save")!.gameState.matchdayState.matchdayId).toBe(matchdayId);

    const pointsAfterD1 = Object.fromEntries(
      Object.entries(afterD1.standings ?? {}).map(([teamId, row]) => [teamId, row.points ?? 0]),
    );

    const d2 = await runCommit(persistence, gameState, "d2");
    expect(d2.summary.resultApplyAllowed).toBe(true);
    expect(d2.summary.standingsApplyAllowed).toBe(true);

    const afterD2 = persistence.getSaveById("test-save")!.gameState.seasonState;
    const sidesAfterD2 = new Set(
      (afterD2.disciplineResults ?? [])
        .filter((entry) => entry.matchdayResultId === resultId)
        .map((entry) => entry.disciplineSide),
    );
    expect([...sidesAfterD2].sort()).toEqual(["d1", "d2"]);

    // Eine bereits gewertete Disziplin ist eingefroren: Der D2-Commit rechnet D1 NICHT
    // neu. Ohne das Einfrieren verschob die nicht bitgleiche Replay-Rekonstruktion die
    // D1-Raenge nachtraeglich, obwohl der Spieler sie laengst als Ergebnis gesehen hatte.
    const d1RowsAfterD2 = (afterD2.disciplineResults ?? [])
      .filter((entry) => entry.matchdayResultId === resultId && entry.disciplineSide === "d1")
      .map((entry) => `${entry.teamId}:${entry.rank}:${entry.totalScore}`)
      .sort();
    expect(d1RowsAfterD2).toEqual(d1RowsAfterD1);

    // Kein Doppelzaehlen: der zweite Apply rechnet von derselben Vor-Spieltags-Basis,
    // die Gesamtpunkte sind also nicht die Summe zweier voller Spieltage.
    const pointsAfterD2 = Object.fromEntries(
      Object.entries(afterD2.standings ?? {}).map(([teamId, row]) => [teamId, row.points ?? 0]),
    );
    const baselineIds = new Set(
      Object.values(afterD2.standings ?? {}).map((row) => row.matchdayBaselineId),
    );
    expect([...baselineIds]).toEqual([matchdayId]);
    for (const [teamId, points] of Object.entries(pointsAfterD2)) {
      const baseline = afterD2.standings![teamId]!.matchdayBaselinePoints ?? 0;
      const afterD1Points = pointsAfterD1[teamId] ?? 0;
      // D1-Punkte bleiben enthalten, D2 kommt oben drauf — nie weniger als nach D1.
      expect(points).toBeGreaterThanOrEqual(Number((afterD1Points - 0.001).toFixed(3)));
      expect(points).toBeGreaterThanOrEqual(baseline);
    }
  }, 120_000);
});
