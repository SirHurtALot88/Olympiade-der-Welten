import type { FormCardColor, FormCardRecord, GameState, LineupDraftModifiers, LineupDisciplineSide, Player } from "@/lib/data/olyDataTypes";
import type {
  LegacyFormCardOption,
  LegacyMutatorSlotEffect,
  LegacyModifierSourceSummary,
  LegacyMutatorTraitOption,
  LegacyResolveMutatorMode,
  LegacyDisciplineScoreRef,
  LegacyRosterPlayerRef,
} from "@/lib/lineups/legacy-lineup-types";

const FORM_CARD_VALUES = [0, 2, 4, 8] as const;

const CLASS_COLOR_MAP: Record<string, FormCardColor> = {
  Berserker: "red",
  Warlord: "red",
  Tank: "red",
  Sprinter: "green",
  Rogue: "green",
  Charger: "green",
  Mage: "blue",
  Overseer: "blue",
  Templar: "blue",
  Bard: "yellow",
  Hero: "yellow",
  Badass: "yellow",
  Tactician: "yellow",
};

const POSITIVE_MUTATOR_TRAITS = [
  "Altruistic",
  "Ambitious",
  "Caring",
  "Cool",
  "Diligent",
  "Eloquent",
  "Fair",
  "FanFavorite",
  "FiredUp",
  "Flexible",
  "Healthy",
  "Motivated",
  "Relaxed",
  "Sexy",
] as const;

const NEGATIVE_MUTATOR_TRAITS = [
  "Timid",
  "Cheater",
  "ColdBlooded",
  "Devious",
  "Diva",
  "Egomaniac",
  "FaintHearted",
  "Feisty",
  "Gambler",
  "Lazy",
  "Manipulative",
  "Mercenary",
  "Renegade",
  "Scandalous",
  "Vindictive",
] as const;

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickDeterministicCardValue(seed: string) {
  const index = hashSeed(seed) % FORM_CARD_VALUES.length;
  return FORM_CARD_VALUES[index] ?? 0;
}

function createDefaultModifierSide() {
  return {
    primaryFormCardId: null,
    secondaryFormCardId: null,
    mutatorTrait1: null,
    mutatorTrait2: null,
    teamPowerId: null,
    intensity: "normal" as const,
  };
}

export function createDefaultLineupDraftModifiers(): LineupDraftModifiers {
  return {
    d1: createDefaultModifierSide(),
    d2: createDefaultModifierSide(),
  };
}

export function normalizeLineupDraftModifiers(modifiers?: Partial<LineupDraftModifiers> | null): LineupDraftModifiers {
  return {
    d1: {
      ...createDefaultModifierSide(),
      ...(modifiers?.d1 ?? {}),
    },
    d2: {
      ...createDefaultModifierSide(),
      ...(modifiers?.d2 ?? {}),
    },
  };
}

export function getLegacyMutatorTraitOptions(): LegacyMutatorTraitOption[] {
  return [
    ...POSITIVE_MUTATOR_TRAITS.map((trait) => ({
      label: trait,
      value: trait,
      polarity: "positive" as const,
    })),
    ...NEGATIVE_MUTATOR_TRAITS.map((trait) => ({
      label: trait,
      value: trait,
      polarity: "negative" as const,
    })),
  ];
}

function normalizeTraitValue(trait: unknown) {
  return String(trait ?? "").trim();
}

function normalizeTraitKey(trait: unknown) {
  return normalizeTraitValue(trait).toLowerCase();
}

export function getPlayerMutatorTraitSlots(player: Pick<LegacyRosterPlayerRef, "traitsPositive" | "traitsNegative"> | null): string[] {
  if (!player) {
    return [];
  }
  return [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])]
    .map(normalizeTraitValue)
    .filter(Boolean);
}

