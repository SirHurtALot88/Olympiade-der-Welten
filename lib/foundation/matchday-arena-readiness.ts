import type { FormCardPlanRecord, GameState } from "@/lib/data/olyDataTypes";
import { getFormCardFlowStatus } from "@/lib/foundation/form-card-flow";
import {
  getMatchdayLineupSideRequirements,
  getTeamMatchdayLineupDraft,
  getTeamMatchdayLineupOpenSlots,
  getTeamRosterPlayerIds,
  isTeamMatchdayLineupComplete,
  isTeamMatchdayLineupOperationallyReady,
  isTeamMatchdayLineupSubmitted,
} from "@/lib/foundation/matchday-lineup-readiness";

export type MatchdayArenaBlockerReason =
  | "missing_lineup"
  | "incomplete_lineup"
  | "lineup_not_submitted"
  | "missing_formcard_selections"
  | "missing_formcard_pool"
  | null;

export function hasCurrentMatchdayResult(gameState: GameState) {
  return (gameState.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === gameState.season.id && result.matchdayId === gameState.matchdayState.matchdayId,
  );
}

export function mergeFormCardPlansIntoGameState(
  gameState: GameState,
  nextPlans: FormCardPlanRecord[],
  scope: { seasonId: string; teamId: string },
): GameState {
  const retained = (gameState.seasonState.formCardPlans ?? []).filter(
    (plan) => !(plan.seasonId === scope.seasonId && plan.teamId === scope.teamId),
  );
  const scopedPlans = nextPlans.filter((plan) => plan.seasonId === scope.seasonId && plan.teamId === scope.teamId);
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      formCardPlans: [...retained, ...scopedPlans],
    },
  };
}

export function getMatchdayArenaReadiness(gameState: GameState, activeTeamId: string | null) {
  const lineup = activeTeamId ? getTeamMatchdayLineupDraft(gameState, activeTeamId) : null;
  const lineupSlotComplete = activeTeamId ? isTeamMatchdayLineupComplete(gameState, activeTeamId, lineup) : false;
  const lineupOperationallyReady = activeTeamId ? isTeamMatchdayLineupOperationallyReady(gameState, activeTeamId, lineup) : false;
  const lineupSubmitted = isTeamMatchdayLineupSubmitted(lineup);
  const openLineupSlots = activeTeamId ? getTeamMatchdayLineupOpenSlots(gameState, activeTeamId, lineup) : 0;
  const rosterPlayerIds = activeTeamId ? getTeamRosterPlayerIds(gameState, activeTeamId) : [];
  const deployedPlayerIds = new Set((lineup?.entries ?? []).map((entry) => entry.playerId));
  const undeployedRosterCount = rosterPlayerIds.filter((playerId) => !deployedPlayerIds.has(playerId)).length;
  const hasResults = hasCurrentMatchdayResult(gameState);
  const formCardsRequired = lineupOperationallyReady && !hasResults;
  const formCardFlow = getFormCardFlowStatus(gameState, activeTeamId);
  const formCardsReady = !formCardsRequired || formCardFlow.isReady;
  const isReady = lineupOperationallyReady && lineupSubmitted && formCardsReady;

  let blocker: MatchdayArenaBlockerReason = null;
  if (!lineup?.entries?.length) {
    blocker = "missing_lineup";
  } else if (!lineupOperationallyReady) {
    blocker = "incomplete_lineup";
  } else if (!lineupSubmitted) {
    blocker = "lineup_not_submitted";
  } else if (formCardsRequired && formCardFlow.blocker) {
    blocker = formCardFlow.blocker as MatchdayArenaBlockerReason;
  }

  return {
    isReady,
    blocker,
    openLineupSlots,
    undeployedRosterCount,
    lineupSlotComplete,
    lineupOperationallyReady,
    sideRequirements: activeTeamId ? getMatchdayLineupSideRequirements(gameState) : null,
    formCardsRequired,
    formCardFlow,
    lineupReady: lineupOperationallyReady,
    lineupSubmitted,
    hasResults,
  };
}

export function formatLineupOperationalGapDetail(
  readiness: Pick<
    ReturnType<typeof getMatchdayArenaReadiness>,
    "openLineupSlots" | "undeployedRosterCount"
  >,
) {
  const parts: string[] = [];
  if (readiness.openLineupSlots > 0) {
    parts.push(`${readiness.openLineupSlots} offene Slot${readiness.openLineupSlots === 1 ? "" : "s"}`);
  }
  if (readiness.undeployedRosterCount > 0) {
    parts.push(
      `${readiness.undeployedRosterCount} Kader-Spieler noch nicht eingesetzt`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
