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

const MVP_FORCED_MUTATOR_LABELS = [
  "MVP Force I",
  "MVP Force II",
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
    sourceLabel: "Mutator-Auswahl aus Legacy mutator_trait_1/_2; Effekt: +6 Score pro passendem Mutator und +0.3 Player-PPs pro passendem Spieler.",
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

function countTraitHits(player: LegacyRosterPlayerRef | null, traitSet: Set<string>) {
  if (!player || traitSet.size === 0) {
    return 0;
  }
  const allTraits = [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])]
    .map((trait) => String(trait).trim().toLowerCase())
    .filter(Boolean);
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
  const selectedTraits = [selection.mutatorTrait1, selection.mutatorTrait2]
    .map((trait) => String(trait ?? "").trim())
    .filter(Boolean);
  const warnings: string[] = [];
  const traitSet = new Set(selectedTraits.map((trait) => trait.toLowerCase()));
  const playerById = new Map(input.rosterPlayers.map((player) => [player.id, player]));
  const playerMutatorPpsBonuses: Record<string, number> = {};
  const affectedPlayerIdsByTrait = new Map<string, Set<string>>();

  for (const entry of input.entries) {
    const player = playerById.get(entry.playerId) ?? null;
    const hits = countTraitHits(player, traitSet);
    if (hits > 0) {
      playerMutatorPpsBonuses[entry.playerId] = Number((hits * 0.3).toFixed(1));
    }
    if (player) {
      const allTraits = [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])]
        .map((trait) => String(trait).trim().toLowerCase())
        .filter(Boolean);
      for (const trait of selectedTraits) {
        const normalizedTrait = trait.toLowerCase();
        if (allTraits.includes(normalizedTrait)) {
          const affectedPlayerIds = affectedPlayerIdsByTrait.get(normalizedTrait) ?? new Set<string>();
          affectedPlayerIds.add(entry.playerId);
          affectedPlayerIdsByTrait.set(normalizedTrait, affectedPlayerIds);
        }
      }
    }
  }

  for (const trait of selectedTraits) {
    const exists = getLegacyMutatorTraitOptions().some((option) => option.value === trait);
    if (!exists) {
      warnings.push(`Mutator-Trait ${trait} ist nicht im bekannten Trait-Pool enthalten.`);
    }
  }
  const matchingMutatorCount = selectedTraits.filter((trait) => (affectedPlayerIdsByTrait.get(trait.toLowerCase())?.size ?? 0) > 0).length;
  const mutatorSlots = selectedTraits.map((trait, index) => {
    const affectedPlayerIds = [...(affectedPlayerIdsByTrait.get(trait.toLowerCase()) ?? new Set<string>())];
    return {
      slotKey: index === 0 ? "mutator1" as const : "mutator2" as const,
      label: trait,
      scoreModifier: affectedPlayerIds.length > 0 ? 6 : 0,
      playerPpsModifier: affectedPlayerIds.length > 0 ? 0.3 : 0,
      teamPpsModifier: null,
      teamPpsStatus: "missing_source" as const,
      affectedPlayerIds,
      sourceStatus: "ready" as const,
    };
  });

  return {
    mutatorMode: "legacy_selected_traits",
    mutatorText: selectedTraits.length > 0 ? selectedTraits.join(", ") : null,
    mutatorModifier: matchingMutatorCount * 6,
    playerMutatorBonuses: {},
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
  const rankedPlayerIds = [...input.entries]
    .map((entry) => ({
      playerId: entry.playerId,
      score: scoreMap.get(entry.playerId) ?? 0,
    }))
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.playerId);

  const fallbackPlayerId = rankedPlayerIds[0] ?? input.entries[0]?.playerId ?? null;
  const slotAssignments = [
    rankedPlayerIds[0] ?? fallbackPlayerId,
    rankedPlayerIds[1] ?? fallbackPlayerId,
  ];

  const playerMutatorPpsBonuses: Record<string, number> = {};
  const mutatorSlots: LegacyMutatorSlotEffect[] = MVP_FORCED_MUTATOR_LABELS.map((label, index) => {
    const targetPlayerId = slotAssignments[index] ?? null;
    if (targetPlayerId) {
      playerMutatorPpsBonuses[targetPlayerId] = Number(((playerMutatorPpsBonuses[targetPlayerId] ?? 0) + 0.3).toFixed(1));
    }

    return {
      slotKey: index === 0 ? "mutator1" : "mutator2",
      label,
      scoreModifier: input.entries.length > 0 ? 6 : 0,
      playerPpsModifier: targetPlayerId ? 0.3 : 0,
      teamPpsModifier: null,
      teamPpsStatus: "missing_source",
      affectedPlayerIds: targetPlayerId ? [targetPlayerId] : [],
      sourceStatus: "ready",
    };
  });

  if (input.entries.length === 0) {
    warnings.push(`MVP forced mutators could not affect ${input.disciplineId}/${input.disciplineSide} because no lineup entries were found.`);
  }

  return {
    mutatorMode: "mvp_forced_mutators",
    mutatorText: mutatorSlots.map((slot) => slot.label).join(" + "),
    mutatorModifier: Number(mutatorSlots.reduce((sum, slot) => sum + slot.scoreModifier, 0).toFixed(1)),
    playerMutatorBonuses: {},
    playerMutatorPpsBonuses,
    mutatorSlots,
    teamPpsModifier: null,
    teamPpsStatus: "missing_source",
    warnings,
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