export function buildLegacyMutatorTraitOptionsForRoster(rosterPlayers: LegacyRosterPlayerRef[]): LegacyMutatorTraitOption[] {
  const byKey = new Map<string, LegacyMutatorTraitOption>();
  for (const option of getLegacyMutatorTraitOptions()) {
    byKey.set(normalizeTraitKey(option.value), option);
  }

  for (const player of rosterPlayers) {
    for (const trait of player.traitsPositive ?? []) {
      const value = normalizeTraitValue(trait);
      if (!value) continue;
      const key = normalizeTraitKey(value);
      if (!byKey.has(key)) {
        byKey.set(key, { label: value, value, polarity: "positive" });
      }
    }
    for (const trait of player.traitsNegative ?? []) {
      const value = normalizeTraitValue(trait);
      if (!value) continue;
      const key = normalizeTraitKey(value);
      if (!byKey.has(key)) {
        byKey.set(key, { label: value, value, polarity: "negative" });
      }
    }
  }

  return [...byKey.values()].sort((left, right) => left.label.localeCompare(right.label));
}

export function getLegacyFormCardSourceSummary(): LegacyModifierSourceSummary {
  return {
    selectionStatus: "ready",
    effectStatus: "ready",
    sourceLabel: "Lokaler Formkarten-Pool auf Basis des Legacy formkarten_v2-Flows.",
    warnings: [],
  };
}

export function getLegacyMutatorSourceSummary(): LegacyModifierSourceSummary {
  return {
    selectionStatus: "ready",
    effectStatus: "ready",
    sourceLabel:
      "Mutator-Auswahl aus Legacy mutator_trait_1/_2; Effekt: +6 Score pro passendem Mutator und +0.3 Player-PPs pro betroffenem aktivem Spieler, maximal einmal je Diszi-Seite.",
    warnings: [],
  };
}

export function buildGeneratedFormCardRecordsForTeam(
  gameState: GameState,
  saveId: string,
  seasonId: string,
  teamId: string,
): FormCardRecord[] {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  const seasonRosterEntries = [...gameState.rosters]
    .filter((entry) => entry.teamId === teamId)
    .sort((left, right) => left.playerId.localeCompare(right.playerId));
  const generated: FormCardRecord[] = [];

  for (const rosterEntry of seasonRosterEntries) {
    const player = playerById.get(rosterEntry.playerId);
    if (!player) {
      continue;
    }

    const cardColor = CLASS_COLOR_MAP[player.className];
    if (!cardColor) {
      continue;
    }

    const positiveValue = pickDeterministicCardValue(`${saveId}:${seasonId}:${rosterEntry.teamId}:${player.id}:positive`);
    const negativeValue = pickDeterministicCardValue(`${saveId}:${seasonId}:${rosterEntry.teamId}:${player.id}:negative`);
    const createdAt = `${seasonId}:${player.id}`;

    generated.push({
      id: `formcard:${seasonId}:${rosterEntry.teamId}:${player.id}:positive`,
      saveId,
      seasonId,
      teamId: rosterEntry.teamId,
      playerId: player.id,
      playerName: player.name,
      cardColor,
      cardValue: positiveValue,
      createdAt,
    });
    generated.push({
      id: `formcard:${seasonId}:${rosterEntry.teamId}:${player.id}:negative`,
      saveId,
      seasonId,
      teamId: rosterEntry.teamId,
      playerId: player.id,
      playerName: player.name,
      cardColor,
      cardValue: negativeValue === 0 ? 0 : -negativeValue,
      createdAt,
    });
  }

  return generated;
}

export function buildGeneratedFormCardRecordsForSeason(
  gameState: GameState,
  saveId: string,
  seasonId: string,
): FormCardRecord[] {
  return [...gameState.teams]
    .sort((left, right) => left.teamId.localeCompare(right.teamId))
    .flatMap((team) => buildGeneratedFormCardRecordsForTeam(gameState, saveId, seasonId, team.teamId));
}

export function ensureLocalFormCardsForSeason(gameState: GameState, saveId: string, seasonId: string): GameState {
  const existing = gameState.seasonState.formCards ?? [];
  const hasCurrentSeasonCards = existing.some((card) => card.seasonId === seasonId);
  if (hasCurrentSeasonCards) {
    return gameState;
  }

  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      formCards: [...existing, ...buildGeneratedFormCardRecordsForSeason(gameState, saveId, seasonId)],
    },
  };
}

