import type { GameState, SponsorArchetype, SponsorOffer, SponsorOfferComponent, SponsorStarTier } from "@/lib/data/olyDataTypes";
import { normalizeEconomyMoney, resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { PRIZE_MONEY_NORMALIZED_JSON_PATH } from "@/lib/season/prize-money-paths";

export const SPONSOR_BASE_FLOOR_C = 32;

/** Meilenstein-Kompression erst ab dieser Basis-Erhöhung über statischer Kalibrierung. */
export const SPONSOR_BASE_ELEVATION_COMPRESSION_THRESHOLD_C = 8;

export const SPONSOR_RANK_MILESTONES = [
  { maxRank: 28, bonusC: 7, label: "Top 28" },
  { maxRank: 24, bonusC: 5, label: "Top 24" },
  { maxRank: 20, bonusC: 6, label: "Top 20" },
  { maxRank: 16, bonusC: 8, label: "Top 16" },
  { maxRank: 12, bonusC: 6, label: "Top 12" },
  { maxRank: 8, bonusC: 12, label: "Top 8" },
  { maxRank: 4, bonusC: 10, label: "Top 4" },
  { maxRank: 1, bonusC: 9, label: "Meister" },
] as const;

export type SponsorRankMilestone = (typeof SPONSOR_RANK_MILESTONES)[number];

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

let prizeMoneyByRankCache: Map<number, number> | null = null;

function loadPrizeMoneyByRank(): Map<number, number> {
  if (prizeMoneyByRankCache) {
    return prizeMoneyByRankCache;
  }
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    const raw = JSON.parse(fs.readFileSync(PRIZE_MONEY_NORMALIZED_JSON_PATH, "utf8")) as {
      rows: Array<{ rank: number | null; prizeMoney: number | null }>;
    };
    prizeMoneyByRankCache = new Map(
      raw.rows
        .filter((row) => row.rank != null && row.prizeMoney != null)
        .map((row) => [row.rank as number, row.prizeMoney as number]),
    );
  } catch {
    prizeMoneyByRankCache = new Map();
  }
  return prizeMoneyByRankCache;
}

export function getPrizeMoneyReference(rank: number, salaryFactor = 1): number {
  const boundedRank = Math.min(32, Math.max(1, Math.round(rank)));
  const prize = loadPrizeMoneyByRank().get(boundedRank) ?? 0;
  return round1(prize * salaryFactor);
}

export function getArchetypeBaseShare(archetype: SponsorArchetype): number {
  if (archetype === "security") return 0.65;
  if (archetype === "identity") return 0.55;
  return 0.35;
}

export function getTotalMilestoneBonusC(salaryFactor = 1): number {
  return round1(SPONSOR_RANK_MILESTONES.reduce((sum, milestone) => sum + milestone.bonusC, 0) * salaryFactor);
}

export function getRankMilestoneBonus(finalRank: number | null | undefined, salaryFactor = 1): number {
  if (finalRank == null || !Number.isFinite(finalRank)) {
    return 0;
  }
  const boundedRank = Math.min(32, Math.max(1, Math.round(finalRank)));
  let total = 0;
  for (const milestone of SPONSOR_RANK_MILESTONES) {
    if (boundedRank <= milestone.maxRank) {
      total += milestone.bonusC;
    }
  }
  return round1(total * salaryFactor);
}

export function getUnlockedMilestones(finalRank: number | null | undefined): SponsorRankMilestone[] {
  if (finalRank == null || !Number.isFinite(finalRank)) {
    return [];
  }
  const boundedRank = Math.min(32, Math.max(1, Math.round(finalRank)));
  return SPONSOR_RANK_MILESTONES.filter((milestone) => boundedRank <= milestone.maxRank);
}

export function getSponsorPayoutForFinalRank(finalRank: number | null | undefined, salaryFactor = 1): number {
  const base = round1(SPONSOR_BASE_FLOOR_C * salaryFactor);
  const milestoneBonus = getRankMilestoneBonus(finalRank, salaryFactor);
  return round1(base + milestoneBonus);
}

export function getNextMilestoneRank(startRank: number | null | undefined): number {
  const rank = startRank ?? 32;
  const next = SPONSOR_RANK_MILESTONES.find((milestone) => milestone.maxRank < rank);
  return next?.maxRank ?? 1;
}

export function buildMilestoneRankLabel(): string {
  return SPONSOR_RANK_MILESTONES.map((milestone) => `${milestone.label} (+${milestone.bonusC} C)`).join(" · ");
}

export function getArchetypeRankShare(archetype: SponsorArchetype): number {
  return round1(1 - getArchetypeBaseShare(archetype));
}

