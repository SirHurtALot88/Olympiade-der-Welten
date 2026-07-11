import type { GameState, Team, TeamControlMode, TeamControlSettings } from "@/lib/data/olyDataTypes";
import {
  resolveFoundationSaveMode,
  type FoundationSaveModePreset,
} from "@/lib/persistence/foundation-save-mode";

export const DEFAULT_ACTIVE_OWNER_ID = "user_local";
export const FRANKY_OWNER_ID = "franky_remote_placeholder";
export const LOCAL_USER_DISPLAY_LABEL = "Chris";
export const AI_OWNER_ID = "ai";

export type TeamOwnerType = "local_user" | "local_friend" | "remote_player" | "ai";

export type TeamOwner = {
  ownerId: string;
  label: string;
  type: TeamOwnerType;
  controlledTeamIds: string[];
};

export type TeamControlFilter =
  | "my_teams"
  | "human"
  | "ai"
  | "passive"
  | "all"
  | `owner:${string}`;

export const DEFAULT_TEAM_OWNERS: Array<Omit<TeamOwner, "controlledTeamIds">> = [
  { ownerId: DEFAULT_ACTIVE_OWNER_ID, label: LOCAL_USER_DISPLAY_LABEL, type: "local_user" },
  { ownerId: "ramona_local", label: "Ramona", type: "local_friend" },
  { ownerId: FRANKY_OWNER_ID, label: "Franky", type: "remote_player" },
  { ownerId: AI_OWNER_ID, label: "AI", type: "ai" },
];

function normalizeOwnerIdForMode(controlMode: TeamControlMode, ownerId: string | null | undefined) {
  if (controlMode === "manual") {
    return ownerId && ownerId !== AI_OWNER_ID ? ownerId : DEFAULT_ACTIVE_OWNER_ID;
  }

  if (controlMode === "ai") {
    return AI_OWNER_ID;
  }

  return ownerId ?? AI_OWNER_ID;
}

function normalizeOwnerSlotForMode(controlMode: TeamControlMode, ownerSlot: string | null | undefined, ownerId: string) {
  if (ownerSlot) {
    return ownerSlot;
  }

  if (controlMode === "manual") {
    return ownerId === DEFAULT_ACTIVE_OWNER_ID ? "user" : ownerId;
  }

  return controlMode;
}

export function createDefaultTeamControlSettings(team: Team): TeamControlSettings {
  const controlMode: TeamControlMode = team.humanControlled ? "manual" : "ai";
  const ownerId = normalizeOwnerIdForMode(controlMode, null);

  return {
    teamId: team.teamId,
    controlMode,
    ownerId,
    ownerSlot: normalizeOwnerSlotForMode(controlMode, null, ownerId),
    displayLabel: team.shortCode,
    aiLineupPreviewEnabled: controlMode === "ai",
    aiLineupApplyEnabled: false,
    aiLineupAutoApplyEnabled: false,
    aiTransferPreviewEnabled: controlMode === "ai",
    aiTransferAutoApplyEnabled: false,
    aiSellPreviewEnabled: controlMode === "ai",
    aiSellAutoApplyEnabled: false,
    notes: null,
    strategyLock: null,
  };
}

/** Teams under manual control (Spieler-Teams aus Admin/Team-Einstellungen). */
export function getManualControlTeamIds(gameState: GameState): Set<string> {
  const settingsMap = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  return new Set(
    gameState.teams
      .filter((team) => settingsMap[team.teamId]?.controlMode === "manual")
      .map((team) => team.teamId),
  );
}

export function buildTeamControlSettingsMap(teams: Team[], existing?: Record<string, TeamControlSettings> | null) {
  return Object.fromEntries(
    teams.map((team) => {
      const current = existing?.[team.teamId];
      const defaults = createDefaultTeamControlSettings(team);
      const controlMode = current?.controlMode ?? defaults.controlMode;
      const ownerId = normalizeOwnerIdForMode(controlMode, current?.ownerId ?? defaults.ownerId);
      return [
        team.teamId,
        {
          ...defaults,
          ...current,
          teamId: team.teamId,
          controlMode,
          ownerId,
          ownerSlot: normalizeOwnerSlotForMode(controlMode, current?.ownerSlot ?? defaults.ownerSlot, ownerId),
          displayLabel: current?.displayLabel ?? defaults.displayLabel,
          aiLineupApplyEnabled: current?.aiLineupApplyEnabled ?? current?.aiLineupAutoApplyEnabled ?? defaults.aiLineupApplyEnabled,
        },
      ];
    }),
  );
}

