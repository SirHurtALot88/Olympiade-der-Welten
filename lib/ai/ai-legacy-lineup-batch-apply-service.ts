import { buildAiLegacyLineupPreview } from "@/lib/ai/ai-legacy-lineup-engine";
import type { FormCardColor, GameState, LineupDraftModifiers } from "@/lib/data/olyDataTypes";
import type { AiLegacyLineupPreviewStatus } from "@/lib/ai/ai-needs-types";
import { buildTeamControlSettingsMap, isAiLineupBatchApplyEnabled } from "@/lib/foundation/team-control-settings";
import {
  createDefaultLineupDraftModifiers,
  ensureLocalFormCardsForSeason,
  getFormCardColorForDisciplineCategory,
} from "@/lib/lineups/legacy-lineup-modifiers";
import type { LegacyFormCardOption, LegacyLineupEntryInput, LegacyLineupKeyParams, LegacyLineupLoadedContext, LegacyMutatorTraitOption, LegacyRosterPlayerRef, LegacyTeamPowerOption } from "@/lib/lineups/legacy-lineup-types";
import {
  calculateLocalLegacyLineupPreviewFromContext,
  loadLocalLegacyLineupContextFromGameState,
  saveLocalLegacyLineupDraftBatch,
} from "@/lib/lineups/legacy-lineup-local-service";
import { isLegacyLineupDraftComplete } from "@/lib/lineups/legacy-matchday-readiness";
import { calculateTeamPowerModifierForSide, ensureLocalTeamPowersForSeason } from "@/lib/lineups/team-powers";
import { selectTeamCaptain } from "@/lib/morale/player-demands-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";

export type AiBatchApplyTeamStatus =
  | "saved"
  | "skipped_warning"
  | "skipped_blocked"
  | "skipped_existing"
  | "skipped_manual"
  | "skipped_passive"
  | "skipped_disabled"
  | "failed_validation";

export type AiBatchApplyTeamResult = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  aiEligible: boolean;
  previewStatus: AiLegacyLineupPreviewStatus | "validation_failed";
  captainSlotsUsed: number | null;
  captainSlotsRemaining: number | null;
  d1CaptainSelectionStatus: string | null;
  d2CaptainSelectionStatus: string | null;
  result: AiBatchApplyTeamStatus;
  overwriteExisting: boolean;
  warnings: string[];
  blockingReasons: string[];
  saved: boolean;
  formCardsSelected?: number;
  negativeFormCardsSelected?: number;
};

export type AiBatchApplySummary = {
  totalTeams: number;
  aiEligibleTeams: number;
  skippedManual: number;
  skippedPassive: number;
  skippedDisabled: number;
  readyToSave: number;
  readyTeams: number;
  warningTeams: number;
  blockedTeams: number;
  wouldSave: number;
  savedTeams: number;
  skippedWarning: number;
  skippedBlocked: number;
  skippedExisting: number;
  existingLineups: number;
  wouldOverwrite: number;
  overwrittenExisting: number;
  plannedLineups: number;
  formCardsSelected: number;
  negativeFormCardsSelected: number;
  performanceBreakdown?: {
    formCardPlanningMs: number;
    aiLineupGenerationMs: number;
    lineupValidationMs: number;
    mutatorPlanningMs: number;
    saveWriteMs: number;
    contextLoadMs: number;
    teamPowerPlanningMs: number;
    totalMs: number;
  };
  warnings: string[];
  blockingReasons: string[];
};

export type AiBatchApplyResult = {
  source: "sqlite";
  readOnly: false;
  dryRun: boolean;
  includeWarningTeams: boolean;
  totalTeams: number;
  results: AiBatchApplyTeamResult[];
  summary: AiBatchApplySummary;
};

type AiBatchApplyInput = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  includeWarningTeams?: boolean;
  overwriteExisting?: boolean;
  forceAiTeams?: boolean;
  dryRun?: boolean;
};

function resolveLocalScope(input: AiBatchApplyInput, persistence: PersistenceService) {
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save =
    persistence.getSaveById(input.saveId) ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error("No local save available for AI batch apply.");
  }

	  return {
	    save,
	    saveId: save.saveId,
	    seasonId: input.seasonId || save.gameState.season.id,
	    matchdayId: input.matchdayId || save.gameState.matchdayState.matchdayId,
    teams: (() => {
      const settingsMap = buildTeamControlSettingsMap(
        save.gameState.teams,
        save.gameState.seasonState?.teamControlSettings,
      );

      return save.gameState.teams.map((team) => {
        const settings = settingsMap[team.teamId];
        const controlMode = settings?.controlMode ?? "manual";
        const aiEligible = controlMode === "ai" && (input.forceAiTeams === true || isAiLineupBatchApplyEnabled(settings));

        return {
          teamId: team.teamId,
          teamCode: team.shortCode ?? team.teamId,
          teamName: team.name,
          controlMode,
          aiEligible,
        };
      });
    })(),
  };
}

function classifyPreviewStatus(status: AiLegacyLineupPreviewStatus) {
  if (status === "blocked") {
    return "blocked";
  }
  if (status === "ready") {
    return "ready";
  }
  return "warning";
}

