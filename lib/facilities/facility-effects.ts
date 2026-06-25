import type { GameState, PlayerGeneratorAttributeName, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import {
  FACILITY_CATALOG,
  FACILITY_CATALOG_BY_ID,
  getFacilityLevelDefinition,
  SPECIALIST_WING_VARIANTS,
  type FacilityId,
  type SpecialistWingVariant,
} from "@/lib/facilities/facility-catalog";
import { clampFacilityCondition, getFacilityEfficiencyPct } from "@/lib/facilities/facility-condition";
import type { PlayerProgressionRatingTier } from "@/lib/training/training-plan-types";

export type FacilityStateSource = GameState | { gameState: GameState };

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clampLevel(level: number | null | undefined) {
  if (typeof level !== "number" || !Number.isFinite(level)) {
    return 0;
  }
  return Math.max(0, Math.min(5, Math.round(level)));
}

function resolveGameState(source: FacilityStateSource) {
  return "gameState" in source ? source.gameState : source;
}

export function getTeamFacilityState(source: FacilityStateSource, teamId: string): TeamFacilityCollection {
  const gameState = resolveGameState(source);
  const stored = gameState.seasonState.teamFacilities?.[teamId]?.facilities ?? {};
  const facilities = Object.fromEntries(
    FACILITY_CATALOG.map((catalogEntry) => {
      const existing = stored[catalogEntry.facilityId];
      const level = clampLevel(existing?.level);
      return [
          catalogEntry.facilityId,
          {
            level,
            enabled: existing?.enabled ?? level > 0,
            conditionPct: clampFacilityCondition(existing?.conditionPct),
            activeVariant: existing?.activeVariant,
            lastPaidSeasonId: existing?.lastPaidSeasonId,
            disabledReason: existing?.disabledReason ?? (level > 0 ? undefined : "not_built"),
          },
      ];
    }),
  ) as TeamFacilityCollection["facilities"];

  return { facilities };
}

export function getFacilityLevel(teamFacilities: TeamFacilityCollection | null | undefined, facilityId: FacilityId) {
  const entry = teamFacilities?.facilities?.[facilityId];
  if (!entry?.enabled || clampFacilityCondition(entry.conditionPct) <= 0) {
    return 0;
  }
  return clampLevel(entry?.level);
}

export function getFacilityEfficiency(teamFacilities: TeamFacilityCollection | null | undefined, facilityId: FacilityId) {
  const entry = teamFacilities?.facilities?.[facilityId];
  const conditionPct = clampFacilityCondition(entry?.conditionPct);
  if (!entry?.enabled || clampLevel(entry?.level) <= 0) {
    return { conditionPct, efficiencyPct: 0 };
  }
  return {
    conditionPct,
    efficiencyPct: getFacilityEfficiencyPct(conditionPct),
  };
}

export function calculateFacilityUpkeep(teamFacilities: TeamFacilityCollection | null | undefined) {
  return roundValue(
    FACILITY_CATALOG.reduce((sum, facility) => {
      return sum + calculateFacilitySeasonUpkeep(facility.facilityId, teamFacilities);
    }, 0),
  );
}

export function calculateFacilityIncome(teamFacilities: TeamFacilityCollection | null | undefined) {
  return roundValue(
    FACILITY_CATALOG.reduce((sum, facility) => {
      const level = getFacilityLevel(teamFacilities, facility.facilityId);
      const efficiencyPct = getFacilityEfficiency(teamFacilities, facility.facilityId).efficiencyPct;
      return sum + ((getFacilityLevelDefinition(facility.facilityId, level)?.seasonIncome ?? 0) * efficiencyPct) / 100;
    }, 0),
  );
}

export function applyTrainingXpFacilityModifiers(
  baseTrainingXp: number,
  facilities: TeamFacilityCollection | null | undefined,
  options?: { developmentTrainingBonusPct?: number },
) {
  const level = getFacilityLevel(facilities, "training_center");
  const efficiencyPct = getFacilityEfficiency(facilities, "training_center").efficiencyPct;
  const modifierPct = roundValue(((getFacilityLevelDefinition("training_center", level)?.modifierPct ?? 0) * efficiencyPct) / 100);
  const developmentBonusPct = options?.developmentTrainingBonusPct ?? 0;
  const totalModifierPct = modifierPct + developmentBonusPct;
  return {
    before: baseTrainingXp,
    modifierPct: totalModifierPct,
    after: roundValue(baseTrainingXp * (1 + totalModifierPct / 100), 0),
  };
}

export function applyRecoveryFacilityModifiers(baseRecovery: number, facilities: TeamFacilityCollection | null | undefined) {
  const level = getFacilityLevel(facilities, "recovery_center");
  const efficiencyPct = getFacilityEfficiency(facilities, "recovery_center").efficiencyPct;
  const modifierPct = roundValue(((getFacilityLevelDefinition("recovery_center", level)?.modifierPct ?? 0) * efficiencyPct) / 100);
  return {
    before: baseRecovery,
    modifierPct,
    after: roundValue(baseRecovery * (1 + modifierPct / 100), 2),
  };
}

function getAcademyDiscountPct(ratingTier: PlayerProgressionRatingTier, facilities: TeamFacilityCollection | null | undefined) {
  if (ratingTier !== "F" && ratingTier !== "E" && ratingTier !== "D") {
    return 0;
  }
  const level = getFacilityLevel(facilities, "academy");
  const efficiencyPct = getFacilityEfficiency(facilities, "academy").efficiencyPct;
  return roundValue(((getFacilityLevelDefinition("academy", level)?.discountPct ?? 0) * efficiencyPct) / 100);
}

function normalizeSpecialistVariant(value: string | null | undefined): SpecialistWingVariant {
  return value && Object.prototype.hasOwnProperty.call(SPECIALIST_WING_VARIANTS, value)
    ? (value as SpecialistWingVariant)
    : "power_gym";
}

function getSpecialistDiscountPct(attribute: PlayerGeneratorAttributeName, facilities: TeamFacilityCollection | null | undefined) {
  const level = getFacilityLevel(facilities, "specialist_wing");
  const efficiencyPct = getFacilityEfficiency(facilities, "specialist_wing").efficiencyPct;
  const variant = normalizeSpecialistVariant(facilities?.facilities?.specialist_wing?.activeVariant);
  const matchesVariant = SPECIALIST_WING_VARIANTS[variant].attributes.includes(attribute);
  return matchesVariant ? roundValue(((getFacilityLevelDefinition("specialist_wing", level)?.discountPct ?? 0) * efficiencyPct) / 100) : 0;
}

export function getSpecialistWingUpkeepDiscountPct(facilities: TeamFacilityCollection | null | undefined) {
  const level = getFacilityLevel(facilities, "specialist_wing");
  const efficiencyPct = getFacilityEfficiency(facilities, "specialist_wing").efficiencyPct;
  return roundValue(((getFacilityLevelDefinition("specialist_wing", level)?.discountPct ?? 0) * efficiencyPct) / 100);
}

export function calculateFacilitySeasonUpkeep(
  facilityId: FacilityId,
  teamFacilities: TeamFacilityCollection | null | undefined,
) {
  const level = getFacilityLevel(teamFacilities, facilityId);
  const baseUpkeep = getFacilityLevelDefinition(facilityId, level)?.seasonUpkeep ?? 0;
  if (baseUpkeep <= 0) {
    return 0;
  }

  const specialistDiscountPct = getSpecialistWingUpkeepDiscountPct(teamFacilities);
  return roundValue(baseUpkeep * (1 - specialistDiscountPct / 100));
}

export function applyUpgradeCostFacilityModifiers(
  attribute: PlayerGeneratorAttributeName,
  ratingTier: PlayerProgressionRatingTier,
  baseCost: number,
  facilities: TeamFacilityCollection | null | undefined,
) {
  const academyDiscountPct = getAcademyDiscountPct(ratingTier, facilities);
  const specialistDiscountPct = getSpecialistDiscountPct(attribute, facilities);
  const facilityDiscountPct = academyDiscountPct + specialistDiscountPct;
  return {
    costBeforeFacility: baseCost,
    academyDiscountPct,
    specialistDiscountPct,
    facilityDiscountPct,
    costAfterFacility: Math.max(1, Math.ceil(baseCost * (1 - facilityDiscountPct / 100))),
    appliedEffects: [
      academyDiscountPct > 0 ? `academy_low_tier_discount:${academyDiscountPct}pct` : null,
      specialistDiscountPct > 0 ? `specialist_wing_discount:${specialistDiscountPct}pct` : null,
    ].filter((entry): entry is string => Boolean(entry)),
  };
}

export function getScoutingConfidence(facilities: TeamFacilityCollection | null | undefined) {
  const level = getFacilityLevel(facilities, "scouting_office");
  return {
    level,
    label: level === 0 ? "none" : FACILITY_CATALOG_BY_ID.scouting_office.levels[level - 1]?.effectDescription ?? "unknown",
  };
}

export function getAnalyticsForecastQuality(facilities: TeamFacilityCollection | null | undefined) {
  const level = getFacilityLevel(facilities, "analytics_room");
  return {
    level,
    label: level === 0 ? "baseline" : FACILITY_CATALOG_BY_ID.analytics_room.levels[level - 1]?.effectDescription ?? "unknown",
  };
}
