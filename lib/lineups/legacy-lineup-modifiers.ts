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
  "Disciplined",
  "Eloquent",
  "Fair",
  "FanFavorite",
  "Fearless",
  "FiredUp",
  "Flexible",
  "Healthy",
  "Loyal",
  "Motivated",
  "Relaxed",
  "Resourceful",
  "Sexy",
] as const;

const NEGATIVE_MUTATOR_TRAITS = [
  "Timid",
  "Cheater",
  "ColdBlooded",
  "Cruel",
  "Devious",
  "Diva",
  "Egomaniac",
  "FaintHearted",
  "Feisty",
  "Gambler",
  "Lazy",
  "Manipulative",
  "Mercenary",
  "Obsessive",
  "Paranoid",
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

export function lineupModifiersHaveFormCardSelections(modifiers?: Partial<LineupDraftModifiers> | null) {
  const normalized = normalizeLineupDraftModifiers(modifiers);
  return [normalized.d1, normalized.d2].some(
    (side) => Boolean(side.primaryFormCardId || side.secondaryFormCardId),
  );
}

export function autoFillFormCardModifiers(input: {
  gameState: GameState;
  seasonId: string;
  teamId: string;
  lineupId?: string | null;
  modifiers?: Partial<LineupDraftModifiers> | null;
}): LineupDraftModifiers {
  const normalized = normalizeLineupDraftModifiers(input.modifiers);
  if (lineupModifiersHaveFormCardSelections(normalized)) {
    return normalized;
  }

  const options = getTeamFormCardOptions({
    gameState: input.gameState,
    seasonId: input.seasonId,
    teamId: input.teamId,
    lineupId: input.lineupId ?? null,
  });
  const usedIds = new Set<string>();

  for (const side of ["d1", "d2"] as const) {
    if (normalized[side].primaryFormCardId || normalized[side].secondaryFormCardId) {
      continue;
    }
    const positive = options
      .filter((card) => card.value > 0 && !usedIds.has(card.id))
      .sort((left, right) => right.value - left.value || left.id.localeCompare(right.id))[0];
    if (positive) {
      normalized[side].primaryFormCardId = positive.id;
      usedIds.add(positive.id);
    }
  }

  return normalized;
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

export function selectBestMutatorTraitsForEntries(
  entries: Array<{ playerId: string }>,
  rosterPlayers: LegacyRosterPlayerRef[],
  traitOptions: LegacyMutatorTraitOption[] = getLegacyMutatorTraitOptions(),
): [string | null, string | null] {
  const rosterPlayerById = new Map((rosterPlayers ?? []).map((player) => [player.id, player]));
  const traitCounts = new Map<string, { label: string; hits: number; players: Set<string> }>();

  for (const entry of entries) {
    const player = rosterPlayerById.get(entry.playerId) ?? null;
    const hitKeysForPlayer = new Set<string>();
    for (const trait of getPlayerMutatorTraitSlots(player)) {
      const key = normalizeTraitKey(trait);
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

  const usedKeys = new Set(selectedLabels.filter(Boolean).map((label) => normalizeTraitKey(label!)));
  for (const option of traitOptions.length > 0 ? traitOptions : getLegacyMutatorTraitOptions()) {
    const label = String(option.label || option.value || "").trim();
    if (!label) continue;
    const key = normalizeTraitKey(label);
    if (usedKeys.has(key)) continue;
    const emptyIndex = selectedLabels.findIndex((entry) => !entry);
    if (emptyIndex === -1) break;
    selectedLabels[emptyIndex] = label;
    usedKeys.add(key);
  }

  return [selectedLabels[0] ?? null, selectedLabels[1] ?? null];
}

export function applyMutatorTraitsToLineupModifiers(input: {
  modifiers: LineupDraftModifiers;
  entries: Array<{ playerId: string; disciplineSide: "d1" | "d2" }>;
  rosterPlayers: LegacyRosterPlayerRef[];
  traitOptions?: LegacyMutatorTraitOption[];
  onlyFillMissing?: boolean;
}): LineupDraftModifiers {
  const modifiers = normalizeLineupDraftModifiers(input.modifiers);
  const traitOptions = input.traitOptions ?? getLegacyMutatorTraitOptions();

  for (const side of ["d1", "d2"] as const) {
    const sideEntries = input.entries.filter((entry) => entry.disciplineSide === side);
    const [trait1, trait2] = selectBestMutatorTraitsForEntries(sideEntries, input.rosterPlayers, traitOptions);
    if (!input.onlyFillMissing || !modifiers[side].mutatorTrait1?.trim()) {
      modifiers[side].mutatorTrait1 = trait1;
    }
    if (!input.onlyFillMissing || !modifiers[side].mutatorTrait2?.trim()) {
      modifiers[side].mutatorTrait2 = trait2;
    }
  }

  return modifiers;
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
      "Matchday-Mutatoren: 2 Traits werden einmal pro Spieltag und Disziplin-Seite für alle Teams ausgewürfelt; +6 Score pro passendem Trait je eingesetztem Spieler und +0,3 Player-PPs pro betroffenem Spieler.",
    warnings: [],
  };
}

export type MatchdayMutatorTraitsBySide = Record<LineupDisciplineSide, [string, string]>;

export function rollMatchdayMutatorTraitsForSide(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  disciplineSide: LineupDisciplineSide;
  disciplineId?: string | null;
}): [string, string] {
  const pool = getLegacyMutatorTraitOptions()
    .map((option) => option.value)
    .sort((left, right) => left.localeCompare(right, "de"));
  if (pool.length === 0) {
    return ["", ""];
  }

  const seedBase = [
    input.saveId,
    input.seasonId,
    input.matchdayId,
    input.disciplineSide,
    input.disciplineId ?? "discipline",
  ].join("::");
  const firstIndex = hashSeed(`${seedBase}::mutator1`) % pool.length;
  const first = pool[firstIndex] ?? pool[0]!;
  const remaining = pool.filter((_, index) => index !== firstIndex);
  const secondPool = remaining.length > 0 ? remaining : pool;
  const secondIndex = hashSeed(`${seedBase}::mutator2`) % secondPool.length;
  const second = secondPool[secondIndex] ?? secondPool[0] ?? first;

  return [first, second];
}

export function buildMatchdayMutatorTraitsBySide(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  d1DisciplineId?: string | null;
  d2DisciplineId?: string | null;
}): MatchdayMutatorTraitsBySide {
  return {
    d1: rollMatchdayMutatorTraitsForSide({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      disciplineSide: "d1",
      disciplineId: input.d1DisciplineId,
    }),
    d2: rollMatchdayMutatorTraitsForSide({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      disciplineSide: "d2",
      disciplineId: input.d2DisciplineId,
    }),
  };
}

export function getDisciplineTextMutatorSourceSummary(mutator1: string | null, mutator2: string | null): LegacyModifierSourceSummary {
  if (!mutator1?.trim() && !mutator2?.trim()) {
    return {
      selectionStatus: "missing_source",
      effectStatus: "missing_source",
      sourceLabel: "Disziplin-Text-Mutatoren sind noch nicht an eine kanonische Quelle angebunden.",
      warnings: ["discipline_text_mutator_source_missing"],
    };
  }

  return {
    selectionStatus: "ready",
    effectStatus: "ready",
    sourceLabel: `Disziplin-Text-Mutatoren: ${[mutator1, mutator2].filter(Boolean).join(" / ")}`,
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
      const unusedNegativeCardList = unusedCards.filter((card) => card.cardValue < 0);
      const unusedNegativeCards = unusedNegativeCardList.length;
      const unusedPositiveCards = unusedCards.filter((card) => card.cardValue > 0).length;
      const negativePenaltyPoints = Math.round(
        unusedNegativeCardList.reduce((sum, card) => sum + Math.abs(card.cardValue) * 0.5, 0),
      );

      return {
        teamId: team.teamId,
        totalCards: cards.length,
        usedCards: usedCards.length,
        unusedCards: unusedCards.length,
        unusedPositiveCards,
        unusedNegativeCards,
        negativePenaltyPoints,
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

const FORM_CARD_COLOR_CODES: Record<FormCardColor, string> = {
  red: "R",
  green: "G",
  blue: "B",
  yellow: "Y",
};

export function formatCompactFormCardLabel(
  card: Pick<LegacyFormCardOption, "color" | "value">,
  doubled = false,
): string {
  const code = FORM_CARD_COLOR_CODES[normalizeColor(card.color) ?? "red"] ?? "C";
  const sign = card.value > 0 ? "+" : "";
  return `${code}${sign}${card.value}${doubled ? "×2" : ""}`;
}

export function formatSelectedFormCardLabels(input: {
  selectedCards: LegacyFormCardOption[];
  disciplineColor?: string | null;
}): string | null {
  if (input.selectedCards.length === 0) {
    return null;
  }

  const normalizedColor = normalizeColor(input.disciplineColor);
  return input.selectedCards
    .map((card) => {
      const doubled = normalizedColor != null && card.color === normalizedColor;
      return formatCompactFormCardLabel(card, doubled);
    })
    .join(" · ");
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
  formCardLabel: string | null;
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
    formCardLabel: formatSelectedFormCardLabels({
      selectedCards,
      disciplineColor: input.disciplineColor,
    }),
    formModifier: Number((effectiveSum * input.playerCount).toFixed(1)),
    warnings,
  };
}

// Deterministischer Form-Jitter in [-jitterMax, jitterMax] (1 Dezimale), stabil
// pro Seed. Reiner FNV-Hash → dieselbe Paarung liefert immer denselben Wert,
// damit Engine (Score/PP) und Anzeige exakt übereinstimmen.
export function seededFormJitter(seed: string, jitterMax = 4): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const norm = ((h >>> 0) % 1000) / 1000; // 0..1
  return Number(((norm * 2 - 1) * jitterMax).toFixed(1));
}

// Verteilt die Team-Form (formModifier = Kartenwert × Anzahl) ADDITIV auf die
// Spieler: jeder bekommt den flachen Pro-Spieler-Wert (formModifier/Anzahl) plus
// einen echten Zufalls-Jitter (±jitterMax). Der Jitter ist bewusst NICHT
// zero-sum — die Team-Summe wackelt mit (Extra-Kick, wie die zufälligen
// Formkarten selbst). Reihenfolge der Seeds == Reihenfolge der Spieler; der Seed
// (z.B. `${playerId}|${disciplineId}|${matchdayId}`) macht das Ergebnis reproduzierbar, sodass
// Score-Engine und Bühne identische Werte zeigen.
export function distributePerPlayerFormShares(input: {
  formModifier?: number | null;
  seeds: string[];
  jitterMax?: number;
}): number[] {
  const total = input.formModifier ?? 0;
  const n = input.seeds.length;
  if (n === 0) {
    return [];
  }
  if (!Number.isFinite(total) || total === 0) {
    return input.seeds.map(() => 0);
  }
  const flat = total / n;
  const jitterMax = input.jitterMax ?? 4;
  return input.seeds.map((seed) => Number((flat + seededFormJitter(seed, jitterMax)).toFixed(1)));
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
  matchdayMutatorTraits?: Array<string | null | undefined>;
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
  const matchdayTraits = (input.matchdayMutatorTraits ?? [])
    .map(normalizeTraitValue)
    .filter(Boolean);
  const storedTraits = Array.from(
    new Map(
      [selection.mutatorTrait1, selection.mutatorTrait2]
        .map(normalizeTraitValue)
        .filter(Boolean)
        .map((trait) => [normalizeTraitKey(trait), trait] as const),
    ).values(),
  );
  // Vorrang: Eine vorhandene gespeicherte Spieler-/KI-Auswahl (mutatorTrait1/2) wird
  // honoriert. Nur wenn KEINE gespeicherte Auswahl existiert, fällt die Wertung
  // deterministisch auf die ausgewürfelten Matchday-Traits zurück (Roll bleibt Fallback).
  const selectedTraits = Array.from(
    new Map(
      (storedTraits.length > 0 ? storedTraits : matchdayTraits).map(
        (trait) => [normalizeTraitKey(trait), trait] as const,
      ),
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
