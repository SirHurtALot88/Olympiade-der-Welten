export type StandingsTieBreakerMode = "block_on_tie" | "shared_rank" | "deterministic_sort";
export type SharedRankMode = "competition" | "dense";

export const DEFAULT_STANDINGS_TIEBREAKER_MODE: StandingsTieBreakerMode = "block_on_tie";
export const DEFAULT_SHARED_RANK_MODE: SharedRankMode = "competition";

export type StandingsTieBreakItem = {
  teamId: string;
  teamName: string;
  totalScore: number | null;
  projectedPoints: number | null;
  currentRank: number | null;
  currentPoints: number | null;
  matchdayRank: number | null;
  cash: number | null;
};

export type StandingTieGroup = {
  type: "totalScore" | "projectedPoints";
  value: number;
  affectedTeams: Array<{
    teamId: string;
    teamName: string;
    totalScore: number | null;
    projectedPoints: number | null;
    currentRank: number | null;
    currentPoints: number | null;
    matchdayRank: number | null;
    cash: number | null;
  }>;
  requiresConfirmedTieBreaker: boolean;
};

function compareNullableNumbersDesc(left: number | null, right: number | null) {
  return (right ?? Number.NEGATIVE_INFINITY) - (left ?? Number.NEGATIVE_INFINITY);
}

function compareNullableNumbersAsc(left: number | null, right: number | null) {
  return (left ?? Number.POSITIVE_INFINITY) - (right ?? Number.POSITIVE_INFINITY);
}

function sortForProjectedPoints(left: StandingsTieBreakItem, right: StandingsTieBreakItem) {
  const projectedDelta = compareNullableNumbersDesc(left.projectedPoints, right.projectedPoints);
  if (projectedDelta !== 0) return projectedDelta;

  const totalScoreDelta = compareNullableNumbersDesc(left.totalScore, right.totalScore);
  if (totalScoreDelta !== 0) return totalScoreDelta;

  const matchdayDelta = compareNullableNumbersAsc(left.matchdayRank, right.matchdayRank);
  if (matchdayDelta !== 0) return matchdayDelta;

  const currentRankDelta = compareNullableNumbersAsc(left.currentRank, right.currentRank);
  if (currentRankDelta !== 0) return currentRankDelta;

  return left.teamName.localeCompare(right.teamName, "de");
}

function sortForTotalScore(left: StandingsTieBreakItem, right: StandingsTieBreakItem) {
  const scoreDelta = compareNullableNumbersDesc(left.totalScore, right.totalScore);
  if (scoreDelta !== 0) return scoreDelta;
  return left.teamName.localeCompare(right.teamName, "de");
}

function isProjectedPointsTieAfterScoreTieBreak(left: StandingsTieBreakItem, right: StandingsTieBreakItem) {
  return left.projectedPoints != null &&
    right.projectedPoints != null &&
    left.totalScore != null &&
    right.totalScore != null &&
    left.projectedPoints === right.projectedPoints &&
    left.totalScore === right.totalScore;
}

function buildTieGroupsForField(
  items: StandingsTieBreakItem[],
  field: "totalScore" | "projectedPoints",
): StandingTieGroup[] {
  if (field === "projectedPoints") {
    const sortedItems = [...items]
      .filter((item) => item.projectedPoints != null)
      .sort(sortForProjectedPoints);
    const groups: StandingsTieBreakItem[][] = [];
    let currentGroup: StandingsTieBreakItem[] = [];

    for (const item of sortedItems) {
      const previous = currentGroup[currentGroup.length - 1];
      if (previous && isProjectedPointsTieAfterScoreTieBreak(previous, item)) {
        currentGroup.push(item);
        continue;
      }

      if (currentGroup.length > 1) {
        groups.push(currentGroup);
      }
      currentGroup = [item];
    }

    if (currentGroup.length > 1) {
      groups.push(currentGroup);
    }

    return groups.map((group) => ({
      type: "projectedPoints" as const,
      value: group[0]!.projectedPoints as number,
      affectedTeams: group.map((item) => ({
        teamId: item.teamId,
        teamName: item.teamName,
        totalScore: item.totalScore,
        projectedPoints: item.projectedPoints,
        currentRank: item.currentRank,
        currentPoints: item.currentPoints,
        matchdayRank: item.matchdayRank,
        cash: item.cash,
      })),
      requiresConfirmedTieBreaker: true,
    }));
  }

  return Array.from(
    items
      .filter((item) => item[field] != null)
      .reduce((map, item) => {
        const key = item[field] as number;
        const group = map.get(key) ?? [];
        group.push(item);
        map.set(key, group);
        return map;
      }, new Map<number, StandingsTieBreakItem[]>()),
  )
    .filter(([, group]) => group.length > 1)
    .map(([value, group]) => ({
      type: field,
      value,
      affectedTeams: group.map((item) => ({
        teamId: item.teamId,
        teamName: item.teamName,
        totalScore: item.totalScore,
        projectedPoints: item.projectedPoints,
        currentRank: item.currentRank,
        currentPoints: item.currentPoints,
        matchdayRank: item.matchdayRank,
        cash: item.cash,
      })),
      requiresConfirmedTieBreaker: true,
    }));
}

