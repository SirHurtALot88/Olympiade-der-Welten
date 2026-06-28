export const FATIGUE_PERFORMANCE_CAP = 80;
export const FATIGUE_PERFORMANCE_MAX_PENALTY_PERCENT = 25;

export const FATIGUE_INJURY_RISK_ANCHORS = [
  { fatigue: 0, riskPercent: 0 },
  { fatigue: 30, riskPercent: 5 },
  { fatigue: 50, riskPercent: 10 },
  { fatigue: 80, riskPercent: 25 },
  { fatigue: 100, riskPercent: 40 },
] as const;

export const injuryRiskBands = [
  { min: 0, max: 29, label: "none", uiLabel: "kein Risiko" },
  { min: 30, max: 49, label: "minimal", uiLabel: "minimales Verletzungsrisiko" },
  { min: 50, max: 69, label: "mittel", uiLabel: "mittleres Verletzungsrisiko" },
  { min: 70, max: 79, label: "stark", uiLabel: "starkes Verletzungsrisiko" },
  { min: 80, max: 100, label: "sehr_stark", uiLabel: "sehr starkes Verletzungsrisiko" },
] as const;

export type InjuryRiskBand = (typeof injuryRiskBands)[number] & {
  riskPercent: number;
};

function clampFatigue(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function getFatiguePerformancePenaltyPercent(fatigue: number | null | undefined) {
  const normalized = clampFatigue(fatigue);
  const uncapped = (normalized / FATIGUE_PERFORMANCE_CAP) * FATIGUE_PERFORMANCE_MAX_PENALTY_PERCENT;
  return roundValue(Math.min(FATIGUE_PERFORMANCE_MAX_PENALTY_PERCENT, uncapped), 2);
}

export function getFatiguePerformanceMultiplier(fatigue: number | null | undefined) {
  return roundValue(1 - getFatiguePerformancePenaltyPercent(fatigue) / 100, 4);
}

export function getInjuryRiskPercent(fatigue: number | null | undefined) {
  const normalized = clampFatigue(fatigue);
  for (let index = 0; index < FATIGUE_INJURY_RISK_ANCHORS.length - 1; index += 1) {
    const left = FATIGUE_INJURY_RISK_ANCHORS[index];
    const right = FATIGUE_INJURY_RISK_ANCHORS[index + 1];
    if (normalized < left.fatigue || normalized > right.fatigue) {
      continue;
    }
    if (right.fatigue === left.fatigue) {
      return right.riskPercent;
    }
    const progress = (normalized - left.fatigue) / (right.fatigue - left.fatigue);
    return roundValue(left.riskPercent + (right.riskPercent - left.riskPercent) * progress, 2);
  }
  return FATIGUE_INJURY_RISK_ANCHORS[FATIGUE_INJURY_RISK_ANCHORS.length - 1]?.riskPercent ?? 0;
}

export function getInjuryRiskBand(fatigue: number | null | undefined): InjuryRiskBand {
  const normalized = clampFatigue(fatigue);
  const band =
    injuryRiskBands.find((entry) => normalized >= entry.min && normalized <= entry.max) ?? injuryRiskBands[0];
  return {
    ...band,
    riskPercent: getInjuryRiskPercent(normalized),
  };
}

export function getFatigueRiskLevel(fatigue: number | null | undefined): "niedrig" | "mittel" | "hoch" {
  const normalized = clampFatigue(fatigue);
  if (normalized >= 65) {
    return "hoch";
  }
  if (normalized >= 40) {
    return "mittel";
  }
  return "niedrig";
}
