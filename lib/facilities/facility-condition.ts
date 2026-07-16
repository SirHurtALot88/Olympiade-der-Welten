import { getFacilityLevelDefinition, type FacilityId } from "@/lib/facilities/facility-catalog";

export const FACILITY_CONDITION_FULL = 100;
export const FACILITY_CONDITION_WARNING = 70;
export const FACILITY_SEASON_DECAY_PAID = 8;
export const FACILITY_SEASON_DECAY_UNPAID = 22;

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function clampFacilityCondition(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return FACILITY_CONDITION_FULL;
  }
  return Math.max(0, Math.min(FACILITY_CONDITION_FULL, roundValue(value)));
}

export function getFacilityEfficiencyPct(conditionPct: number | null | undefined) {
  const condition = clampFacilityCondition(conditionPct);
  if (condition >= FACILITY_CONDITION_WARNING) {
    return FACILITY_CONDITION_FULL;
  }
  return roundValue((condition / FACILITY_CONDITION_WARNING) * FACILITY_CONDITION_FULL);
}

export function getFacilityConditionStatus(conditionPct: number | null | undefined) {
  const condition = clampFacilityCondition(conditionPct);
  if (condition <= 0) return "broken" as const;
  if (condition < 40) return "critical" as const;
  if (condition < FACILITY_CONDITION_WARNING) return "worn" as const;
  if (condition < 90) return "aging" as const;
  return "good" as const;
}

export function calculateFacilityMaintenanceCost(input: {
  facilityId: FacilityId;
  level: number;
  conditionPct: number;
}) {
  if (input.level <= 0 || input.conditionPct >= FACILITY_CONDITION_FULL) {
    return 0;
  }
  const definition = getFacilityLevelDefinition(input.facilityId, input.level);
  const missingConditionShare = (FACILITY_CONDITION_FULL - clampFacilityCondition(input.conditionPct)) / 100;
  const costBase = Math.max(definition?.upgradeCost ?? 0, definition?.seasonUpkeep ?? 0);
  return roundValue(Math.max(1, costBase * missingConditionShare * 0.45));
}

export function degradeFacilityCondition(conditionPct: number | null | undefined, paid: boolean) {
  const decay = paid ? FACILITY_SEASON_DECAY_PAID : FACILITY_SEASON_DECAY_UNPAID;
  return clampFacilityCondition(clampFacilityCondition(conditionPct) - decay);
}
