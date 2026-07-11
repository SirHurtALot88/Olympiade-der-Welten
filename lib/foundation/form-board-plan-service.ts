import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import type { LineupDraftModifiers } from "@/lib/data/olyDataTypes";

function emptySideModifiers() {
  return {
    primaryFormCardId: null,
    secondaryFormCardId: null,
    mutatorTrait1: null,
    mutatorTrait2: null,
    intensity: "normal" as const,
    teamPowerId: null,
  };
}

export function normalizeLineupModifiers(modifiers?: Partial<LineupDraftModifiers> | null): LineupDraftModifiers {
  return {
    d1: { ...emptySideModifiers(), ...(modifiers?.d1 ?? {}) },
    d2: { ...emptySideModifiers(), ...(modifiers?.d2 ?? {}) },
  };
}

export function applyPlannedFormCardsToModifiers(
  context: LegacyLineupLoadedContext | null,
  modifiers: LineupDraftModifiers,
  options?: { overwriteCurrentMatchday?: boolean },
) {
  if (!context || (context.existingDraft && !options?.overwriteCurrentMatchday)) {
    return modifiers;
  }

  const planned = (context.formCardPlans ?? []).filter(
    (plan) => plan.matchdayId === context.matchday.id && plan.teamId === context.team.id,
  );
  if (planned.length === 0) {
    return modifiers;
  }

  const availableCards = new Set((context.formCards ?? []).filter((card) => !card.isUsed).map((card) => card.id));
  const positiveAvailableCards = new Set(
    (context.formCards ?? []).filter((card) => !card.isUsed && card.value > 0).map((card) => card.id),
  );
  const next = normalizeLineupModifiers(modifiers);
  const usedPlannedCards = new Set<string>();
  for (const side of ["d1", "d2"] as const) {
    const plan = planned.find((entry) => entry.disciplineSide === side) ?? null;
    const cardId = plan?.primaryFormCardId ?? null;
    if (options?.overwriteCurrentMatchday) {
      next[side] = {
        ...next[side],
        primaryFormCardId: cardId && availableCards.has(cardId) && !usedPlannedCards.has(cardId) ? cardId : null,
      };
      if (next[side].primaryFormCardId) {
        usedPlannedCards.add(next[side].primaryFormCardId);
      }
    } else if (cardId && availableCards.has(cardId) && !usedPlannedCards.has(cardId) && !next[side].primaryFormCardId) {
      next[side] = {
        ...next[side],
        primaryFormCardId: cardId,
      };
      usedPlannedCards.add(cardId);
    }
    const secondaryCardId = plan?.secondaryFormCardId ?? null;
    if (options?.overwriteCurrentMatchday) {
      next[side] = {
        ...next[side],
        secondaryFormCardId:
          secondaryCardId &&
          positiveAvailableCards.has(secondaryCardId) &&
          !usedPlannedCards.has(secondaryCardId)
            ? secondaryCardId
            : null,
      };
      if (next[side].secondaryFormCardId) {
        usedPlannedCards.add(next[side].secondaryFormCardId);
      }
    } else if (
      secondaryCardId &&
      positiveAvailableCards.has(secondaryCardId) &&
      !usedPlannedCards.has(secondaryCardId) &&
      !next[side].secondaryFormCardId
    ) {
      next[side] = {
        ...next[side],
        secondaryFormCardId: secondaryCardId,
      };
      usedPlannedCards.add(secondaryCardId);
    }
  }
  return next;
}
