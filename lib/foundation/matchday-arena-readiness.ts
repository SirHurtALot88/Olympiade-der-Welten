import type { FormCardPlanRecord, GameState } from "@/lib/data/olyDataTypes";
import { getFormCardFlowStatus } from "@/lib/foundation/form-card-flow";
import {
  getMatchdayLineupSideRequirements,
  getTeamMatchdayLineupDraft,
  getTeamMatchdayLineupOpenSlots,
  isTeamMatchdayLineupComplete,
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
  const lineupReady = activeTeamId ? isTeamMatchdayLineupComplete(gameState, activeTeamId, lineup) : false;
  const lineupSubmitted = isTeamMatchdayLineupSubmitted(lineup);
  const openLineupSlots = activeTeamId ? getTeamMatchdayLineupOpenSlots(gameState, activeTeamId, lineup) : 0;
  const hasResults = hasCurrentMatchdayResult(gameState);
  const formCardsRequired = lineupReady && !hasResults;
  const formCardFlow = getFormCardFlowStatus(gameState, activeTeamId);
  const formCardsReady = !formCardsRequired || formCardFlow.isReady;
  const isReady = lineupReady && lineupSubmitted && formCardsReady;

  let blocker: MatchdayArenaBlockerReason = null;
  if (!lineup?.entries?.length) {
    blocker = "missing_lineup";
  } else if (!lineupReady) {
    blocker = "incomplete_lineup";
  } else if (!lineupSubmitted) {
    blocker = "lineup_not_submitted";
  } else if (formCardsRequired && formCardFlow.blocker) {
    blocker = formCardFlow.blocker;
  }

  return {
    isReady,
    blocker,
    openLineupSlots,
    sideRequirements: activeTeamId ? getMatchdayLineupSideRequirements(gameState) : null,
    formCardsRequired,
    formCardFlow,
    lineupReady,
    lineupSubmitted,
    hasResults,
  };
}