function buildFormCardUsageMap(gameState: GameState, seasonId: string, excludeLineupId?: string | null) {
  const usage = new Map<string, string>();
  for (const draft of gameState.seasonState.lineupDrafts ?? []) {
    if (draft.seasonId !== seasonId) {
      continue;
    }
    if (excludeLineupId && draft.lineupId === excludeLineupId) {
      continue;
    }
    const modifiers = normalizeLineupDraftModifiers(draft.modifiers);
    for (const cardId of [
      modifiers.d1.primaryFormCardId,
      modifiers.d1.secondaryFormCardId,
      modifiers.d2.primaryFormCardId,
      modifiers.d2.secondaryFormCardId,
    ]) {
      if (cardId) {
        usage.set(cardId, draft.lineupId);
      }
    }
  }
  return usage;
}

export function getTeamFormCardOptions(input: {
  gameState: GameState;
  seasonId: string;
  teamId: string;
  lineupId?: string | null;
}): LegacyFormCardOption[] {
  const cards = (input.gameState.seasonState.formCards ?? []).filter(
    (card) => card.seasonId === input.seasonId && card.teamId === input.teamId && card.cardValue !== 0,
  );
  const usage = buildFormCardUsageMap(input.gameState, input.seasonId, input.lineupId ?? null);

  return cards.map((card) => ({
    id: card.id,
    playerId: card.playerId,
    playerName: card.playerName,
    color: card.cardColor,
    value: card.cardValue,
    isUsed: usage.has(card.id),
    usedByLineupId: usage.get(card.id) ?? null,
  }));
}

export type FormCardSeasonUsageAuditTeam = {
  teamId: string;
  totalCards: number;
  usedCards: number;
  unusedCards: number;
  unusedPositiveCards: number;
  unusedNegativeCards: number;
  negativePenaltyPoints: number;
};

export function buildFormCardSeasonUsageAudit(gameState: GameState, seasonId: string) {
  const usage = buildFormCardUsageMap(gameState, seasonId);
  const rows = [...gameState.teams]
    .sort((left, right) => left.teamId.localeCompare(right.teamId))
    .map((team): FormCardSeasonUsageAuditTeam => {
      const cards = (gameState.seasonState.formCards ?? []).filter(
        (card) => card.seasonId === seasonId && card.teamId === team.teamId && card.cardValue !== 0,
      );
      const usedCards = cards.filter((card) => usage.has(card.id));
      const unusedCards = cards.filter((card) => !usage.has(card.id));
      const unusedNegativeCards = unusedCards.filter((card) => card.cardValue < 0).length;
      const unusedPositiveCards = unusedCards.filter((card) => card.cardValue > 0).length;

      return {
        teamId: team.teamId,
        totalCards: cards.length,
        usedCards: usedCards.length,
        unusedCards: unusedCards.length,
        unusedPositiveCards,
        unusedNegativeCards,
        negativePenaltyPoints: unusedNegativeCards,
      };
    });

  return {
    seasonId,
    rows,
    totalCards: rows.reduce((sum, row) => sum + row.totalCards, 0),
    usedCards: rows.reduce((sum, row) => sum + row.usedCards, 0),
    unusedCards: rows.reduce((sum, row) => sum + row.unusedCards, 0),
    unusedPositiveCards: rows.reduce((sum, row) => sum + row.unusedPositiveCards, 0),
    unusedNegativeCards: rows.reduce((sum, row) => sum + row.unusedNegativeCards, 0),
    negativePenaltyPoints: rows.reduce((sum, row) => sum + row.negativePenaltyPoints, 0),
  };
}

function normalizeColor(value: string | null | undefined): FormCardColor | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "red" || normalized === "green" || normalized === "blue" || normalized === "yellow") {
    return normalized;
  }
  return null;
}

export function getModifierSelectionForSide(
  modifiers: LineupDraftModifiers | undefined | null,
  disciplineSide: LineupDisciplineSide,
) {
  return normalizeLineupDraftModifiers(modifiers)[disciplineSide];
}

