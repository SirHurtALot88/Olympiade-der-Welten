import { createHash } from "node:crypto";

import type { AiManagerTrainingSettingRecord, GameState, TrainingIntensityConfirmationRecord } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { persistGameStateWithMaterializedDerivations } from "@/lib/foundation/materialize-season-derivations";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import type { AiManagementTrainingFocus, AiManagementTrainingIntensity } from "@/lib/ai/ai-team-management-preview-service";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import { isTrainingIntensityLockedForSeason } from "@/lib/foundation/game-phase-action-policy";

export const TRAINING_INTENSITY_LOCKED_BLOCKING_REASON = "training_intensity_locked_for_season";

function buildTrainingIntensityConfirmationRecord(input: {
  teamId: string;
  seasonId: string;
  sourcePlanId: string;
}): TrainingIntensityConfirmationRecord {
  return {
    teamId: input.teamId,
    seasonId: input.seasonId,
    confirmedAt: new Date().toISOString(),
    sourcePlanId: input.sourcePlanId,
  };
}

export type TeamTrainingSettingsPreview = {
  ok: boolean;
  dryRun: true;
  confirmToken: string | null;
  teamId: string;
  seasonId: string;
  trainingFocus: AiManagementTrainingFocus;
  trainingIntensity: AiManagementTrainingIntensity;
  playerTrainingMode: PlayerTrainingMode;
  affectedPlayers: number;
  expectedXpEffect: number;
  expectedRecoveryEffect: number;
  expectedInjuryRiskEffect: number;
  warnings: string[];
  blockingReasons: string[];
};

export type TeamTrainingSettingsApplyResult = Omit<TeamTrainingSettingsPreview, "dryRun"> & {
  dryRun: false;
  applied: boolean;
  // See FacilityUpgradeApplyResult.save in facility-upgrade-service.ts: avoids a redundant full
  // GameState re-read via persistence.getSaveById() in bulk callers like applyAiManagerPlan.
  save?: PersistedSaveGame | null;
};

export function trainingIntensityToMode(intensity: AiManagementTrainingIntensity): PlayerTrainingMode {
  if (intensity === "light") return "leicht";
  if (intensity === "hard") return "hart";
  return "mittel";
}

function buildConfirmToken(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  trainingFocus: AiManagementTrainingFocus;
  trainingIntensity: AiManagementTrainingIntensity;
  affectedPlayers: number;
}) {
  return createHash("sha256")
    .update(
      [
        input.saveId,
        input.seasonId,
        input.teamId,
        input.trainingFocus,
        input.trainingIntensity,
        input.affectedPlayers,
      ].join(":"),
    )
    .digest("hex");
}

function buildIntensityEffects(intensity: AiManagementTrainingIntensity) {
  if (intensity === "hard") {
    return {
      expectedXpEffect: 110,
      expectedRecoveryEffect: 82,
      expectedInjuryRiskEffect: 18,
      warnings: ["hard_training_recovery_cost"],
    };
  }
  if (intensity === "light") {
    return {
      expectedXpEffect: 40,
      expectedRecoveryEffect: 108,
      expectedInjuryRiskEffect: -10,
      warnings: ["light_training_lower_xp"],
    };
  }
  return {
    expectedXpEffect: 70,
    expectedRecoveryEffect: 100,
    expectedInjuryRiskEffect: 0,
    warnings: [] as string[],
  };
}

