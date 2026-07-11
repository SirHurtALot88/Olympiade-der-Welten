export type LeaguePlayerHeatPools = {
  ovr: number[];
  mvs: number[];
  pps: number[];
  pow: number[];
  spe: number[];
  men: number[];
  soc: number[];
  disciplines: Record<string, number[]>;
};

export function createEmptyLeaguePlayerHeatPools(disciplineIds: string[] = []): LeaguePlayerHeatPools {
  return {
    ovr: [],
    mvs: [],
    pps: [],
    pow: [],
    spe: [],
    men: [],
    soc: [],
    disciplines: Object.fromEntries(disciplineIds.map((id) => [id, [] as number[]])),
  };
}

export function getPoolHeatClass(value: number | null | undefined, pool: Array<number | null | undefined>) {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }

  const numericPool = pool.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
  if (numericPool.length < 2) {
    return "";
  }

  const sorted = [...numericPool].sort((left, right) => left - right);
  const min = sorted[0] ?? null;
  const max = sorted[sorted.length - 1] ?? null;
  if (min == null || max == null || min === max) {
    return "";
  }

  let upperIndex = -1;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    if (sorted[index]! <= value) {
      upperIndex = index;
      break;
    }
  }

  if (upperIndex < 0) {
    return "heat-band-1";
  }

  const percentile = upperIndex / Math.max(1, sorted.length - 1);
  const bucketIndex = Math.min(7, Math.max(0, Math.floor(percentile * 8)));
  return `heat-band-${bucketIndex + 1}`;
}

export function getMetricBarPercent(
  value: number | null | undefined,
  pool: Array<number | null | undefined> = [],
  fallbackMax = 100,
) {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const numericPool = pool.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry) && entry > 0);
  const poolMax = numericPool.length > 0 ? Math.max(...numericPool) : null;
  const max = poolMax != null && poolMax > 0 ? poolMax : fallbackMax;
  if (!Number.isFinite(max) || max <= 0) {
    return 0;
  }

  return Math.max(10, Math.min(100, (value / max) * 100));
}
