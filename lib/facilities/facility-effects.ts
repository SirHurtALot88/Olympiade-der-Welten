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

/**
 * Summiert die effektiven Saison-Einnahmen aller Gebäude (effizienzgewichtet).
 *
 * `arenaPopularityFactor` (Beliebtheit, Default 1.0 = Liga-Durchschnitt) skaliert
 * NUR die Arena (`arena_upgrade`) — der Fan-Shop bleibt bewusst flach. Der Default
 * 1.0 hält Aufrufer ohne Liga-Kontext (und Alt-Tests) auf der reinen Basis.
 * Reales Cash wird an der echten Season-End-Resolution (facility-season-end-service)
 * mit dem team-spezifischen Faktor gutgeschrieben.
 */
export function calculateFacilityIncome(
  teamFacilities: TeamFacilityCollection | null | undefined,
  options?: { arenaPopularityFactor?: number },
) {
  const arenaPopularityFactor =
    typeof options?.arenaPopularityFactor === "number" && Number.isFinite(options.arenaPopularityFactor)
      ? options.arenaPopularityFactor
      : 1;
  return roundValue(
    FACILITY_CATALOG.reduce((sum, facility) => {
      const level = getFacilityLevel(teamFacilities, facility.facilityId);
      const efficiencyPct = getFacilityEfficiency(teamFacilities, facility.facilityId).efficiencyPct;
      const popularityFactor = facility.facilityId === "arena_upgrade" ? arenaPopularityFactor : 1;
      return (
        sum +
        ((getFacilityLevelDefinition(facility.facilityId, level)?.seasonIncome ?? 0) * efficiencyPct * popularityFactor) /
          100
      );
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

/** Cumulative flat recovery bonus by REHA level (Basis 20 → L1=22, L2=24, L3=26, L4=29, L5=32 at 100% condition). */
export const RECOVERY_FLAT_BONUS_BY_LEVEL = [0, 3, 5, 7, 10, 13] as const;

export function getRecoveryFlatBonusAtLevel(level: number) {
  return RECOVERY_FLAT_BONUS_BY_LEVEL[clampLevel(level)] ?? 0;
}

export function getRecoveryFlatBonus(facilities: TeamFacilityCollection | null | undefined) {
  const level = getFacilityLevel(facilities, "recovery_center");
  const efficiencyPct = getFacilityEfficiency(facilities, "recovery_center").efficiencyPct;
  return roundValue(getRecoveryFlatBonusAtLevel(level) * (efficiencyPct / 100));
}

export function applyRecoveryFacilityModifiers(baseRecovery: number, facilities: TeamFacilityCollection | null | undefined) {
  const flatBonus = getRecoveryFlatBonus(facilities);
  const modifierPct =
    baseRecovery > 0 ? roundValue((flatBonus / baseRecovery) * 100) : flatBonus > 0 ? flatBonus * 5 : 0;
  return {
    before: baseRecovery,
    modifierPct,
    flatBonus,
    after: roundValue(baseRecovery + flatBonus, 2),
  };
}

/** Reduces season-end training fatigue load (on top of matchday fatigue) by REHA flat bonus vs basis 20. */
export function getRecoveryTrainingFatigueReductionPct(facilities: TeamFacilityCollection | null | undefined) {
  const flatBonus = getRecoveryFlatBonus(facilities);
  return roundValue((flatBonus / 20) * 100);
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
