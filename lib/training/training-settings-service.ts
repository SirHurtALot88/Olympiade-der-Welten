import { createHash } from "node:crypto";

import type { AiManagerTrainingSettingRecord, GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import type { AiManagementTrainingFocus, AiManagementTrainingIntensity } from "@/lib/ai/ai-team-management-preview-service";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

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
    },
  };
  persistence.saveSingleplayerState(save.saveId, nextGameState);
  return {
    ...preview,
    dryRun: false,
    applied: true,
    blockingReasons: [],
  };
}
