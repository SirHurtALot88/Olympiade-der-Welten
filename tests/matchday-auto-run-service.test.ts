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

    expect(aiLineupStep?.metrics.skippedManual).toBe(1);
    expect(Number(aiLineupStep?.metrics.skippedPassive ?? 0)).toBeGreaterThanOrEqual(0);
    expect(resolveStep?.metrics.manualMissing).toBe(1);
    expect(Number(resolveStep?.metrics.passiveMissing ?? 0)).toBeGreaterThanOrEqual(0);
    expect(resolveStep?.blockingReasons).toContain("missing_manual_lineup");
  });

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
});
