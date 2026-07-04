import {
  applySeasonEndXpSpend,
  buildEconomyPreviewContext,
  buildPreComputedSeasonXpMap,
  previewSeasonEndXpSpend,
} from "@/lib/progression/season-end-xp-apply-service";
import { applyRankTableMarketValuesToGameState, patchSeasonProgressionEventMarketValues } from "@/lib/player-formulas/market-value-apply";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

export type SeasonEndProgressionBatchResult = {
  save: PersistedSaveGame;
  teamsProcessed: number;
  teamsApplied: number;
  humanOrganicTeams: number;
  /** @deprecated Always 0 — manual AI XP spend removed. Kept for log compatibility. */
  aiPlannedTeams: number;
  /** @deprecated Renamed path: organic apply for AI teams. Kept for log compatibility. */
  aiOrganicFallbackTeams: number;
  playerEventsCreated: number;
  warnings: string[];
  blockingReasons: string[];
};

function createProgressionCapturePersistence(input: {
  save: PersistedSaveGame;
  delegate: PersistenceService;
  skipDelegateWrites?: boolean;
}): { persistence: PersistenceService; getSave: () => PersistedSaveGame } {
  let currentSave = structuredClone(input.save);
  const persistence: PersistenceService = {
    ...input.delegate,
    bootstrapSingleplayerSave() {
      return { save: structuredClone(currentSave), createdFromSeed: false };
    },
    getActiveSave() {
      return structuredClone(currentSave);
    },
    getSaveById(saveId) {
      return saveId === currentSave.saveId ? structuredClone(currentSave) : input.delegate.getSaveById(saveId);
    },
    saveSingleplayerState(saveId, nextGameState) {
      if (input.skipDelegateWrites) {
        if (saveId === currentSave.saveId) {
          currentSave = {
            ...currentSave,
            updatedAt: new Date().toISOString(),
            gameState: structuredClone(nextGameState),
          };
        }
        return structuredClone(currentSave);
      }
      const saved = input.delegate.saveSingleplayerState(saveId, nextGameState);
      if (saveId === currentSave.saveId) {
        currentSave = {
          ...currentSave,
          updatedAt: saved.updatedAt ?? new Date().toISOString(),
          gameState: structuredClone(nextGameState),
        };
      }
      return structuredClone(currentSave);
    },
  };
  return {
    persistence,
    getSave: () => structuredClone(currentSave),
  };
}

export function runSeasonEndProgressionBatch(input: {
  save: PersistedSaveGame;
  persistence: PersistenceService;
  /** When true (default), writes the batched final state once to the delegate persistence. */
  persistFinalState?: boolean;
}): SeasonEndProgressionBatchResult {
  const materializationSave: PersistedSaveGame = {
    ...input.save,
    status: "active",
  };
  const capture = createProgressionCapturePersistence({
    save: materializationSave,
    delegate: input.persistence,
    skipDelegateWrites: true,
  });
  const completedSeasonId = input.save.gameState.season.id;
  const teamControlSettings = materializationSave.gameState.seasonState.teamControlSettings ?? {};
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  let teamsProcessed = 0;
  let teamsApplied = 0;
  let humanOrganicTeams = 0;
  let aiOrganicFallbackTeams = 0;
  let playerEventsCreated = 0;

  const sharedEconomyContext = buildEconomyPreviewContext(materializationSave.gameState);
  const sharedPreComputedSeasonXp = buildPreComputedSeasonXpMap(materializationSave);

  for (const team of materializationSave.gameState.teams) {
    const currentSave = capture.getSave();
    const rosterCount = currentSave.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    if (rosterCount === 0) continue;
    teamsProcessed += 1;
    const controlMode = teamControlSettings[team.teamId]?.controlMode ?? (team.humanControlled === false ? "ai" : "manual");

    const preview = previewSeasonEndXpSpend(
      currentSave,
      team.teamId,
      sharedEconomyContext,
      { skipAfterEconomyAudit: true },
      sharedPreComputedSeasonXp,
    );
    if (!preview.confirmToken || !preview.ok) {
      const softReasons = preview.blockingReasons.filter((reason) => reason !== "season_xp_no_unmaterialized_xp");
      warnings.push(...preview.warnings.map((warning) => `${team.shortCode}:${warning}`));
      warnings.push(...softReasons.map((reason) => `${team.shortCode}:${reason}`));
      continue;
    }
    const result = applySeasonEndXpSpend(
      currentSave,
      team.teamId,
      preview.confirmToken,
      capture.persistence,
      {
        allowAiTeams: true,
        skipAfterEconomyAudit: true,
        deferLeagueWideMarketValueRecalc: true,
      },
      sharedEconomyContext,
      preview,
      sharedPreComputedSeasonXp,
    );
    warnings.push(...result.warnings.map((warning) => `${team.shortCode}:${warning}`));
    if (result.applied) {
      teamsApplied += 1;
      playerEventsCreated += result.eventIds.length;
      if (controlMode === "ai") aiOrganicFallbackTeams += 1;
      else humanOrganicTeams += 1;
    } else {
      blockingReasons.push(...result.blockingReasons.map((reason) => `${team.shortCode}:${reason}`));
    }
  }

  const finalSeasonEventCount = (capture.getSave().gameState.playerProgressionEvents ?? []).filter(
    (event) => event.seasonId === completedSeasonId,
  ).length;
  if (teamsProcessed > 0 && finalSeasonEventCount === 0) {
    blockingReasons.push("season_end_progression_no_player_events");
  }

  const beforeBatchSave = capture.getSave();
  const progressedPlayerIds = (beforeBatchSave.gameState.playerProgressionEvents ?? [])
    .filter((event) => event.seasonId === completedSeasonId)
    .map((event) => event.playerId);
  const batchedGameState = patchSeasonProgressionEventMarketValues({
    gameState: applyRankTableMarketValuesToGameState(beforeBatchSave.gameState),
    seasonId: completedSeasonId,
    playerIds: progressedPlayerIds,
  });

  const persistFinalState = input.persistFinalState !== false;
  if (persistFinalState) {
    input.persistence.saveSingleplayerState(beforeBatchSave.saveId, batchedGameState);
  } else {
    capture.persistence.saveSingleplayerState(beforeBatchSave.saveId, batchedGameState);
  }

  const batchedSave: PersistedSaveGame = {
    ...beforeBatchSave,
    gameState: batchedGameState,
    updatedAt: new Date().toISOString(),
  };

  return {
    save: batchedSave,
    teamsProcessed,
    teamsApplied,
    humanOrganicTeams,
    aiPlannedTeams: 0,
    aiOrganicFallbackTeams,
    playerEventsCreated,
    warnings: [...new Set(warnings)],
    blockingReasons: [...new Set(blockingReasons)],
  };
}