export function getTeamControlSettings(gameState: GameState, teamId: string) {
  const existing = gameState.seasonState.teamControlSettings?.[teamId];
  if (existing) {
    return existing;
  }

  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  return team ? createDefaultTeamControlSettings(team) : null;
}

export function isChrisOwnedTeamSettings(settings: TeamControlSettings | null | undefined) {
  if (!settings || settings.controlMode !== "manual") {
    return false;
  }

  const ownerId = normalizeOwnerIdForMode(settings.controlMode, settings.ownerId);
  return (
    ownerId === DEFAULT_ACTIVE_OWNER_ID ||
    settings.ownerSlot === "user" ||
    settings.displayLabel === LOCAL_USER_DISPLAY_LABEL
  );
}

export function isFrankyOwnedTeamSettings(settings: TeamControlSettings | null | undefined) {
  if (!settings || settings.controlMode !== "manual") {
    return false;
  }

  const ownerId = normalizeOwnerIdForMode(settings.controlMode, settings.ownerId);
  return ownerId === FRANKY_OWNER_ID || settings.displayLabel === "Franky";
}

export function deriveChrisFrankyTeamIdsFromSettings(teams: Team[], settingsMap: Record<string, TeamControlSettings>) {
  const chrisTeamIds: string[] = [];
  const frankyTeamIds: string[] = [];

  for (const team of teams) {
    const settings = settingsMap[team.teamId];
    if (isChrisOwnedTeamSettings(settings)) {
      chrisTeamIds.push(team.teamId);
      continue;
    }
    if (isFrankyOwnedTeamSettings(settings)) {
      frankyTeamIds.push(team.teamId);
    }
  }

  return { chrisTeamIds, frankyTeamIds };
}

export function getGameModeOwnershipLimits(saveMode: FoundationSaveModePreset): {
  chrisMax: number;
  frankyMax: number;
} {
  switch (saveMode) {
    case "online_4v4":
      return { chrisMax: 4, frankyMax: 4 };
    case "solo_4":
      return { chrisMax: 4, frankyMax: 0 };
    case "solo_2":
      return { chrisMax: 2, frankyMax: 0 };
    case "solo_1":
      return { chrisMax: 1, frankyMax: 0 };
    default:
      return { chrisMax: 1, frankyMax: 0 };
  }
}

export function createChrisFrankyTeamControlSetting(
  team: Team,
  ownership: "chris" | "franky" | "ai",
): TeamControlSettings {
  if (ownership === "chris") {
    return {
      teamId: team.teamId,
      controlMode: "manual",
      ownerId: DEFAULT_ACTIVE_OWNER_ID,
      ownerSlot: "user",
      displayLabel: LOCAL_USER_DISPLAY_LABEL,
      aiLineupPreviewEnabled: false,
      aiLineupApplyEnabled: false,
      aiLineupAutoApplyEnabled: false,
      aiTransferPreviewEnabled: false,
      aiTransferAutoApplyEnabled: false,
      aiSellPreviewEnabled: false,
      aiSellAutoApplyEnabled: false,
      notes: null,
      strategyLock: null,
    };
  }

  if (ownership === "franky") {
    return {
      teamId: team.teamId,
      controlMode: "manual",
      ownerId: FRANKY_OWNER_ID,
      ownerSlot: FRANKY_OWNER_ID,
      displayLabel: "Franky",
      aiLineupPreviewEnabled: false,
      aiLineupApplyEnabled: false,
      aiLineupAutoApplyEnabled: false,
      aiTransferPreviewEnabled: false,
      aiTransferAutoApplyEnabled: false,
      aiSellPreviewEnabled: false,
      aiSellAutoApplyEnabled: false,
      notes: null,
      strategyLock: null,
    };
  }

  return {
    teamId: team.teamId,
    controlMode: "ai",
    ownerId: AI_OWNER_ID,
    ownerSlot: "ai",
    displayLabel: "AI",
    aiLineupPreviewEnabled: true,
    aiLineupApplyEnabled: false,
    aiLineupAutoApplyEnabled: false,
    aiTransferPreviewEnabled: true,
    aiTransferAutoApplyEnabled: false,
    aiSellPreviewEnabled: true,
    aiSellAutoApplyEnabled: false,
    notes: null,
    strategyLock: null,
  };
}