export const SPONSOR_TIER_BASE_MULT: Record<SponsorStarTier, number> = {
  1: 0.9,
  2: 0.94,
  3: 0.97,
  4: 0.99,
  5: 1,
};

/** Low-star sponsors unlock far less of the Gewinnstufen ladder (big jumps 1★→5★). */
export const SPONSOR_TIER_MILESTONE_MULT: Record<SponsorStarTier, number> = {
  1: 0.28,
  2: 0.48,
  3: 0.66,
  4: 0.82,
  5: 1,
};

export function getStarTierBaseMultiplier(starTier: SponsorStarTier): number {
  return SPONSOR_TIER_BASE_MULT[starTier] ?? 1;
}

export function getStarTierMilestoneMultiplier(starTier: SponsorStarTier): number {
  return SPONSOR_TIER_MILESTONE_MULT[starTier] ?? 1;
}

export function getRewardMultiplierForTier(starTier: SponsorStarTier): number {
  return getStarTierMilestoneMultiplier(starTier);
}

export function getTeamDisplaySalaryTotal(gameState: GameState, teamId: string): number {
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const total = gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .reduce((sum, entry) => {
      const player = playerById.get(entry.playerId) ?? null;
      const contract = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      const salary = contract.expectedSalary ?? normalizeEconomyMoney(contract.salary) ?? 0;
      return sum + salary;
    }, 0);
  return round1(total);
}

export function getLeagueMinimumSalaryTotal(gameState: GameState): number {
  const overviewSalaries = buildTeamSeasonOverviewRows({ gameState })
    .map((row) => getTeamDisplaySalaryTotal(gameState, row.teamId))
    .filter((value) => value > 0);
  if (overviewSalaries.length === 0) {
    return SPONSOR_BASE_FLOOR_C;
  }
  return round1(Math.min(...overviewSalaries));
}

export type SponsorEconomyAnchors = {
  effectiveBaseFloor: number;
  milestonePool: number;
  milestoneScale: number;
};

export function resolveSponsorEconomyAnchors(salaryFactor: number, leagueMinSalary: number): SponsorEconomyAnchors {
  const scaledStaticFloor = round1(SPONSOR_BASE_FLOOR_C * salaryFactor);
  const scaledLeagueMin = round1(leagueMinSalary * salaryFactor);
  const effectiveBaseFloor = round1(Math.max(scaledStaticFloor, scaledLeagueMin));
  const fullMilestoneBonus = getTotalMilestoneBonusC(salaryFactor);
  const baseElevation = Math.max(0, effectiveBaseFloor - scaledStaticFloor);
  const elevationAboveThreshold = Math.max(0, baseElevation - SPONSOR_BASE_ELEVATION_COMPRESSION_THRESHOLD_C);
  const compressionFactor =
    elevationAboveThreshold <= 0 || fullMilestoneBonus <= 0
      ? 1
      : Math.max(0.12, 1 - elevationAboveThreshold / (fullMilestoneBonus + elevationAboveThreshold));
  const milestonePool = round1(fullMilestoneBonus * compressionFactor);
  const milestoneScale = fullMilestoneBonus > 0 ? milestonePool / fullMilestoneBonus : 0;
  return { effectiveBaseFloor, milestonePool, milestoneScale };
}

export function getScaledRankMilestoneBonus(
  finalRank: number | null | undefined,
  salaryFactor: number,
  leagueMinSalary: number,
): number {
  const { milestoneScale } = resolveSponsorEconomyAnchors(salaryFactor, leagueMinSalary);
  return round1(getRankMilestoneBonus(finalRank, salaryFactor) * milestoneScale);
}

export function getSponsorPayoutForFinalRankAndTier(
  finalRank: number | null | undefined,
  salaryFactor: number,
  starTier: SponsorStarTier,
  leagueMinSalary = SPONSOR_BASE_FLOOR_C,
  archetype: SponsorArchetype = "security",
): number {
  const { effectiveBaseFloor, milestoneScale } = resolveSponsorEconomyAnchors(salaryFactor, leagueMinSalary);
  const base =
    archetype === "security"
      ? round1(effectiveBaseFloor)
      : round1(effectiveBaseFloor * getStarTierBaseMultiplier(starTier));
  const milestoneBonus = round1(
    getRankMilestoneBonus(finalRank, salaryFactor) * milestoneScale * getStarTierMilestoneMultiplier(starTier),
  );
  return round1(base + milestoneBonus);
}

