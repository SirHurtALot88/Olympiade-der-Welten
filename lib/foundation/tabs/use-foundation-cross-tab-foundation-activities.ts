import { useMemo } from "react";

import { buildFoundationActivities } from "@/lib/foundation/foundation-activity-registry";
import type { FoundationAiPreseasonAutomationRun } from "@/lib/foundation/tabs/foundation-page-types";

type AdminSimulationRunSnapshot = {
  status: string;
  currentOperation?: string | null;
  progressPct?: number | null;
  activePhase?: string | null;
} | null;

type AiLineupEnsureFeedSnapshot = {
  summary?: {
    savedTeams?: number;
    existingLineups?: number;
    blockedTeams?: number;
    performanceBreakdown?: { totalMs?: number | null } | null;
  } | null;
} | null;

export function useFoundationCrossTabFoundationActivities(input: {
  isSaveBusy: boolean;
  aiPreseasonBusy: boolean;
  aiPreseasonDisplayRun: FoundationAiPreseasonAutomationRun | null;
  aiLineupEnsureBusy: boolean;
  aiLineupEnsureTeamsCount: number;
  aiLineupMissingTeamIdsCount: number;
  aiLineupEnsureFeed: AiLineupEnsureFeedSnapshot;
  adminSimulationBusy: boolean;
  adminSimulationRun: AdminSimulationRunSnapshot;
  seasonTransitionBusy: boolean;
  preSeasonWorkflowBusy: boolean;
  seasonStartResetBusy: boolean;
  newGameBusy: boolean;
  rosterFillBusy: boolean;
  adminBalancingBusy: boolean;
  cockpitBusyKey: string | null;
  aiTeamsCount: number;
  marketBuyBusy?: boolean;
  marketSellBusy?: boolean;
  contractRenewalBusy?: boolean;
  sponsorChoiceBusy?: boolean;
  facilityUpgradeBusy?: boolean;
  facilityMaintenanceBusy?: boolean;
  assignTeamCaptainBusy?: boolean;
  marketAiPreviewBusy?: boolean;
  liveSyncStatus?: "connected" | "syncing" | "reconnecting" | "disconnected" | "idle";
  fetchSlowWarning?: boolean;
  showIdleReady?: boolean;
}) {
  return useMemo(
    () =>
      buildFoundationActivities({
        isSaveBusy: input.isSaveBusy,
        aiPreseasonBusy: input.aiPreseasonBusy,
        aiPreseasonRun: input.aiPreseasonDisplayRun,
        aiLineupEnsureBusy: input.aiLineupEnsureBusy,
        aiLineupEnsure: input.aiLineupEnsureBusy
          ? {
              totalTeams: input.aiLineupEnsureTeamsCount,
              readyTeams: Math.max(input.aiLineupEnsureTeamsCount - input.aiLineupMissingTeamIdsCount, 0),
              savedTeams: input.aiLineupEnsureFeed?.summary?.savedTeams ?? 0,
              existingLineups: input.aiLineupEnsureFeed?.summary?.existingLineups ?? 0,
              blockedTeams: input.aiLineupEnsureFeed?.summary?.blockedTeams ?? 0,
              totalMs: input.aiLineupEnsureFeed?.summary?.performanceBreakdown?.totalMs ?? null,
            }
          : null,
        adminSimulationBusy: input.adminSimulationBusy,
        adminSimulationRun: input.adminSimulationRun
          ? {
              status: input.adminSimulationRun.status,
              currentOperation: input.adminSimulationRun.currentOperation,
              progressPct: input.adminSimulationRun.progressPct,
              activePhase: input.adminSimulationRun.activePhase,
            }
          : null,
        seasonTransitionBusy: input.seasonTransitionBusy,
        preSeasonWorkflowBusy: input.preSeasonWorkflowBusy,
        seasonStartResetBusy: input.seasonStartResetBusy,
        newGameBusy: input.newGameBusy,
        rosterFillBusy: input.rosterFillBusy,
        adminBalancingBusy: input.adminBalancingBusy,
        cockpitBusyKey: input.cockpitBusyKey,
        aiTeamsCount: input.aiTeamsCount,
        marketBuyBusy: input.marketBuyBusy,
        marketSellBusy: input.marketSellBusy,
        contractRenewalBusy: input.contractRenewalBusy,
        sponsorChoiceBusy: input.sponsorChoiceBusy,
        facilityUpgradeBusy: input.facilityUpgradeBusy,
        facilityMaintenanceBusy: input.facilityMaintenanceBusy,
        assignTeamCaptainBusy: input.assignTeamCaptainBusy,
        marketAiPreviewBusy: input.marketAiPreviewBusy,
        liveSyncStatus: input.liveSyncStatus,
        fetchSlowWarning: input.fetchSlowWarning,
        showIdleReady: input.showIdleReady,
      }),
    [
      input.adminBalancingBusy,
      input.adminSimulationBusy,
      input.adminSimulationRun,
      input.aiLineupEnsureBusy,
      input.aiLineupEnsureFeed,
      input.aiLineupEnsureTeamsCount,
      input.aiLineupMissingTeamIdsCount,
      input.aiPreseasonBusy,
      input.aiPreseasonDisplayRun,
      input.aiTeamsCount,
      input.assignTeamCaptainBusy,
      input.cockpitBusyKey,
      input.contractRenewalBusy,
      input.facilityMaintenanceBusy,
      input.facilityUpgradeBusy,
      input.fetchSlowWarning,
      input.isSaveBusy,
      input.liveSyncStatus,
      input.marketAiPreviewBusy,
      input.marketBuyBusy,
      input.marketSellBusy,
      input.newGameBusy,
      input.preSeasonWorkflowBusy,
      input.rosterFillBusy,
      input.seasonStartResetBusy,
      input.seasonTransitionBusy,
      input.showIdleReady,
      input.sponsorChoiceBusy,
    ],
  );
}