export function applyChrisFrankyOwnershipToTeamControlSettings(
  teams: Team[],
  chrisTeamIds: string[],
  frankyTeamIds: string[],
  existing?: Record<string, TeamControlSettings> | null,
) {
  const chrisSet = new Set(chrisTeamIds);
  const frankySet = new Set(frankyTeamIds.filter((teamId) => !chrisSet.has(teamId)));

  return Object.fromEntries(
    teams.map((team) => {
      const existingSettings = existing?.[team.teamId];
      const ownership = chrisSet.has(team.teamId) ? "chris" : frankySet.has(team.teamId) ? "franky" : "ai";
      const nextSettings = createChrisFrankyTeamControlSetting(team, ownership);
      return [
        team.teamId,
        existingSettings
          ? {
              ...existingSettings,
              ...nextSettings,
              teamId: team.teamId,
              notes: existingSettings.notes ?? nextSettings.notes,
              strategyLock: existingSettings.strategyLock ?? nextSettings.strategyLock,
            }
          : nextSettings,
      ];
    }),
  );
}

export function resolveGameModeFromState(gameState: GameState): FoundationSaveModePreset {
  return resolveFoundationSaveMode({ gameState, scenarioMeta: gameState.scenarioMeta });
}

export function applyGameModeOwnership(
  gameState: GameState,
  input: {
    saveMode: FoundationSaveModePreset;
    chrisTeamIds: string[];
    frankyTeamIds: string[];
  },
): GameState {
  const validTeamIds = new Set(gameState.teams.map((team) => team.teamId));
  const chrisTeamIds = input.chrisTeamIds.filter((teamId) => validTeamIds.has(teamId));
  const frankyTeamIds = input.frankyTeamIds.filter(
    (teamId) => validTeamIds.has(teamId) && !chrisTeamIds.includes(teamId),
  );
  const teamControlSettings = applyChrisFrankyOwnershipToTeamControlSettings(
    gameState.teams,
    chrisTeamIds,
    frankyTeamIds,
    gameState.seasonState.teamControlSettings,
  );
  const teams = gameState.teams.map((team) => ({
    ...team,
    humanControlled: teamControlSettings[team.teamId]?.controlMode === "manual",
  }));
  const primaryChrisTeamId = chrisTeamIds[0] ?? null;
  const humanControlledTeamCount = chrisTeamIds.length + frankyTeamIds.length;

  return {
    ...gameState,
    teams,
    scenarioMeta: gameState.scenarioMeta
      ? {
          ...gameState.scenarioMeta,
          saveMode: input.saveMode,
          newGamePresetId: input.saveMode,
          humanControlledTeamCount,
        }
      : gameState.scenarioMeta,
    seasonState: {
      ...gameState.seasonState,
      teamControlSettings,
      newGameFlow: gameState.seasonState.newGameFlow
        ? {
            ...gameState.seasonState.newGameFlow,
            selectedTeamId:
              input.saveMode === "solo_1"
                ? primaryChrisTeamId
                : (gameState.seasonState.newGameFlow.selectedTeamId ?? primaryChrisTeamId),
          }
        : gameState.seasonState.newGameFlow,
    },
  };
}

/** Sync derived fields from teamControlSettings without mutating ownership. */
export function withNormalizedTeamControlSettings(gameState: GameState): GameState {
  const settingsMap = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  const teams = gameState.teams.map((team) => ({
    ...team,
    humanControlled: settingsMap[team.teamId]?.controlMode === "manual",
  }));

  return {
    ...gameState,
    teams,
    seasonState: {
      ...gameState.seasonState,
      teamControlSettings: buildTeamControlSettingsMap(teams, settingsMap),
    },
  };
}