export function calculateFormModifierForSide(input: {
  modifiers: LineupDraftModifiers | undefined | null;
  disciplineSide: LineupDisciplineSide;
  disciplineColor?: string | null;
  playerCount: number;
  formCards: LegacyFormCardOption[];
}): {
  formCardsAvailable: number;
  formCardsSelected: number;
  formModifier: number;
  warnings: string[];
} {
  const selection = getModifierSelectionForSide(input.modifiers, input.disciplineSide);
  const selectedIds = [selection.primaryFormCardId, selection.secondaryFormCardId].filter((value): value is string => Boolean(value));
  const selectedCards = selectedIds
    .map((cardId) => input.formCards.find((card) => card.id === cardId) ?? null)
    .filter((card): card is LegacyFormCardOption => Boolean(card));

  const warnings: string[] = [];
  if (selectedIds.length !== selectedCards.length) {
    warnings.push(`Eine ausgewählte Formkarte für ${input.disciplineSide.toUpperCase()} konnte nicht geladen werden.`);
  }
  if (selectedCards.length > 1 && selectedCards[1] && selectedCards[1].value < 0) {
    warnings.push(`Die zweite Formkarte auf ${input.disciplineSide.toUpperCase()} darf nicht negativ sein.`);
  }
  const normalizedColor = normalizeColor(input.disciplineColor);
  const effectiveSum = selectedCards.reduce((sum, card) => {
    const multiplier = normalizedColor && card.color === normalizedColor ? 2 : 1;
    return sum + card.value * multiplier;
  }, 0);

  return {
    formCardsAvailable: input.formCards.filter((card) => !card.isUsed || selectedIds.includes(card.id)).length,
    formCardsSelected: selectedCards.length,
    formModifier: Number((effectiveSum * input.playerCount).toFixed(1)),
    warnings,
  };
}

export function calculatePerPlayerFormModifier(input: {
  formModifier?: number | null;
  selectedPlayers?: number | null;
  requiredPlayers?: number | null;
}) {
  const total = input.formModifier ?? 0;
  if (!Number.isFinite(total) || total === 0) {
    return 0;
  }

  const selectedPlayers = input.selectedPlayers ?? 0;
  const requiredPlayers = input.requiredPlayers ?? 0;
  const divisor = selectedPlayers > 0 ? selectedPlayers : requiredPlayers > 0 ? requiredPlayers : 1;

  return Number((total / divisor).toFixed(1));
}

function countTraitHits(player: LegacyRosterPlayerRef | null, traitSet: Set<string>) {
  if (!player || traitSet.size === 0) {
    return 0;
  }
  const allTraits = Array.from(new Set(getPlayerMutatorTraitSlots(player).map(normalizeTraitKey).filter(Boolean)));
  return allTraits.reduce((hits, trait) => hits + (traitSet.has(trait) ? 1 : 0), 0);
}

