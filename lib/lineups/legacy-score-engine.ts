import type {
  TeamPowerEffectType,
  TeamPowerTargetMode,
} from "@/lib/data/olyDataTypes";
import type {
  DisciplineSide,
  LegacyActivePlayerRef,
  LegacyDisciplineScoreRef,
  LegacyLineupEntryInput,
  LegacyMutatorSlotEffect,
  LegacyLineupScoreResult,
  LegacyMoralePerformanceRef,
  LegacyResolveMutatorMode,
  LegacyRosterPlayerRef,
} from "@/lib/lineups/legacy-lineup-types";

function roundPreviewScore(value: number) {
  return Math.round(value * 10) / 10;
}

const INTENSITY_SCORE_MODIFIER = {
  conserve: -2,
  normal: 0,
  push: 3,
} as const;

function normalizeIntensity(value: unknown): keyof typeof INTENSITY_SCORE_MODIFIER {
  return value === "conserve" || value === "push" || value === "normal" ? value : "normal";
}

function buildScoreMap(disciplineScores: LegacyDisciplineScoreRef[]) {
  return new Map<string, number>(disciplineScores.map((entry) => [`${entry.playerId}::${entry.disciplineId}`, entry.score]));
}

type ScoreSideInput = {
  disciplineId: string;
  disciplineSide: DisciplineSide;
  entries: LegacyLineupEntryInput[];
  disciplineScores: LegacyDisciplineScoreRef[];
  activePlayers?: LegacyActivePlayerRef[];
  rosterPlayers?: LegacyRosterPlayerRef[];
  requiredPlayers?: number | null;
  fatigueByPlayerId?: Record<string, { count: number; multiplier: number }> | null;
  moraleByPlayerId?: Record<string, LegacyMoralePerformanceRef> | null;
  fatigueSourceStatus?: "mapped" | "missing_source";
  intensity?: "conserve" | "normal" | "push" | null;
  slotRoleModifier?: number | null;
  formCardsAvailable?: number | null;
  formCardsSelected?: number | null;
  formModifier?: number | null;
  formCardStatus?: "ready" | "missing_source";
  formCardLabel?: string | null;
  mutatorMode?: LegacyResolveMutatorMode;
  mutatorText?: string | null;
  mutatorModifier?: number | null;
  mutatorSlots?: LegacyMutatorSlotEffect[] | null;
  mutatorBonusByPlayerId?: Record<string, number> | null;
  mutatorPpsBonusByPlayerId?: Record<string, number> | null;
  teamPowerSelected?: number | null;
  teamPowerStatus?: "ready" | "missing_source";
  teamPowerLabel?: string | null;
  teamPowerModifier?: number | null;
  teamPowerImpact?: number | null;
  teamPowerBasePct?: number | null;
  teamPowerConditionalPct?: number | null;
  teamPowerAttributeFitPct?: number | null;
  teamPowerEffectType?: TeamPowerEffectType | null;
  teamPowerTargetMode?: TeamPowerTargetMode | null;
  teamPowerTargetLimit?: number | null;
  captainMode?: "selected_captain" | "legacy_strongest_selected" | "missing_source";
  captainStatus?: "mapped" | "missing_source";
  teamPpsModifier?: number | null;
  teamPpsStatus?: "ready" | "missing_source";
};

