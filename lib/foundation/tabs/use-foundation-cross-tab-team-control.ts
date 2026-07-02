import { useMemo } from "react";

import type { GameState, Team } from "@/lib/data/olyDataTypes";
import {
  DEFAULT_ACTIVE_OWNER_ID,
  buildTeamControlSettingsMap,
  buildTeamOwners,
  deriveChrisFrankyTeamIdsFromSettings,
  filterTeamsByControlScope,
  getGameModeOwnershipLimits,
  isAiLineupBatchApplyEnabled,
  resolveGameModeFromState,
  type TeamControlFilter,
} from "@/lib/foundation/team-control-settings";
import { buildTeamStrategyProfileMap } from "@/lib/foundation/team-strategy-profiles";
import { resolveFoundationManageableTeamIds } from "@/lib/foundation/foundation-admin-dev-flags";

export function useFoundationCrossTabTeamControl(input: {
  gameState: GameState;
  activeOwnerId: string;
  teamContextFilter: TeamControlFilter;
  gameModeOwnershipChrisIds: string[];
  gameModeOwnershipFrankyIds: string[];
}) {
  const resolvedTeamControlSettings = useMemo(
    () => buildTeamControlSettingsMap(input.gameState.teams, input.gameState.seasonState.teamControlSettings),
    [input.gameState.seasonState.teamControlSettings, input.gameState.teams],
  );
  const resolvedTeamStrategyProfiles = useMemo(
    () =>
      buildTeamStrategyProfileMap(
        input.gameState.teams,
        input.gameState.teamIdentities,
        input.gameState.seasonState.teamStrategyProfiles,
      ),
    [input.gameState.seasonState.teamStrategyProfiles, input.gameState.teamIdentities, input.gameState.teams],
  );
  const aiTeams = useMemo(
    () => input.gameState.teams.filter((team) => resolvedTeamControlSettings[team.teamId]?.controlMode === "ai"),
    [input.gameState.teams, resolvedTeamControlSettings],
  );
  const aiLineupApplyTeams = useMemo(
    () => aiTeams.filter((team) => isAiLineupBatchApplyEnabled(resolvedTeamControlSettings[team.teamId])),
    [aiTeams, resolvedTeamControlSettings],
  );
  const aiLineupEnsureTeams = useMemo(() => aiTeams, [aiTeams]);
  const aiMarketEnabledTeams = useMemo(
    () =>
      aiTeams.filter((team) => {
        const settings = resolvedTeamControlSettings[team.teamId];
        return Boolean(settings?.aiTransferPreviewEnabled && settings?.aiSellPreviewEnabled);
      }),
    [aiTeams, resolvedTeamControlSettings],
  );
  const aiMarketDisabledTeams = useMemo(
    () => Math.max(aiTeams.length - aiMarketEnabledTeams.length, 0),
    [aiMarketEnabledTeams.length, aiTeams.length],
  );
  const manualTeams = useMemo(
    () => input.gameState.teams.filter((team) => resolvedTeamControlSettings[team.teamId]?.controlMode === "manual"),
    [input.gameState.teams, resolvedTeamControlSettings],
  );
  const passiveTeams = useMemo(
    () => input.gameState.teams.filter((team) => resolvedTeamControlSettings[team.teamId]?.controlMode === "passive"),
    [input.gameState.teams, resolvedTeamControlSettings],
  );
  const activeSaveGameMode = useMemo(() => resolveGameModeFromState(input.gameState), [input.gameState]);
  const gameModeOwnershipLimits = useMemo(
    () => getGameModeOwnershipLimits(activeSaveGameMode),
    [activeSaveGameMode],
  );
  const savedGameModeOwnership = useMemo(
    () => deriveChrisFrankyTeamIdsFromSettings(input.gameState.teams, resolvedTeamControlSettings),
    [input.gameState.teams, resolvedTeamControlSettings],
  );
  const gameModeOwnershipDraftChanged = useMemo(
    () =>
      JSON.stringify([...input.gameModeOwnershipChrisIds].sort()) !==
        JSON.stringify([...savedGameModeOwnership.chrisTeamIds].sort()) ||
      JSON.stringify([...input.gameModeOwnershipFrankyIds].sort()) !==
        JSON.stringify([...savedGameModeOwnership.frankyTeamIds].sort()),
    [
      input.gameModeOwnershipChrisIds,
      input.gameModeOwnershipFrankyIds,
      savedGameModeOwnership.chrisTeamIds,
      savedGameModeOwnership.frankyTeamIds,
    ],
  );
  const currentSaveOwnership = useMemo(
    () => ({ chrisTeamIds: input.gameModeOwnershipChrisIds, frankyTeamIds: input.gameModeOwnershipFrankyIds }),
    [input.gameModeOwnershipChrisIds, input.gameModeOwnershipFrankyIds],
  );
  const teamOwners = useMemo(
    () => buildTeamOwners(input.gameState.teams, resolvedTeamControlSettings),
    [input.gameState.teams, resolvedTeamControlSettings],
  );
  const activeOwner = useMemo(() => {
    const selectedOwner = teamOwners.find((owner) => owner.ownerId === input.activeOwnerId);
    if (selectedOwner?.controlledTeamIds.length) {
      return selectedOwner;
    }

    const defaultOwner = teamOwners.find((owner) => owner.ownerId === DEFAULT_ACTIVE_OWNER_ID);
    if (defaultOwner?.controlledTeamIds.length) {
      return defaultOwner;
    }

    return teamOwners.find((owner) => owner.controlledTeamIds.length > 0) ?? selectedOwner ?? defaultOwner ?? teamOwners[0] ?? null;
  }, [input.activeOwnerId, teamOwners]);
  const effectiveActiveOwnerId = activeOwner?.ownerId ?? input.activeOwnerId;
  const managerTeamOptions = useMemo(() => {
    const filteredTeams = filterTeamsByControlScope(
      input.gameState.teams,
      resolvedTeamControlSettings,
      input.teamContextFilter,
      effectiveActiveOwnerId,
    );
    return filteredTeams.length ? filteredTeams : manualTeams.length ? manualTeams : input.gameState.teams;
  }, [
    effectiveActiveOwnerId,
    input.gameState.teams,
    input.teamContextFilter,
    manualTeams,
    resolvedTeamControlSettings,
  ]);
  const ownerQuickSwitchTeams = useMemo(() => {
    const ownerTeams = filterTeamsByControlScope(
      input.gameState.teams,
      resolvedTeamControlSettings,
      "my_teams",
      effectiveActiveOwnerId,
    );
    const localUserManualTeams = input.gameState.teams.filter((team) => {
      const settings = resolvedTeamControlSettings[team.teamId];
      return (
        settings?.controlMode === "manual" &&
        (settings.ownerId === DEFAULT_ACTIVE_OWNER_ID || settings.ownerSlot === "user" || settings.displayLabel === "Chris")
      );
    });
    const merged = [...ownerTeams, ...localUserManualTeams].filter(
      (team, index, teams) => teams.findIndex((entry) => entry.teamId === team.teamId) === index,
    );
    return merged.length ? merged : manualTeams;
  }, [effectiveActiveOwnerId, input.gameState.teams, manualTeams, resolvedTeamControlSettings]);
  const foundationManageableTeamIds = useMemo(
    () =>
      resolveFoundationManageableTeamIds(
        input.gameState.teams.map((team) => team.teamId),
        ownerQuickSwitchTeams.map((team: Team) => team.teamId),
      ),
    [input.gameState.teams, ownerQuickSwitchTeams],
  );

  return {
    resolvedTeamControlSettings,
    resolvedTeamStrategyProfiles,
    aiTeams,
    aiLineupApplyTeams,
    aiLineupEnsureTeams,
    aiMarketEnabledTeams,
    aiMarketDisabledTeams,
    manualTeams,
    passiveTeams,
    activeSaveGameMode,
    gameModeOwnershipLimits,
    savedGameModeOwnership,
    gameModeOwnershipDraftChanged,
    currentSaveOwnership,
    teamOwners,
    activeOwner,
    effectiveActiveOwnerId,
    managerTeamOptions,
    ownerQuickSwitchTeams,
    foundationManageableTeamIds,
  };
}