export function previewTeamTrainingSettings(input: {
  save: PersistedSaveGame;
  teamId: string;
  trainingFocus: AiManagementTrainingFocus;
  trainingIntensity: AiManagementTrainingIntensity;
}): TeamTrainingSettingsPreview {
  const team = input.save.gameState.teams.find((entry) => entry.teamId === input.teamId) ?? null;
  const rosterPlayerIds = new Set(
    input.save.gameState.rosters.filter((entry) => entry.teamId === input.teamId).map((entry) => entry.playerId),
  );
  const affectedPlayers = input.save.gameState.players.filter((player) => rosterPlayerIds.has(player.id)).length;
  const blockingReasons: string[] = [];
  if (input.save.status !== "active") blockingReasons.push("save_not_active");
  if (!team) blockingReasons.push("team_not_found");
  if (affectedPlayers <= 0) blockingReasons.push("team_roster_empty");
  if (isTrainingIntensityLockedForSeason(input.save.gameState)) blockingReasons.push(TRAINING_INTENSITY_LOCKED_BLOCKING_REASON);
  const effects = buildIntensityEffects(input.trainingIntensity);
  const confirmToken =
    blockingReasons.length === 0
      ? buildConfirmToken({
          saveId: input.save.saveId,
          seasonId: input.save.gameState.season.id,
          teamId: input.teamId,
          trainingFocus: input.trainingFocus,
          trainingIntensity: input.trainingIntensity,
          affectedPlayers,
        })
      : null;
  return {
    ok: blockingReasons.length === 0,
    dryRun: true,
    confirmToken,
    teamId: input.teamId,
    seasonId: input.save.gameState.season.id,
    trainingFocus: input.trainingFocus,
    trainingIntensity: input.trainingIntensity,
    playerTrainingMode: trainingIntensityToMode(input.trainingIntensity),
    affectedPlayers,
    ...effects,
    blockingReasons,
  };
}

export function applyTeamTrainingSettings(
  save: PersistedSaveGame,
  teamId: string,
  trainingFocus: AiManagementTrainingFocus,
  trainingIntensity: AiManagementTrainingIntensity,
  confirmToken: string | null | undefined,
  sourcePlanId = "manual_training_settings",
  persistence: PersistenceService = createPersistenceService(),
): TeamTrainingSettingsApplyResult {
  const preview = previewTeamTrainingSettings({ save, teamId, trainingFocus, trainingIntensity });
  if (!preview.ok || !preview.confirmToken || confirmToken !== preview.confirmToken) {
    return {
      ...preview,
      dryRun: false,
      applied: false,
      blockingReasons: [...preview.blockingReasons, confirmToken ? "training_settings_preview_stale" : "confirm_token_required"],
    };
  }

  const rosterPlayerIds = new Set(save.gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId));
  const record: AiManagerTrainingSettingRecord = {
    teamId,
    seasonId: save.gameState.season.id,
    sourcePlanId,
    trainingFocus,
    trainingIntensity,
    playerTrainingMode: preview.playerTrainingMode,
    expectedXpEffect: preview.expectedXpEffect,
    expectedRecoveryEffect: preview.expectedRecoveryEffect,
    expectedInjuryRiskEffect: preview.expectedInjuryRiskEffect,
    updatedAt: new Date().toISOString(),
  };
  const nextGameState: GameState = {
    ...save.gameState,
    players: save.gameState.players.map((player) =>
      rosterPlayerIds.has(player.id) ? { ...player, trainingMode: preview.playerTrainingMode } : player,
    ),
    seasonState: {
      ...save.gameState.seasonState,
      aiManagerTrainingSettings: {
        ...(save.gameState.seasonState.aiManagerTrainingSettings ?? {}),
        [teamId]: record,
      },
      trainingIntensityConfirmations: {
        ...(save.gameState.seasonState.trainingIntensityConfirmations ?? {}),
        [teamId]: buildTrainingIntensityConfirmationRecord({
          teamId,
          seasonId: save.gameState.season.id,
          sourcePlanId,
        }),
      },
    },
  };
  const persistedSave = persistGameStateWithMaterializedDerivations(persistence, save.saveId, nextGameState);
  return {
    ...preview,
    dryRun: false,
    applied: true,
    blockingReasons: [],
    save: persistedSave,
  };
}

export type PlayerTrainingClassAssignment = {
  playerId: string;
  trainingClass: string;
};

export type PlayerTrainingClassesPreview = {
  ok: boolean;
  dryRun: true;
  confirmToken: string | null;
  teamId: string;
  seasonId: string;
  assignments: PlayerTrainingClassAssignment[];
  warnings: string[];
  blockingReasons: string[];
};