export function scoreLegacyLineupDisciplineSide(input: ScoreSideInput): LegacyLineupScoreResult {
  const scoreByPlayerAndDiscipline = buildScoreMap(input.disciplineScores);
  const activePlayerById = new Map((input.activePlayers ?? []).map((player) => [player.id, player]));
  const rosterPlayerById = new Map((input.rosterPlayers ?? []).map((player) => [player.id, player]));

  const relevantEntries = input.entries
    .filter((entry) => entry.disciplineId === input.disciplineId && entry.disciplineSide === input.disciplineSide)
    .sort((left, right) => left.slotIndex - right.slotIndex);

  const missingScores: string[] = [];
  const validationWarnings: string[] = [];
  const modifierWarnings: string[] = [];
  const selectedPlayers = relevantEntries.length;
  const requiredPlayers = input.requiredPlayers ?? null;
  const missingPlayers = requiredPlayers == null ? 0 : Math.max(0, requiredPlayers - selectedPlayers);
  const isComplete = requiredPlayers == null ? true : missingPlayers === 0;

  const fatigueSourceStatus = input.fatigueSourceStatus ?? "missing_source";
  const moraleStatus = input.moraleByPlayerId ? "mapped" : "not_applied";
  const formModifier = input.formModifier ?? null;
  const mutatorModifier = input.mutatorModifier ?? null;
  const intensity = normalizeIntensity(input.intensity);
  const intensityModifier = roundPreviewScore(INTENSITY_SCORE_MODIFIER[intensity] * selectedPlayers);
  const captainMode = input.captainMode ?? "selected_captain";
  const captainStatus = input.captainStatus ?? (captainMode === "missing_source" ? "missing_source" : "mapped");
  if (fatigueSourceStatus !== "mapped") {
    modifierWarnings.push(`Fatigue source is missing for ${input.disciplineId}/${input.disciplineSide}.`);
  }
  if ((input.formCardStatus ?? (input.formCardsAvailable == null ? "missing_source" : "ready")) !== "ready") {
    modifierWarnings.push(`Form card source is missing for ${input.disciplineId}/${input.disciplineSide}.`);
  }
  if (input.mutatorModifier == null) {
    modifierWarnings.push(`Mutator score source is missing for ${input.disciplineId}/${input.disciplineSide}.`);
  }
  if ((input.teamPowerStatus ?? "missing_source") !== "ready") {
    modifierWarnings.push(`Team-Power source is missing for ${input.disciplineId}/${input.disciplineSide}.`);
  }
  if (captainStatus !== "mapped") {
    modifierWarnings.push(`Captain source is missing for ${input.disciplineId}/${input.disciplineSide}.`);
  }

  if (!isComplete && requiredPlayers != null) {
    validationWarnings.push(
      `Discipline ${input.disciplineId} on ${input.disciplineSide} is incomplete: ${selectedPlayers}/${requiredPlayers} players selected.`,
    );
  }

  const scoredEntries: LegacyLineupScoreResult["entries"] = relevantEntries.map((entry) => {
    const scoreKey = `${entry.playerId}::${entry.disciplineId}`;
    const baseScore = scoreByPlayerAndDiscipline.get(scoreKey) ?? null;
    const activePlayer = entry.activePlayerId ? activePlayerById.get(entry.activePlayerId) ?? null : null;
    const rosterPlayer = rosterPlayerById.get(entry.playerId) ?? null;
    const warnings: string[] = [];
    const sourceStatus: "mapped" | "missing_source" = baseScore == null ? "missing_source" : "mapped";
    const fatigue = input.fatigueByPlayerId?.[entry.playerId] ?? null;
    const fatigueMultiplier = fatigueSourceStatus === "mapped" ? (fatigue?.multiplier ?? 1) : null;
    const fatigueAdjustedScore =
      baseScore == null || fatigueMultiplier == null ? baseScore : roundPreviewScore(baseScore * fatigueMultiplier);
    const morale = input.moraleByPlayerId?.[entry.playerId] ?? null;
    const moraleMultiplier = moraleStatus === "mapped" ? (morale?.multiplier ?? 1) : null;
    const moraleAdjustedScore =
      fatigueAdjustedScore == null || moraleMultiplier == null
        ? fatigueAdjustedScore
        : roundPreviewScore(fatigueAdjustedScore * moraleMultiplier);
    const moraleModifier =
      fatigueAdjustedScore == null || moraleAdjustedScore == null
        ? null
        : roundPreviewScore(moraleAdjustedScore - fatigueAdjustedScore);

    if (baseScore == null) {
      const warning = `Missing discipline score for player ${entry.playerId} in ${entry.disciplineId} (${entry.disciplineSide}).`;
      missingScores.push(warning);
      validationWarnings.push(warning);
      warnings.push(warning);
    }

    return {
      playerId: entry.playerId,
      activePlayerId: entry.activePlayerId,
      disciplineId: entry.disciplineId,
      disciplineSide: entry.disciplineSide,
      slotIndex: entry.slotIndex,
      name: rosterPlayer?.name ?? activePlayer?.playerId ?? entry.playerId,
      score: baseScore,
      baseDisciplineScore: baseScore,
      fatigueStatus: fatigueSourceStatus,
      fatigueCount: fatigueSourceStatus === "mapped" ? (fatigue?.count ?? 0) : null,
      fatigueMultiplier,
      fatigueAdjustedScore,
      moraleStatus: moraleStatus === "mapped" && !morale ? "missing_source" : moraleStatus,
      morale: morale?.morale ?? null,
      moraleMultiplier,
      moraleModifierPct: morale?.modifierPct ?? null,
      moraleModifier,
      moraleAdjustedScore,
      isCaptain: Boolean(entry.isCaptain),
      captainMultiplier: entry.isCaptain ? 1.5 : 1,
      captainBonus: 0,
      mutatorBonus: 0,
      mutatorPpsBonus: 0,
      finalContribution: moraleAdjustedScore,
      sourceStatus,
      warnings,
    };
  });

  const bestEntry = scoredEntries
    .filter((entry) => entry.finalContribution != null)
    .sort((left, right) => (right.finalContribution ?? 0) - (left.finalContribution ?? 0))[0] ?? null;

  const captainEntries = scoredEntries.filter((entry) => entry.isCaptain);
  let captainBonusTotal = 0;

  if (captainMode !== "missing_source" && captainEntries.length > 0) {
    const bonusEntry =
      captainMode === "legacy_strongest_selected"
        ? bestEntry
        : captainEntries.find((entry) => entry.finalContribution != null) ?? null;
    if (!bonusEntry || bonusEntry.baseDisciplineScore == null) {
      validationWarnings.push(
        `Captain bonus could not be calculated for ${input.disciplineId}/${input.disciplineSide} because the captain player score is missing.`,
      );
    } else {
      captainBonusTotal = roundPreviewScore((bonusEntry.finalContribution ?? 0) * 0.5);
      bonusEntry.captainBonus = captainBonusTotal;
      bonusEntry.finalContribution = roundPreviewScore((bonusEntry.finalContribution ?? 0) + captainBonusTotal);
      bonusEntry.score = bonusEntry.finalContribution;
      bonusEntry.captainMultiplier = 1.5;
      if (captainMode === "legacy_strongest_selected" && !bonusEntry.isCaptain) {
        validationWarnings.push(
          `Captain bonus for ${input.disciplineId}/${input.disciplineSide} follows the strongest selected player score, not a separate stored captain player identity.`,
        );
      }
    }
  }

  if (mutatorModifier != null) {
    for (const entry of scoredEntries) {
      const mutatorBonus = roundPreviewScore(input.mutatorBonusByPlayerId?.[entry.playerId] ?? 0);
      entry.mutatorBonus = mutatorBonus;
      entry.mutatorPpsBonus = roundPreviewScore(input.mutatorPpsBonusByPlayerId?.[entry.playerId] ?? 0);
      entry.finalContribution =
        entry.finalContribution == null ? null : roundPreviewScore((entry.finalContribution ?? 0) + mutatorBonus);
      entry.score = entry.finalContribution;
    }
  }

  const baseScore = roundPreviewScore(
    scoredEntries.reduce((sum, entry) => sum + (entry.baseDisciplineScore ?? 0), 0),
  );
  const fatigueAdjustedScore = roundPreviewScore(
    scoredEntries.reduce((sum, entry) => sum + (entry.fatigueAdjustedScore ?? 0), 0),
  );
  const fatigueModifier = roundPreviewScore(fatigueAdjustedScore - baseScore);
  const moraleModifier = roundPreviewScore(
    scoredEntries.reduce((sum, entry) => sum + (entry.moraleModifier ?? 0), 0),
  );
  const mutatorScoreAlreadyApplied = roundPreviewScore(
    scoredEntries.reduce((sum, entry) => sum + (entry.mutatorBonus ?? 0), 0),
  );
  const mutatorTeamOnlyAdjustment =
    mutatorModifier == null ? 0 : roundPreviewScore(Math.max(0, (mutatorModifier ?? 0) - mutatorScoreAlreadyApplied));
  const slotRoleModifier = input.slotRoleModifier ?? 0;
  const prePowerScore = roundPreviewScore(
    scoredEntries.reduce((sum, entry) => sum + (entry.finalContribution ?? 0), 0) +
      intensityModifier +
      slotRoleModifier +
      (formModifier ?? 0) +
      mutatorTeamOnlyAdjustment,
  );
  const isSelfTeamPower = input.teamPowerEffectType === "self_boost" || input.teamPowerEffectType === "support_boost";
  const teamPowerModifier =
    input.teamPowerStatus === "ready" && isSelfTeamPower
      ? roundPreviewScore((prePowerScore * (input.teamPowerImpact ?? 0)) / 100)
      : input.teamPowerStatus === "ready"
        ? 0
        : null;
  const totalScore = roundPreviewScore(prePowerScore + (teamPowerModifier ?? 0));

  return {
    disciplineId: input.disciplineId,
    disciplineSide: input.disciplineSide,
    requiredPlayers,
    selectedPlayers,
    missingPlayers,
    isComplete,
    entries: scoredEntries,
    baseScore,
    fatigueStatus: fatigueSourceStatus,
    fatigueModifier: fatigueSourceStatus === "mapped" ? fatigueModifier : null,
    moraleStatus,
    moraleModifier: moraleStatus === "mapped" ? moraleModifier : null,
    intensity,
    intensityModifier,
    slotRoleModifier: input.slotRoleModifier ?? null,
    captainStatus,
    captainBonusTotal: captainStatus === "mapped" ? captainBonusTotal : null,
    formCardsAvailable: input.formCardsAvailable ?? null,
    formCardsSelected: input.formCardsSelected ?? null,
    formCardStatus: input.formCardStatus ?? (input.formCardsAvailable == null ? "missing_source" : "ready"),
    formCardLabel: input.formCardLabel ?? null,
    formModifier,
    mutatorMode: input.mutatorMode ?? "legacy_selected_traits",
    mutatorText: input.mutatorText ?? null,
    mutatorModifier,
    teamPowerSelected: input.teamPowerSelected ?? null,
    teamPowerStatus: input.teamPowerStatus ?? "missing_source",
    teamPowerLabel: input.teamPowerLabel ?? null,
    teamPowerModifier,
    teamPowerImpact: input.teamPowerImpact ?? null,
    teamPowerBasePct: input.teamPowerBasePct ?? null,
    teamPowerConditionalPct: input.teamPowerConditionalPct ?? null,
    teamPowerAttributeFitPct: input.teamPowerAttributeFitPct ?? null,
    teamPowerEffectType: input.teamPowerEffectType ?? null,
    teamPowerTargetMode: input.teamPowerTargetMode ?? null,
    teamPowerTargetLimit: input.teamPowerTargetLimit ?? null,
    mutatorSlots: input.mutatorSlots ?? [],
    teamPpsModifier: input.teamPpsModifier ?? null,
    teamPpsStatus: input.teamPpsStatus ?? "missing_source",
    finalPreviewScore: totalScore,
    modifierWarnings,
    totalScore,
    missingScores,
    validationWarnings: [...validationWarnings, ...modifierWarnings],
  };
}