export function mergeAiAutomationFromDraft(
  ownershipSettings: Record<string, TeamControlSettings>,
  draft: Record<string, TeamControlSettings>,
): Record<string, TeamControlSettings> {
  return Object.fromEntries(
    Object.entries(ownershipSettings).map(([teamId, settings]) => {
      const draftSettings = draft[teamId];
      if (settings.controlMode !== "ai" || !draftSettings) {
        return [teamId, settings];
      }

      return [
        teamId,
        {
          ...settings,
          aiLineupPreviewEnabled: draftSettings.aiLineupPreviewEnabled,
          aiLineupApplyEnabled: draftSettings.aiLineupApplyEnabled,
          aiLineupAutoApplyEnabled: draftSettings.aiLineupAutoApplyEnabled,
          aiTransferPreviewEnabled: draftSettings.aiTransferPreviewEnabled,
          aiTransferAutoApplyEnabled: draftSettings.aiTransferAutoApplyEnabled,
          aiSellPreviewEnabled: draftSettings.aiSellPreviewEnabled,
          aiSellAutoApplyEnabled: draftSettings.aiSellAutoApplyEnabled,
          notes: draftSettings.notes ?? settings.notes,
        },
      ];
    }),
  );
}

export function isAiLineupBatchApplyEnabled(settings: TeamControlSettings | null | undefined) {
  if (!settings) {
    return false;
  }

  return settings.aiLineupApplyEnabled ?? settings.aiLineupAutoApplyEnabled ?? false;
}

export function buildTeamOwners(teams: Team[], settingsMap: Record<string, TeamControlSettings>): TeamOwner[] {
  const ownerMeta = new Map(DEFAULT_TEAM_OWNERS.map((owner) => [owner.ownerId, owner]));
  const controlledTeamIds = new Map<string, string[]>();

  for (const team of teams) {
    const settings = settingsMap[team.teamId] ?? createDefaultTeamControlSettings(team);
    const ownerId = normalizeOwnerIdForMode(settings.controlMode, settings.ownerId);
    controlledTeamIds.set(ownerId, [...(controlledTeamIds.get(ownerId) ?? []), team.teamId]);
    if (!ownerMeta.has(ownerId)) {
      ownerMeta.set(ownerId, {
        ownerId,
        label: settings.displayLabel ?? ownerId,
        type: "local_friend",
      });
    }
  }

  return Array.from(ownerMeta.values()).map((owner) => ({
    ...owner,
    controlledTeamIds: controlledTeamIds.get(owner.ownerId) ?? [],
  }));
}

export function getTeamOwner(settings: TeamControlSettings | null | undefined) {
  if (!settings) {
    return null;
  }

  return normalizeOwnerIdForMode(settings.controlMode, settings.ownerId);
}

export function canOwnerManageTeam(
  settings: TeamControlSettings | null | undefined,
  activeOwnerId = DEFAULT_ACTIVE_OWNER_ID,
) {
  if (!settings || settings.controlMode !== "manual") {
    return false;
  }

  return getTeamOwner(settings) === activeOwnerId;
}

export function canLocalUserManageTeam(
  gameState: GameState,
  teamId: string | null | undefined,
  activeOwnerId = DEFAULT_ACTIVE_OWNER_ID,
) {
  if (!teamId) {
    return false;
  }

  return canOwnerManageTeam(getTeamControlSettings(gameState, teamId), activeOwnerId);
}

export function filterTeamsByControlScope(
  teams: Team[],
  settingsMap: Record<string, TeamControlSettings>,
  filter: TeamControlFilter,
  activeOwnerId = DEFAULT_ACTIVE_OWNER_ID,
) {
  if (filter === "all") {
    return teams;
  }

  if (filter === "human") {
    return teams.filter((team) => settingsMap[team.teamId]?.controlMode === "manual");
  }

  if (filter === "ai") {
    return teams.filter((team) => settingsMap[team.teamId]?.controlMode === "ai");
  }

  if (filter === "passive") {
    return teams.filter((team) => settingsMap[team.teamId]?.controlMode === "passive");
  }

  const ownerId = filter.startsWith("owner:") ? filter.slice("owner:".length) : activeOwnerId;
  return teams.filter((team) => {
    const settings = settingsMap[team.teamId];
    return getTeamOwner(settings) === ownerId;
  });
}
