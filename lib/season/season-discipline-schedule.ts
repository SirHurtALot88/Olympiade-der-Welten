import type {
  DisciplineCategory,
  Discipline,
  GameState,
  Matchday,
  SeasonDisciplineScheduleEntry,
  SeasonDisciplineScheduleSlot,
} from "@/lib/data/olyDataTypes";

const SCHEDULE_SOURCE_NOTE =
  "Legacy-Fallback fuer alte Saves ohne vollstaendigen Season-Schedule.";

type ScheduledDiscipline = {
  discipline: Discipline;
  playerCount: number;
};

function toScheduleSlot(discipline: Discipline | null, playerCountOverride?: number | null): SeasonDisciplineScheduleSlot | null {
  if (!discipline) {
    return null;
  }

  return {
    disciplineId: discipline.id,
    displayName: discipline.name,
    order: discipline.displayOrder ?? discipline.originalOrder ?? null,
    playerCount: playerCountOverride ?? discipline.playerCount ?? null,
    category: discipline.category,
  };
}

function hashToUint(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string) {
  let state = hashToUint(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSeeded<T>(items: T[], seed: string) {
  const next = [...items];
  const random = createSeededRandom(seed);
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function clampPlayerCount(value: number) {
  return Math.max(2, Math.min(6, Math.round(value)));
}

function buildSeasonPlayerCount(discipline: Discipline, seed: string) {
  const random = createSeededRandom(`${seed}:players:${discipline.id}`);
  const rolled = 2 + Math.floor(random() * 5);
  if (Number.isFinite(discipline.playerCount ?? NaN)) {
    const base = clampPlayerCount(discipline.playerCount ?? rolled);
    if (rolled === base) {
      const direction = random() >= 0.5 ? 1 : -1;
      return clampPlayerCount(base + direction);
    }
  }
  return clampPlayerCount(rolled);
}

function buildSeasonPlayerCountByDiscipline(disciplines: Discipline[], seed: string) {
  const countByDisciplineId = new Map<string, number>();
  const groupedByCategory = new Map<DisciplineCategory, Discipline[]>();

  for (const discipline of disciplines) {
    const group = groupedByCategory.get(discipline.category) ?? [];
    group.push(discipline);
    groupedByCategory.set(discipline.category, group);
  }

  for (const [category, categoryDisciplines] of groupedByCategory) {
    const ordered = sortDisciplinesForSeasonSchedule(categoryDisciplines);
    if (ordered.length === 5) {
      const counts = shuffleSeeded([2, 3, 4, 5, 6], `${seed}:player-count-balance:${category}`);
      ordered.forEach((discipline, index) => {
        countByDisciplineId.set(discipline.id, counts[index] ?? buildSeasonPlayerCount(discipline, seed));
      });
      continue;
    }

    ordered.forEach((discipline) => {
      countByDisciplineId.set(discipline.id, buildSeasonPlayerCount(discipline, seed));
    });
  }

  return countByDisciplineId;
}

function buildSeededDisciplinePairs(input: {
  disciplines: Discipline[];
  seed: string;
  requiredMatchdays: number;
  maxCombinedPlayerCount: number;
}): { pairs: Array<[ScheduledDiscipline | null, ScheduledDiscipline | null]>; warnings: string[] } {
  const shuffled = shuffleSeeded(sortDisciplinesForSeasonSchedule(input.disciplines), input.seed);
  const playerCountByDisciplineId = buildSeasonPlayerCountByDiscipline(input.disciplines, input.seed);
  const available = shuffled.map((discipline) => ({
    discipline,
    playerCount: playerCountByDisciplineId.get(discipline.id) ?? buildSeasonPlayerCount(discipline, input.seed),
  }));
  const pairs: Array<[ScheduledDiscipline | null, ScheduledDiscipline | null]> = [];
  const warnings: string[] = [];

  for (let index = 0; index < input.requiredMatchdays; index += 1) {
    const first = available.shift() ?? null;
    if (!first) {
      pairs.push([null, null]);
      warnings.push("season_schedule_discipline_pool_exhausted");
      continue;
    }

    const firstCount = first.playerCount;
    let secondIndex = available.findIndex(
      (candidate) => firstCount + candidate.playerCount <= input.maxCombinedPlayerCount,
    );
    if (secondIndex < 0) {
      secondIndex = available.reduce((lowestIndex, candidate, candidateIndex) => {
        const lowest = available[lowestIndex];
        return !lowest || candidate.playerCount < lowest.playerCount ? candidateIndex : lowestIndex;
      }, 0);
      warnings.push(`season_schedule_pair_over_roster_limit:${first.discipline.id}`);
    }
    const second = secondIndex >= 0 ? available.splice(secondIndex, 1)[0] ?? null : null;
    pairs.push([first, second]);
  }

  return { pairs, warnings: Array.from(new Set(warnings)) };
}

export function getDisciplineColor(category?: DisciplineCategory | null) {
  if (category === "power") return "red";
  if (category === "speed") return "green";
  if (category === "mental") return "blue";
  if (category === "social") return "yellow";
  return null;
}

export function sortDisciplinesForSeasonSchedule(disciplines: Discipline[]) {
  return [...disciplines].sort((left, right) => {
    const leftOrder = left.displayOrder ?? left.originalOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.displayOrder ?? right.originalOrder ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.name.localeCompare(right.name, "de");
  });
}

export function getRequiredSeasonDisciplineMatchdayCount(disciplines: Discipline[]) {
  return Math.max(1, Math.ceil(sortDisciplinesForSeasonSchedule(disciplines).length / 2));
}

function sortScheduleEntries(entries: SeasonDisciplineScheduleEntry[]) {
  return [...entries].sort((left, right) => {
    if (left.matchdayIndex !== right.matchdayIndex) {
      return left.matchdayIndex - right.matchdayIndex;
    }
    return left.matchdayId.localeCompare(right.matchdayId, "de");
  });
}

function buildNormalizedMatchdayIds(input: { seasonId: string; disciplines: Discipline[]; matchdayIds?: string[] | null }) {
  const requiredMatchdays = getRequiredSeasonDisciplineMatchdayCount(input.disciplines);
  if (input.matchdayIds && input.matchdayIds.length >= requiredMatchdays) {
    return input.matchdayIds.slice(0, requiredMatchdays);
  }
  const usesLegacySeasonOneIds = (input.matchdayIds ?? []).some((matchdayId) => /^matchday-\d+$/.test(matchdayId));
  return Array.from({ length: requiredMatchdays }, (_, index) =>
    usesLegacySeasonOneIds ? `matchday-${index + 1}` : `${input.seasonId}-matchday-${index + 1}`,
  );
}

export function hasCompleteSeasonDisciplineSchedule(input: {
  disciplines: Discipline[];
  disciplineSchedule?: SeasonDisciplineScheduleEntry[] | null;
  seasonId?: string | null;
}) {
  const requiredMatchdays = getRequiredSeasonDisciplineMatchdayCount(input.disciplines);
  const schedule = (input.disciplineSchedule ?? []).filter((entry) => !input.seasonId || entry.seasonId === input.seasonId);
  if (schedule.length < requiredMatchdays) {
    return false;
  }

  const relevantEntries = sortScheduleEntries(schedule).slice(0, requiredMatchdays);
  if (relevantEntries.length !== requiredMatchdays) {
    return false;
  }
  if (relevantEntries.some((entry) => entry.sourceStatus === "legacy_seed" || entry.sourceStatus === "discipline_schedule_rule_missing")) {
    return false;
  }

  const uniqueMatchdayIds = new Set(relevantEntries.map((entry) => entry.matchdayId));
  return uniqueMatchdayIds.size === requiredMatchdays;
}

export function buildLegacySeedSeasonDisciplineSchedule(input: {
  seasonId: string;
  disciplines: Discipline[];
  matchdayIds?: string[];
}): SeasonDisciplineScheduleEntry[] {
  const ordered = sortDisciplinesForSeasonSchedule(input.disciplines);
  const requiredMatchdays = getRequiredSeasonDisciplineMatchdayCount(input.disciplines);
  const matchdayIds =
    input.matchdayIds && input.matchdayIds.length >= requiredMatchdays
      ? input.matchdayIds.slice(0, requiredMatchdays)
      : Array.from({ length: requiredMatchdays }, (_, index) => `matchday-${index + 1}`);

  return matchdayIds.map((matchdayId, index) => {
    const discipline1 = ordered[index * 2] ?? null;
    const discipline2 = ordered[index * 2 + 1] ?? null;

    return {
      seasonId: input.seasonId,
      matchdayId,
      matchdayIndex: index + 1,
      matchdayLabel: `Spieltag ${index + 1}`,
      discipline1: toScheduleSlot(discipline1),
      discipline2: toScheduleSlot(discipline2),
      sourceStatus: "legacy_seed",
      sourceNote: SCHEDULE_SOURCE_NOTE,
    };
  });
}

export function buildSeasonSeededDisciplineSchedule(input: {
  saveId: string;
  seasonId: string;
  disciplines: Discipline[];
  scheduleVersion?: string;
  matchdayCount?: number;
  matchdayIds?: string[];
  maxCombinedPlayerCount?: number;
}): { entries: SeasonDisciplineScheduleEntry[]; matchdayIds: string[]; scheduleSeed: string; warnings: string[] } {
  const scheduleVersion = input.scheduleVersion ?? "season-setup-v3-balanced-slot-buckets";
  const scheduleSeed = `${input.saveId}:${input.seasonId}:${scheduleVersion}`;
  const requiredMatchdays = Math.max(1, input.matchdayCount ?? getRequiredSeasonDisciplineMatchdayCount(input.disciplines));
  const matchdayIds =
    input.matchdayIds && input.matchdayIds.length >= requiredMatchdays
      ? input.matchdayIds.slice(0, requiredMatchdays)
      : Array.from({ length: requiredMatchdays }, (_, index) => `${input.seasonId}-matchday-${index + 1}`);
  const maxCombinedPlayerCount = input.maxCombinedPlayerCount ?? 10;
  const paired = buildSeededDisciplinePairs({
    disciplines: input.disciplines,
    seed: scheduleSeed,
    requiredMatchdays,
    maxCombinedPlayerCount,
  });
  const warnings = [
    ...(input.disciplines.length < requiredMatchdays * 2 ? ["season_schedule_discipline_pool_smaller_than_slots"] : []),
    ...paired.warnings,
  ];

  const entries = matchdayIds.map((matchdayId, index) => {
    const [discipline1, discipline2] = paired.pairs[index] ?? [null, null];

    return {
      seasonId: input.seasonId,
      matchdayId,
      matchdayIndex: index + 1,
      matchdayLabel: `Spieltag ${index + 1}`,
      discipline1: toScheduleSlot(discipline1?.discipline ?? null, discipline1?.playerCount ?? null),
      discipline2: toScheduleSlot(discipline2?.discipline ?? null, discipline2?.playerCount ?? null),
      sourceStatus: "season_seed",
      sourceNote: `Season-spezifischer Schedule-Seed: ${scheduleSeed}`,
    } satisfies SeasonDisciplineScheduleEntry;
  });

  return { entries, matchdayIds, scheduleSeed, warnings };
}

export function buildMatchdaysFromSeasonDisciplineSchedule(
  seasonId: string,
  entries: SeasonDisciplineScheduleEntry[],
  existingFixtureIdsByMatchdayId?: Record<string, string[]>,
): Matchday[] {
  return entries.map((entry) => ({
    id: entry.matchdayId,
    seasonId,
    index: entry.matchdayIndex,
    label: entry.matchdayLabel,
    fixtureIds: existingFixtureIdsByMatchdayId?.[entry.matchdayId] ?? [],
  }));
}

function scheduleHasPopulatedDisciplineSlots(entries: SeasonDisciplineScheduleEntry[]) {
  return entries.some((entry) => Boolean(entry.discipline1?.disciplineId || entry.discipline2?.disciplineId));
}

function buildResolvedSeasonDisciplineSchedule(
  gameState: GameState,
  saveId = "normalized-local-save",
): SeasonDisciplineScheduleEntry[] {
  const matchdayIds = buildNormalizedMatchdayIds({
    seasonId: gameState.season.id,
    disciplines: gameState.disciplines,
    matchdayIds: gameState.season.matchdayIds,
  });
  return buildSeasonSeededDisciplineSchedule({
    saveId,
    seasonId: gameState.season.id,
    disciplines: gameState.disciplines,
    matchdayIds,
    matchdayCount: matchdayIds.length,
  }).entries;
}

export function getSeasonDisciplineScheduleEntry(
  gameState: GameState,
  matchdayId: string,
  options?: { saveId?: string },
) {
  const schedule = getSeasonDisciplineSchedule(gameState, options);
  return schedule.find((entry) => entry.matchdayId === matchdayId) ?? null;
}

export function getSeasonDisciplineSchedule(gameState: GameState, options?: { saveId?: string }) {
  const saveId = options?.saveId ?? "normalized-local-save";
  const stored = gameState.seasonState.disciplineSchedule ?? [];
  if (
    hasCompleteSeasonDisciplineSchedule({
      disciplines: gameState.disciplines,
      disciplineSchedule: stored,
      seasonId: gameState.season.id,
    })
  ) {
    const activeSchedule = sortScheduleEntries(stored.filter((entry) => entry.seasonId === gameState.season.id));
    if (scheduleHasPopulatedDisciplineSlots(activeSchedule) || gameState.disciplines.length === 0) {
      return activeSchedule;
    }
  }

  if (gameState.disciplines.length === 0) {
    return sortScheduleEntries(stored.filter((entry) => entry.seasonId === gameState.season.id));
  }

  return buildResolvedSeasonDisciplineSchedule(gameState, saveId);
}

export function buildSeasonDisciplinePlayerCountMap(gameState: GameState) {
  const playerCountByDisciplineId = new Map<string, number | null>();

  for (const entry of getSeasonDisciplineSchedule(gameState)) {
    const slots = [entry.discipline1, entry.discipline2];
    for (const slot of slots) {
      if (!slot?.disciplineId) {
        continue;
      }
      playerCountByDisciplineId.set(slot.disciplineId, slot.playerCount ?? null);
    }
  }

  for (const discipline of gameState.disciplines) {
    if (!playerCountByDisciplineId.has(discipline.id)) {
      playerCountByDisciplineId.set(discipline.id, discipline.playerCount ?? null);
    }
  }

  return playerCountByDisciplineId;
}

export function withNormalizedSeasonDisciplineSchedule(gameState: GameState): GameState {
  const normalizedSchedule = getSeasonDisciplineSchedule(gameState);
  const normalizedMatchdayIds = normalizedSchedule.map((entry) => entry.matchdayId);
  const fallbackMatchdayId =
    normalizedMatchdayIds[Math.max(0, Math.min(gameState.season.currentMatchday - 1, normalizedMatchdayIds.length - 1))] ??
    normalizedMatchdayIds[0] ??
    gameState.matchdayState.matchdayId;
  const activeMatchdayId = normalizedMatchdayIds.includes(gameState.matchdayState.matchdayId)
    ? gameState.matchdayState.matchdayId
    : fallbackMatchdayId;
  const activeMatchdayIndex = Math.max(
    1,
    normalizedMatchdayIds.findIndex((matchdayId) => matchdayId === activeMatchdayId) + 1,
  );

  return {
    ...gameState,
    season: {
      ...gameState.season,
      currentMatchday: activeMatchdayIndex,
      matchdayIds: normalizedMatchdayIds,
    },
    seasonState: {
      ...gameState.seasonState,
      disciplineSchedule: normalizedSchedule,
    },
    matchdayState: {
      ...gameState.matchdayState,
      matchdayId: activeMatchdayId,
    },
  };
}
