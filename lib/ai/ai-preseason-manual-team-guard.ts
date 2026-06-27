import type { GameState, ScenarioType } from "@/lib/data/olyDataTypes";
import {
  buildTeamControlSettingsMap,
  DEFAULT_ACTIVE_OWNER_ID,
} from "@/lib/foundation/team-control-settings";
import { allowsSandboxTestWrites } from "@/lib/persistence/sandbox-write-permissions";
import { inferScenarioType } from "@/lib/persistence/scenario-meta";

const AI_PRESEASON_OVERRIDE_SCENARIO_TYPES = new Set<ScenarioType>([
  "ai_redraft_test",
  "season1_simulation",
  "season_transition_test",
  "live_feature_test",
  "sandbox_multiseason_test",
  "sandbox_snapshot",
  "manager_multiplayer_test",
]);

export function getProtectedHumanTeamIds(gameState: GameState): Set<string> {
  return new Set(
    [
      gameState.seasonState.newGameFlow?.selectedTeamId ?? null,
      ...gameState.teams.filter((team) => team.humanControlled !== false).map((team) => team.teamId),
      ...Object.values(gameState.seasonState.teamControlSettings ?? {})
        .filter((settings) => settings.controlMode === "manual")
        .map((settings) => settings.teamId),
    ].filter((teamId): teamId is string => Boolean(teamId)),
  );
}

export function allowsAiPreseasonManualTeamOverride(input: {
  saveId: string;
  gameState: GameState;
  explicitOverride?: boolean;
}): boolean {
  if (input.explicitOverride) {
    return true;
  }
  if (allowsSandboxTestWrites(input.gameState)) {
    return true;
  }

  const scenarioType = input.gameState.scenarioMeta?.scenarioType ?? inferScenarioType(input.gameState);
  if (AI_PRESEASON_OVERRIDE_SCENARIO_TYPES.has(scenarioType)) {
    return true;
  }

  return /smoke|sandbox|test|block-/i.test(input.saveId);
}

function buildProtectedManualControlSettings(
  teamId: string,
  team: GameState["teams"][number] | undefined,
  current: ReturnType<typeof buildTeamControlSettingsMap>[string] | undefined,
) {
  return {
    ...current,
    teamId,
    controlMode: "manual" as const,
    ownerId: current?.ownerId && current.ownerId !== "ai" ? current.ownerId : DEFAULT_ACTIVE_OWNER_ID,
    ownerSlot: current?.ownerSlot && current.ownerSlot !== "ai" ? current.ownerSlot : "user",
    displayLabel: current?.displayLabel ?? team?.shortCode ?? teamId,
    aiLineupPreviewEnabled: false,
    aiLineupApplyEnabled: false,
    aiLineupAutoApplyEnabled: false,
    aiTransferPreviewEnabled: false,
    aiTransferAutoApplyEnabled: false,
    aiSellPreviewEnabled: false,
    aiSellAutoApplyEnabled: false,
    notes: current?.notes ?? null,
    strategyLock: current?.strategyLock ?? null,
  };
}

function hasProtectedManualControlSettings(
  settings: ReturnType<typeof buildTeamControlSettingsMap>[string] | undefined,
): boolean {
  if (!settings || settings.controlMode !== "manual") {
    return false;
  }

  return (
    settings.aiLineupPreviewEnabled === false &&
    settings.aiLineupApplyEnabled === false &&
    settings.aiLineupAutoApplyEnabled === false &&
    settings.aiTransferPreviewEnabled === false &&
    settings.aiTransferAutoApplyEnabled === false &&
    settings.aiSellPreviewEnabled === false &&
    settings.aiSellAutoApplyEnabled === false
  );
}

export function protectManualPlayerTeams(gameState: GameState): GameState {
  const protectedHumanTeamIds = getProtectedHumanTeamIds(gameState);
  if (protectedHumanTeamIds.size === 0) {
    return gameState;
  }

  const existingControl = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  let teamsChanged = false;
  const nextTeams = gameState.teams.map((team) => {
    if (!protectedHumanTeamIds.has(team.teamId) || team.humanControlled) {
      return team;
    }
    teamsChanged = true;
    return { ...team, humanControlled: true };
  });

  let controlChanged = false;
  const forcedControlSettings = Object.fromEntries(
    [...protectedHumanTeamIds].map((teamId) => {
      const team = gameState.teams.find((entry) => entry.teamId === teamId);
      const current = existingControl[teamId];
      const nextSettings = buildProtectedManualControlSettings(teamId, team, current);

      if (hasProtectedManualControlSettings(current)) {
        return [teamId, current] as const;
      }

      controlChanged = true;
      return [teamId, nextSettings] as const;
    }),
  );

  if (!teamsChanged && !controlChanged) {
    return gameState;
  }

  return {
    ...gameState,
    teams: nextTeams,
    seasonState: {
      ...gameState.seasonState,
      teamControlSettings: {
        ...existingControl,
        ...forcedControlSettings,
      },
    },
  };
}
