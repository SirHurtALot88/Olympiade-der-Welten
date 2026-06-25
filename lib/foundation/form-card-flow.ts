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

export function activeTeamHasFormCardSelections(gameState: GameState, activeTeamId: string | null) {
  const draft = getActiveTeamLineupDraft(gameState, activeTeamId);
  const modifiers = draft?.modifiers;
  if (!modifiers) return false;
  return [modifiers.d1, modifiers.d2].some(
    (side) => Boolean(side?.primaryFormCardId || side?.secondaryFormCardId),
  );
}

export function getFormCardFlowStatus(gameState: GameState, activeTeamId: string | null) {
  const hasPool = activeTeamHasFormCardPool(gameState, activeTeamId);
  const hasSelections = activeTeamHasFormCardSelections(gameState, activeTeamId);
  return {
    hasPool,
    hasSelections,
    isReady: hasSelections,
    blocker: !hasPool ? "missing_formcard_pool" : !hasSelections ? "missing_formcard_selections" : null,
  };
}
