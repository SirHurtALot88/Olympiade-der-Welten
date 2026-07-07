import type { GameState, Player, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { getTransfermarktBracket, getTransfermarktBracketRange } from "@/lib/market/transfermarkt-fit";
import {
  buildTransfermarktSaleFactorBreakdown,
  getSaleFactorRankContext,
  hasCurrentSeasonSaleFactorRanking,
  isBracketRankPoolEligible,
} from "@/lib/market/transfermarkt-sale-factor";
import { teamHasCashBufferRebuildFocus } from "@/lib/ai/ai-team-cash-reserve-service";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function normalizeManagementValue(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0.5;
  const normalized = Number(value);
  if (normalized <= 10) return clamp(normalized / 10, 0, 1);
  return clamp(normalized / 100, 0, 1);
}

export type CompositeSellTeamProfile = "default" | "flip_shop" | "harmony" | "development";

const WEIGHTS: Record<
  CompositeSellTeamProfile,
  {
    profit: number;
    financial: number;
    bracketLag: number;
    depthReplace: number;
    contract: number;
    mwDecline: number;
    performanceKeep: number;
    lossResistance: number;
  }
> = {
  default: {
    profit: 38,
    financial: 14,
    bracketLag: 12,
    depthReplace: 8,
    contract: 6,
    mwDecline: 10,
    performanceKeep: 12,
    lossResistance: 12,
  },
  flip_shop: {
    profit: 48,
    financial: 14,
    bracketLag: 12,
    depthReplace: 8,
    contract: 6,
    mwDecline: 4,
    performanceKeep: 4.2,
    lossResistance: 12,
  },
  harmony: {
    profit: 30,
    financial: 14,
    bracketLag: 12,
    depthReplace: 8,
    contract: 6,
    mwDecline: 10,
    performanceKeep: 13.8,
    lossResistance: 12,
  },
  development: {
    profit: 28,
    financial: 14,
    bracketLag: 12,
    depthReplace: 8,
    contract: 6,
    mwDecline: 12,
    performanceKeep: 12,
    lossResistance: 12,
  },
};

const BASE_THRESHOLD: Record<CompositeSellTeamProfile, number> = {
  default: 30,
  flip_shop: 22,
  harmony: 30,
  development: 30,
};

export function resolveCompositeSellTeamProfile(
  teamId: string,
  sellForProfitAggression: number | null | undefined,
): CompositeSellTeamProfile {
  if (teamId === "C-C" || (sellForProfitAggression ?? 0) >= 8) return "flip_shop";
  if (teamId === "T-T") return "development";
  if (teamId === "M-S") return "harmony";
  return "default";
}

export function getBracketMedianMarketValue(gameState: GameState, bracket: number, saveId?: string | null) {
  const rankContext = getSaleFactorRankContext(gameState, saveId);
  const group = rankContext.groupedCandidates.get(bracket) ?? [];
  if (isBracketRankPoolEligible(group.length)) {
    const values = group.map((entry) => entry.baseMarketValue).sort((left, right) => left - right);
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 1 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2;
  }
  const range = getTransfermarktBracketRange(bracket);
  return range.max != null ? (range.min + range.max) / 2 : range.min + 5;
}

export type CompositeSellScoreInput = {
  teamId: string;
  team: Team;
  identity: TeamIdentity | null;
  player: Player;
  roster: RosterEntry;
  gameState: GameState;
  saveId?: string | null;
  expectedSellValue: number | null;
  marketValue: number | null;
  salary: number | null;
  teamCash: number;
  teamSalaryTotal: number;
  cashPressureScore: number;
  explanation?: string;
  sellForProfitAggression?: number | null;
};

export type CompositeSellScoreResult = {
  total: number;
  threshold: number;
  teamProfile: CompositeSellTeamProfile;
  components: {
    profit: number;
    financial: number;
    bracketLag: number;
    depthReplace: number;
    contract: number;
    mwDecline: number;
    performanceKeep: number;
    boardCohesionKeep: number;
    lossResistance: number;
  };
};

export function resolveEffectiveSellThreshold(input: {
  teamProfile: CompositeSellTeamProfile;
  cashPressureScore: number;
}) {
  const base = BASE_THRESHOLD[input.teamProfile];
  const floor = input.teamProfile === "flip_shop" ? 18 : 22;
  return Math.max(floor, base - Math.round(input.cashPressureScore * 8));
}

export function computeCompositeSellScore(input: CompositeSellScoreInput): CompositeSellScoreResult {
  const teamProfile = resolveCompositeSellTeamProfile(input.teamId, input.sellForProfitAggression);
  const weights = WEIGHTS[teamProfile];
  const purchasePrice = input.roster.purchasePrice ?? null;
  const currentMw = input.marketValue;
  const expectedSell = input.expectedSellValue;

  const profitAbsolute =
    expectedSell != null && purchasePrice != null
      ? expectedSell - purchasePrice
      : expectedSell != null && currentMw != null
        ? expectedSell - currentMw
        : null;
  const profitRatio =
    profitAbsolute != null && purchasePrice != null && purchasePrice > 0
      ? profitAbsolute / purchasePrice
      : profitAbsolute != null && currentMw != null && currentMw > 0
        ? profitAbsolute / currentMw
        : null;
  const ratioPart = profitRatio != null && profitRatio > 0 ? clamp01(profitRatio / 0.35) : 0;
  const absPart =
    profitAbsolute != null && profitAbsolute > 0
      ? clamp01(profitAbsolute / Math.max(6, input.teamCash * 0.55))
      : 0;
  const profit = round(
    clamp01(ratioPart * 0.55 + absPart * 0.45) * (1 + input.cashPressureScore * 0.35) * weights.profit +
      (teamHasCashBufferRebuildFocus(input.gameState, input.teamId) ? 8 : 0),
  );

  const cashPressure = clamp01(
    input.teamCash < 0 ? 1 : input.teamSalaryTotal > 0 ? input.teamSalaryTotal / Math.max(input.teamCash, 1) / 3 : 0,
  );
  const wageShare = input.salary != null && input.teamSalaryTotal > 0 ? input.salary / input.teamSalaryTotal : 0;
  const financial = round(clamp01(cashPressure * 0.7 + wageShare * 0.3) * weights.financial);

  const breakdown = buildTransfermarktSaleFactorBreakdown(input.gameState, input.player, input.roster, {
    saveId: input.saveId,
  });
  const pool = breakdown.bracketGroupSize;
  const poolEligible = isBracketRankPoolEligible(pool) && hasCurrentSeasonSaleFactorRanking(input.gameState, input.saveId);
  const rank = breakdown.rankInBracket;
  const bracketLag =
    poolEligible && rank != null && pool > 1 ? clamp01((rank - 1) / (pool - 1)) * weights.bracketLag : 0;

  const bracket = breakdown.bracket ?? getTransfermarktBracket(currentMw);
  const depthReplace = round((bracket <= 3 ? 1 : bracket === 4 ? 0.5 : 0) * weights.depthReplace);

  const contractYears = input.roster.contractLength;
  const contractBase = contractYears <= 1 ? 0.8 : contractYears === 2 ? 0.45 : 0.12;
  const contract = round(contractBase * weights.contract + (teamProfile === "flip_shop" && contractYears <= 1 ? 8 : 0));

  const absoluteLoss =
    purchasePrice != null && currentMw != null ? Math.max(0, purchasePrice - currentMw) : 0;
  const relativeLoss = purchasePrice != null && purchasePrice > 0 ? absoluteLoss / purchasePrice : 0;
  const bracketScale = Math.max(6, getBracketMedianMarketValue(input.gameState, bracket, input.saveId) * 0.15);
  const absolutePart = clamp01(absoluteLoss / bracketScale);
  const relativePart = clamp01(relativeLoss / 0.35);
  const mwDeclineSell = clamp01(0.3 * relativePart + 0.7 * absolutePart);
  const mwDecline = round(mwDeclineSell * weights.mwDecline);

  const harmonyScore = normalizeManagementValue(input.identity?.harmony);
  const explanation = input.explanation ?? "";
  const identityLoyalty = ["Bindet", "Loyal", "Mentor"].some((token) => explanation.includes(token)) ? 0.85 : 0.35;
  const topQuartile = poolEligible && rank != null && pool >= 4 && rank <= Math.ceil(pool * 0.25);
  const keepMultiplier = teamProfile === "flip_shop" ? 0.35 : teamProfile === "harmony" ? 1.15 : 1;
  const performanceKeep = topQuartile
    ? -round(0.6 * (0.4 + harmonyScore * 0.35 + identityLoyalty * 0.25) * weights.performanceKeep * keepMultiplier)
    : 0;

  const boardConfidence = normalizeManagementValue(input.identity?.boardConfidence);
  const boardCohesionKeep =
    boardConfidence >= 0.65
      ? -round((boardConfidence - 0.55) * weights.performanceKeep * 1.35 * keepMultiplier)
      : 0;

  // Realized loss vs. purchase price (expectedSell is already the NET proceeds, i.e. after buyout).
  // This used to cap out at a small, *fixed* malus for the worst cases (bottom-tercile / big MW
  // decline) instead of scaling up with them — meaning the sales that lose the most cash were the
  // *least* resisted. Fixed so the malus always scales with the realized loss magnitude, and a hard
  // gate on top blocks/heavily suppresses big-cash losses unless the team is in genuine cash need.
  const sellBelowPurchase =
    purchasePrice != null && expectedSell != null && expectedSell < purchasePrice;
  const realizedLossAbs = profitAbsolute != null && profitAbsolute < 0 ? -profitAbsolute : 0;
  const realizedLossRatio = profitRatio != null && profitRatio < 0 ? -profitRatio : 0;
  const lossMagnitude = clamp01(realizedLossRatio);
  const baseLossResistance = sellBelowPurchase ? -(0.3 + lossMagnitude * 1.7) * weights.lossResistance : 0;

  const HARD_LOSS_RELATIVE_THRESHOLD = 0.3;
  const HARD_LOSS_ABSOLUTE_FLOOR_C = 5;
  const isCashEmergency = input.cashPressureScore >= 0.45;
  const hardLossGateActive =
    sellBelowPurchase &&
    realizedLossRatio > HARD_LOSS_RELATIVE_THRESHOLD &&
    realizedLossAbs >= HARD_LOSS_ABSOLUTE_FLOOR_C &&
    !isCashEmergency;
  const lossResistance = round(hardLossGateActive ? baseLossResistance - 25 : baseLossResistance);

  const total = round(
    clamp(
      profit + financial + bracketLag + depthReplace + contract + mwDecline + performanceKeep + boardCohesionKeep + lossResistance,
      0,
      100,
    ),
  );

  return {
    total,
    threshold: resolveEffectiveSellThreshold({
      teamProfile,
      cashPressureScore: input.cashPressureScore,
    }),
    teamProfile,
    components: {
      profit,
      financial,
      bracketLag: round(bracketLag),
      depthReplace,
      contract,
      mwDecline,
      performanceKeep,
      boardCohesionKeep: round(boardCohesionKeep),
      lossResistance,
    },
  };
}

export function selectCompositeSellCandidates<T extends { expectedSellValue?: number | null; salary?: number | null }>(
  input: {
    candidates: Array<{ candidate: T; score: number }>;
    teamCash: number;
    teamSalaryTotal: number;
    cashPressureScore: number;
    teamProfile: CompositeSellTeamProfile;
    /** When true (season_end sell pass), keep taking profit-sell candidates even after cash pressure is resolved. */
    allowProfitSellsBelowMin?: boolean;
    /** Block sells that would drop the roster below hardMin unless cash emergency. */
    hardMin?: number;
    rosterCount?: number;
  },
): T[] {
  const sorted = [...input.candidates].sort((left, right) => right.score - left.score);
  if (sorted.length === 0) return [];
  if (input.teamProfile === "flip_shop") {
    return sorted.map((entry) => entry.candidate);
  }

  let projectedCash = input.teamCash;
  let projectedSalary = input.teamSalaryTotal;
  let projectedRoster = input.rosterCount ?? Number.POSITIVE_INFINITY;
  const hardMin = input.hardMin;
  const isCashEmergency = input.cashPressureScore >= 0.45;
  const selected: T[] = [];

  const isCashPressureResolved = () => {
    if (projectedCash < 0) return false;
    if (input.cashPressureScore >= 0.45) {
      return projectedCash >= Math.max(8, projectedSalary * 0.18);
    }
    if (input.cashPressureScore >= 0.35) {
      return projectedCash >= projectedSalary * 0.25;
    }
    return true;
  };

  for (const entry of sorted) {
    if (
      hardMin != null &&
      Number.isFinite(projectedRoster) &&
      projectedRoster - 1 < hardMin &&
      !isCashEmergency
    ) {
      continue;
    }
    if (selected.length > 0 && isCashPressureResolved() && !input.allowProfitSellsBelowMin) {
      break;
    }
    selected.push(entry.candidate);
    projectedCash += entry.candidate.expectedSellValue ?? 0;
    projectedSalary = Math.max(0, projectedSalary - (entry.candidate.salary ?? 0));
    if (Number.isFinite(projectedRoster)) {
      projectedRoster -= 1;
    }
  }

  return selected;
}
