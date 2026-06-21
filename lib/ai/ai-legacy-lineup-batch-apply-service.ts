import { buildAiLegacyLineupPreview } from "@/lib/ai/ai-legacy-lineup-engine";
import type { FormCardColor, GameState, LineupDraftModifiers } from "@/lib/data/olyDataTypes";
import type { AiLegacyLineupPreviewStatus } from "@/lib/ai/ai-needs-types";
import { buildTeamControlSettingsMap, isAiLineupBatchApplyEnabled } from "@/lib/foundation/team-control-settings";
import {
  createDefaultLineupDraftModifiers,
  ensureLocalFormCardsForSeason,
  getFormCardColorForDisciplineCategory,
  getLegacyMutatorTraitOptions,
  getPlayerMutatorTraitSlots,
} from "@/lib/lineups/legacy-lineup-modifiers";
import type { LegacyFormCardOption, LegacyLineupEntryInput, LegacyLineupKeyParams, LegacyLineupLoadedContext, LegacyMutatorTraitOption, LegacyRosterPlayerRef } from "@/lib/lineups/legacy-lineup-types";
import {
  calculateLocalLegacyLineupPreviewFromContext,
  loadLocalLegacyLineupContextFromGameState,
  saveLocalLegacyLineupDraftBatch,
} from "@/lib/lineups/legacy-lineup-local-service";
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