export type PlayerTrainingClassesApplyResult = Omit<PlayerTrainingClassesPreview, "dryRun"> & {
  dryRun: false;
  applied: boolean;
  // See FacilityUpgradeApplyResult.save in facility-upgrade-service.ts: avoids a redundant full
  // GameState re-read via persistence.getSaveById() in bulk callers like applyAiManagerPlan.
  save?: PersistedSaveGame | null;
};

function buildPlayerClassesConfirmToken(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  assignments: PlayerTrainingClassAssignment[];
}) {
  const payload = input.assignments
    .slice()
    .sort((left, right) => left.playerId.localeCompare(right.playerId))
    .map((entry) => `${entry.playerId}:${entry.trainingClass}`)
    .join("|");
  return createHash("sha256")
    .update([input.saveId, input.seasonId, input.teamId, payload].join(":"))
    .digest("hex");
}

export function previewPlayerTrainingClasses(input: {
  save: PersistedSaveGame;
  teamId: string;
  assignments: PlayerTrainingClassAssignment[];
}): PlayerTrainingClassesPreview {
  const rosterPlayerIds = new Set(
    input.save.gameState.rosters.filter((entry) => entry.teamId === input.teamId).map((entry) => entry.playerId),
  );
  const blockingReasons: string[] = [];
  if (input.save.status !== "active") blockingReasons.push("save_not_active");
  if (rosterPlayerIds.size <= 0) blockingReasons.push("team_roster_empty");
  const validAssignments = input.assignments.filter((entry) => rosterPlayerIds.has(entry.playerId) && entry.trainingClass);
  if (validAssignments.length === 0) blockingReasons.push("no_valid_player_assignments");
  const confirmToken =
    blockingReasons.length === 0
      ? buildPlayerClassesConfirmToken({
          saveId: input.save.saveId,
          seasonId: input.save.gameState.season.id,
          teamId: input.teamId,
          assignments: validAssignments,
        })
      : null;
  return {
    ok: blockingReasons.length === 0,
    dryRun: true,
    confirmToken,
    teamId: input.teamId,
    seasonId: input.save.gameState.season.id,
    assignments: validAssignments,
    warnings: [],
    blockingReasons,
  };
}

export function applyPlayerTrainingClasses(
  save: PersistedSaveGame,
  teamId: string,
  assignments: PlayerTrainingClassAssignment[],
  confirmToken: string | null | undefined,
  persistence: PersistenceService = createPersistenceService(),
): PlayerTrainingClassesApplyResult {
  const preview = previewPlayerTrainingClasses({ save, teamId, assignments });
  if (!preview.ok || !preview.confirmToken || confirmToken !== preview.confirmToken) {
    return {
      ...preview,
      dryRun: false,
      applied: false,
      blockingReasons: [...preview.blockingReasons, confirmToken ? "player_training_classes_preview_stale" : "confirm_token_required"],
    };
  }
  const assignmentMap = new Map(preview.assignments.map((entry) => [entry.playerId, entry.trainingClass] as const));
  const nextGameState: GameState = {
    ...save.gameState,
    players: save.gameState.players.map((player) =>
      assignmentMap.has(player.id) ? { ...player, trainingClass: assignmentMap.get(player.id) } : player,
    ),
  };
  const persistedSave = persistGameStateWithMaterializedDerivations(persistence, save.saveId, nextGameState);
  return {
    ...preview,
    dryRun: false,
    applied: true,
    blockingReasons: [],
    save: persistedSave,
  };
}

export type PlayerTrainingModeAssignment = {
  playerId: string;
  trainingMode: PlayerTrainingMode;
};

export type PlayerTrainingModesPreview = {
  ok: boolean;
  dryRun: true;
  confirmToken: string | null;
  teamId: string;
  seasonId: string;
  assignments: PlayerTrainingModeAssignment[];
  warnings: string[];
  blockingReasons: string[];
};

