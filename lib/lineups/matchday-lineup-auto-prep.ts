import { buildAiLegacyLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import { isFormCardFlowReadyForMatchday } from "@/lib/foundation/form-card-flow";
import { isTeamMatchdayLineupSubmitted } from "@/lib/foundation/matchday-lineup-readiness";
import {
  autoFillFormCardModifiers,
  ensureLocalFormCardsForSeason,
  lineupModifiersHaveFormCardSelections,
  normalizeLineupDraftModifiers,
} from "@/lib/lineups/legacy-lineup-modifiers";
import { loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupEntryInput } from "@/lib/lineups/legacy-lineup-types";

export function prepareGameStateForMatchdayResolve(
  gameState: GameState,
  scope: { saveId: string; seasonId: string; matchdayId: string },
): { gameState: GameState; warnings: string[] } {
  let next = ensureLocalFormCardsForSeason(gameState, scope.saveId, scope.seasonId);
  const warnings: string[] = [];
  const drafts = [...(next.seasonState.lineupDrafts ?? [])];
  let changed = next !== gameState;

  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index]!;
    if (draft.seasonId !== scope.seasonId || draft.matchdayId !== scope.matchdayId || draft.entries.length === 0) {
      continue;
    }

    if (
      isFormCardFlowReadyForMatchday(next, draft.teamId, {
        lineupSubmitted: isTeamMatchdayLineupSubmitted(draft),
      })
    ) {
      continue;
    }

    const contextResult = loadLocalLegacyLineupContextFromGameState(next, {
      saveId: scope.saveId,
      seasonId: scope.seasonId,
      matchdayId: scope.matchdayId,
      teamId: draft.teamId,
    });
    if (!contextResult.ok) {
      continue;
    }

    const entries = draft.entries as LegacyLineupEntryInput[];
    const modifiers = lineupModifiersHaveFormCardSelections(draft.modifiers)
      ? normalizeLineupDraftModifiers(draft.modifiers)
      : buildAiLegacyLineupModifiers(contextResult.context, entries);

    drafts[index] = {
      ...draft,
      modifiers: autoFillFormCardModifiers({
        gameState: next,
        seasonId: scope.seasonId,
        teamId: draft.teamId,
        lineupId: draft.lineupId,
        modifiers,
      }),
      status: draft.status === "draft" ? "submitted" : draft.status,
      updatedAt: new Date().toISOString(),
    };
    changed = true;
    warnings.push(`auto_prepared_lineup:${draft.teamId}`);
  }

  if (!changed) {
    return { gameState: next, warnings };
  }

  return {
    gameState: {
      ...next,
      seasonState: {
        ...next.seasonState,
        lineupDrafts: drafts,
      },
    },
    warnings,
  };
}
