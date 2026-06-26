import type { GameState, SponsorOffer, SponsorOfferComponent, SponsorStarTier } from "@/lib/data/olyDataTypes";
import { normalizeEconomyMoney, resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { PRIZE_MONEY_NORMALIZED_JSON_PATH } from "@/lib/season/prize-money-paths";

export const SPONSOR_COMPONENT_WEIGHTS = {
  base: 1.0,
  rank: 0.55,
  improvement: 0.45,
  special: 0.35,
} as const;

export const SPONSOR_PAYOUT_TARGET_MULT = 0.85;
export const SPONSOR_ECONOMY_MULT_MIN = 0.35;
export const SPONSOR_ECONOMY_MULT_MAX = 1.4;

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

let prizeMoneyByRankCache: Map<number, number> | null = null;

function loadPrizeMoneyByRank(): Map<number, number> {
  if (prizeMoneyByRankCache) {
    return prizeMoneyByRankCache;
  }
  try {
    // Lazy server read — keep node:fs out of the static client import graph.
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

export function getTypicalPayoutTarget(rank: number, salaryFactor = 1): number {
  return round1(getPrizeMoneyReference(rank, salaryFactor) * SPONSOR_PAYOUT_TARGET_MULT);
}

export function sumWeightedBlueprintComponentValue(input: {
  baseCash: number;
  rankCash: number;
  improvementCash: number;
  specialCash: number;
}): number {
  return (
    input.baseCash * SPONSOR_COMPONENT_WEIGHTS.base +
    input.rankCash * SPONSOR_COMPONENT_WEIGHTS.rank +
    input.improvementCash * SPONSOR_COMPONENT_WEIGHTS.improvement +
    input.specialCash * SPONSOR_COMPONENT_WEIGHTS.special
  );
}

export function getEconomyMultiplier(input: {
  rank: number;
  salaryFactor: number;
  starTier: SponsorStarTier;
  blueprintComponentSum: number;
  rewardMult: number;
}): number {
  const weightedBlueprint = input.blueprintComponentSum;
  if (weightedBlueprint <= 0 || input.rewardMult <= 0) {
    return input.salaryFactor;
  }
  const target = getTypicalPayoutTarget(input.rank, input.salaryFactor);
  const raw = target / (weightedBlueprint * input.rewardMult);
  return round1(clamp(raw, SPONSOR_ECONOMY_MULT_MIN, SPONSOR_ECONOMY_MULT_MAX));
}

export function getTeamNormalizedSalaryTotal(gameState: GameState, teamId: string): number {
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const total = gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .reduce((sum, entry) => {
      const player = playerById.get(entry.playerId) ?? null;
      const rawSalary = resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? 0;
      return sum + (normalizeEconomyMoney(rawSalary) ?? 0);
    }, 0);
  return round1(total);
}

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

function componentWeight(kind: SponsorOfferComponent["kind"]) {
  if (kind === "base") return SPONSOR_COMPONENT_WEIGHTS.base;
  if (kind === "rank") return SPONSOR_COMPONENT_WEIGHTS.rank;
  if (kind === "improvement") return SPONSOR_COMPONENT_WEIGHTS.improvement;
  return SPONSOR_COMPONENT_WEIGHTS.special;
}

export function estimateExpectedPayout(offer: SponsorOffer, powerRank: number | null): number {
  let expected = 0;
  for (const component of offer.components) {
    if (component.kind === "base") {
      expected += component.rewardCash;
      continue;
    }
    if (component.kind === "rank") {
      const target = typeof component.targetValue === "number" ? component.targetValue : 16;
      const rankEstimate = powerRank ?? target + 4;
      expected += component.rewardCash * getTieredRankPayoutFraction(rankEstimate, target);
      continue;
    }
    if (component.kind === "improvement") {
      expected += component.rewardCash * 0.3;
      continue;
    }
    expected += component.rewardCash * 0.15;
  }
  return round1(expected);
}

export function scaleSponsorComponentValue(
  kind: SponsorOfferComponent["kind"],
  value: number,
  rewardMult: number,
  economyMult: number,
): number {
  return round1(value * rewardMult * economyMult * componentWeight(kind));
}