export function calculateMutatorModifierForSide(input: {
  modifiers: LineupDraftModifiers | undefined | null;
  disciplineSide: LineupDisciplineSide;
  entries: Array<{ playerId: string }>;
  rosterPlayers: LegacyRosterPlayerRef[];
}): {
  mutatorMode: LegacyResolveMutatorMode;
  mutatorText: string | null;
  mutatorModifier: number;
  playerMutatorBonuses: Record<string, number>;
  playerMutatorPpsBonuses: Record<string, number>;
  mutatorSlots: LegacyMutatorSlotEffect[];
  teamPpsModifier: number | null;
  teamPpsStatus: "ready" | "missing_source";
  warnings: string[];
} {
  const selection = getModifierSelectionForSide(input.modifiers, input.disciplineSide);
  const selectedTraits = Array.from(
    new Map(
      [selection.mutatorTrait1, selection.mutatorTrait2]
        .map(normalizeTraitValue)
        .filter(Boolean)
        .map((trait) => [normalizeTraitKey(trait), trait] as const),
    ).values(),
  );
  const warnings: string[] = [];
  const traitSet = new Set(selectedTraits.map(normalizeTraitKey));
  const playerById = new Map(input.rosterPlayers.map((player) => [player.id, player]));
  const playerMutatorBonuses: Record<string, number> = {};
  const playerMutatorPpsBonuses: Record<string, number> = {};
  const affectedPlayerIdsByTrait = new Map<string, Set<string>>();
  const hitCountByTrait = new Map<string, number>();
  const ppsPlayerIdsByTrait = new Map<string, Set<string>>();
  let totalHits = 0;
  const activePlayerIds = Array.from(
    new Set(input.entries.map((entry) => String(entry.playerId ?? "").trim()).filter(Boolean)),
  );

  for (const playerId of activePlayerIds) {
    const player = playerById.get(playerId) ?? null;
    const hits = countTraitHits(player, traitSet);
    totalHits += hits;
    if (hits > 0) {
      playerMutatorBonuses[playerId] = Number((hits * 6).toFixed(1));
      playerMutatorPpsBonuses[playerId] = 0.3;
    }
    if (player) {
      const allTraits = Array.from(new Set(getPlayerMutatorTraitSlots(player).map(normalizeTraitKey).filter(Boolean)));
      let assignedPpsTrait = false;
      for (const trait of selectedTraits) {
        const normalizedTrait = normalizeTraitKey(trait);
        const traitHits = allTraits.reduce((count, playerTrait) => count + (playerTrait === normalizedTrait ? 1 : 0), 0);
        if (traitHits > 0) {
          hitCountByTrait.set(normalizedTrait, (hitCountByTrait.get(normalizedTrait) ?? 0) + traitHits);
          const affectedPlayerIds = affectedPlayerIdsByTrait.get(normalizedTrait) ?? new Set<string>();
          affectedPlayerIds.add(playerId);
          affectedPlayerIdsByTrait.set(normalizedTrait, affectedPlayerIds);
          if (!assignedPpsTrait) {
            const ppsPlayerIds = ppsPlayerIdsByTrait.get(normalizedTrait) ?? new Set<string>();
            ppsPlayerIds.add(playerId);
            ppsPlayerIdsByTrait.set(normalizedTrait, ppsPlayerIds);
            assignedPpsTrait = true;
          }
        }
      }
    }
  }

  const mutatorSlots = selectedTraits.map((trait, index) => {
    const normalizedTrait = normalizeTraitKey(trait);
    const hitCount = hitCountByTrait.get(normalizedTrait) ?? 0;
    const affectedPlayerIds = [...(affectedPlayerIdsByTrait.get(normalizedTrait) ?? new Set<string>())];
    const ppsPlayerCount = ppsPlayerIdsByTrait.get(normalizedTrait)?.size ?? 0;
    return {
      slotKey: index === 0 ? "mutator1" as const : "mutator2" as const,
      label: trait,
      hitCount,
      scoreModifier: Number((hitCount * 6).toFixed(1)),
      playerPpsModifier: Number((ppsPlayerCount * 0.3).toFixed(1)),
      teamPpsModifier: null,
      teamPpsStatus: "missing_source" as const,
      affectedPlayerIds,
      sourceStatus: "ready" as const,
    };
  });

  return {
    mutatorMode: "legacy_selected_traits",
    mutatorText: selectedTraits.length > 0 ? selectedTraits.join(", ") : null,
    mutatorModifier: Number((totalHits * 6).toFixed(1)),
    playerMutatorBonuses,
    playerMutatorPpsBonuses,
    mutatorSlots,
    teamPpsModifier: null,
    teamPpsStatus: "missing_source",
    warnings,
  };
}

function buildDisciplineScoreMap(disciplineScores: LegacyDisciplineScoreRef[], disciplineId: string) {
  return new Map(
    disciplineScores
      .filter((entry) => entry.disciplineId === disciplineId)
      .map((entry) => [entry.playerId, entry.score] as const),
  );
}