export type PlayerTrainingModesApplyResult = Omit<PlayerTrainingModesPreview, "dryRun"> & {
  dryRun: false;
  applied: boolean;
  // See FacilityUpgradeApplyResult.save in facility-upgrade-service.ts: avoids a redundant full
  // GameState re-read via persistence.getSaveById() in bulk callers like applyAiManagerPlan.
  save?: PersistedSaveGame | null;
};

function buildPlayerModesConfirmToken(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  assignments: PlayerTrainingModeAssignment[];
}) {
  const payload = input.assignments
    .slice()
    .sort((left, right) => left.playerId.localeCompare(right.playerId))
    .map((entry) => `${entry.playerId}:${entry.trainingMode}`)
    .join("|");
  return createHash("sha256")
    .update([input.saveId, input.seasonId, input.teamId, payload].join(":"))
    .digest("hex");
}

export function previewPlayerTrainingModes(input: {
  save: PersistedSaveGame;
  teamId: string;
  assignments: PlayerTrainingModeAssignment[];
}): PlayerTrainingModesPreview {
  const rosterPlayerIds = new Set(
    input.save.gameState.rosters.filter((entry) => entry.teamId === input.teamId).map((entry) => entry.playerId),
  );
  const blockingReasons: string[] = [];
  if (input.save.status !== "active") blockingReasons.push("save_not_active");
  if (rosterPlayerIds.size <= 0) blockingReasons.push("team_roster_empty");
  if (isTrainingIntensityLockedForSeason(input.save.gameState)) blockingReasons.push(TRAINING_INTENSITY_LOCKED_BLOCKING_REASON);
  const validAssignments = input.assignments.filter((entry) => rosterPlayerIds.has(entry.playerId));
  if (validAssignments.length === 0) blockingReasons.push("no_valid_player_assignments");
  const confirmToken =
    blockingReasons.length === 0
      ? buildPlayerModesConfirmToken({
          saveId: input.save.saveId,
          seasonId: input.save.gameState.season.id,
          teamId: input.teamId,
          assignments: validAssignments,
        })
      : null;
  return {
    ok: blockingReasons.length === 0,
    dryRun: true,
    confirmToken,
    teamId: input.teamId,
    seasonId: input.save.gameState.season.id,
    assignments: validAssignments,
    warnings: [],
    blockingReasons,
  };
}

export function applyPlayerTrainingModes(
  save: PersistedSaveGame,
  teamId: string,
  assignments: PlayerTrainingModeAssignment[],
  confirmToken: string | null | undefined,
  persistence: PersistenceService = createPersistenceService(),
  sourcePlanId = "manual_player_training_modes",
): PlayerTrainingModesApplyResult {
  const preview = previewPlayerTrainingModes({ save, teamId, assignments });
  if (!preview.ok || !preview.confirmToken || confirmToken !== preview.confirmToken) {
    return {
      ...preview,
      dryRun: false,
      applied: false,
      blockingReasons: [...preview.blockingReasons, confirmToken ? "player_training_modes_preview_stale" : "confirm_token_required"],
    };
  }
  const assignmentMap = new Map(preview.assignments.map((entry) => [entry.playerId, entry.trainingMode] as const));
  const nextGameState: GameState = {
    ...save.gameState,
    players: save.gameState.players.map((player) =>
      assignmentMap.has(player.id) ? { ...player, trainingMode: assignmentMap.get(player.id) } : player,
    ),
    seasonState: {
      ...save.gameState.seasonState,
      trainingIntensityConfirmations: {
        ...(save.gameState.seasonState.trainingIntensityConfirmations ?? {}),
        [teamId]: buildTrainingIntensityConfirmationRecord({
          teamId,
          seasonId: save.gameState.season.id,
          sourcePlanId,
        }),
      },
    },
  };
  const persistedSave = persistGameStateWithMaterializedDerivations(persistence, save.saveId, nextGameState);
  return {
    ...preview,
    dryRun: false,
    applied: true,
    blockingReasons: [],
    save: persistedSave,
  };
}
