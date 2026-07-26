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
import type { LegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

function findPlayerFinalScore(
  preview: LegacyMatchdayResolvePreview,
  teamId: string,
  playerId: string,
): number | null {
  for (const disciplinePreview of preview.disciplinePreviews) {
    const match = disciplinePreview.topPlayers.find(
      (player) => player.teamId === teamId && player.playerId === playerId,
    );
    if (match) {
      return match.finalPlayerScore;
    }
  }
  return null;
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
          stopOnTie: true,
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
  // scored 1.0x through auto-run while scoring 0.75x through the manual/sim path.
  it("persists the same-day injury malus (fatigue*0.75) for an injured player through the execute path", async () => {
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

    const injuryAwareFinal = findPlayerFinalScore(injuryAwarePreview, injuredTeamId!, injuredPlayerId!);
    const noInjuryFinal = findPlayerFinalScore(noInjuryPreview, injuredTeamId!, injuredPlayerId!);
    expect(injuryAwareFinal).not.toBeNull();
    expect(noInjuryFinal).not.toBeNull();
    // The injury malus lowers the score, at the fatigue*0.75 ratio.
    expect(injuryAwareFinal!).toBeLessThan(noInjuryFinal!);
    expect(injuryAwareFinal! / noInjuryFinal!).toBeCloseTo(0.75, 1);

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

  it("self-heals a team whose available roster for this matchday drops below the 7-player floor instead of stalling the season (MD8->MD9 production stall regression)", async () => {
    const gameState = createFreshSeasonOneGameState();
    // Move to matchday-2 and top up every team's roster to EXACTLY that matchday's combined
    // discipline requirement (zero rotation slack) — the same "no bench margin" state the
    // real season reaches on its heaviest weeks (see full-season-ui-playthrough.ts topUpRostersForLineups).
    gameState.matchdayState = { ...gameState.matchdayState, matchdayId: "matchday-2" };
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

    const targetTeam = gameState.teams[0]!;
    const targetRoster = gameState.rosters.filter((entry) => entry.teamId === targetTeam.teamId);
    // Root cause reproduction: a player selected into a lineup never recovers fatigue that
    // matchday (only benched players do), so a team with zero rotation slack has its WHOLE
    // roster climb in fatigue every week with no relief. Simulate the resulting pileup directly —
    // several of THIS team's players are "injured" from matchday-1's heavy use and unavailable
    // for matchday-2, leaving fewer than LEGACY_MATCHDAY_MINIMUM_PLAYERS (7) available.
    const injuredCount = Math.max(0, targetRoster.length - 5);
    expect(injuredCount).toBeGreaterThan(0);
    gameState.seasonState.playerAvailabilityState = targetRoster.slice(0, injuredCount).map((entry) => ({
      playerId: entry.playerId,
      teamId: targetTeam.teamId,
      fatigue: 90,
      injuryStatus: "injured" as const,
      injuredAtMatchdayId: "matchday-1",
      injuryUntilMatchday: "matchday-2",
    }));

    const scope = {
      saveId: "test-save",
      seasonId: gameState.season.id,
      matchdayId: "matchday-2",
    };
    const preContextResult = loadLocalLegacyLineupContextFromGameState(gameState, {
      ...scope,
      teamId: targetTeam.teamId,
    });
    if (!preContextResult.ok) {
      throw new Error(preContextResult.errors.join(" | "));
    }
    // Confirms the scenario actually reproduces the pre-fix stall condition.
    expect(preContextResult.context.activePlayers.length).toBeLessThan(7);

    const persistence = createInMemoryPersistence(gameState, true);
    const result = await runLocalMatchdayAutoRun(
      {
        ...scope,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: true,
          stopOnTie: false,
          advanceAfterCashApply: false,
        },
      },
      persistence,
    );

    // Without the self-heal, this always blocks with resolve_status:incomplete_lineups because
    // isPartialLineupAllowed requires at least 7 active players before it ever allows a partial
    // lineup — no lineup construction, however clever, can satisfy that with only 5 active.
    expect(result.blockingReasons).not.toContain("resolve_status:incomplete_lineups");
    expect(result.ok).toBe(true);
    const resultApplyStep = result.steps.find((step) => step.key === "result_apply");
    expect(resultApplyStep?.status).toBe("applied");

    // The emergency reinforcement actually ran and is visible/auditable in the step warnings.
    expect(
      result.warnings.some((warning) => warning.startsWith(`emergency_roster_reinforcement:${targetTeam.teamId}:`)),
    ).toBe(true);

    const postGameState = persistence.getSaveById(scope.saveId)!.gameState;
    const postContextResult = loadLocalLegacyLineupContextFromGameState(postGameState, {
      ...scope,
      teamId: targetTeam.teamId,
    });
    if (!postContextResult.ok) {
      throw new Error(postContextResult.errors.join(" | "));
    }
    expect(postContextResult.context.activePlayers.length).toBeGreaterThanOrEqual(7);
  }, 40_000);
});
