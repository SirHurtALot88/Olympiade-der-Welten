import { useMemo } from "react";

import {
  buildTeamObjectiveOverview,
  type TeamObjectiveOverview,
} from "@/lib/board/team-season-objectives-service";
import type { GameInboxItem, GameState, Team, TeamBoardConfidenceRecord, TeamGeneralManagerProfile, TeamSeasonObjectiveRecord } from "@/lib/data/olyDataTypes";
import { buildGmStoryView, type GmStoryView } from "@/lib/foundation/gm-story";
import { getAxisSharePercentages } from "@/lib/foundation/team-general-managers";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import { formatMoney } from "@/lib/foundation/tabs/foundation-format-render-helpers";
import { teamStrategyBiasFieldLabels } from "@/lib/foundation/tabs/foundation-page-types";
import { roundViewNumber } from "@/lib/foundation/tabs/season-stand-render-helpers";
import { buildPlayerMoraleAudit } from "@/lib/morale/player-morale-service";
import { buildTeamPlayerDemandMap } from "@/lib/morale/player-demands-service";

const EMPTY_TEAM_OBJECTIVE_OVERVIEW: TeamObjectiveOverview = {
  seasonId: "",
  objectives: [],
  boardConfidence: {},
  aiBiasByTeamId: {},
  warnings: [],
};

export function shouldBuildFoundationTeamObjectiveOverview(input: {
  shouldBuildHomeV2Overview: boolean;
  shouldBuildTeamsView: boolean;
  shouldBuildMarketView: boolean;
  activeView: string;
  teamProfileTeamId: string | null;
}): boolean {
  return (
    input.shouldBuildHomeV2Overview ||
    input.shouldBuildTeamsView ||
    input.shouldBuildMarketView ||
    input.activeView === "seasonV2" ||
    Boolean(input.teamProfileTeamId)
  );
}

export function shouldBuildFoundationHqOfficeDerivations(
  shouldBuildHomeV2Overview: boolean,
  homeV2Tab: string = "overview",
): boolean {
  return shouldBuildHomeV2Overview && homeV2Tab === "office";
}

export function shouldBuildFoundationHqGmStory(input: {
  shouldBuildHomeV2Overview: boolean;
  activeView: string;
}): boolean {
  return input.shouldBuildHomeV2Overview || input.activeView === "teamSettings";
}

export function shouldBuildFoundationTeamGmProfileDerivations(input: {
  shouldBuildTeamsView: boolean;
  shouldBuildHomeV2Overview: boolean;
  activeView: string;
}): boolean {
  return input.shouldBuildTeamsView || input.shouldBuildHomeV2Overview || input.activeView === "teamSettings";
}

export function shouldBuildFoundationTeamPlayerDemands(input: {
  shouldBuildTeamsView: boolean;
  shouldBuildHomeV2Overview: boolean;
  homeV2Tab?: string;
}): boolean {
  return (
    input.shouldBuildTeamsView ||
    (input.shouldBuildHomeV2Overview && (input.homeV2Tab ?? "overview") === "office")
  );
}

export type SelectedHqMoraleSummary = {
  average: number;
  criticalCount: number;
  exitRiskCount: number;
};

export type SelectedTeamGeneralManagerAssignment = {
  assignment: {
    source?: string | null;
    previousGmId?: string | null;
    dismissalReason?: string | null;
  };
  profile: TeamGeneralManagerProfile;
} | null;

