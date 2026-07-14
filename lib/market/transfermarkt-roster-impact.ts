export type TransfermarktAxisKey = "pow" | "spe" | "men" | "soc";

export const TRANSFERMARKT_AXIS_KEYS: TransfermarktAxisKey[] = ["pow", "spe", "men", "soc"];

export type TransfermarktAxisValues = Partial<Record<TransfermarktAxisKey, number | null | undefined>>;

export type TransfermarktTopSixAxisImpactRow = {
  axis: TransfermarktAxisKey;
  before: number | null;
  after: number | null;
  delta: number | null;
};

export type TransfermarktDisciplineTopSixImpactRow = {
  disciplineId: string;
  disciplineName: string;
  tierWindow: string;
  beforeTopSixAvg: number | null;
  afterTopSixAvg: number | null;
  delta: number | null;
  /** Teilnehmerzahl der Saison-Disziplin (gleiche Quelle wie Top-Disziplinen-Chart), null wenn unbekannt. */
  playerCount: number | null;
};

export type TransfermarktAxisTeamRankEstimate = {
  axis: TransfermarktAxisKey;
  bestRank: number;
  worstRank: number;
  rosterSize: number;
};

function readAxisValue(source: TransfermarktAxisValues | null | undefined, axis: TransfermarktAxisKey) {
  const value = source?.[axis];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function topNValues(values: number[], count: number) {
  if (count <= 0 || values.length === 0) {
    return [];
  }
  return [...values].sort((left, right) => right - left).slice(0, Math.min(count, values.length));
}

function averageValues(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computeTopSixAxisAverage(values: number[], topCount = 6) {
  return averageValues(topNValues(values, topCount));
}

export function computeTopSixAxisAverages(
  roster: TransfermarktAxisValues[],
  topCount = 6,
): Record<TransfermarktAxisKey, number | null> {
  return TRANSFERMARKT_AXIS_KEYS.reduce(
    (result, axis) => {
      const axisValues = roster
        .map((entry) => readAxisValue(entry, axis))
        .filter((value): value is number => value != null);
      result[axis] = computeTopSixAxisAverage(axisValues, topCount);
      return result;
    },
    {} as Record<TransfermarktAxisKey, number | null>,
  );
}

export function computeTopSixAxisImpact(
  roster: TransfermarktAxisValues[],
  candidate: TransfermarktAxisValues | null | undefined,
  topCount = 6,
): TransfermarktTopSixAxisImpactRow[] {
  const before = computeTopSixAxisAverages(roster, topCount);
  const after = candidate ? computeTopSixAxisAverages([...roster, candidate], topCount) : before;

  return TRANSFERMARKT_AXIS_KEYS.map((axis) => ({
    axis,
    before: before[axis],
    after: after[axis],
    delta:
      before[axis] != null && after[axis] != null
        ? Number((after[axis]! - before[axis]!).toFixed(1))
        : null,
  }));
}

export function computeCompositeTopSixAverage(rows: TransfermarktTopSixAxisImpactRow[], mode: "before" | "after") {
  const values = rows
    .map((row) => (mode === "before" ? row.before : row.after))
    .filter((value): value is number => value != null);
  return averageValues(values);
}

export function computeDisciplineTopSixAverage(
  roster: Array<{ disciplineRatings?: Record<string, number | null | undefined> | null }>,
  disciplineId: string,
  topCount = 6,
) {
  const scores = roster
    .map((entry) => entry.disciplineRatings?.[disciplineId])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return computeTopSixAxisAverage(scores, topCount);
}

export function computeCandidateAxisTeamRankEstimate(
  roster: TransfermarktAxisValues[],
  candidate: TransfermarktAxisValues | null | undefined,
  axis: TransfermarktAxisKey,
  confidence: number | null | undefined,
): TransfermarktAxisTeamRankEstimate | null {
  if (!candidate) {
    return null;
  }
  const candidateValue = readAxisValue(candidate, axis);
  if (candidateValue == null) {
    return null;
  }

  const rosterValues = roster
    .map((entry) => readAxisValue(entry, axis))
    .filter((value): value is number => value != null);
  const rosterSize = rosterValues.length + 1;
  const exactRank = rosterValues.filter((value) => value > candidateValue).length + 1;

  if (confidence != null && confidence >= 75) {
    return { axis, bestRank: exactRank, worstRank: exactRank, rosterSize };
  }

  const noiseMargin = confidence != null && confidence >= 50 ? 5 : 9;
  const optimisticRank = rosterValues.filter((value) => value > candidateValue + noiseMargin).length + 1;
  const pessimisticRank = rosterValues.filter((value) => value > candidateValue - noiseMargin).length + 1;

  return {
    axis,
    bestRank: Math.min(optimisticRank, pessimisticRank),
    worstRank: Math.max(optimisticRank, pessimisticRank),
    rosterSize,
  };
}

export function computeCandidateAxisTeamRankEstimates(
  roster: TransfermarktAxisValues[],
  candidate: TransfermarktAxisValues | null | undefined,
  confidence: number | null | undefined,
): TransfermarktAxisTeamRankEstimate[] {
  return TRANSFERMARKT_AXIS_KEYS.map((axis) =>
    computeCandidateAxisTeamRankEstimate(roster, candidate, axis, confidence),
  ).filter((entry): entry is TransfermarktAxisTeamRankEstimate => entry != null);
}

export function formatTeamRankEstimateLabel(
  estimate: TransfermarktAxisTeamRankEstimate | null | undefined,
  confidence: number | null | undefined,
) {
  if (!estimate) {
    return null;
  }
  if (confidence != null && confidence >= 75) {
    return `#${estimate.bestRank}/${estimate.rosterSize}`;
  }
  if (estimate.bestRank === estimate.worstRank) {
    return `ca. #${estimate.bestRank}/${estimate.rosterSize}`;
  }
  return `ca. #${estimate.bestRank}–${estimate.worstRank}/${estimate.rosterSize}`;
}

export function computeDisciplineTopSixImpact(
  roster: Array<{ disciplineRatings?: Record<string, number | null | undefined> | null }>,
  disciplines: Array<{
    disciplineId: string;
    disciplineName: string;
    displayedScore: number | null;
    tierWindow: string;
    playerCount?: number | null;
  }>,
  topCount = 6,
): TransfermarktDisciplineTopSixImpactRow[] {
  return disciplines.map((discipline) => {
    const beforeTopSixAvg = computeDisciplineTopSixAverage(roster, discipline.disciplineId, topCount);
    const afterTopSixAvg =
      discipline.displayedScore == null
        ? beforeTopSixAvg
        : computeTopSixAxisAverage(
            [
              ...roster
                .map((entry) => entry.disciplineRatings?.[discipline.disciplineId])
                .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
              discipline.displayedScore,
            ],
            topCount,
          );
    return {
      disciplineId: discipline.disciplineId,
      disciplineName: discipline.disciplineName,
      tierWindow: discipline.tierWindow,
      beforeTopSixAvg: beforeTopSixAvg != null ? Number(beforeTopSixAvg.toFixed(1)) : null,
      afterTopSixAvg: afterTopSixAvg != null ? Number(afterTopSixAvg.toFixed(1)) : null,
      delta:
        beforeTopSixAvg != null && afterTopSixAvg != null
          ? Number((afterTopSixAvg - beforeTopSixAvg).toFixed(1))
          : null,
      playerCount:
        typeof discipline.playerCount === "number" && Number.isFinite(discipline.playerCount)
          ? discipline.playerCount
          : null,
    };
  });
}
