import type {
  DisciplineCategory,
  Discipline,
  GameState,
  Matchday,
  SeasonDisciplineScheduleEntry,
  SeasonDisciplineScheduleSlot,
} from "@/lib/data/olyDataTypes";

const SCHEDULE_SOURCE_NOTE =
  "Retool nutzt eine feste Diszireihenfolge. Eine separate Saison-Neumisch-Regel wurde nicht gefunden; der lokale Plan bleibt daher legacy_seed.";

function toScheduleSlot(discipline: Discipline | null): SeasonDisciplineScheduleSlot | null {
  if (!discipline) {
    return null;
  }

  return {
    disciplineId: discipline.id,
    displayName: discipline.name,
    order: discipline.displayOrder ?? discipline.originalOrder ?? null,
    playerCount: discipline.playerCount ?? null,
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

function getDisciplinePlayerCount(discipline: Discipline | null | undefined) {
  return typeof discipline?.playerCount === "number" && Number.isFinite(discipline.playerCount)
    ? discipline.playerCount
    : 0;
}

function buildSeededDisciplinePairs(input: {
  disciplines: Discipline[];
  seed: string;
  requiredMatchdays: number;
  maxCombinedPlayerCount: number;
}): { pairs: Array<[Discipline | null, Discipline | null]>; warnings: string[] } {
  const shuffled = shuffleSeeded(sortDisciplinesForSeasonSchedule(input.disciplines), input.seed);
  const available = [...shuffled].sort((left, right) => {
    const countDelta = getDisciplinePlayerCount(right) - getDisciplinePlayerCount(left);
    if (countDelta !== 0) return countDelta;
    return shuffled.indexOf(left) - shuffled.indexOf(right);
  });
  const pairs: Array<[Discipline | null, Discipline | null]> = [];
  const warnings: string[] = [];

  for (let index = 0; index < input.requiredMatchdays; index += 1) {
    const first = available.shift() ?? null;
    if (!first) {
      pairs.push([null, null]);
      warnings.push("season_schedule_discipline_pool_exhausted");
      continue;
    }

    const firstCount = getDisciplinePlayerCount(first);
    let secondIndex = available.findIndex(
      (candidate) => firstCount + getDisciplinePlayerCount(candidate) <= input.maxCombinedPlayerCount,
    );
    if (secondIndex < 0) {
      secondIndex = 0;
      warnings.push(`season_schedule_pair_over_roster_limit:${first.id}`);
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
  maxCombinedPlayerCount?: number;
}): { entries: SeasonDisciplineScheduleEntry[]; matchdayIds: string[]; scheduleSeed: string; warnings: string[] } {
  const scheduleVersion = input.scheduleVersion ?? "season-setup-v2";
  const scheduleSeed = `${input.saveId}:${input.seasonId}:${scheduleVersion}`;
  const requiredMatchdays = Math.max(1, input.matchdayCount ?? getRequiredSeasonDisciplineMatchdayCount(input.disciplines));
  const matchdayIds = Array.from({ length: requiredMatchdays }, (_, index) => `${input.seasonId}-matchday-${index + 1}`);
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
      discipline1: toScheduleSlot(discipline1),
      discipline2: toScheduleSlot(discipline2),
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

export function getSeasonDisciplineScheduleEntry(gameState: GameState, matchdayId: string) {
  const stored = gameState.seasonState.disciplineSchedule ?? [];
  if (hasCompleteSeasonDisciplineSchedule({ disciplines: gameState.disciplines, disciplineSchedule: stored, seasonId: gameState.season.id })) {
    return sortScheduleEntries(stored.filter((entry) => entry.seasonId === gameState.season.id)).find((entry) => entry.matchdayId === matchdayId) ?? null;
  }

  const fallback = buildLegacySeedSeasonDisciplineSchedule({
    seasonId: gameState.season.id,
    disciplines: gameState.disciplines,
    matchdayIds: gameState.season.matchdayIds,
  });
  return fallback.find((entry) => entry.matchdayId === matchdayId) ?? null;
}

export function getSeasonDisciplineSchedule(gameState: GameState) {
  if (
    hasCompleteSeasonDisciplineSchedule({
      disciplines: gameState.disciplines,
      disciplineSchedule: gameState.seasonState.disciplineSchedule,
      seasonId: gameState.season.id,
    })
  ) {
    return sortScheduleEntries((gameState.seasonState.disciplineSchedule ?? []).filter((entry) => entry.seasonId === gameState.season.id));
  }

  return buildLegacySeedSeasonDisciplineSchedule({
    seasonId: gameState.season.id,
    disciplines: gameState.disciplines,
    matchdayIds: gameState.season.matchdayIds,
  });
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