export function useFoundationCrossTabHomeV2(input: {
  activeView: string;
  shouldBuildHomeV2Overview: boolean;
  homeV2Tab?: string;
  shouldBuildTeamsView: boolean;
  shouldBuildMarketView: boolean;
  teamProfileTeamId: string | null;
  inboxGameState: GameState;
  gameState: GameState;
  gameInboxItems: GameInboxItem[];
  selectedTeam: Team | null;
  selectedStandingRow: TeamManagementSnapshotRow | null;
  selectedTeamGeneralManager: SelectedTeamGeneralManagerAssignment;
}) {
  const shouldBuildTeamObjectiveOverview = shouldBuildFoundationTeamObjectiveOverview({
    shouldBuildHomeV2Overview: input.shouldBuildHomeV2Overview,
    shouldBuildTeamsView: input.shouldBuildTeamsView,
    shouldBuildMarketView: input.shouldBuildMarketView,
    activeView: input.activeView,
    teamProfileTeamId: input.teamProfileTeamId,
  });
  const shouldBuildHqOfficeDerivations = shouldBuildFoundationHqOfficeDerivations(
    input.shouldBuildHomeV2Overview,
    input.homeV2Tab,
  );
  const shouldBuildHqGmStory = shouldBuildFoundationHqGmStory({
    shouldBuildHomeV2Overview: input.shouldBuildHomeV2Overview,
    activeView: input.activeView,
  });

  const teamObjectiveOverview = useMemo(
    () =>
      shouldBuildTeamObjectiveOverview
        ? buildTeamObjectiveOverview(input.inboxGameState)
        : EMPTY_TEAM_OBJECTIVE_OVERVIEW,
    [input.inboxGameState, shouldBuildTeamObjectiveOverview],
  );

  const selectedTeamObjectives = useMemo(
    () =>
      shouldBuildTeamObjectiveOverview && input.selectedTeam
        ? teamObjectiveOverview.objectives.filter((objective) => objective.teamId === input.selectedTeam?.teamId)
        : ([] as TeamSeasonObjectiveRecord[]),
    [input.selectedTeam, shouldBuildTeamObjectiveOverview, teamObjectiveOverview.objectives],
  );

  const selectedBoardConfidence = useMemo((): TeamBoardConfidenceRecord | null => {
    if (!shouldBuildTeamObjectiveOverview || !input.selectedTeam) {
      return null;
    }
    return teamObjectiveOverview.boardConfidence[input.selectedTeam.teamId] ?? null;
  }, [input.selectedTeam, shouldBuildTeamObjectiveOverview, teamObjectiveOverview.boardConfidence]);

  const selectedOpenObjectives = useMemo(
    () =>
      shouldBuildHqOfficeDerivations
        ? selectedTeamObjectives.filter((objective) => objective.status === "open" || objective.status === "at_risk")
        : ([] as TeamSeasonObjectiveRecord[]),
    [selectedTeamObjectives, shouldBuildHqOfficeDerivations],
  );

  const selectedHqGmStory = useMemo((): GmStoryView | null => {
    if (!shouldBuildHqGmStory || !input.selectedTeamGeneralManager) {
      return null;
    }
    return buildGmStoryView({
      source: input.selectedTeamGeneralManager.assignment.source,
      previousGmId: input.selectedTeamGeneralManager.assignment.previousGmId,
      dismissalReason: input.selectedTeamGeneralManager.assignment.dismissalReason,
      boardPressure: selectedBoardConfidence?.pressure ?? null,
      boardConfidenceValue: selectedBoardConfidence?.value ?? null,
    });
  }, [
    input.selectedTeamGeneralManager,
    selectedBoardConfidence?.pressure,
    selectedBoardConfidence?.value,
    shouldBuildHqGmStory,
  ]);

  const selectedHqInboxItems = useMemo(() => {
    if (!shouldBuildHqOfficeDerivations || !input.selectedTeam) {
      return [] as GameInboxItem[];
    }
    return input.gameInboxItems
      .filter(
        (item) =>
          item.status !== "done" &&
          (!item.teamId ||
            item.teamId === input.selectedTeam?.teamId ||
            item.targetParams.teamId === input.selectedTeam?.teamId),
      )
      .slice(0, 6);
  }, [input.gameInboxItems, input.selectedTeam, shouldBuildHqOfficeDerivations]);

  const selectedHqFinanceWarnings = useMemo(() => {
    if (!shouldBuildHqOfficeDerivations) {
      return [] as string[];
    }
    const warnings: string[] = [];
    const salaryTotal = input.selectedStandingRow?.salaryTotal ?? null;
    const cash = input.selectedStandingRow?.cash ?? null;
    const guv = input.selectedStandingRow?.guv ?? null;
    if (guv != null && guv < 0) {
      warnings.push(`GuV negativ: ${formatMoney(guv)} bei aktuellem Rang.`);
    }
    if (salaryTotal != null && cash != null && cash + salaryTotal > 0) {
      const pressurePct = Math.round((salaryTotal / (cash + salaryTotal)) * 100);
      if (pressurePct >= 55) {
        warnings.push(`Gehaltsdruck ${pressurePct}%: Gehalt frisst zu viel vom Cash/Gehalt-Pool.`);
      }
      if (cash < salaryTotal * 0.35) {
        warnings.push(`Cash-Puffer niedrig: ${formatMoney(cash)} Cash gegen ${formatMoney(salaryTotal)} Gehalt.`);
      }
    }
    selectedBoardConfidence?.warnings.slice(0, 2).forEach((warning) => warnings.push(warning));
    return warnings;
  }, [
    input.selectedStandingRow?.cash,
    input.selectedStandingRow?.guv,
    input.selectedStandingRow?.salaryTotal,
    selectedBoardConfidence?.warnings,
    shouldBuildHqOfficeDerivations,
  ]);

  const selectedHqMoraleSummary = useMemo((): SelectedHqMoraleSummary | null => {
    if (!shouldBuildHqOfficeDerivations || !input.selectedTeam) {
      return null;
    }
    const playerMoraleAudit = buildPlayerMoraleAudit(input.gameState);
    const rows = playerMoraleAudit.rows.filter((entry) => entry.teamId === input.selectedTeam?.teamId);
    if (rows.length === 0) {
      return null;
    }
    const average = rows.reduce((sum, entry) => sum + entry.morale, 0) / rows.length;
    const criticalCount = rows.filter((entry) => entry.visibleMood === "angry" || entry.visibleMood === "unhappy").length;
    const exitRiskCount = rows.filter(
      (entry) => entry.contractIntent === "refuses_extension" || entry.contractIntent === "considering_exit",
    ).length;
    return {
      average: roundViewNumber(average, 1),
      criticalCount,
      exitRiskCount,
    };
  }, [input.gameState, input.selectedTeam, shouldBuildHqOfficeDerivations]);

  const shouldBuildTeamGmProfileDerivations = shouldBuildFoundationTeamGmProfileDerivations({
    shouldBuildTeamsView: input.shouldBuildTeamsView,
    shouldBuildHomeV2Overview: input.shouldBuildHomeV2Overview,
    activeView: input.activeView,
  });
  const shouldBuildTeamPlayerDemands = shouldBuildFoundationTeamPlayerDemands({
    shouldBuildTeamsView: input.shouldBuildTeamsView,
    shouldBuildHomeV2Overview: input.shouldBuildHomeV2Overview,
    homeV2Tab: input.homeV2Tab,
  });

  const selectedTeamGmAxisShares = useMemo(
    () =>
      shouldBuildTeamGmProfileDerivations && input.selectedTeamGeneralManager
        ? getAxisSharePercentages(input.selectedTeamGeneralManager.profile)
        : null,
    [input.selectedTeamGeneralManager, shouldBuildTeamGmProfileDerivations],
  );

  const selectedTeamGmBiasHighlights = useMemo(() => {
    if (!shouldBuildTeamGmProfileDerivations || !input.selectedTeamGeneralManager) {
      return [];
    }
    return teamStrategyBiasFieldLabels
      .map((field) => {
        const rawValue = input.selectedTeamGeneralManager!.profile.bias[field.key] ?? 5;
        const delta = rawValue - 5;
        const tendency =
          rawValue >= 8
            ? "hoch"
            : rawValue <= 3
              ? "niedrig"
              : rawValue >= 6
                ? "spürbar"
                : rawValue <= 4
                  ? "gebremst"
                  : "neutral";
        return {
          key: field.key,
          label: field.label,
          rawValue,
          delta,
          tendency,
        };
      })
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || left.label.localeCompare(right.label, "de"))
      .slice(0, 5);
  }, [input.selectedTeamGeneralManager, shouldBuildTeamGmProfileDerivations]);

  const selectedTeamPlayerDemands = useMemo(() => {
    if (!shouldBuildTeamPlayerDemands || !input.selectedTeam) {
      return [];
    }
    const playersById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
    const statusWeight = { failed: 0, at_risk: 1, open: 2, fulfilled: 3 } as const;
    const priorityWeight = { high: 0, medium: 1, low: 2 } as const;
    return Array.from(buildTeamPlayerDemandMap(input.gameState, input.selectedTeam.teamId).entries())
      .flatMap(([playerId, demands]) =>
        demands.map((demand) => ({
          ...demand,
          playerName: playersById.get(playerId)?.name ?? playerId,
        })),
      )
      .filter((demand) => demand.status !== "fulfilled")
      .sort(
        (left, right) =>
          statusWeight[left.status] - statusWeight[right.status] ||
          priorityWeight[left.priority] - priorityWeight[right.priority] ||
          left.playerName.localeCompare(right.playerName, "de"),
      );
  }, [input.gameState, input.selectedTeam, shouldBuildTeamPlayerDemands]);

  return {
    teamObjectiveOverview,
    selectedTeamObjectives,
    selectedBoardConfidence,
    selectedOpenObjectives,
    selectedHqGmStory,
    selectedHqInboxItems,
    selectedHqFinanceWarnings,
    selectedHqMoraleSummary,
    selectedTeamGmAxisShares,
    selectedTeamGmBiasHighlights,
    selectedTeamPlayerDemands,
  };
}
