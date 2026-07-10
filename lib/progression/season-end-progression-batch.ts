import {
  applySeasonEndProgressionMutations,
  buildEconomyPreviewContext,
  buildPreComputedSeasonXpMap,
  finalizeSeasonEndProgressionLeagueEconomy,
  previewSeasonEndXpSpend,
  type SeasonEndProgressionTeamApply,
} from "@/lib/progression/season-end-xp-apply-service";
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
  const cloneOnRead = !input.skipDelegateWrites;
  const readSave = () => (cloneOnRead ? structuredClone(currentSave) : currentSave);
  const persistence: PersistenceService = {
    ...input.delegate,
    bootstrapSingleplayerSave() {
      return { save: readSave(), createdFromSeed: false };
    },
    getActiveSave() {
      return readSave();
    },
    getSaveById(saveId) {
      return saveId === currentSave.saveId ? readSave() : input.delegate.getSaveById(saveId);
    },
    saveSingleplayerState(saveId, nextGameState) {
      if (input.skipDelegateWrites) {
        if (saveId === currentSave.saveId) {
          currentSave = {
            ...currentSave,
            updatedAt: new Date().toISOString(),
            gameState: nextGameState,
          };
        }
        return currentSave;
      }
      const saved = input.delegate.saveSingleplayerState(saveId, nextGameState);
      if (saveId === currentSave.saveId) {
        currentSave = {
          ...currentSave,
          updatedAt: saved.updatedAt ?? new Date().toISOString(),
          gameState: structuredClone(nextGameState),
        };
      }
      return readSave();
    },
  };
  return {
    persistence,
    getSave: readSave,
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

  const sharedEconomyContext = buildEconomyPreviewContext(materializationSave.gameState);
  const sharedPreComputedSeasonXp = buildPreComputedSeasonXpMap(materializationSave);
  const teamApplies: SeasonEndProgressionTeamApply[] = [];

  console.error(
    `[season-end-xp] ${completedSeasonId}: preview ${materializationSave.gameState.teams.length} teams…`,
  );

  for (const team of materializationSave.gameState.teams) {
    const currentSave = capture.getSave();
    const rosterCount = currentSave.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    if (rosterCount === 0) continue;
    teamsProcessed += 1;
    if (teamsProcessed === 1 || teamsProcessed % 8 === 0 || teamsProcessed === materializationSave.gameState.teams.length) {
      console.error(`[season-end-xp] ${completedSeasonId}: preview team ${teamsProcessed}/${materializationSave.gameState.teams.length} (${team.shortCode})`);
    }
    const controlMode = teamControlSettings[team.teamId]?.controlMode ?? (team.humanControlled === false ? "ai" : "manual");

    const preview = previewSeasonEndXpSpend(
      currentSave,
      team.teamId,
      sharedEconomyContext,
      { skipAfterEconomyAudit: true, fastDisciplineLeague: true },
      sharedPreComputedSeasonXp,
    );
    if (!preview.confirmToken || !preview.ok) {
      const softReasons = preview.blockingReasons.filter((reason) => reason !== "season_xp_no_unmaterialized_xp");
      warnings.push(...preview.warnings.map((warning) => `${team.shortCode}:${warning}`));
      warnings.push(...softReasons.map((reason) => `${team.shortCode}:${reason}`));
      continue;
    }

    teamApplies.push({ teamId: team.teamId, preview });
    teamsApplied += 1;
    if (controlMode === "ai") aiOrganicFallbackTeams += 1;
    else humanOrganicTeams += 1;
  }

  const beforeBatchSave = capture.getSave();
  let batchedGameState = beforeBatchSave.gameState;

  if (teamApplies.length > 0) {
    console.error(
      `[season-end-xp] ${completedSeasonId}: apply progression mutations once (${teamApplies.length} teams)…`,
    );
    const mutations = applySeasonEndProgressionMutations({
      gameState: beforeBatchSave.gameState,
      teamApplies,
    });
    console.error(
      `[season-end-xp] ${completedSeasonId}: league discipline + market value recalc once (${batchedGameState.players.length} players)…`,
    );
    const leagueRecalcStartedAt = Date.now();
    batchedGameState = finalizeSeasonEndProgressionLeagueEconomy({
      gameState: mutations.gameState,
      seasonId: completedSeasonId,
      progressedPlayerIds: mutations.progressedPlayerIds,
      disciplineBaselinesBefore: mutations.disciplineBaselinesBefore,
    });
    console.error(
      `[season-end-xp] ${completedSeasonId}: league recalc done in ${Date.now() - leagueRecalcStartedAt}ms`,
    );
  }

  const playerEventsCreated = (batchedGameState.playerProgressionEvents ?? []).filter(
    (event) => event.seasonId === completedSeasonId,
  ).length;
  if (teamsProcessed > 0 && playerEventsCreated === 0) {
    blockingReasons.push("season_end_progression_no_player_events");
  }

  console.error(`[season-end-xp] ${completedSeasonId}: persist batch state once…`);
  const persistFinalState = input.persistFinalState !== false;
  if (persistFinalState) {
    input.persistence.saveSingleplayerState(beforeBatchSave.saveId, batchedGameState);
    console.error(`[season-end-xp] ${completedSeasonId}: persist done`);
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
