import { useMemo } from "react";

import type { GameState, Team } from "@/lib/data/olyDataTypes";
import {
  AI_OWNER_ID,
  DEFAULT_ACTIVE_OWNER_ID,
  FRANKY_OWNER_ID,
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
    const base = filteredTeams.length ? filteredTeams : manualTeams.length ? manualTeams : input.gameState.teams;
    // Reihenfolge im Team-Picker: eigene Teams (lokaler Spieler) zuerst, dann
    // die des 2. Spielers (Franky), dann KI — so tauchen die selbst gesteuerten
    // 1–4 Teams immer ganz oben auf (auch in der "Alle Teams"-Ansicht). Rang aus
    // den Team-Control-Settings, stabiler Tiebreak über den Kürzel-Code.
    const ownerRank = (teamId: string): number => {
      const settings = resolvedTeamControlSettings[teamId];
      if (!settings) return 3;
      if (settings.controlMode === "ai" || settings.ownerId === AI_OWNER_ID) return 2;
      if (settings.ownerId === DEFAULT_ACTIVE_OWNER_ID) return 0;
      if (settings.ownerId === FRANKY_OWNER_ID) return 1;
      return 1; // sonstige menschliche Owner zwischen "eigen" und KI
    };
    return [...base].sort(
      (left, right) =>
        ownerRank(left.teamId) - ownerRank(right.teamId) ||
        (left.shortCode ?? "").localeCompare(right.shortCode ?? ""),
    );
  }, [
    effectiveActiveOwnerId,
    input.gameState.teams,
    input.teamContextFilter,
    manualTeams,
    resolvedTeamControlSettings,
  ]);
  const localUserManualTeams = useMemo(() => {
    return input.gameState.teams.filter((team) => {
      const settings = resolvedTeamControlSettings[team.teamId];
      return (
        settings?.controlMode === "manual" &&
        (settings.ownerId === DEFAULT_ACTIVE_OWNER_ID || settings.ownerSlot === "user" || settings.displayLabel === "Chris")
      );
    });
  }, [input.gameState.teams, resolvedTeamControlSettings]);
  const ownerQuickSwitchTeams = useMemo(() => {
    const ownerTeams = filterTeamsByControlScope(
      input.gameState.teams,
      resolvedTeamControlSettings,
      "my_teams",
      effectiveActiveOwnerId,
    );
    const merged = [...ownerTeams, ...localUserManualTeams].filter(
      (team, index, teams) => teams.findIndex((entry) => entry.teamId === team.teamId) === index,
    );
    return merged.length ? merged : manualTeams;
  }, [effectiveActiveOwnerId, localUserManualTeams, manualTeams, resolvedTeamControlSettings]);
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
    localUserManualTeams,
    ownerQuickSwitchTeams,
    foundationManageableTeamIds,
  };
}