export function buildLegacyLineupAggregateScore(scoreParts: LegacyLineupScoreResult[]): LegacyLineupScoreResult {
  const allFatigueMapped = scoreParts.every((part) => part.fatigueStatus === "mapped");
  const allMoraleMapped = scoreParts.every((part) => part.moraleStatus === "mapped");
  return {
    entries: scoreParts.flatMap((part) => part.entries),
    selectedPlayers: scoreParts.reduce((sum, part) => sum + (part.selectedPlayers ?? part.entries.length), 0),
    missingPlayers: scoreParts.reduce((sum, part) => sum + (part.missingPlayers ?? 0), 0),
    isComplete: scoreParts.every((part) => part.isComplete !== false),
    baseScore: roundPreviewScore(scoreParts.reduce((sum, part) => sum + (part.baseScore ?? 0), 0)),
    fatigueStatus: allFatigueMapped ? "mapped" : "missing_source",
    fatigueModifier: allFatigueMapped
      ? roundPreviewScore(scoreParts.reduce((sum, part) => sum + (part.fatigueModifier ?? 0), 0))
      : null,
    moraleStatus: allMoraleMapped ? "mapped" : scoreParts.some((part) => part.moraleStatus === "mapped") ? "missing_source" : "not_applied",
    moraleModifier: allMoraleMapped
      ? roundPreviewScore(scoreParts.reduce((sum, part) => sum + (part.moraleModifier ?? 0), 0))
      : null,
    intensity: null,
    intensityModifier: roundPreviewScore(scoreParts.reduce((sum, part) => sum + (part.intensityModifier ?? 0), 0)),
    captainStatus: scoreParts.every((part) => part.captainStatus === "mapped") ? "mapped" : "missing_source",
    captainBonusTotal: scoreParts.every((part) => part.captainStatus === "mapped")
      ? roundPreviewScore(scoreParts.reduce((sum, part) => sum + (part.captainBonusTotal ?? 0), 0))
      : null,
    formCardsAvailable: null,
    formCardsSelected: null,
    formCardStatus: scoreParts.every((part) => part.formCardStatus === "ready") ? "ready" : "missing_source",
    formCardLabel: null,
    formModifier: scoreParts.every((part) => part.formModifier != null)
      ? roundPreviewScore(scoreParts.reduce((sum, part) => sum + (part.formModifier ?? 0), 0))
      : null,
    mutatorMode: scoreParts.some((part) => part.mutatorMode === "mvp_forced_mutators")
      ? "mvp_forced_mutators"
      : "legacy_selected_traits",
    mutatorText: null,
    mutatorModifier: scoreParts.every((part) => part.mutatorModifier != null)
      ? roundPreviewScore(scoreParts.reduce((sum, part) => sum + (part.mutatorModifier ?? 0), 0))
      : null,
    teamPowerSelected: scoreParts.reduce((sum, part) => sum + (part.teamPowerSelected ?? 0), 0),
    teamPowerStatus: scoreParts.every((part) => part.teamPowerStatus === "ready") ? "ready" : "missing_source",
    teamPowerLabel: null,
    teamPowerModifier: scoreParts.every((part) => part.teamPowerModifier != null)
      ? roundPreviewScore(scoreParts.reduce((sum, part) => sum + (part.teamPowerModifier ?? 0), 0))
      : null,
    teamPowerImpact: scoreParts.every((part) => part.teamPowerImpact != null)
      ? roundPreviewScore(scoreParts.reduce((sum, part) => sum + (part.teamPowerImpact ?? 0), 0))
      : null,
    teamPowerBasePct: scoreParts.every((part) => part.teamPowerBasePct != null)
      ? roundPreviewScore(scoreParts.reduce((sum, part) => sum + (part.teamPowerBasePct ?? 0), 0))
      : null,
    teamPowerConditionalPct: scoreParts.every((part) => part.teamPowerConditionalPct != null)
      ? roundPreviewScore(scoreParts.reduce((sum, part) => sum + (part.teamPowerConditionalPct ?? 0), 0))
      : null,
    teamPowerAttributeFitPct: scoreParts.every((part) => part.teamPowerAttributeFitPct != null)
      ? roundPreviewScore(scoreParts.reduce((sum, part) => sum + (part.teamPowerAttributeFitPct ?? 0), 0))
      : null,
    teamPowerEffectType: null,
    teamPowerTargetMode: null,
    teamPowerTargetLimit: null,
    mutatorSlots: scoreParts.flatMap((part) => part.mutatorSlots ?? []),
    teamPpsModifier: scoreParts.every((part) => part.teamPpsModifier != null)
      ? roundPreviewScore(scoreParts.reduce((sum, part) => sum + (part.teamPpsModifier ?? 0), 0))
      : null,
    teamPpsStatus: scoreParts.every((part) => part.teamPpsStatus === "ready") ? "ready" : "missing_source",
    finalPreviewScore: roundPreviewScore(scoreParts.reduce((sum, part) => sum + (part.finalPreviewScore ?? part.totalScore), 0)),
    totalScore: roundPreviewScore(scoreParts.reduce((sum, part) => sum + part.totalScore, 0)),
    missingScores: scoreParts.flatMap((part) => part.missingScores),
    modifierWarnings: scoreParts.flatMap((part) => part.modifierWarnings ?? []),
    validationWarnings: scoreParts.flatMap((part) => part.validationWarnings),
  };
}