function selectBestMutatorTraitsForEntries(
  entries: LegacyLineupEntryInput[],
  rosterPlayers: LegacyRosterPlayerRef[],
  traitOptions: LegacyMutatorTraitOption[] = getLegacyMutatorTraitOptions(),
): [string | null, string | null] {
  const rosterPlayerById = new Map((rosterPlayers ?? []).map((player) => [player.id, player]));
  const traitCounts = new Map<string, { label: string; hits: number; players: Set<string> }>();

  for (const entry of entries) {
    const player = rosterPlayerById.get(entry.playerId) ?? null;
    const hitKeysForPlayer = new Set<string>();
    for (const trait of getPlayerMutatorTraitSlots(player)) {
      const key = trait.toLowerCase();
      const current = traitCounts.get(key) ?? { label: trait, hits: 0, players: new Set<string>() };
      current.hits += 1;
      if (!hitKeysForPlayer.has(key)) {
        current.players.add(entry.playerId);
        hitKeysForPlayer.add(key);
      }
      traitCounts.set(key, current);
    }
  }

  const candidates = [...traitCounts.values()]
    .filter((entry) => entry.hits > 0)
    .sort((left, right) => {
      if (left.players.size !== right.players.size) return right.players.size - left.players.size;
      if (left.hits !== right.hits) return right.hits - left.hits;
      return left.label.localeCompare(right.label);
    });

  const first = candidates[0] ?? null;
  const coveredPlayers = new Set(first?.players ?? []);
  const second =
    candidates
      .filter((entry) => entry !== first)
      .sort((left, right) => {
        const leftNewPlayers = [...left.players].filter((playerId) => !coveredPlayers.has(playerId)).length;
        const rightNewPlayers = [...right.players].filter((playerId) => !coveredPlayers.has(playerId)).length;
        if (leftNewPlayers !== rightNewPlayers) return rightNewPlayers - leftNewPlayers;
        if (left.players.size !== right.players.size) return right.players.size - left.players.size;
        if (left.hits !== right.hits) return right.hits - left.hits;
        return left.label.localeCompare(right.label);
      })[0] ?? null;

  const selectedLabels = [first?.label ?? null, second?.label ?? null];
  if (selectedLabels.every(Boolean)) {
    return selectedLabels as [string, string];
  }

  const usedKeys = new Set(selectedLabels.filter(Boolean).map((label) => label!.toLowerCase()));
  for (const option of traitOptions.length > 0 ? traitOptions : getLegacyMutatorTraitOptions()) {
    const label = String(option.label || option.value || "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (usedKeys.has(key)) continue;
    const emptyIndex = selectedLabels.findIndex((entry) => !entry);
    if (emptyIndex === -1) break;
    selectedLabels[emptyIndex] = label;
    usedKeys.add(key);
  }

  return [selectedLabels[0] ?? null, selectedLabels[1] ?? null];
}

function applyAiMutatorsForSide(
  modifiers: LineupDraftModifiers,
  side: "d1" | "d2",
  entries: LegacyLineupEntryInput[],
  rosterPlayers: LegacyRosterPlayerRef[],
  traitOptions?: LegacyMutatorTraitOption[],
) {
  const [trait1, trait2] = selectBestMutatorTraitsForEntries(
    entries.filter((entry) => entry.disciplineSide === side),
    rosterPlayers,
    traitOptions,
  );
  modifiers[side].mutatorTrait1 = trait1;
  modifiers[side].mutatorTrait2 = trait2;
}

function selectBestTeamPowerForSide(input: {
  context: LegacyLineupLoadedContext;
  modifiers: LineupDraftModifiers;
  side: "d1" | "d2";
  disciplineId: string | null | undefined;
  disciplineCategory: string | null | undefined;
  usedPowerIds: Set<string>;
}) {
  const candidates = (input.context.teamPowers ?? []).filter((power) => {
    if (input.usedPowerIds.has(power.id)) return false;
    if (power.isUsedUp || power.chargesRemaining <= 0) return false;
    return true;
  });
  if (candidates.length === 0 || !input.disciplineId) return null;
  const contextGameState = (input.context as LegacyLineupLoadedContext & { gameState?: GameState }).gameState ?? null;
  const teamCaptain = contextGameState ? selectTeamCaptain(contextGameState, input.context.teamId) : null;

  const ranked = candidates
    .map((power) => {
      const conditionalBonusPct =
        power.conditionalTrigger === "rival_top8_discipline" &&
        (input.context.teamPowerWindows?.[input.disciplineId ?? ""]?.top8Rivals.length ?? 0) > 0
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
      const categoryFit = power.category === "flex" || power.category === input.disciplineCategory ? 0.45 : 0;
      const rivalryFit = conditionalBonusPct > 0 || power.effectType === "rivalry_debuff" ? 0.35 : 0;
      const targetFit = power.targetMode === "rank_band" || power.targetMode === "single_rival" ? 0.15 : 0;
      return {
        power,
        score: result.teamPowerImpact + categoryFit + rivalryFit + targetFit,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.power.chargesRemaining !== left.power.chargesRemaining) return right.power.chargesRemaining - left.power.chargesRemaining;
      return left.power.label.localeCompare(right.power.label);
    });

  return ranked[0]?.power ?? null;
}

function applyAiTeamPowers(context: LegacyLineupLoadedContext, modifiers: LineupDraftModifiers) {
  const usedPowerIds = new Set<string>();
  const sides = [
    {
      side: "d1" as const,
      disciplineId: context.matchdayContract?.discipline1?.disciplineId ?? null,
      category: context.matchdayContract?.discipline1?.category ?? null,
    },
    {
      side: "d2" as const,
      disciplineId: context.matchdayContract?.discipline2?.disciplineId ?? null,
      category: context.matchdayContract?.discipline2?.category ?? null,
    },
  ].sort((left, right) => {
    const leftWindow = left.disciplineId ? (context.teamPowerWindows?.[left.disciplineId]?.top8Rivals.length ?? 0) : 0;
    const rightWindow = right.disciplineId ? (context.teamPowerWindows?.[right.disciplineId]?.top8Rivals.length ?? 0) : 0;
    return rightWindow - leftWindow;
  });

  for (const side of sides) {
    const selected = selectBestTeamPowerForSide({
      context,
      modifiers,
      side: side.side,
      disciplineId: side.disciplineId,
      disciplineCategory: side.category,
      usedPowerIds,
    });
    if (!selected) continue;
    modifiers[side.side].teamPowerId = selected.id;
    usedPowerIds.add(selected.id);
  }
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
  const strongestScore = Math.max(
    0,
    ...sideEntries.map((entry) =>
      input.context.disciplineScores.find(
        (score) => score.playerId === entry.playerId && score.disciplineId === input.disciplineId,
      )?.score ?? 0,
    ),
  );
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
  const negativeCards = formCards.filter((card) => card.value < 0);
  const positiveCards = formCards.filter((card) => card.value > 0);
  const desiredNegativeThisMatchday = Math.min(
    2,
    Math.ceil(negativeCards.length / remainingMatchdaysIncludingCurrent),
  );
  const desiredPositiveThisMatchday = Math.min(
    4 - desiredNegativeThisMatchday,
    Math.ceil(positiveCards.length / remainingMatchdaysIncludingCurrent),
  );
  const usedIds = new Set<string>();
  let negativeSelected = 0;
  let positiveSelected = 0;
  const sides = [
    {
      side: "d1" as const,
      color: getFormCardColorForDisciplineCategory(context.matchdayContract?.discipline1?.category),
    },
    {
      side: "d2" as const,
      color: getFormCardColorForDisciplineCategory(context.matchdayContract?.discipline2?.category),
    },
  ];

  for (const side of sides) {
    if (formCards.length > 0 && negativeSelected < desiredNegativeThisMatchday) {
      const negative = takeBestFormCard({
        cards: negativeCards,
        usedIds,
        color: side.color,
        polarity: "negative",
      });
      if (negative) {
        modifiers[side.side].primaryFormCardId = negative.id;
        negativeSelected += 1;
      }
    }

    if (formCards.length > 0 && !modifiers[side.side].primaryFormCardId && positiveSelected < desiredPositiveThisMatchday) {
      const positive = takeBestFormCard({
        cards: positiveCards,
        usedIds,
        color: side.color,
        polarity: "positive",
      });
      if (positive) {
        modifiers[side.side].primaryFormCardId = positive.id;
        positiveSelected += 1;
      }
    }

    if (formCards.length > 0) {
      const secondaryPositive = takeBestFormCard({
        cards: positiveCards,
        usedIds,
        color: side.color,
        polarity: "positive",
      });
      if (secondaryPositive) {
        modifiers[side.side].secondaryFormCardId = secondaryPositive.id;
        positiveSelected += 1;
      }
    }
  }

  applyAiMutatorsForSide(modifiers, "d1", plannedEntries, context.rosterPlayers ?? [], context.mutatorTraitOptions);
  applyAiMutatorsForSide(modifiers, "d2", plannedEntries, context.rosterPlayers ?? [], context.mutatorTraitOptions);
  applyAiTeamPowers(context, modifiers);
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
    if (team.controlMode === "manual") {
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

    if (team.controlMode === "passive") {
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

    if (!team.aiEligible) {
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

    if (hasExistingDraft && !overwriteExisting) {
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