export function calculateMvpForcedMutatorModifierForSide(input: {
  disciplineId: string;
  disciplineSide: LineupDisciplineSide;
  entries: Array<{ playerId: string }>;
  disciplineScores: LegacyDisciplineScoreRef[];
  rosterPlayers: LegacyRosterPlayerRef[];
}): {
  mutatorMode: LegacyResolveMutatorMode;
  mutatorText: string | null;
  mutatorModifier: number;
  playerMutatorBonuses: Record<string, number>;
  playerMutatorPpsBonuses: Record<string, number>;
  mutatorSlots: LegacyMutatorSlotEffect[];
  teamPpsModifier: number | null;
  teamPpsStatus: "ready" | "missing_source";
  warnings: string[];
} {
  const warnings: string[] = [];
  const scoreMap = buildDisciplineScoreMap(input.disciplineScores, input.disciplineId);
  const activePlayerIds = Array.from(
    new Set(input.entries.map((entry) => String(entry.playerId ?? "").trim()).filter(Boolean)),
  );
  const playerById = new Map(input.rosterPlayers.map((player) => [player.id, player]));
  const traitCandidates = new Map<string, {
    label: string;
    affectedPlayerIds: Set<string>;
    hitCount: number;
    disciplineScoreSum: number;
  }>();

  for (const playerId of activePlayerIds) {
    const player = playerById.get(playerId) ?? null;
    if (!player) {
      continue;
    }
    const playerScore = scoreMap.get(playerId) ?? 0;
    const playerTraits = Array.from(new Map(
      getPlayerMutatorTraitSlots(player)
        .map(normalizeTraitValue)
        .filter(Boolean)
        .map((trait) => [normalizeTraitKey(trait), trait] as const),
    ).entries());

    for (const [normalizedTrait, label] of playerTraits) {
      const current = traitCandidates.get(normalizedTrait) ?? {
        label,
        affectedPlayerIds: new Set<string>(),
        hitCount: 0,
        disciplineScoreSum: 0,
      };
      current.affectedPlayerIds.add(playerId);
      current.hitCount += 1;
      current.disciplineScoreSum += playerScore;
      traitCandidates.set(normalizedTrait, current);
    }
  }

  const selectedTraits = [...traitCandidates.values()]
    .sort((left, right) => {
      if (right.hitCount !== left.hitCount) return right.hitCount - left.hitCount;
      if (right.disciplineScoreSum !== left.disciplineScoreSum) return right.disciplineScoreSum - left.disciplineScoreSum;
      return left.label.localeCompare(right.label, "de");
    })
    .slice(0, 2)
    .map((candidate) => candidate.label);

  if (input.entries.length === 0) {
    warnings.push(`Forced mutators could not affect ${input.disciplineId}/${input.disciplineSide} because no lineup entries were found.`);
  }
  if (input.entries.length > 0 && selectedTraits.length === 0) {
    warnings.push(`Forced mutators found no matching player traits for ${input.disciplineId}/${input.disciplineSide}.`);
  }

  const modifiers: LineupDraftModifiers = {
    d1: createDefaultModifierSide(),
    d2: createDefaultModifierSide(),
  };
  modifiers[input.disciplineSide] = {
    ...createDefaultModifierSide(),
    mutatorTrait1: selectedTraits[0] ?? null,
    mutatorTrait2: selectedTraits[1] ?? null,
  };
  const result = calculateMutatorModifierForSide({
    modifiers,
    disciplineSide: input.disciplineSide,
    entries: input.entries,
    rosterPlayers: input.rosterPlayers,
  });

  return {
    mutatorMode: "mvp_forced_mutators",
    mutatorText: result.mutatorText,
    mutatorModifier: result.mutatorModifier,
    playerMutatorBonuses: result.playerMutatorBonuses,
    playerMutatorPpsBonuses: result.playerMutatorPpsBonuses,
    mutatorSlots: result.mutatorSlots,
    teamPpsModifier: result.teamPpsModifier,
    teamPpsStatus: result.teamPpsStatus,
    warnings: [...warnings, ...result.warnings],
  };
}

export function getPlayerClassColor(player: Player): FormCardColor | null {
  return CLASS_COLOR_MAP[player.className] ?? null;
}

export function getFormCardColorForDisciplineCategory(category: string | null | undefined): FormCardColor | null {
  if (category === "power") return "red";
  if (category === "speed") return "green";
  if (category === "mental") return "blue";
  if (category === "social") return "yellow";
  return null;
}
