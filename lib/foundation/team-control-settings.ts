import type { GameState, Team, TeamControlMode, TeamControlSettings } from "@/lib/data/olyDataTypes";

export const DEFAULT_ACTIVE_OWNER_ID = "user_local";
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
  { ownerId: DEFAULT_ACTIVE_OWNER_ID, label: "User", type: "local_user" },
  { ownerId: "ramona_local", label: "Ramona", type: "local_friend" },
  { ownerId: "franky_remote_placeholder", label: "Franky", type: "remote_player" },
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

export function withNormalizedTeamControlSettings(gameState: GameState): GameState {
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      teamControlSettings: buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings),
    },
  };
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
