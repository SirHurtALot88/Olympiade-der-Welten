import type { Player } from "@/lib/data/olyDataTypes";

export type PlayerPotentialBand = "unknown" | "low" | "solid" | "high" | "elite" | "generational";
export type PlayerPotentialCertainty = "missing_source" | "low" | "medium" | "high";

export type PlayerScoutPotential = {
  scoutRating: number | null;
  potentialRange: { min: number; max: number } | null;
  starRating: string;
  band: PlayerPotentialBand;
  certainty: PlayerPotentialCertainty;
  trainingSpeedMultiplier: number;
  marketValuePotentialPremiumPct: number;
  salaryExpectationPremiumPct: number;
  ceilingMode: "soft_range_no_hard_ceiling";
  reasons: string[];
  warnings: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundValue(value: number, digits = 0) {
  return Number(value.toFixed(digits));
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getScoutingUncertainty(level: number | null | undefined) {
  if (!isFiniteNumber(level) || level <= 0) return 12;
  if (level >= 5) return 3;
  if (level >= 4) return 4;
  if (level >= 3) return 6;
  if (level >= 2) return 8;
  return 10;
}

function getCertainty(level: number | null | undefined): PlayerPotentialCertainty {
  if (!isFiniteNumber(level) || level <= 0) return "low";
  if (level >= 4) return "high";
  if (level >= 2) return "medium";
  return "low";
}

function getPotentialBand(potential: number): PlayerPotentialBand {
  if (potential >= 94) return "generational";
  if (potential >= 88) return "elite";
  if (potential >= 78) return "high";
  if (potential >= 62) return "solid";
  return "low";
}

function getStarRating(potential: number) {
  if (potential >= 94) return "5.0 Sterne";
  if (potential >= 88) return "4.5 Sterne";
  if (potential >= 80) return "4.0 Sterne";
  if (potential >= 72) return "3.5 Sterne";
  if (potential >= 64) return "3.0 Sterne";
  if (potential >= 56) return "2.5 Sterne";
  return "2.0 Sterne";
}

function getTrainingSpeedMultiplier(potential: number) {
  if (potential >= 94) return 1.18;
  if (potential >= 88) return 1.14;
  if (potential >= 80) return 1.09;
  if (potential >= 72) return 1.04;
  if (potential >= 58) return 1;
  return 0.94;
}

function getMarketValuePotentialPremiumPct(potential: number) {
  if (potential >= 94) return 22;
  if (potential >= 88) return 16;
  if (potential >= 80) return 10;
  if (potential >= 72) return 5;
  if (potential >= 58) return 0;
  return -4;
}

export function buildPlayerScoutPotential(input: {
  player: Pick<Player, "potential">;
  scoutingLevel?: number | null;
}): PlayerScoutPotential {
  if (!isFiniteNumber(input.player.potential) || input.player.potential <= 0) {
    return {
      scoutRating: null,
      potentialRange: null,
      starRating: "-",
      band: "unknown",
      certainty: "missing_source",
      trainingSpeedMultiplier: 1,
      marketValuePotentialPremiumPct: 0,
      salaryExpectationPremiumPct: 0,
      ceilingMode: "soft_range_no_hard_ceiling",
      reasons: ["potential_source_missing"],
      warnings: ["potential_source_missing"],
    };
  }

  const scoutRating = roundValue(clamp(input.player.potential, 1, 99), 0);
  const uncertainty = getScoutingUncertainty(input.scoutingLevel);
  const band = getPotentialBand(scoutRating);
  const trainingSpeedMultiplier = getTrainingSpeedMultiplier(scoutRating);
  const marketValuePotentialPremiumPct = getMarketValuePotentialPremiumPct(scoutRating);
  const reasons = ["soft_potential_range_no_hard_ceiling"];
  if (band === "generational" || band === "elite") reasons.push("high_potential_training_acceleration");
  if (band === "high") reasons.push("above_average_potential");
  if (band === "low") reasons.push("limited_scouted_upside");
  if (trainingSpeedMultiplier !== 1) reasons.push("potential_training_speed_modifier");
  if (marketValuePotentialPremiumPct > 0) reasons.push("market_value_potential_premium_preview");
  if (uncertainty >= 10) reasons.push("wide_scouting_range");

  return {
    scoutRating,
    potentialRange: {
      min: roundValue(clamp(scoutRating - uncertainty, 35, 99), 0),
      max: roundValue(clamp(scoutRating + uncertainty, 35, 99), 0),
    },
    starRating: getStarRating(scoutRating),
    band,
    certainty: getCertainty(input.scoutingLevel),
    trainingSpeedMultiplier,
    marketValuePotentialPremiumPct,
    salaryExpectationPremiumPct: roundValue(marketValuePotentialPremiumPct * 0.5, 1),
    ceilingMode: "soft_range_no_hard_ceiling",
    reasons,
    warnings: uncertainty >= 10 ? ["potential_range_uncertain"] : [],
  };
}