export function detectStandingTieGroups(items: StandingsTieBreakItem[]): StandingTieGroup[] {
  return [
    ...buildTieGroupsForField(items, "totalScore"),
    ...buildTieGroupsForField(items, "projectedPoints"),
  ];
}

function buildRankMapWithMode(
  sortedItems: StandingsTieBreakItem[],
  valueKey: "totalScore" | "projectedPoints",
  mode: StandingsTieBreakerMode,
  sharedRankMode: SharedRankMode,
) {
  const rankByTeamId = new Map<string, number | null>();

  if (mode === "deterministic_sort") {
    sortedItems
      .filter((item) => item[valueKey] != null)
      .forEach((item, index) => {
        rankByTeamId.set(item.teamId, index + 1);
      });
    return rankByTeamId;
  }

  let currentRank = 0;
  let denseRank = 0;
  let previousValue: number | null | undefined = undefined;

  for (let index = 0; index < sortedItems.length; index += 1) {
    const item = sortedItems[index];
    const value = item[valueKey];
    if (value == null) {
      rankByTeamId.set(item.teamId, null);
      continue;
    }

    const previousItem = index > 0 ? sortedItems[index - 1] : null;
    const isSameAsPrevious =
      valueKey === "projectedPoints"
        ? previousItem != null && isProjectedPointsTieAfterScoreTieBreak(previousItem, item)
        : previousValue != null && value === previousValue;
    const sameValueGroupSize =
      valueKey === "projectedPoints"
        ? sortedItems.filter((candidate) => isProjectedPointsTieAfterScoreTieBreak(candidate, item)).length
        : sortedItems.filter((candidate) => candidate[valueKey] === value).length;

    if (mode === "block_on_tie" && sameValueGroupSize > 1) {
      rankByTeamId.set(item.teamId, null);
      previousValue = value;
      continue;
    }

    if (!isSameAsPrevious) {
      denseRank += 1;
      currentRank = index + 1;
      previousValue = value;
    }

    rankByTeamId.set(item.teamId, sharedRankMode === "dense" ? denseRank : currentRank);
  }

  return rankByTeamId;
}

export function resolveProjectedRankWithTiePolicy(
  items: StandingsTieBreakItem[],
  mode: StandingsTieBreakerMode = DEFAULT_STANDINGS_TIEBREAKER_MODE,
  sharedRankMode: SharedRankMode = DEFAULT_SHARED_RANK_MODE,
) {
  const sortedItems = [...items].sort(sortForProjectedPoints);
  return buildRankMapWithMode(sortedItems, "projectedPoints", mode, sharedRankMode);
}

export function resolveMatchdayRankWithTiePolicy(
  items: StandingsTieBreakItem[],
  mode: StandingsTieBreakerMode = DEFAULT_STANDINGS_TIEBREAKER_MODE,
  sharedRankMode: SharedRankMode = DEFAULT_SHARED_RANK_MODE,
) {
  const sortedItems = [...items].sort(sortForTotalScore);
  return buildRankMapWithMode(sortedItems, "totalScore", mode, sharedRankMode);
}
