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

export type SeasonEndProgressionBatchPreview = {
  /** Per-team organic dry-run previews (the exact objects the apply consumes) — no mutations/persistence. */
  teamApplies: SeasonEndProgressionTeamApply[];
  teamsProcessed: number;
  teamsApplied: number;
  humanOrganicTeams: number;
  aiOrganicFallbackTeams: number;
  warnings: string[];
  blockingReasons: string[];
};

/**
 * Audit #5: single-source DRY-RUN of the season-end organic progression for ALL rostered teams. This is
 * exactly the per-team `previewSeasonEndXpSpend` pass that `runSeasonEndProgressionBatch` runs before it
 * applies mutations — extracted so BOTH the apply path AND the pre-season workflow preview consume the same
 * computation (⇒ "Vorschau == Apply" by construction, replacing the legacy hardcoded `power +1` preview).
 * Pure: builds the shared economy context + O(n²)-guarded pre-computed XP map ONCE and performs no writes.
 */
export function previewSeasonEndProgressionBatch(save: PersistedSaveGame): SeasonEndProgressionBatchPreview {
  const materializationSave: PersistedSaveGame = { ...save, status: "active" };
  const gameState = materializationSave.gameState;
  const completedSeasonId = gameState.season.id;
  const teamControlSettings = gameState.seasonState.teamControlSettings ?? {};
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  let teamsProcessed = 0;
  let teamsApplied = 0;
  let humanOrganicTeams = 0;
  let aiOrganicFallbackTeams = 0;

  // Perf: shared context + precompute map built EXACTLY once (buildPreComputedSeasonXpMap is the
  // O(n²)-avoidance from the apply service). Both are reused across every team below.
  const sharedEconomyContext = buildEconomyPreviewContext(gameState);
  const sharedPreComputedSeasonXp = buildPreComputedSeasonXpMap(materializationSave);
  const teamApplies: SeasonEndProgressionTeamApply[] = [];

  console.error(`[season-end-xp] ${completedSeasonId}: preview ${gameState.teams.length} teams…`);

  for (const team of gameState.teams) {
    const rosterCount = gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    if (rosterCount === 0) continue;
    teamsProcessed += 1;
    if (teamsProcessed === 1 || teamsProcessed % 8 === 0 || teamsProcessed === gameState.teams.length) {
      console.error(`[season-end-xp] ${completedSeasonId}: preview team ${teamsProcessed}/${gameState.teams.length} (${team.shortCode})`);
    }
    const controlMode = teamControlSettings[team.teamId]?.controlMode ?? (team.humanControlled === false ? "ai" : "manual");

    const preview = previewSeasonEndXpSpend(
      materializationSave,
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

  return { teamApplies, teamsProcessed, teamsApplied, humanOrganicTeams, aiOrganicFallbackTeams, warnings, blockingReasons };
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

  // Identical dry-run as the pre-season workflow preview (Vorschau == Apply): read the capture's save so
  // the teamApplies are computed against the very gameState the mutations are then applied to.
  const {
    teamApplies,
    teamsProcessed,
    teamsApplied,
    humanOrganicTeams,
    aiOrganicFallbackTeams,
    warnings,
    blockingReasons,
  } = previewSeasonEndProgressionBatch(capture.getSave());

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