function elapsedSince(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function buildCaptainPreviewMeta(
  preview: Partial<{
    captainSlotsUsed: number;
    captainSlotsRemaining: number;
    d1: { captainSelectionStatus?: string | null } | null;
    d2: { captainSelectionStatus?: string | null } | null;
  }>,
) {
  return {
    captainSlotsUsed: preview.captainSlotsUsed ?? null,
    captainSlotsRemaining: preview.captainSlotsRemaining ?? null,
    d1CaptainSelectionStatus: preview.d1?.captainSelectionStatus ?? null,
    d2CaptainSelectionStatus: preview.d2?.captainSelectionStatus ?? null,
  };
}

function countSelectedFormCards(modifiers: LineupDraftModifiers) {
  const ids = [
    modifiers.d1.primaryFormCardId,
    modifiers.d1.secondaryFormCardId,
    modifiers.d2.primaryFormCardId,
    modifiers.d2.secondaryFormCardId,
  ].filter((value): value is string => Boolean(value));

  return ids.length;
}

function countSelectedNegativeFormCards(modifiers: LineupDraftModifiers, cards: LegacyFormCardOption[]) {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  return [
    modifiers.d1.primaryFormCardId,
    modifiers.d2.primaryFormCardId,
  ].filter((cardId) => {
    if (!cardId) return false;
    return (cardById.get(cardId)?.value ?? 0) < 0;
  }).length;
}

function isNonActionableAiLineupWarning(warning: string) {
  return warning === "captain_limit_reached";
}

function normalizeAiLineupWarnings(warnings: string[]) {
  return Array.from(new Set(warnings.filter((warning) => !isNonActionableAiLineupWarning(warning))));
}

function sortFormCardsForSlot(
  cards: LegacyFormCardOption[],
  color: FormCardColor | null,
  polarity: "positive" | "negative",
) {
  return [...cards].sort((left, right) => {
    if (polarity === "negative") {
      const leftColorPenalty = color && left.color === color ? 1 : 0;
      const rightColorPenalty = color && right.color === color ? 1 : 0;
      if (leftColorPenalty !== rightColorPenalty) return leftColorPenalty - rightColorPenalty;
      const absDiff = Math.abs(left.value) - Math.abs(right.value);
      if (absDiff !== 0) return absDiff;
      return left.id.localeCompare(right.id);
    }

    const leftColorHit = color && left.color === color ? 1 : 0;
    const rightColorHit = color && right.color === color ? 1 : 0;
    if (leftColorHit !== rightColorHit) return rightColorHit - leftColorHit;
    if (left.value !== right.value) return right.value - left.value;
    return left.id.localeCompare(right.id);
  });
}

function takeBestFormCard(input: {
  cards: LegacyFormCardOption[];
  usedIds: Set<string>;
  color: FormCardColor | null;
  polarity: "positive" | "negative";
}) {
  const candidates = input.cards.filter((card) => {
    if (input.usedIds.has(card.id)) {
      return false;
    }
    if (input.polarity === "negative" && input.color && card.color === input.color) {
      return false;
    }
    return true;
  });
  const picked = sortFormCardsForSlot(candidates, input.color, input.polarity)[0] ?? null;
  if (picked) {
    input.usedIds.add(picked.id);
  }
  return picked;
}

function findBestMatchingPositiveFormCard(input: {
  cards: LegacyFormCardOption[];
  usedIds: Set<string>;
  color: FormCardColor | null;
  fallbackAnyColor?: boolean;
}) {
  const candidates = input.cards.filter((card) => !input.usedIds.has(card.id) && card.value > 0);
  if (candidates.length === 0) return null;

  const colorMatchCandidates = input.color ? candidates.filter((card) => card.color === input.color) : [];
  if (colorMatchCandidates.length > 0) {
    return sortFormCardsForSlot(colorMatchCandidates, input.color, "positive")[0] ?? null;
  }

  if (input.fallbackAnyColor) {
    return sortFormCardsForSlot(candidates, null, "positive")[0] ?? null;
  }
  return null;
}

function competitivenessRank(value: DisciplineSideCompetitiveness) {
  switch (value) {
    case "weak":
      return 0;
    case "neutral":
      return 1;
    case "strong":
      return 2;
  }
}

function planNegativeDumpSidesForMatchday(input: {
  sides: Array<{ side: "d1" | "d2"; competitiveness: DisciplineSideCompetitiveness }>;
  dumpsRequiredThisMatchday: number;
  unusedNegativeCount: number;
}) {
  const dumpSides = new Set<"d1" | "d2">();
  if (input.unusedNegativeCount <= 0 || input.dumpsRequiredThisMatchday <= 0) {
    return dumpSides;
  }

  const target = Math.min(input.dumpsRequiredThisMatchday, input.unusedNegativeCount, 2);
  const orderedSides = [...input.sides].sort(
    (left, right) => competitivenessRank(left.competitiveness) - competitivenessRank(right.competitiveness),
  );

  for (const side of orderedSides) {
    if (dumpSides.size >= target) {
      break;
    }
    dumpSides.add(side.side);
  }

  return dumpSides;
}

function parseIdentityPowerSlotIndex(powerId: string) {
  const match = powerId.match(/:identity:(\d+)$/);
  if (!match) {
    return null;
  }
  return Number(match[1]) - 1;
}

function countRemainingSelectableCharges(teamPowers: LegacyTeamPowerOption[]) {
  return teamPowers
    .filter((power) => power.selectedForSeason && power.chargesRemaining > 0)
    .reduce((sum, power) => sum + power.chargesRemaining, 0);
}

function isDebuffTeamPower(power: LegacyTeamPowerOption) {
  return (
    power.effectType === "snipe_debuff" ||
    power.effectType === "field_debuff" ||
    power.effectType === "rivalry_debuff"
  );
}

function powerMatchesDisciplineCategory(power: LegacyTeamPowerOption, disciplineCategory: string | null | undefined) {
  return power.category === "flex" || power.category === disciplineCategory;
}

function sideTeamPowerPriority(input: {
  competitiveness: DisciplineSideCompetitiveness;
  rivalryCount: number;
}) {
  const competitivenessRank = input.competitiveness === "strong" ? 2 : input.competitiveness === "neutral" ? 1 : 0;
  return competitivenessRank * 3 + Math.min(input.rivalryCount, 2);
}

function planTeamPowerSidesForMatchday(input: {
  sidePlans: Array<{
    side: "d1" | "d2";
    competitiveness: DisciplineSideCompetitiveness;
    rivalryCount: number;
  }>;
  remainingCharges: number;
  remainingMatchdaysIncludingCurrent: number;
  matchdayIndex: number;
}) {
  const plannedSides = new Set<"d1" | "d2">();
  if (input.remainingCharges <= 0 || input.sidePlans.length === 0) {
    return plannedSides;
  }

  const remainingSlots = input.remainingMatchdaysIncludingCurrent * 2;
  const slack = remainingSlots - input.remainingCharges;
  const totalMatchdays = Math.max(1, Math.ceil(remainingSlots / 2));
  const lateSeason = input.matchdayIndex >= Math.ceil(totalMatchdays * 0.7);

  let targetUses = 0;
  if (slack < 0) {
    targetUses = Math.min(2, Math.max(1, input.remainingCharges - Math.max(0, remainingSlots - 2)));
  } else if (slack <= 1) {
    targetUses = 1;
  } else if (lateSeason && slack <= 3) {
    targetUses = 1;
  }

  const orderedSides = [...input.sidePlans].sort(
    (left, right) =>
      sideTeamPowerPriority(right) - sideTeamPowerPriority(left) || left.side.localeCompare(right.side),
  );

  if (targetUses === 0) {
    const bestSide =
      orderedSides.find((side) => side.rivalryCount > 0) ??
      orderedSides.find((side) => side.competitiveness === "strong") ??
      null;
    if (
      bestSide &&
      (bestSide.rivalryCount > 0 || (bestSide.competitiveness === "strong" && input.matchdayIndex >= 4))
    ) {
      plannedSides.add(bestSide.side);
    }
    return plannedSides;
  }

  for (const side of orderedSides) {
    if (plannedSides.size >= targetUses) {
      break;
    }
    if (side.competitiveness === "weak" && !lateSeason && slack > 0) {
      continue;
    }
    plannedSides.add(side.side);
  }

  return plannedSides;
}

function powerAllowedForSide(input: {
  power: LegacyTeamPowerOption;
  competitiveness: DisciplineSideCompetitiveness;
  disciplineCategory: string | null | undefined;
  rivalryCount: number;
  lateSeason: boolean;
}) {
  if (isDebuffTeamPower(input.power)) {
    return input.rivalryCount > 0 || input.power.conditionalTrigger === "rival_top8_discipline";
  }

  const identitySlot = parseIdentityPowerSlotIndex(input.power.id);
  if (identitySlot == null) {
    if (input.power.source === "facility") {
      return (
        (input.competitiveness === "strong" || input.lateSeason) &&
        powerMatchesDisciplineCategory(input.power, input.disciplineCategory)
      );
    }
    return (
      input.rivalryCount > 0 ||
      categoryMatch ||
      input.competitiveness === "strong" ||
      input.power.conditionalTrigger === "rival_top8_discipline"
    );
  }

  const categoryMatch = powerMatchesDisciplineCategory(input.power, input.disciplineCategory);
  if (input.competitiveness === "strong") {
    return identitySlot <= 1 || categoryMatch;
  }
  if (input.competitiveness === "neutral") {
    return identitySlot >= 1 || categoryMatch;
  }
  return identitySlot >= 2;
}

function selectBestTeamPowerForSide(input: {
  context: LegacyLineupLoadedContext;
  modifiers: LineupDraftModifiers;
  side: "d1" | "d2";
  disciplineId: string | null | undefined;
  disciplineCategory: string | null | undefined;
  usedPowerIds: Set<string>;
  competitiveness: DisciplineSideCompetitiveness;
  rivalryCount: number;
  lateSeason: boolean;
}) {
  const candidates = (input.context.teamPowers ?? []).filter((power) => {
    if (input.usedPowerIds.has(power.id)) return false;
    if (power.isUsedUp || power.chargesRemaining <= 0) return false;
    return powerAllowedForSide({
      power,
      competitiveness: input.competitiveness,
      disciplineCategory: input.disciplineCategory,
      rivalryCount: input.rivalryCount,
      lateSeason: input.lateSeason,
    });
  });
  if (candidates.length === 0 || !input.disciplineId) return null;
  const contextGameState = (input.context as LegacyLineupLoadedContext & { gameState?: GameState }).gameState ?? null;
  const teamCaptain = contextGameState ? selectTeamCaptain(contextGameState, input.context.teamId) : null;

  const ranked = candidates
    .map((power) => {
      const conditionalBonusPct =
        power.conditionalTrigger === "rival_top8_discipline" && input.rivalryCount > 0
          ? power.conditionalBonusPct
          : 0;
      const result = calculateTeamPowerModifierForSide({
        modifiers: {
          ...input.modifiers,
          [input.side]: {
            ...input.modifiers[input.side],
            teamPowerId: power.id,
          },
        },
        disciplineSide: input.side,
        disciplineId: input.disciplineId,
        disciplineCategory: input.disciplineCategory,
        teamPowers: candidates,
        teamCaptainPowerModifierPct: teamCaptain?.effects.teamPowerModifierPct ?? null,
        conditionalBonusPct,
      });
      const categoryMatch = powerMatchesDisciplineCategory(power, input.disciplineCategory);
      const identitySlot = parseIdentityPowerSlotIndex(power.id);
      const slotFit =
        identitySlot == null
          ? power.source === "facility"
            ? 0.15
            : 0
          : input.competitiveness === "strong"
            ? identitySlot === 0
              ? 0.55
              : identitySlot === 1
                ? 0.35
                : 0.1
            : input.competitiveness === "neutral"
              ? identitySlot === 1
                ? 0.35
                : identitySlot === 2
                  ? 0.25
                  : 0.05
              : identitySlot === 2
                ? 0.2
                : 0;
      const categoryFit = categoryMatch ? 0.5 : power.category === "flex" ? 0.2 : -0.35;
      const rivalryFit = conditionalBonusPct > 0 || (isDebuffTeamPower(power) && input.rivalryCount > 0) ? 0.45 : 0;
      const chargeFit = (power.chargesTotal - power.chargesRemaining) / Math.max(1, power.chargesTotal);
      const conserveBonus = power.chargesTotal >= 4 && input.competitiveness !== "strong" ? -0.25 : 0;
      return {
        power,
        score:
          result.teamPowerImpact +
          categoryFit +
          rivalryFit +
          slotFit +
          conserveBonus -
          chargeFit * 0.15,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const leftSlot = parseIdentityPowerSlotIndex(left.power.id) ?? 99;
      const rightSlot = parseIdentityPowerSlotIndex(right.power.id) ?? 99;
      if (leftSlot !== rightSlot) return leftSlot - rightSlot;
      if (right.power.chargesRemaining !== left.power.chargesRemaining) {
        return right.power.chargesRemaining - left.power.chargesRemaining;
      }
      return left.power.label.localeCompare(right.power.label);
    });

  const best = ranked[0] ?? null;
  if (!best || best.score < 5.5) {
    return null;
  }
  return best.power;
}

function applyAiTeamPowers(
  context: LegacyLineupLoadedContext,
  modifiers: LineupDraftModifiers,
  plannedEntries: LegacyLineupEntryInput[],
) {
  const teamPowers = context.teamPowers ?? [];
  const remainingCharges = countRemainingSelectableCharges(teamPowers);
  if (remainingCharges <= 0) {
    return;
  }

  const totalSeasonSides = context.matchdayContract?.totalDisciplineSidesInSeason ?? 20;
  const totalMatchdays = Math.max(1, Math.ceil(totalSeasonSides / 2));
  const matchdayIndex = Math.max(1, context.matchday?.index || context.season?.currentMatchday || 1);
  const remainingMatchdaysIncludingCurrent = Math.max(1, totalMatchdays - matchdayIndex + 1);
  const lateSeason = matchdayIndex >= Math.ceil(totalMatchdays * 0.7);

  const sidePlans = [
    {
      side: "d1" as const,
      disciplineId: context.matchdayContract?.discipline1?.disciplineId ?? null,
      category: context.matchdayContract?.discipline1?.category ?? null,
      competitiveness: estimateDisciplineSideCompetitiveness({
        context,
        side: "d1",
        disciplineId: context.matchdayContract?.discipline1?.disciplineId ?? null,
        plannedEntries,
      }),
      rivalryCount: context.teamPowerWindows?.[context.matchdayContract?.discipline1?.disciplineId ?? ""]?.top8Rivals.length ?? 0,
    },
    {
      side: "d2" as const,
      disciplineId: context.matchdayContract?.discipline2?.disciplineId ?? null,
      category: context.matchdayContract?.discipline2?.category ?? null,
      competitiveness: estimateDisciplineSideCompetitiveness({
        context,
        side: "d2",
        disciplineId: context.matchdayContract?.discipline2?.disciplineId ?? null,
        plannedEntries,
      }),
      rivalryCount: context.teamPowerWindows?.[context.matchdayContract?.discipline2?.disciplineId ?? ""]?.top8Rivals.length ?? 0,
    },
  ];

  const plannedSides = planTeamPowerSidesForMatchday({
    sidePlans: sidePlans.map((side) => ({
      side: side.side,
      competitiveness: side.competitiveness,
      rivalryCount: side.rivalryCount,
    })),
    remainingCharges,
    remainingMatchdaysIncludingCurrent,
    matchdayIndex,
  });

  const usedPowerIds = new Set<string>();
  for (const side of sidePlans) {
    if (!plannedSides.has(side.side)) {
      continue;
    }
    const selected = selectBestTeamPowerForSide({
      context,
      modifiers,
      side: side.side,
      disciplineId: side.disciplineId,
      disciplineCategory: side.category,
      usedPowerIds,
      competitiveness: side.competitiveness,
      rivalryCount: side.rivalryCount,
      lateSeason,
    });
    if (!selected) continue;
    modifiers[side.side].teamPowerId = selected.id;
    usedPowerIds.add(selected.id);
  }
}

function takeDumpNegativeFormCard(input: {
  cards: LegacyFormCardOption[];
  usedIds: Set<string>;
  color: FormCardColor | null;
}) {
  const candidates = input.cards.filter((card) => !input.usedIds.has(card.id));
  if (candidates.length === 0) {
    return null;
  }

  const nonMatching = candidates.filter((card) => !(input.color && card.color === input.color));
  const pool = nonMatching.length > 0 ? nonMatching : candidates;
  const picked =
    [...pool].sort((left, right) => {
      if (left.value !== right.value) {
        return left.value - right.value;
      }
      return left.id.localeCompare(right.id);
    })[0] ?? null;

  if (picked) {
    input.usedIds.add(picked.id);
  }
  return picked;
}

function getSideStrongestScore(input: {
  context: LegacyLineupLoadedContext;
  side: "d1" | "d2";
  disciplineId: string | null | undefined;
  plannedEntries: LegacyLineupEntryInput[];
}) {
  if (!input.disciplineId) {
    return 0;
  }

  const sideEntries = input.plannedEntries.filter((entry) => entry.disciplineSide === input.side);
  return Math.max(
    0,
    ...sideEntries.map((entry) =>
      input.context.disciplineScores.find(
        (score) => score.playerId === entry.playerId && score.disciplineId === input.disciplineId,
      )?.score ?? 0,
    ),
  );
}

type DisciplineSideCompetitiveness = "weak" | "neutral" | "strong";

function estimateDisciplineSideCompetitiveness(input: {
  context: LegacyLineupLoadedContext;
  side: "d1" | "d2";
  disciplineId: string | null | undefined;
  plannedEntries: LegacyLineupEntryInput[];
}): DisciplineSideCompetitiveness {
  if (!input.disciplineId) {
    return "neutral";
  }

  const sideEntries = input.plannedEntries.filter((entry) => entry.disciplineSide === input.side);
  if (sideEntries.length === 0) {
    return "neutral";
  }

  const rank = input.context.teamDisciplineRanks?.[input.disciplineId]?.rank ?? null;
  const strongestScore = getSideStrongestScore(input);

  if ((rank != null && rank >= 24) || strongestScore < 68) {
    return "weak";
  }
  if (rank != null && rank >= 20 && strongestScore < 74) {
    return "weak";
  }
  if (rank != null && rank <= 12 && strongestScore >= 76) {
    return "strong";
  }
  if (rank != null && rank <= 16 && strongestScore >= 80) {
    return "strong";
  }

  return "neutral";
}

function pickPrimaryFormCardForSide(input: {
  competitiveness: DisciplineSideCompetitiveness;
  preferNegativeDump: boolean;
  negativeCards: LegacyFormCardOption[];
  positiveCards: LegacyFormCardOption[];
  usedIds: Set<string>;
  color: FormCardColor | null;
  positiveSelected: number;
  desiredPositiveThisMatchday: number;
  positiveUrgency: boolean;
}) {
  if (input.competitiveness === "weak") {
    return takeDumpNegativeFormCard({
      cards: input.negativeCards,
      usedIds: input.usedIds,
      color: input.color,
    });
  }

  if (input.preferNegativeDump) {
    // For both strong and neutral dump sides: prefer non-color-matched but always fall back
    // to any negative (including color-matched) so forced dumps never silently skip.
    const nonMatching = takeBestFormCard({
      cards: input.negativeCards,
      usedIds: input.usedIds,
      color: input.color,
      polarity: "negative",
    });
    if (nonMatching) return nonMatching;
    return takeDumpNegativeFormCard({
      cards: input.negativeCards,
      usedIds: input.usedIds,
      color: input.color,
    });
  }

  if (input.competitiveness === "strong" && input.positiveSelected < input.desiredPositiveThisMatchday) {
    const positive = findBestMatchingPositiveFormCard({
      cards: input.positiveCards,
      usedIds: input.usedIds,
      color: input.color,
      fallbackAnyColor: input.positiveUrgency,
    });
    if (positive) {
      input.usedIds.add(positive.id);
      return positive;
    }
  }

  if (input.competitiveness === "neutral" && input.positiveUrgency && input.positiveSelected < input.desiredPositiveThisMatchday) {
    const positive = findBestMatchingPositiveFormCard({
      cards: input.positiveCards,
      usedIds: input.usedIds,
      color: input.color,
      fallbackAnyColor: true,
    });
    if (positive) {
      input.usedIds.add(positive.id);
      return positive;
    }
  }

  return null;
}

function pickSecondaryFormCardForSide(input: {
  competitiveness: DisciplineSideCompetitiveness;
  primaryCard: LegacyFormCardOption | null;
  positiveCards: LegacyFormCardOption[];
  usedIds: Set<string>;
  color: FormCardColor | null;
  positiveSelected: number;
  desiredPositiveThisMatchday: number;
  positiveUrgency: boolean;
}) {
  // Weak sides never get secondary cards.
  if (input.competitiveness === "weak") return null;
  // Neutral sides only get a secondary when positives are piling up.
  if (input.competitiveness === "neutral" && !input.positiveUrgency) return null;
  // Never put a negative in the secondary slot.
  if (input.primaryCard && input.primaryCard.value < 0) return null;
  if (input.positiveSelected >= input.desiredPositiveThisMatchday) return null;

  const positive = findBestMatchingPositiveFormCard({
    cards: input.positiveCards,
    usedIds: input.usedIds,
    color: input.color,
    fallbackAnyColor: input.positiveUrgency,
  });
  if (positive) {
    input.usedIds.add(positive.id);
  }
  return positive;
}

function getAiIntensityForSide(input: {
  context: LegacyLineupLoadedContext;
  side: "d1" | "d2";
  disciplineId: string | null | undefined;
  plannedEntries: LegacyLineupEntryInput[];
}) {
  if (!input.disciplineId) {
    return "normal" as const;
  }
  const rank = input.context.teamDisciplineRanks?.[input.disciplineId]?.rank ?? null;
  const sideEntries = input.plannedEntries.filter((entry) => entry.disciplineSide === input.side);
  const strongestScore = getSideStrongestScore({
    context: input.context,
    side: input.side,
    disciplineId: input.disciplineId,
    plannedEntries: input.plannedEntries,
  });
  const hasCaptain = sideEntries.some((entry) => entry.isCaptain);
  const matchdayIndex = Math.max(1, input.context.matchdayContract?.matchdayIndex ?? input.context.matchday.index ?? 1);
  const totalSeasonSides = input.context.matchdayContract?.totalDisciplineSidesInSeason ?? 20;
  const totalMatchdays = Math.max(1, Math.ceil(totalSeasonSides / 2));
  const isMidSeasonOrLater = matchdayIndex >= Math.ceil(totalMatchdays * 0.4);
  const isLateSeason = matchdayIndex >= Math.ceil(totalMatchdays * 0.7);
  const requiredPlayers =
    input.context.disciplineSidePlayerCounts?.[`${input.disciplineId}::${input.side}`] ??
    input.context.disciplinePlayerCounts[input.disciplineId] ??
    sideEntries.length;

  const isWeakDisciplineWindow =
    (rank != null && rank >= 28) ||
    (rank != null && rank >= 22 && strongestScore < 74) ||
    strongestScore < 66;

  if (isWeakDisciplineWindow) {
    return matchdayIndex <= 2 ? "conserve" as const : "normal" as const;
  }

  const hasHighLeverageRank = rank != null && rank <= 8 && strongestScore >= 76;
  const hasEliteSpecialistWindow = strongestScore >= (isLateSeason ? 84 : 88);
  const hasTopHalfPressure = rank != null && rank <= 16 && strongestScore >= 72 && isMidSeasonOrLater;
  const hasLargeDisciplineLeverage = requiredPlayers >= 5 && rank != null && rank <= 20 && strongestScore >= 72;
  const hasLateComebackWindow = isLateSeason && rank != null && rank <= 24 && strongestScore >= 78;

  if (
    hasCaptain ||
    hasHighLeverageRank ||
    hasEliteSpecialistWindow ||
    hasTopHalfPressure ||
    hasLargeDisciplineLeverage ||
    hasLateComebackWindow
  ) {
    return "push" as const;
  }
  if (matchdayIndex <= 2 && rank != null && rank >= 24 && strongestScore < 68) {
    return "conserve" as const;
  }
  return "normal" as const;
}

function applyAiIntensity(context: LegacyLineupLoadedContext, modifiers: LineupDraftModifiers, plannedEntries: LegacyLineupEntryInput[]) {
  modifiers.d1.intensity = getAiIntensityForSide({
    context,
    side: "d1",
    disciplineId: context.matchdayContract?.discipline1?.disciplineId ?? null,
    plannedEntries,
  });
  modifiers.d2.intensity = getAiIntensityForSide({
    context,
    side: "d2",
    disciplineId: context.matchdayContract?.discipline2?.disciplineId ?? null,
    plannedEntries,
  });
}

export function buildAiLegacyLineupModifiers(
  context: LegacyLineupLoadedContext,
  plannedEntries: LegacyLineupEntryInput[] = context.existingDraft?.entries ?? context.entries ?? [],
): LineupDraftModifiers {
  const modifiers = createDefaultLineupDraftModifiers();
  const formCards = (context.formCards ?? []).filter((card) => !card.isUsed);

  const totalSeasonSides = context.matchdayContract?.totalDisciplineSidesInSeason ?? 20;
  const totalMatchdays = Math.max(1, Math.ceil(totalSeasonSides / 2));
  const currentMatchdayIndex = Math.max(1, context.matchday?.index || context.season?.currentMatchday || 1);
  const remainingMatchdaysIncludingCurrent = Math.max(1, totalMatchdays - currentMatchdayIndex + 1);
  const remainingPrimarySlots = remainingMatchdaysIncludingCurrent * 2;
  const negativeCards = formCards.filter((card) => card.value < 0);
  const positiveCards = formCards.filter((card) => card.value > 0);
  const dumpsRequiredThisMatchday = Math.min(
    2,
    Math.max(0, negativeCards.length - Math.max(0, remainingPrimarySlots - 2)),
  );
  const desiredPositiveThisMatchday = Math.min(
    4,
    Math.ceil(positiveCards.length / remainingMatchdaysIncludingCurrent),
  );
  // Urgency flags: true when cards are accumulating faster than available slots can absorb them.
  // Negative urgency: more negatives than remaining primary slots (can't all be used without color-override).
  // Positive urgency: more than 2 positives needed per matchday to exhaust the pool.
  const negativeUrgency = negativeCards.length > remainingPrimarySlots;
  const positiveUrgency = positiveCards.length > remainingMatchdaysIncludingCurrent * 2;
  const usedIds = new Set<string>();
  let positiveSelected = 0;
  const sides = [
    {
      side: "d1" as const,
      disciplineId: context.matchdayContract?.discipline1?.disciplineId ?? null,
      color: getFormCardColorForDisciplineCategory(context.matchdayContract?.discipline1?.category),
    },
    {
      side: "d2" as const,
      disciplineId: context.matchdayContract?.discipline2?.disciplineId ?? null,
      color: getFormCardColorForDisciplineCategory(context.matchdayContract?.discipline2?.category),
    },
  ];
  const sidePlans = sides.map((side) => ({
    ...side,
    competitiveness: estimateDisciplineSideCompetitiveness({
      context,
      side: side.side,
      disciplineId: side.disciplineId,
      plannedEntries,
    }),
  }));
  // When negative urgency is active, also flag the weaker sides for forced dumps so all
  // negatives get assigned rather than waiting until the very last matchday.
  const effectiveDumpsRequired = negativeUrgency
    ? Math.min(2, negativeCards.length)
    : dumpsRequiredThisMatchday;
  const negativeDumpSides = planNegativeDumpSidesForMatchday({
    sides: sidePlans,
    dumpsRequiredThisMatchday: effectiveDumpsRequired,
    unusedNegativeCount: negativeCards.length,
  });

  for (const side of sidePlans) {
    const primary =
      formCards.length > 0
        ? pickPrimaryFormCardForSide({
            competitiveness: side.competitiveness,
            preferNegativeDump: negativeDumpSides.has(side.side),
            negativeCards,
            positiveCards,
            usedIds,
            color: side.color,
            positiveSelected,
            desiredPositiveThisMatchday,
            positiveUrgency,
          })
        : null;

    if (primary) {
      modifiers[side.side].primaryFormCardId = primary.id;
      if (primary.value > 0) {
        positiveSelected += 1;
      }
    }

    const secondary =
      formCards.length > 0
        ? pickSecondaryFormCardForSide({
            competitiveness: side.competitiveness,
            primaryCard: primary,
            positiveCards,
            usedIds,
            color: side.color,
            positiveSelected,
            desiredPositiveThisMatchday,
            positiveUrgency,
          })
        : null;

    if (secondary) {
      modifiers[side.side].secondaryFormCardId = secondary.id;
      positiveSelected += 1;
    }
  }

  applyAiTeamPowers(context, modifiers, plannedEntries);
  applyAiIntensity(context, modifiers, plannedEntries);

  return modifiers;
}

export function applyAiLegacyLineupBatchLocally(
  input: AiBatchApplyInput,
  persistence: PersistenceService = createPersistenceService(),
): AiBatchApplyResult {
  const totalStartedAt = performance.now();
  const performanceBreakdown = {
    formCardPlanningMs: 0,
    aiLineupGenerationMs: 0,
    lineupValidationMs: 0,
    mutatorPlanningMs: 0,
    saveWriteMs: 0,
    contextLoadMs: 0,
    teamPowerPlanningMs: 0,
    totalMs: 0,
  };
  const includeWarningTeams = input.includeWarningTeams ?? false;
  const overwriteExisting = input.overwriteExisting ?? false;
  const dryRun = input.dryRun ?? true;
	  const scope = resolveLocalScope(input, persistence);
	  const save = scope.save;
  const results: AiBatchApplyTeamResult[] = [];
  const pendingDrafts: Array<{
    resultIndex: number;
    params: LegacyLineupKeyParams;
    entries: LegacyLineupEntryInput[];
    modifiers: LineupDraftModifiers;
  }> = [];
	  const formCardStartedAt = performance.now();
	  const existingSeasonCards = (save.gameState.seasonState?.formCards ?? []).filter((card) => card.seasonId === scope.seasonId);
	  let preparedGameState = save.gameState;
	  const formCardEnsure = {
	    ok: true as const,
	    warnings: [] as string[],
	    generatedCardCount: 0,
	    existingCardCount: existingSeasonCards.length,
	  };
	  try {
	    preparedGameState = ensureLocalFormCardsForSeason(save.gameState, scope.saveId, scope.seasonId);
	    const preparedSeasonCards = (preparedGameState.seasonState?.formCards ?? []).filter((card) => card.seasonId === scope.seasonId);
	    formCardEnsure.generatedCardCount = existingSeasonCards.length > 0 ? 0 : preparedSeasonCards.length;
	  } catch (error) {
	    formCardEnsure.warnings.push(error instanceof Error ? `form_card_prepare_skipped:${error.message}` : "form_card_prepare_skipped");
	  }
	  performanceBreakdown.formCardPlanningMs += elapsedSince(formCardStartedAt);
	  const powerStartedAt = performance.now();
	  try {
	    preparedGameState = ensureLocalTeamPowersForSeason(preparedGameState, scope.saveId, scope.seasonId);
	  } catch (error) {
	    formCardEnsure.warnings.push(error instanceof Error ? `team_power_prepare_skipped:${error.message}` : "team_power_prepare_skipped");
	  }
	  performanceBreakdown.teamPowerPlanningMs += elapsedSince(powerStartedAt);
	  if (!dryRun && typeof persistence.saveSingleplayerState === "function") {
	    persistence.saveSingleplayerState(scope.saveId, preparedGameState);
	  }

  for (const team of scope.teams) {
    const params: LegacyLineupKeyParams = {
      saveId: scope.saveId,
      seasonId: scope.seasonId,
      matchdayId: scope.matchdayId,
      teamId: team.teamId,
    };
    const contextStartedAt = performance.now();
    const contextResult = loadLocalLegacyLineupContextFromGameState(preparedGameState, params);
    performanceBreakdown.contextLoadMs += elapsedSince(contextStartedAt);

    if (!contextResult.ok) {
      results.push({
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: "blocked",
        captainSlotsUsed: null,
        captainSlotsRemaining: null,
        d1CaptainSelectionStatus: null,
        d2CaptainSelectionStatus: null,
        result: "skipped_blocked",
        overwriteExisting: false,
        warnings: contextResult.warnings,
        blockingReasons: contextResult.errors,
        saved: false,
      });
      continue;
    }

    const hasCompleteExistingDraft = isLegacyLineupDraftComplete(contextResult.context);
    const canAutoFillIncompleteLineup = !hasCompleteExistingDraft;

    if (team.controlMode === "manual" && !canAutoFillIncompleteLineup) {
      results.push({
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        controlMode: team.controlMode,
        aiEligible: false,
        previewStatus: "blocked",
        captainSlotsUsed: null,
        captainSlotsRemaining: null,
        d1CaptainSelectionStatus: null,
        d2CaptainSelectionStatus: null,
        result: "skipped_manual",
        overwriteExisting: false,
        warnings: [],
        blockingReasons: ["team_control_mode_manual"],
        saved: false,
      });
      continue;
    }

    if (team.controlMode === "passive" && !canAutoFillIncompleteLineup) {
      results.push({
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        controlMode: team.controlMode,
        aiEligible: false,
        previewStatus: "blocked",
        captainSlotsUsed: null,
        captainSlotsRemaining: null,
        d1CaptainSelectionStatus: null,
        d2CaptainSelectionStatus: null,
        result: "skipped_passive",
        overwriteExisting: false,
        warnings: [],
        blockingReasons: ["team_control_mode_passive"],
        saved: false,
      });
      continue;
    }

    if (!team.aiEligible && team.controlMode === "ai" && !canAutoFillIncompleteLineup) {
      results.push({
        teamId: team.teamId,
        teamCode: team.teamCode,
        teamName: team.teamName,
        controlMode: team.controlMode,
        aiEligible: false,
        previewStatus: "blocked",
        captainSlotsUsed: null,
        captainSlotsRemaining: null,
        d1CaptainSelectionStatus: null,
        d2CaptainSelectionStatus: null,
        result: "skipped_disabled",
        overwriteExisting: false,
        warnings: [],
        blockingReasons: ["ai_lineup_apply_disabled"],
        saved: false,
      });
      continue;
    }

    const effectiveAiEligible = team.aiEligible || canAutoFillIncompleteLineup;
    const previewStartedAt = performance.now();
    const preview = buildAiLegacyLineupPreview(contextResult.context, "sqlite");
    performanceBreakdown.aiLineupGenerationMs += elapsedSince(previewStartedAt);
    const modifierStartedAt = performance.now();
    const modifiers = buildAiLegacyLineupModifiers(contextResult.context, preview.entries);
    performanceBreakdown.mutatorPlanningMs += elapsedSince(modifierStartedAt);
    const validationStartedAt = performance.now();
    const validationPreview = calculateLocalLegacyLineupPreviewFromContext(
      contextResult.context,
      preview.entries,
      modifiers,
      contextResult.context.fatigueByPlayerId ?? null,
    );
    performanceBreakdown.lineupValidationMs += elapsedSince(validationStartedAt);
    const existingDraft = contextResult.context.existingDraft;
    const hasExistingDraft = Boolean(existingDraft?.entries?.length);
    const statusKind = classifyPreviewStatus(preview.status);
    const baseWarnings = normalizeAiLineupWarnings([
      ...(preview.warnings ?? []),
      ...(validationPreview.ok ? validationPreview.validation.warnings : validationPreview.warnings),
      ...(!formCardEnsure.ok ? formCardEnsure.warnings : formCardEnsure.warnings),
      ...(canAutoFillIncompleteLineup && team.controlMode === "manual" ? ["manual_incomplete_lineup_autofilled"] : []),
    ]);
    const formCardsSelected = countSelectedFormCards(modifiers);
    const negativeFormCardsSelected = countSelectedNegativeFormCards(modifiers, contextResult.context.formCards ?? []);

    if (!validationPreview.ok || !validationPreview.validation.isValid) {
      const captainMeta = buildCaptainPreviewMeta(preview);
      results.push({
        teamId: preview.teamId,
        teamCode: preview.teamCode,
        teamName: preview.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: "validation_failed",
        ...captainMeta,
        result: "failed_validation",
        overwriteExisting: hasExistingDraft,
        warnings: baseWarnings,
        blockingReasons: validationPreview.ok ? validationPreview.validation.errors : validationPreview.errors,
        saved: false,
        formCardsSelected,
        negativeFormCardsSelected,
      });
      continue;
    }

    if (statusKind === "blocked") {
      const captainMeta = buildCaptainPreviewMeta(preview);
      results.push({
        teamId: preview.teamId,
        teamCode: preview.teamCode,
        teamName: preview.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: preview.status,
        ...captainMeta,
        result: "skipped_blocked",
        overwriteExisting: hasExistingDraft,
        warnings: baseWarnings,
        blockingReasons: preview.warnings,
        saved: false,
        formCardsSelected,
        negativeFormCardsSelected,
      });
      continue;
    }

    if (statusKind === "warning" && !includeWarningTeams) {
      const captainMeta = buildCaptainPreviewMeta(preview);
      results.push({
        teamId: preview.teamId,
        teamCode: preview.teamCode,
        teamName: preview.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: preview.status,
        ...captainMeta,
        result: "skipped_warning",
        overwriteExisting: hasExistingDraft,
        warnings: baseWarnings,
        blockingReasons: [],
        saved: false,
        formCardsSelected,
        negativeFormCardsSelected,
      });
      continue;
    }

    if (hasCompleteExistingDraft && !overwriteExisting) {
      const captainMeta = buildCaptainPreviewMeta(preview);
      results.push({
        teamId: preview.teamId,
        teamCode: preview.teamCode,
        teamName: preview.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: preview.status,
        ...captainMeta,
        result: "skipped_existing",
        overwriteExisting: true,
        warnings: baseWarnings,
        blockingReasons: ["existing_lineup_requires_overwrite_confirm"],
        saved: false,
        formCardsSelected,
        negativeFormCardsSelected,
      });
      continue;
    }

    if (dryRun) {
      const captainMeta = buildCaptainPreviewMeta(preview);
      results.push({
        teamId: preview.teamId,
        teamCode: preview.teamCode,
        teamName: preview.teamName,
        controlMode: team.controlMode,
        aiEligible: team.aiEligible,
        previewStatus: preview.status,
        ...captainMeta,
        result: "saved",
        overwriteExisting: hasExistingDraft,
        warnings: baseWarnings,
        blockingReasons: [],
        saved: false,
        formCardsSelected,
        negativeFormCardsSelected,
      });
      continue;
    }

    const captainMeta = buildCaptainPreviewMeta(preview);
    const resultIndex = results.length;
    results.push({
      teamId: preview.teamId,
      teamCode: preview.teamCode,
      teamName: preview.teamName,
      controlMode: team.controlMode,
      aiEligible: team.aiEligible,
      previewStatus: preview.status,
      ...captainMeta,
      result: "saved",
      overwriteExisting: hasExistingDraft,
      warnings: baseWarnings,
      blockingReasons: [],
      saved: false,
      formCardsSelected,
      negativeFormCardsSelected,
    });
    pendingDrafts.push({
      resultIndex,
      params,
      entries: preview.entries,
      modifiers,
    });
  }

  if (!dryRun && pendingDrafts.length > 0) {
    const saveStartedAt = performance.now();
    const batchSave = saveLocalLegacyLineupDraftBatch(
      pendingDrafts.map((draft) => ({
        params: draft.params,
        entries: draft.entries,
        modifiers: draft.modifiers,
      })),
      persistence,
    );
    performanceBreakdown.saveWriteMs += elapsedSince(saveStartedAt);
    if (batchSave.ok) {
      for (const draft of pendingDrafts) {
        const result = results[draft.resultIndex];
        if (!result) continue;
        result.saved = true;
        result.warnings = Array.from(new Set([...result.warnings, ...batchSave.warnings]));
      }
    } else {
      for (const draft of pendingDrafts) {
        const result = results[draft.resultIndex];
        if (!result) continue;
        result.result = "failed_validation";
        result.saved = false;
        result.warnings = Array.from(new Set([...result.warnings, ...batchSave.warnings]));
        result.blockingReasons = Array.from(new Set([...result.blockingReasons, ...batchSave.errors]));
      }
    }
  }

  const summary: AiBatchApplySummary = {
    totalTeams: results.length,
    aiEligibleTeams: results.filter((entry) => entry.aiEligible).length,
    skippedManual: results.filter((entry) => entry.result === "skipped_manual").length,
    skippedPassive: results.filter((entry) => entry.result === "skipped_passive").length,
    skippedDisabled: results.filter((entry) => entry.result === "skipped_disabled").length,
    readyToSave: results.filter((entry) => entry.aiEligible && entry.previewStatus === "ready").length,
    readyTeams: results.filter((entry) => entry.previewStatus === "ready").length,
    warningTeams: results.filter((entry) => entry.previewStatus === "incomplete_roster" || entry.previewStatus === "missing_scores").length,
    blockedTeams: results.filter((entry) => entry.result === "skipped_blocked" || entry.result === "failed_validation").length,
    wouldSave: results.filter((entry) => dryRun && entry.result === "saved").length,
    savedTeams: results.filter((entry) => !dryRun && entry.saved).length,
    skippedWarning: results.filter((entry) => entry.result === "skipped_warning").length,
    skippedBlocked: results.filter((entry) => entry.result === "skipped_blocked" || entry.result === "failed_validation").length,
    skippedExisting: results.filter((entry) => entry.result === "skipped_existing").length,
    existingLineups: results.filter((entry) => entry.overwriteExisting).length,
    wouldOverwrite: results.filter((entry) => entry.overwriteExisting && entry.result === "saved").length,
    overwrittenExisting: results.filter((entry) => entry.overwriteExisting && (dryRun ? entry.result === "saved" : entry.saved)).length,
    plannedLineups: results.filter((entry) => dryRun ? entry.result === "saved" : entry.saved).length,
    formCardsSelected: results.reduce((sum, entry) => sum + (entry.formCardsSelected ?? 0), 0),
    negativeFormCardsSelected: results.reduce((sum, entry) => sum + (entry.negativeFormCardsSelected ?? 0), 0),
    performanceBreakdown: {
      ...performanceBreakdown,
      totalMs: elapsedSince(totalStartedAt),
    },
    warnings: Array.from(new Set(results.flatMap((entry) => entry.warnings))),
    blockingReasons: Array.from(new Set(results.flatMap((entry) => entry.blockingReasons))),
  };

  return {
    source: "sqlite",
    readOnly: false,
    dryRun,
    includeWarningTeams,
    totalTeams: results.length,
    results,
    summary,
  };
}
