import type { GameState } from "@/lib/data/olyDataTypes";

export function getActiveTeamLineupDraft(gameState: GameState, activeTeamId: string | null) {
  if (!activeTeamId) return null;
  return (
    (gameState.seasonState.lineupDrafts ?? []).find(
      (draft) =>
        draft.seasonId === gameState.season.id &&
        draft.matchdayId === gameState.matchdayState.matchdayId &&
        draft.teamId === activeTeamId,
    ) ?? null
  );
}

export function activeTeamHasFormCardPool(gameState: GameState, activeTeamId: string | null) {
  if (!activeTeamId) return false;
  return (gameState.seasonState.formCards ?? []).some(
    (card) => card.seasonId === gameState.season.id && card.teamId === activeTeamId,
  );
}

export function activeTeamHasFormCardModifierSelections(gameState: GameState, activeTeamId: string | null) {
  const draft = getActiveTeamLineupDraft(gameState, activeTeamId);
  const modifiers = draft?.modifiers;
  if (!modifiers) return false;
  return [modifiers.d1, modifiers.d2].some(
    (side) => Boolean(side?.primaryFormCardId || side?.secondaryFormCardId),
  );
}

export function activeTeamHasFormCardPlanSelections(gameState: GameState, activeTeamId: string | null) {
  if (!activeTeamId) return false;
  const matchdayId = gameState.matchdayState.matchdayId;
  return (gameState.seasonState.formCardPlans ?? []).some(
    (plan) =>
      plan.teamId === activeTeamId &&
      plan.matchdayId === matchdayId &&
      Boolean(plan.primaryFormCardId || plan.secondaryFormCardId),
  );
}

export function getFormCardFlowStatus(gameState: GameState, activeTeamId: string | null) {
  const hasPool = activeTeamHasFormCardPool(gameState, activeTeamId);
  const hasModifierSelections = activeTeamHasFormCardModifierSelections(gameState, activeTeamId);
  const hasPlanSelections = activeTeamHasFormCardPlanSelections(gameState, activeTeamId);
  const hasSelections = hasModifierSelections || hasPlanSelections;
  return {
    hasPool,
    hasModifierSelections,
    hasPlanSelections,
    hasSelections,
    isReady: hasPool && hasSelections,
    blocker: !hasPool ? "missing_formcard_pool" : !hasSelections ? "missing_formcard_selections" : null,
  };
}

/** @deprecated Use activeTeamHasFormCardModifierSelections */
export function activeTeamHasFormCardSelections(gameState: GameState, activeTeamId: string | null) {
  return activeTeamHasFormCardModifierSelections(gameState, activeTeamId);
}
