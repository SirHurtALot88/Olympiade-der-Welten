export type PlayerProgressHistoryRow = {
  seasonId: string | null;
  seasonName: string;
  isActiveSeason: boolean;
  ovr: number | null;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
};

export type PlayerProgressMetricId = "ovr" | "pow" | "spe" | "men" | "soc";

export type PlayerProgressMetricSummary = {
  id: PlayerProgressMetricId;
  label: string;
  firstValue: number | null;
  lastValue: number | null;
  delta: number | null;
  tone: "positive" | "negative" | "neutral";
};

export type PlayerProgressSummary = {
  firstSeasonName: string;
  lastSeasonName: string;
  lastSeasonIsLive: boolean;
  metrics: PlayerProgressMetricSummary[];
  axisSumDelta: number | null;
  axisSumTone: "positive" | "negative" | "neutral";
};

const METRIC_DEFINITIONS: Array<{ id: PlayerProgressMetricId; label: string }> = [
  { id: "ovr", label: "OVR" },
  { id: "pow", label: "POW" },
  { id: "spe", label: "SPE" },
  { id: "men", label: "MEN" },
  { id: "soc", label: "SOC" },
];

const AXIS_METRIC_IDS: PlayerProgressMetricId[] = ["pow", "spe", "men", "soc"];

function sortHistoryRows<T extends PlayerProgressHistoryRow>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    const leftKey = left.seasonId ?? left.seasonName;
    const rightKey = right.seasonId ?? right.seasonName;
    return leftKey.localeCompare(rightKey, "de", { numeric: true });
  });
}

function resolveDeltaTone(delta: number | null): PlayerProgressMetricSummary["tone"] {
  if (delta == null || !Number.isFinite(delta) || delta === 0) {
    return "neutral";
  }
  return delta > 0 ? "positive" : "negative";
}

function computeDelta(firstValue: number | null, lastValue: number | null) {
  if (firstValue == null || lastValue == null || !Number.isFinite(firstValue) || !Number.isFinite(lastValue)) {
    return null;
  }
  return Number((lastValue - firstValue).toFixed(1));
}

export function formatProgressDelta(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const formatted = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
    signDisplay: "exceptZero",
  }).format(value);
  return formatted;
}

export function buildPlayerProgressSummary<T extends PlayerProgressHistoryRow>(rows: T[]): PlayerProgressSummary | null {
  const sortedRows = sortHistoryRows(rows);
  if (sortedRows.length === 0) {
    return null;
  }

  const firstRow = sortedRows[0];
  const lastRow = sortedRows[sortedRows.length - 1];

  const metrics = METRIC_DEFINITIONS.map(({ id, label }) => {
    const firstValue = firstRow[id];
    const lastValue = lastRow[id];
    const delta = computeDelta(firstValue, lastValue);
    return {
      id,
      label,
      firstValue: firstValue != null && Number.isFinite(firstValue) ? firstValue : null,
      lastValue: lastValue != null && Number.isFinite(lastValue) ? lastValue : null,
      delta,
      tone: resolveDeltaTone(delta),
    };
  });

  const axisDeltas = metrics
    .filter((metric) => AXIS_METRIC_IDS.includes(metric.id))
    .map((metric) => metric.delta)
    .filter((delta): delta is number => delta != null && Number.isFinite(delta));

  const axisSumDelta =
    axisDeltas.length === AXIS_METRIC_IDS.length
      ? Number(axisDeltas.reduce((total, delta) => total + delta, 0).toFixed(1))
      : null;

  return {
    firstSeasonName: firstRow.seasonName,
    lastSeasonName: lastRow.seasonName,
    lastSeasonIsLive: lastRow.isActiveSeason,
    metrics,
    axisSumDelta,
    axisSumTone: resolveDeltaTone(axisSumDelta),
  };
}

export function sortPlayerProgressHistoryRows<T extends PlayerProgressHistoryRow>(rows: T[]): T[] {
  return sortHistoryRows(rows);
}

export const PLAYER_PROGRESS_METRIC_DEFINITIONS = METRIC_DEFINITIONS;
