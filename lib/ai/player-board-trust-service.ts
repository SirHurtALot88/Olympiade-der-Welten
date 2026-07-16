export type PlayerBoardTrustMood = "happy" | "neutral" | "worried" | "critical";
export type PlayerBoardTrustRenewalPolicy = "normal" | "salary_cap" | "renewal_warning" | "do_not_renew";

export type PlayerBoardTrustInput = {
  boardConfidence: number | null;
  appearances: number;
  averageContribution: number | null;
  averageFinalScore: number | null;
  expectedPerformanceValue: number | null;
  contractLength: number | null;
  weakTeamFit: boolean;
  hardNoGoHit?: boolean;
  roleTag?: string | null;
  salary?: number | null;
  marketValue?: number | null;
  purchasePrice?: number | null;
  currentValue?: number | null;
  ovrRank?: number | null;
  actualPpsRank?: number | null;
  actualMvsRank?: number | null;
  expectedAxisRank?: number | null;
  actualAxisPpsRank?: number | null;
  rankPoolSize?: number | null;
};

export type PlayerBoardTrustAssessment = {
  trustScore: number;
  mood: PlayerBoardTrustMood;
  smiley: string;
  renewalPolicy: PlayerBoardTrustRenewalPolicy;
  salaryCapMultiplier: number | null;
  reasons: string[];
  warnings: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundValue(value: number, digits = 0) {
  return Number(value.toFixed(digits));
}

function getMood(score: number): PlayerBoardTrustMood {
  if (score >= 70) return "happy";
  if (score >= 48) return "neutral";
  if (score >= 30) return "worried";
  return "critical";
}

function getSmiley(mood: PlayerBoardTrustMood) {
  switch (mood) {
    case "happy":
      return ":)";
    case "neutral":
      return ":|";
    case "worried":
      return ":/";
    case "critical":
      return ">:(";
    default:
      return ":|";
  }
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getRoleExpectationWeight(roleTag: string | null | undefined) {
  const normalized = (roleTag ?? "").toLowerCase();
  if (normalized.includes("star") || normalized.includes("starter") || normalized.includes("core")) {
    return 1.25;
  }
  if (normalized.includes("bench") || normalized.includes("depth")) {
    return 0.8;
  }
  if (normalized.includes("prospect") || normalized.includes("youth")) {
    return 0.55;
  }
  return 1;
}

function getActualCompositeRank(input: PlayerBoardTrustInput) {
  const weightedRanks: Array<{ rank: number; weight: number }> = [];
  if (isFiniteNumber(input.actualPpsRank)) {
    weightedRanks.push({ rank: input.actualPpsRank, weight: 0.5 });
  }
  if (isFiniteNumber(input.actualMvsRank)) {
    weightedRanks.push({ rank: input.actualMvsRank, weight: 0.35 });
  }
  if (isFiniteNumber(input.actualAxisPpsRank)) {
    weightedRanks.push({ rank: input.actualAxisPpsRank, weight: 0.15 });
  }
  if (weightedRanks.length === 0) {
    return null;
  }

  const totalWeight = weightedRanks.reduce((sum, entry) => sum + entry.weight, 0);
  return weightedRanks.reduce((sum, entry) => sum + entry.rank * entry.weight, 0) / totalWeight;
}

function getExpectedCompositeRank(input: PlayerBoardTrustInput) {
  const weightedRanks: Array<{ rank: number; weight: number }> = [];
  if (isFiniteNumber(input.ovrRank)) {
    weightedRanks.push({ rank: input.ovrRank, weight: 0.65 });
  }
  if (isFiniteNumber(input.expectedAxisRank)) {
    weightedRanks.push({ rank: input.expectedAxisRank, weight: 0.35 });
  }
  if (weightedRanks.length === 0) {
    return null;
  }

  const totalWeight = weightedRanks.reduce((sum, entry) => sum + entry.weight, 0);
  return weightedRanks.reduce((sum, entry) => sum + entry.rank * entry.weight, 0) / totalWeight;
}

function getCostPressure(input: PlayerBoardTrustInput) {
  const salary = isFiniteNumber(input.salary) ? input.salary : 0;
  const marketValue = isFiniteNumber(input.marketValue) ? input.marketValue : 0;
  const purchasePrice = isFiniteNumber(input.purchasePrice) ? input.purchasePrice : 0;
  const salaryPressure = clamp(salary / 16, 0, 1);
  const valuePressure = clamp(Math.max(marketValue, purchasePrice) / 80, 0, 1);
  return clamp(salaryPressure * 0.45 + valuePressure * 0.55, 0, 1);
}

export function assessPlayerBoardTrust(input: PlayerBoardTrustInput): PlayerBoardTrustAssessment {
  const boardConfidence = input.boardConfidence != null && Number.isFinite(input.boardConfidence)
    ? clamp(input.boardConfidence, 0, 100)
    : 50;
  const expected = input.expectedPerformanceValue != null && Number.isFinite(input.expectedPerformanceValue)
    ? Math.max(input.expectedPerformanceValue, 1)
    : null;
  const actualScore = input.averageFinalScore ?? null;
  const expiring = (input.contractLength ?? 99) <= 1;
  const lowBoardConfidence = boardConfidence < 42;
  const expectedRank = getExpectedCompositeRank(input);
  const actualRank = getActualCompositeRank(input);
  const rankGap = expectedRank != null && actualRank != null ? actualRank - expectedRank : null;
  const hasScoreSample = input.appearances >= 3 && actualScore != null && expected != null;
  const hasRankSample = input.appearances >= 3 && rankGap != null;
  const hasSample = hasScoreSample || hasRankSample;
  const hasBroadRankContext = isFiniteNumber(input.rankPoolSize) && input.rankPoolSize >= 20;
  const rankMeetsExpectation = hasBroadRankContext && rankGap != null && rankGap <= 6;
  const scoreRatio = actualScore != null && expected != null ? clamp(actualScore / expected, 0, 1.4) : null;
  const performanceRatio = hasScoreSample && scoreRatio != null ? scoreRatio : 1;
  const earlyMissesExpectation =
    !hasScoreSample &&
    lowBoardConfidence &&
    expiring &&
    input.appearances > 0 &&
    scoreRatio != null &&
    scoreRatio < 0.62;
  const missesExpectation =
    (hasScoreSample && performanceRatio < 0.72 && !rankMeetsExpectation) || earlyMissesExpectation;
  const badlyMissesExpectation =
    (hasScoreSample && performanceRatio < 0.52 && !rankMeetsExpectation) || earlyMissesExpectation && (scoreRatio ?? 1) < 0.42;
  const softMissesExpectation =
    !missesExpectation &&
    lowBoardConfidence &&
    expiring &&
    ((hasScoreSample && performanceRatio < 0.9 && !rankMeetsExpectation) ||
      (!hasScoreSample && input.appearances > 0 && !hasBroadRankContext) ||
      input.appearances > 0);
  const roleExpectationWeight = getRoleExpectationWeight(input.roleTag);
  const meaningfulRankGap = hasRankSample && rankGap != null;
  const eliteCurrentProduction = [input.actualPpsRank, input.actualMvsRank, input.actualAxisPpsRank].some(
    (rank) => isFiniteNumber(rank) && rank <= 3,
  );
  const eliteExpectedProfile = [input.ovrRank, input.expectedAxisRank].some((rank) => isFiniteNumber(rank) && rank <= 3);
  const credibleEliteScore = scoreRatio == null || scoreRatio >= 0.6;
  const productiveElite =
    !input.hardNoGoHit &&
    hasBroadRankContext &&
    credibleEliteScore &&
    (eliteCurrentProduction || (eliteExpectedProfile && rankMeetsExpectation));
  const costPressure = getCostPressure(input);
  const expensivePlayer = costPressure >= 0.72;
  const valueLoss =
    isFiniteNumber(input.purchasePrice) && input.purchasePrice > 0 && isFiniteNumber(input.currentValue)
      ? (input.currentValue - input.purchasePrice) / input.purchasePrice
      : null;

  let trustScore = boardConfidence;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!hasSample) {
    reasons.push("board_trust_sample_too_small");
  }

  if (lowBoardConfidence) {
    trustScore -= 10;
    reasons.push("low_board_confidence");
  }
  if (missesExpectation || softMissesExpectation) {
    const penalty = (badlyMissesExpectation ? 24 : softMissesExpectation ? 7 : 14) * roleExpectationWeight;
    trustScore -= penalty;
    reasons.push("performance_below_board_expectation");
  }
  if (meaningfulRankGap && rankGap > 18) {
    const penalty = clamp((rankGap - 12) * 0.55, 6, 22) * roleExpectationWeight;
    trustScore -= penalty;
    reasons.push("actual_rank_below_expected_rank");
  } else if (meaningfulRankGap && rankGap < -8) {
    trustScore += clamp(Math.abs(rankGap) * 0.35, 3, 10);
    reasons.push("outperformed_expected_rank");
  }
  if (hasSample && expensivePlayer && (missesExpectation || (rankGap ?? 0) > 12)) {
    trustScore -= 8;
    reasons.push("expensive_player_underperformed");
  }
  if (hasSample && costPressure <= 0.35 && !badlyMissesExpectation && (rankGap == null || rankGap <= 16)) {
    trustScore += 5;
    reasons.push("cheap_player_value_patience");
  }
  if (hasSample && valueLoss != null && valueLoss < -0.25) {
    trustScore -= 5;
    reasons.push("market_value_loss_after_purchase");
  }
  if (input.appearances > 0 && input.appearances < 3) {
    const usagePenalty = input.roleTag?.toLowerCase().includes("starter") ? 4 : 0;
    trustScore -= usagePenalty;
    reasons.push("limited_usage_needs_review");
  }
  if (input.weakTeamFit) {
    trustScore -= 8;
    reasons.push("weak_team_fit");
  }
  if (input.hardNoGoHit) {
    trustScore -= 18;
    reasons.push("team_hard_no_go");
  }
  if (expiring && (missesExpectation || softMissesExpectation || input.weakTeamFit || input.hardNoGoHit)) {
    trustScore -= 10;
    reasons.push("expiring_contract_trust_review");
  }
  if (productiveElite) {
    const retentionFloor = input.weakTeamFit ? 32 : lowBoardConfidence ? 38 : 52;
    if (trustScore < retentionFloor) {
      trustScore = retentionFloor;
      reasons.push("elite_player_retention_floor");
    }
  }

  trustScore = roundValue(clamp(trustScore, 0, 100));
  const mood = getMood(trustScore);

  // Der harte "do_not_renew"-Tier wurde entfernt: das Board blockt keine Verlängerung
  // und erzwingt keine Verkäufe mehr. Verkauf/Entlassung liegt allein beim Team/GM.
  // Die weicheren Tiers bleiben rein informativ (kein Einfluss auf Sell-Priority).
  let renewalPolicy: PlayerBoardTrustRenewalPolicy = "normal";
  let salaryCapMultiplier: number | null = null;
  if (trustScore < 38 || (lowBoardConfidence && missesExpectation && expiring)) {
    renewalPolicy = "renewal_warning";
    salaryCapMultiplier = 0.7;
    warnings.push("board_warns_against_full_renewal");
  } else if (trustScore < 52 || (lowBoardConfidence && missesExpectation)) {
    renewalPolicy = "salary_cap";
    salaryCapMultiplier = 0.85;
    warnings.push("board_salary_cap_recommended");
  }

  return {
    trustScore,
    mood,
    smiley: getSmiley(mood),
    renewalPolicy,
    salaryCapMultiplier,
    reasons,
    warnings,
  };
}
