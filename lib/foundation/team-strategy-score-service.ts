import type { TeamIdentity, TeamStrategyBias, TeamStrategyProfile } from "@/lib/data/olyDataTypes";

export type TeamStrategyScoreKey =
  | "buyAggression"
  | "sellAggression"
  | "riskAppetite"
  | "starHunting"
  | "valueDiscipline"
  | "salaryDiscipline"
  | "cashReserveDiscipline"
  | "themeCommitment"
  | "harmonyProtection"
  | "loyaltyRetention"
  | "prospectDevelopment"
  | "depthPreference"
  | "smallElitePreference"
  | "overpayTolerance"
  | "shortContractBias"
  | "longContractBias"
  | "facilityInvestment"
  | "trainingAggression";

export type TeamStrategicArchetype =
  | "all_in_contender"
  | "opportunistic_risk_taker"
  | "small_elite"
  | "theme_guardian"
  | "salary_value_trader"
  | "profit_flipper"
  | "harmony_builder"
  | "development_rebuild"
  | "disciplined_balanced";

export type TeamStrategyScores = Record<TeamStrategyScoreKey, number> & {
  archetype: TeamStrategicArchetype;
  strongestSignals: string[];
  sourceSummary: string;
};

const neutralBias: TeamStrategyBias = {
  cashPriority: 5,
  valuePriority: 5,
  starPriority: 5,
  riskTolerance: 5,
  wageSensitivity: 5,
  sellForProfitAggression: 5,
  shortContractPreference: 5,
  longContractPreference: 5,
  loyaltyBias: 5,
  harmonyStrictness: 5,
  rosterDepthPreference: 5,
  eliteSmallRosterPreference: 5,
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toScore(value: number | null | undefined, fallback = 5) {
  const next = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return clampScore(next * 10);
}

function average(...values: number[]) {
  if (values.length === 0) return 50;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function axisSpecialization(identity: TeamIdentity | null | undefined) {
  if (!identity) return 50;
  const axes = [identity.pow, identity.spe, identity.men, identity.soc].filter((value) => Number.isFinite(value));
  if (axes.length === 0) return 50;
  const max = Math.max(...axes);
  const avg = axes.reduce((sum, value) => sum + value, 0) / axes.length;
  return clampScore(50 + (max - avg) * 7);
}

function hasThemeSignals(profile: TeamStrategyProfile | null | undefined) {
  if (!profile) return false;
  return (
    profile.preferredArchetypes.length +
      profile.preferredRaces.length +
      profile.preferredClasses.length +
      (profile.preferredTraits?.length ?? 0) +
      profile.hardNoGos.length >=
    4
  );
}

function profileMentions(profile: TeamStrategyProfile | null | undefined, needles: string[]) {
  const text = `${profile?.strategySummary ?? ""} ${profile?.buyStyle ?? ""} ${profile?.sellStyle ?? ""} ${profile?.contractStyle ?? ""} ${profile?.rosterStyle ?? ""}`.toLowerCase();
  return needles.some((needle) => text.includes(needle));
}

function strongestSignals(scores: Record<TeamStrategyScoreKey, number>) {
  return Object.entries(scores)
    .sort((left, right) => Math.abs(right[1] - 50) - Math.abs(left[1] - 50))
    .slice(0, 6)
    .map(([key, value]) => `${key}:${value}`);
}

function classify(scores: Record<TeamStrategyScoreKey, number>, profile: TeamStrategyProfile | null | undefined): TeamStrategicArchetype {
  if (scores.starHunting >= 82 && scores.riskAppetite >= 72) return "all_in_contender";
  if (scores.riskAppetite >= 85) return "opportunistic_risk_taker";
  if (scores.smallElitePreference >= 80) return "small_elite";
  if (scores.valueDiscipline >= 78 && scores.sellAggression >= 75) return "profit_flipper";
  if (scores.valueDiscipline >= 78 || profileMentions(profile, ["ratio", "salary value", "gehalt", "cash"])) return "salary_value_trader";
  if (scores.themeCommitment >= 78) return "theme_guardian";
  if (scores.harmonyProtection >= 78) return "harmony_builder";
  if (scores.prospectDevelopment >= 72 && scores.starHunting <= 62) return "development_rebuild";
  return "disciplined_balanced";
}

export function buildTeamStrategyScores(input: {
  identity?: TeamIdentity | null;
  profile?: TeamStrategyProfile | null;
}): TeamStrategyScores {
  const identity = input.identity ?? null;
  const profile = input.profile ?? null;
  const bias = { ...neutralBias, ...(profile?.bias ?? {}) };
  const ambition = toScore(identity?.ambition);
  const finances = toScore(identity?.finances);
  const boardConfidence = toScore(identity?.boardConfidence);
  const harmony = toScore(identity?.harmony);
  const manners = toScore(identity?.manners);
  const popularity = toScore(identity?.popularity);
  const cooperation = toScore(identity?.cooperation);
  const axisFocus = axisSpecialization(identity);
  const themeSignals = hasThemeSignals(profile) ? 18 : 0;
  const hardNoGoPressure = Math.min(18, (profile?.hardNoGos.length ?? 0) * 3);

  const scores: Record<TeamStrategyScoreKey, number> = {
    buyAggression: clampScore(average(ambition, toScore(bias.starPriority), toScore(bias.riskTolerance), 100 - toScore(bias.cashPriority))),
    sellAggression: clampScore(average(toScore(bias.sellForProfitAggression), 100 - toScore(bias.loyaltyBias), 100 - harmony, 100 - cooperation)),
    riskAppetite: clampScore(average(toScore(bias.riskTolerance), ambition, 100 - manners, 100 - boardConfidence * 0.35)),
    starHunting: clampScore(average(toScore(bias.starPriority), ambition, axisFocus, 100 - toScore(bias.wageSensitivity) * 0.25)),
    valueDiscipline: clampScore(average(toScore(bias.valuePriority), toScore(bias.wageSensitivity), finances, toScore(bias.cashPriority))),
    salaryDiscipline: clampScore(average(toScore(bias.wageSensitivity), toScore(bias.cashPriority), finances, 100 - toScore(bias.riskTolerance) * 0.2)),
    cashReserveDiscipline: clampScore(average(toScore(bias.cashPriority), finances, boardConfidence, 100 - ambition * 0.25)),
    themeCommitment: clampScore(average(axisFocus, toScore(bias.harmonyStrictness), harmony, manners) + themeSignals + hardNoGoPressure),
    harmonyProtection: clampScore(average(harmony, cooperation, manners, toScore(bias.harmonyStrictness))),
    loyaltyRetention: clampScore(average(toScore(bias.loyaltyBias), harmony, cooperation, toScore(bias.longContractPreference))),
    prospectDevelopment: clampScore(average(toScore(bias.valuePriority), toScore(bias.rosterDepthPreference), 100 - ambition * 0.2, finances)),
    depthPreference: clampScore(average(toScore(bias.rosterDepthPreference), cooperation, 100 - toScore(bias.eliteSmallRosterPreference) * 0.2)),
    smallElitePreference: clampScore(average(toScore(bias.eliteSmallRosterPreference), toScore(bias.starPriority), 100 - toScore(bias.rosterDepthPreference) * 0.25)),
    overpayTolerance: clampScore(average(toScore(bias.starPriority), toScore(bias.riskTolerance), ambition, 100 - toScore(bias.wageSensitivity) * 0.35)),
    shortContractBias: clampScore(average(toScore(bias.shortContractPreference), toScore(bias.sellForProfitAggression), 100 - toScore(bias.loyaltyBias) * 0.2)),
    longContractBias: clampScore(average(toScore(bias.longContractPreference), toScore(bias.loyaltyBias), harmony, 100 - toScore(bias.sellForProfitAggression) * 0.2)),
    facilityInvestment: clampScore(average(finances, boardConfidence, toScore(bias.cashPriority), 100 - toScore(bias.shortContractPreference) * 0.15)),
    trainingAggression: clampScore(average(ambition, toScore(bias.riskTolerance), 100 - harmony * 0.15, toScore(bias.rosterDepthPreference))),
  };

  const archetype = classify(scores, profile);
  return {
    ...scores,
    archetype,
    strongestSignals: strongestSignals(scores),
    sourceSummary: `identity=${identity?.teamId ?? "missing"};profile=${profile?.strategyVersion ?? "missing"};archetype=${archetype}`,
  };
}