export function buildOfferCashAmounts(input: {
  archetype: SponsorArchetype;
  salaryFactor: number;
  starTier: SponsorStarTier;
  leagueMinSalary?: number;
}): { baseCash: number; rankCash: number; specialCash: number; totalAtMaxRank: number } {
  const leagueMinSalary = input.leagueMinSalary ?? SPONSOR_BASE_FLOOR_C;
  const { effectiveBaseFloor, milestonePool } = resolveSponsorEconomyAnchors(input.salaryFactor, leagueMinSalary);
  const baseMult = getStarTierBaseMultiplier(input.starTier);
  const milestoneMult = getStarTierMilestoneMultiplier(input.starTier);
  const floorTotal =
    input.archetype === "security"
      ? round1(effectiveBaseFloor)
      : round1(effectiveBaseFloor * baseMult);
  const milestoneTotal = round1(milestonePool * milestoneMult);
  const baseShare = getArchetypeBaseShare(input.archetype);
  const rankShare = getArchetypeRankShare(input.archetype);

  const baseCash =
    input.archetype === "security"
      ? floorTotal
      : round1(floorTotal * (baseShare / getArchetypeBaseShare("security")));
  const rankCash =
    input.archetype === "security"
      ? round1(milestoneTotal * rankShare)
      : round1(milestoneTotal * (rankShare / getArchetypeRankShare("performance")));
  const totalAtMaxRank = round1(
    getSponsorPayoutForFinalRankAndTier(1, input.salaryFactor, input.starTier, leagueMinSalary, input.archetype),
  );
  const specialCash = round1(totalAtMaxRank * 0.04);
  return { baseCash, rankCash, specialCash, totalAtMaxRank };
}

/** @deprecated Use getRankMilestoneBonus for Gewinnstufen settlement */
export function getTieredRankPayoutFraction(currentRank: number, target: number): number {
  if (currentRank <= target) {
    return 1;
  }
  if (currentRank <= target + 3) {
    return 0.5;
  }
  if (currentRank <= target + 6) {
    return 0.25;
  }
  return 0;
}

export function estimateExpectedPayout(
  offer: SponsorOffer,
  powerRank: number | null,
  leagueMinSalary?: number,
): number {
  const baseComponent = offer.components.find((component) => component.kind === "base");
  const starTier = offer.starTier ?? 2;
  const baseMult = getStarTierBaseMultiplier(starTier);
  const baseCash = baseComponent?.rewardCash ?? 0;
  const inferredFactor =
    baseMult > 0 && offer.archetype === "security"
      ? baseCash / (SPONSOR_BASE_FLOOR_C * baseMult)
      : baseMult > 0 && offer.archetype === "performance"
        ? baseCash / (SPONSOR_BASE_FLOOR_C * baseMult * (getArchetypeBaseShare("performance") / getArchetypeBaseShare("security")))
        : baseMult > 0
          ? baseCash / (SPONSOR_BASE_FLOOR_C * baseMult * (getArchetypeBaseShare("identity") / getArchetypeBaseShare("security")))
          : 1;
  const salaryFactor = inferredFactor > 0 ? inferredFactor : 1;
  const resolvedLeagueMin =
    leagueMinSalary ??
    (offer.archetype === "security"
      ? round1(baseCash / Math.max(0.01, getStarTierBaseMultiplier(starTier)))
      : SPONSOR_BASE_FLOOR_C * salaryFactor);
  const targetTotal = getSponsorPayoutForFinalRankAndTier(
    powerRank,
    salaryFactor,
    starTier,
    resolvedLeagueMin,
    offer.archetype,
  );
  let expected = round1(Math.max(baseCash, targetTotal));
  for (const component of offer.components) {
    if (component.kind === "improvement") {
      expected += component.rewardCash * 0.2;
    } else if (component.kind === "special") {
      expected += component.rewardCash * 0.12;
    }
  }
  return round1(expected);
}

export function estimateSettlementPayout(
  offer: SponsorOffer,
  finalRank: number | null,
  salaryFactor = 1,
): number {
  const baseComponent = offer.components.find((component) => component.kind === "base");
  const rankComponent = offer.components.find((component) => component.kind === "rank");
  const base = baseComponent?.rewardCash ?? 0;
  const rankCash = rankComponent?.rewardCash ?? 0;
  const totalMilestone = getTotalMilestoneBonusC(salaryFactor);
  const unlocked = getRankMilestoneBonus(finalRank, salaryFactor);
  const rankPayout = totalMilestone > 0 ? round1(rankCash * (unlocked / totalMilestone)) : 0;
  let extra = 0;
  for (const component of offer.components) {
    if (component.kind === "improvement" || component.kind === "special") {
      extra += component.rewardCash * (component.kind === "special" ? 0.12 : 0.2);
    }
  }
  return round1(base + rankPayout + extra);
}
