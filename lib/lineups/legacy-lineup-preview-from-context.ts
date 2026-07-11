import {
  calculateFormModifierForSide,
  calculateMutatorModifierForSide,
  getFormCardColorForDisciplineCategory,
  normalizeLineupDraftModifiers,
  buildMatchdayMutatorTraitsBySide,
} from "@/lib/lineups/legacy-lineup-modifiers";
import { calculateTeamPowerModifierForSide } from "@/lib/lineups/team-powers";
import { SEASON_CAPTAIN_SLOTS } from "@/lib/lineups/lineup-discipline-contract";
import { buildLegacyLineupAggregateScore, scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import { selectTeamCaptain } from "@/lib/morale/player-demands-service";
import { buildPlayerMoralePerformanceMap } from "@/lib/morale/player-morale-performance";
import type { GameState, LineupDraft } from "@/lib/data/olyDataTypes";
import type {
  LegacyLineupDraft,
  LegacyLineupEntryInput,
  LegacyLineupLoadedContext,
  LegacyLineupPreviewResult,
  LegacyLineupValidationOptions,
} from "@/lib/lineups/legacy-lineup-types";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";

function buildDisciplineSidePlayerCounts(context: LegacyLineupLoadedContext) {
  const result: Record<string, number> = {};
  const d1 = context.matchdayContract?.discipline1;
  const d2 = context.matchdayContract?.discipline2;
  if (d1?.requiredPlayers != null) {
    result[`${d1.disciplineId}::d1`] = d1.requiredPlayers;
  }
  if (d2?.requiredPlayers != null) {
    result[`${d2.disciplineId}::d2`] = d2.requiredPlayers;
  }
  return result;
}

function normalizeEntries(entries: LegacyLineupEntryInput[]) {
  return [...entries]
    .map((entry) => ({
      ...entry,
      disciplineId: entry.disciplineId.trim(),
      playerId: entry.playerId.trim(),
      activePlayerId: entry.activePlayerId?.trim() ?? null,
      isCaptain: Boolean(entry.isCaptain),
    }))
    .sort((left, right) => {
      if (left.disciplineId !== right.disciplineId) {
        return left.disciplineId.localeCompare(right.disciplineId);
      }
      if (left.disciplineSide !== right.disciplineSide) {
        return left.disciplineSide.localeCompare(right.disciplineSide);
      }
      return left.slotIndex - right.slotIndex;
    });
}

function buildValidationOptions(context: LegacyLineupLoadedContext, forSubmit = false): LegacyLineupValidationOptions {
  const previousCaptainKeys = new Set(
    (context.existingDraft?.entries ?? [])
      .filter((entry) => entry.isCaptain)
      .map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`),
  );
  const captainUsedBeforeCurrentDraftSides = new Set(context.teamStatus?.captainUsedSides ?? []);
  for (const key of previousCaptainKeys) {
    captainUsedBeforeCurrentDraftSides.delete(key);
  }

  return {
    enforceCompleteness: forSubmit,
    seasonCaptainLimit: SEASON_CAPTAIN_SLOTS,
    captainUsedBeforeCurrentDraft: Math.max(0, (context.teamStatus?.captainUsedCount ?? 0) - previousCaptainKeys.size),
    captainUsedBeforeCurrentDraftSides: Array.from(captainUsedBeforeCurrentDraftSides),
  };
}

export function calculateLocalLegacyLineupPreviewFromContext(
  context: LegacyLineupLoadedContext,
  entries?: LegacyLineupEntryInput[],
  modifiers?: LegacyLineupDraft["modifiers"],
  fatigueMap: LegacyLineupLoadedContext["fatigueByPlayerId"] = context.fatigueByPlayerId ?? null,
  gameStateOverride?: GameState | null,
): LegacyLineupPreviewResult {
  const previewEntries = normalizeEntries(entries ?? context.existingDraft?.entries ?? []);
  const previewPlayerIds = new Set(previewEntries.map((entry) => entry.playerId));
  const resolvedGameState = gameStateOverride ?? context.gameState ?? null;
  const moraleByPlayerId = resolvedGameState
    ? buildPlayerMoralePerformanceMap({
        gameState: resolvedGameState,
        teamId: context.teamId,
        rosterEntries:
          resolvedGameState.rosters.filter((entry) => entry.teamId === context.teamId && previewPlayerIds.has(entry.playerId)) ??
          null,
      })
    : {};
  const previewModifiers = normalizeLineupDraftModifiers(modifiers ?? context.existingDraft?.modifiers);
  const matchdayMutatorTraitsBySide = buildMatchdayMutatorTraitsBySide({
    saveId: context.saveId,
    seasonId: context.seasonId,
    matchdayId: context.matchdayId,
    d1DisciplineId: context.contextMeta.d1DisciplineId,
    d2DisciplineId: context.contextMeta.d2DisciplineId,
  });
  const validation = validateLegacyLineupContext(
    {
      ...context,
      entries: previewEntries,
      disciplineSidePlayerCounts: buildDisciplineSidePlayerCounts(context),
      disciplineSideCaptainCounts: context.disciplineSideCaptainCounts,
    },
    buildValidationOptions(context),
  );

  const previewPairs = [
    context.matchdayContract?.discipline1
      ? `${context.matchdayContract.discipline1.disciplineId}::${context.matchdayContract.discipline1.disciplineSide}`
      : null,
    context.matchdayContract?.discipline2
      ? `${context.matchdayContract.discipline2.disciplineId}::${context.matchdayContract.discipline2.disciplineSide}`
      : null,
    ...previewEntries.map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`),
  ].filter((value): value is string => Boolean(value));
  const uniquePairs = Array.from(new Set(previewPairs));
  const teamCaptain = resolvedGameState ? selectTeamCaptain(resolvedGameState, context.teamId) : null;
  const scorePartsWithModifierWarnings = uniquePairs.map((pair) => {
    const [disciplineId, disciplineSide] = pair.split("::") as [string, "d1" | "d2"];
    const sideEntries = previewEntries.filter(
      (entry) => entry.disciplineId === disciplineId && entry.disciplineSide === disciplineSide,
    );
    const disciplineMeta =
      disciplineSide === "d1"
        ? context.matchdayContract?.discipline1 ?? null
        : context.matchdayContract?.discipline2 ?? null;
    const formResult = calculateFormModifierForSide({
      modifiers: previewModifiers,
      disciplineSide,
      disciplineColor: getFormCardColorForDisciplineCategory(disciplineMeta?.category),
      playerCount: sideEntries.length,
      formCards: context.formCards ?? [],
    });
    const mutatorResult = calculateMutatorModifierForSide({
      modifiers: previewModifiers,
      disciplineSide,
      entries: sideEntries.map((entry) => ({ playerId: entry.playerId })),
      rosterPlayers: context.rosterPlayers,
      matchdayMutatorTraits: matchdayMutatorTraitsBySide[disciplineSide],
    });
    const teamPowerResult = calculateTeamPowerModifierForSide({
      modifiers: previewModifiers,
      disciplineSide,
      disciplineId,
      disciplineCategory: disciplineMeta?.category,
      teamPowers: context.teamPowers ?? [],
      teamCaptainPowerModifierPct: teamCaptain?.effects.teamPowerModifierPct ?? null,
      conditionalBonusPct: (() => {
        const selectedPower = context.teamPowers?.find((power) => power.id === previewModifiers[disciplineSide].teamPowerId) ?? null;
        if (!selectedPower?.conditionalTrigger || !selectedPower.conditionalBonusPct) {
          return 0;
        }
        if (selectedPower.conditionalTrigger === "rival_top8_discipline") {
          return (context.teamPowerWindows?.[disciplineId]?.top8Rivals.length ?? 0) > 0 ? selectedPower.conditionalBonusPct : 0;
        }
        return 0;
      })(),
    });
    const effectiveMutatorModifier =
      context.mutatorSource?.effectStatus === "ready" ? mutatorResult.mutatorModifier : null;
    const effectiveMutatorBonuses =
      context.mutatorSource?.effectStatus === "ready" ? mutatorResult.playerMutatorBonuses : null;
    const effectiveTeamPowerModifier =
      context.teamPowerSource?.effectStatus === "ready" ? teamPowerResult.teamPowerModifier : null;
    return {
      score: scoreLegacyLineupDisciplineSide({
        disciplineId,
        disciplineSide,
        entries: previewEntries,
        disciplineScores: context.disciplineScores,
        activePlayers: context.activePlayers,
        rosterPlayers: context.rosterPlayers,
        requiredPlayers:
          context.disciplineSidePlayerCounts?.[pair] ??
          context.disciplinePlayerCounts[disciplineId] ??
          null,
        fatigueByPlayerId: fatigueMap,
        moraleByPlayerId,
        fatigueSourceStatus: fatigueMap ? "mapped" : "missing_source",
        intensity: previewModifiers[disciplineSide].intensity,
        formCardsAvailable: formResult.formCardsAvailable,
        formCardsSelected: formResult.formCardsSelected,
        formCardLabel: formResult.formCardLabel,
        formModifier: formResult.formModifier,
        mutatorText: mutatorResult.mutatorText,
        mutatorModifier: effectiveMutatorModifier,
        mutatorBonusByPlayerId: effectiveMutatorBonuses,
        teamPowerSelected: teamPowerResult.teamPowerSelected,
        teamPowerStatus: context.teamPowerSource?.effectStatus === "ready" ? "ready" : "missing_source",
        teamPowerLabel: teamPowerResult.teamPowerLabel,
        teamPowerModifier: effectiveTeamPowerModifier,
        teamPowerImpact: teamPowerResult.teamPowerImpact,
        teamPowerBasePct: teamPowerResult.teamPowerBasePct,
        teamPowerConditionalPct: teamPowerResult.teamPowerConditionalPct,
        teamPowerAttributeFitPct: teamPowerResult.teamPowerAttributeFitPct,
        teamPowerEffectType: context.teamPowers?.find((power) => power.id === previewModifiers[disciplineSide].teamPowerId)?.effectType ?? null,
        teamPowerTargetMode: context.teamPowers?.find((power) => power.id === previewModifiers[disciplineSide].teamPowerId)?.targetMode ?? null,
        teamPowerTargetLimit: context.teamPowers?.find((power) => power.id === previewModifiers[disciplineSide].teamPowerId)?.targetLimit ?? null,
      }),
      modifierWarnings: [...formResult.warnings, ...mutatorResult.warnings, ...teamPowerResult.warnings],
    };
  });
  const scoreParts = scorePartsWithModifierWarnings.map((entry) => entry.score);
  const scorePreview = buildLegacyLineupAggregateScore(scoreParts);
  const modifierWarnings = Array.from(
    new Set(scorePartsWithModifierWarnings.flatMap((entry) => entry.modifierWarnings)),
  );

  return {
    ok: true,
    contextMeta: context.contextMeta,
    validation,
    disciplineSideScores: scoreParts,
    scorePreview: {
      ...scorePreview,
      validationWarnings: [
        ...validation.warnings,
        ...scorePreview.validationWarnings,
        ...modifierWarnings,
      ],
      modifierWarnings: [...(scorePreview.modifierWarnings ?? []), ...modifierWarnings],
    },
    warnings: [],
  };
}
