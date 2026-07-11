import type { GameState, Team, TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";

export type TeamDevelopmentTendency = {
  /** 0–1, soft weighting — no hard team allowlists */
  score: number;
  facilityUpgradeDiscountPct: number;
  trainingCenterBonusPct: number;
  /** 1.0–3.0 interpolated from score, not a binary gate */
  trainingFacilityTargetLevel: number;
  reasons: string[];
};

const DEVELOPMENT_ARCHETYPES = ["teacher", "mentor", "leader", "captain", "scholar", "tactician"];
const DEVELOPMENT_KEYWORDS = ["develop", "entwickl", "prospect", "youth", "train", "mentor", "lehrer", "teacher", "guenstig", "günstig", "schueler", "schüler"];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function includesAny(haystack: string, needles: string[]) {
  const normalized = haystack.toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

function countArchetypeMatches(profile: TeamStrategyProfile | null | undefined, tokens: string[]) {
  const pools = [
    ...(profile?.preferredArchetypes ?? []),
    ...(profile?.secondaryArchetypes ?? []),
    ...(profile?.preferredClasses ?? []),
  ];
  return pools.filter((entry) => tokens.some((token) => entry.toLowerCase().includes(token))).length;
}

/**
 * Soft development tendency from identity + strategy profile — not team shortCode gates.
 * High scores nudge facility discounts/objectives; low scores leave defaults mostly unchanged.
 */
export function getTeamDevelopmentTendency(input: {
  team: Team;
  identity?: TeamIdentity | null;
  profile?: TeamStrategyProfile | null;
}): TeamDevelopmentTendency {
  const profile = input.profile ?? null;
  const identity = input.identity ?? null;
  const reasons: string[] = [];
  let score = 0;

  const archetypeHits = countArchetypeMatches(profile, DEVELOPMENT_ARCHETYPES);
  if (archetypeHits > 0) {
    const bump = Math.min(0.28, 0.08 + archetypeHits * 0.05);
    score += bump;
    reasons.push("development_archetype_fit");
  }

  const summaryBlob = [
    profile?.strategySummary,
    profile?.buyStyle,
    profile?.rosterStyle,
    profile?.transferStyleNote,
    input.team.name,
  ]
    .filter(Boolean)
    .join(" ");
  if (includesAny(summaryBlob, DEVELOPMENT_KEYWORDS)) {
    score += 0.12;
    reasons.push("development_strategy_language");
  }

  const bias = profile?.bias;
  if (bias) {
    if (bias.valuePriority >= 6 && bias.starPriority <= 6) {
      score += 0.1;
      reasons.push("value_over_star_bias");
    }
    if (bias.rosterDepthPreference <= 4 && bias.eliteSmallRosterPreference >= 6) {
      score += 0.08;
      reasons.push("lean_roster_development");
    }
    if (bias.loyaltyBias >= 7 && bias.harmonyStrictness >= 7) {
      score += 0.08;
      reasons.push("mentor_culture_bias");
    }
    if (bias.cashPriority >= 6) {
      score += 0.06;
      reasons.push("fiscal_development_patience");
    }
  }

  if (profile?.prefersDepth === "high") {
    score += 0.06;
    reasons.push("prefers_depth_flag");
  }

  if (identity) {
    const axes = [identity.pow, identity.spe, identity.men, identity.soc].filter((value) => Number.isFinite(value));
    if (axes.length === 4) {
      const spread = Math.max(...axes) - Math.min(...axes);
      if (spread <= 3) {
        score += 0.1;
        reasons.push("balanced_identity_axes");
      }
    }
    if (identity.ambition >= 5 && identity.ambition <= 7) {
      score += 0.04;
      reasons.push("moderate_ambition_development_window");
    }
  }

  const normalizedScore = round(clamp(score, 0, 1), 3);
  return {
    score: normalizedScore,
    facilityUpgradeDiscountPct: round(normalizedScore * 10, 1),
    trainingCenterBonusPct: round(normalizedScore * 15, 1),
    trainingFacilityTargetLevel: round(1 + normalizedScore * 2, 1),
    reasons,
  };
}

export function getDevelopmentWeightedFacilityUpgradeDiscount(input: {
  baseUpgradeCost: number;
  facilityId: string;
  tendency: TeamDevelopmentTendency;
}) {
  if (input.baseUpgradeCost <= 0) return input.baseUpgradeCost;
  const facilityWeight =
    input.facilityId === "training_center" ? 1 :
      input.facilityId === "scouting_office" ? 0.75 :
        input.facilityId === "academy" ? 0.85 :
          0;
  const discountPct = input.tendency.facilityUpgradeDiscountPct * facilityWeight;
  if (discountPct <= 0) return input.baseUpgradeCost;
  return round(input.baseUpgradeCost * (1 - discountPct / 100), 2);
}

export function getTeamDevelopmentTrainingBonusPct(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) return 0;
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  const profile = getTeamStrategyProfile(gameState, teamId);
  return getTeamDevelopmentTendency({ team, identity, profile }).trainingCenterBonusPct;
}
