import {
  buildAiTransfermarktPreview,
  type AiTransferPreviewParams,
  type AiTransferPreviewRecommendation,
  type AiTransferPreviewResult,
  type AiTransferPreviewSource,
  type AiTransferPreviewTeamEntry,
} from "@/lib/ai/ai-transfermarkt-preview-service";
import {
  buildAiTransfermarktSellPreview,
  type AiSellPreviewCandidate,
  type AiSellPreviewResult,
  type AiSellPreviewTeamEntry,
} from "@/lib/ai/ai-transfermarkt-sell-preview-service";
import type { TeamControlMode } from "@/lib/data/olyDataTypes";

export type AiMarketPlanPreviewSource = AiTransferPreviewSource;
export type AiMarketPlanPreviewTeamScope = "ai" | "all";
export type AiMarketPlanPreviewStatus = "hold" | "buy_only" | "sell_only" | "sell_then_buy" | "warning" | "blocked";

export type AiMarketPlanPreviewParams = {
  source?: AiMarketPlanPreviewSource;
  saveId?: string | null;
  seasonId?: string | null;
  teamId?: string | null;
  teamScope?: AiMarketPlanPreviewTeamScope;
  buyLimit?: number | null;
  sellLimit?: number | null;
  fullScoringLimit?: number | null;
  buyNeedOnly?: boolean | null;
  forceBuyScanTeamIds?: string[] | null;
};

export type AiMarketPlanCurrentState = {
  cash: number | null;
  rosterCount: number | null;
  playerMin: number | null;
  playerOpt: number | null;
  salaryTotal: number | null;
  marketValueTotal: number | null;
};

export type AiMarketPlanSellPlan = {
  candidates: AiSellPreviewCandidate[];
  totalExpectedSellValue: number | null;
  salaryFreed: number | null;
  expectedSellValue: number | null;
  rosterAfterSell: number | null;
  warnings: string[];
};

export type AiMarketPlanBuyPlan = {
  candidates: AiTransferPreviewRecommendation[];
  plannedSpend: number | null;
  plannedSalaryAdded: number | null;
  rosterAfterBuy: number | null;
  warnings: string[];
};

export type AiMarketPlanProjectedState = {
  cashAfterPlan: number | null;
  rosterAfterPlan: number | null;
  salaryAfterPlan: number | null;
  marketValueAfterPlan: number | null;
};

export type AiMarketPlanStep = {
  stepType: "sell" | "buy" | "hold" | "warning";
  playerId?: string | null;
  playerName?: string | null;
  amount?: number | null;
  salaryImpact?: number | null;
  rosterImpact?: number | null;
  reason: string;
  sourceStatus: "mapped" | "partial" | "missing_source";
};

export type AiMarketPlanTeamEntry = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: TeamControlMode;
  aiTransferPreviewEnabled: boolean;
  aiSellPreviewEnabled: boolean;
  status: AiMarketPlanPreviewStatus;
  strategySummary: string;
  currentState: AiMarketPlanCurrentState;
  sellPlan: AiMarketPlanSellPlan;
  buyPlan: AiMarketPlanBuyPlan;
  projectedState: AiMarketPlanProjectedState;
  planSteps: AiMarketPlanStep[];
  reasons: string[];
  warnings: string[];
  blockingReasons: string[];
};

export type AiMarketPlanPreviewSummary = {
  aiTeams: number;
  ready: number;
  hold: number;
  buyOnly: number;
  sellOnly: number;
  sellThenBuy: number;
  warning: number;
  blocked: number;
};

export type AiMarketPlanPreviewResult = {
  readOnly: true;
  source: AiMarketPlanPreviewSource;
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
    teamScope: AiMarketPlanPreviewTeamScope;
  };
  totalTeams: number;
  aiTeams: number;
  skippedManual: number;
  skippedPassive: number;
  skippedDisabled: number;
  holdTeams: number;
  buyOnlyTeams: number;
  sellOnlyTeams: number;
  sellThenBuyTeams: number;
  warningTeams: number;
  blockedTeams: number;
  summary: AiMarketPlanPreviewSummary;
  teams: AiMarketPlanTeamEntry[];
};

function sumKnown(values: Array<number | null | undefined>) {
  if (values.some((value) => value == null || !Number.isFinite(value))) {
    return null;
  }

  return values
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0);
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function uniqueById<T>(items: T[], keySelector: (item: T) => string) {
  const seen = new Set<string>();
  const uniqueItems: T[] = [];
  for (const item of items) {
    const key = keySelector(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueItems.push(item);
  }
  return uniqueItems;
}

function isKnownPositiveMoney(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getPreviewCashBuffer(input: {
  salaryTotal: number | null | undefined;
  rosterAfterSell: number | null;
  playerMin: number | null;
  wantedCount: number;
  plannedBuyCount: number;
  strategySummary: string;
}) {
  const salaryBase = Math.max(0, input.salaryTotal ?? 0);
  const longContractHint = /bindet|loyal|lang|contract|vertrag|mentor/i.test(input.strategySummary);
  const missingMin =
    input.rosterAfterSell != null && input.playerMin != null
      ? Math.max(0, input.playerMin - input.rosterAfterSell)
      : 0;
  const remainingBuys = Math.max(0, input.wantedCount - input.plannedBuyCount - 1);
  return Math.max(longContractHint ? 10 : 6, salaryBase * 0.08, missingMin * 2, remainingBuys * 2);
}

function chooseBuyCandidates(team: AiTransferPreviewTeamEntry, plannedSellCount = 0, cashAfterSell?: number | null) {
  const rosterCount = team.rosterCount ?? team.rosterSize ?? null;
  const playerMin = team.targetRosterMin ?? null;
  const playerOpt = team.targetRosterOpt ?? null;
  const rosterAfterSell = rosterCount != null ? rosterCount - plannedSellCount : null;
  const buyCandidates = team.recommendedBuys ?? [];
  const topScore = buyCandidates[0]?.overallRecommendationScore ?? 0;
  const aggressiveBuy =
    team.explanation.includes("Win-at-all-costs") ||
    team.explanation.includes("Stars") ||
    team.explanation.includes("Titel") ||
    team.explanation.includes("Opportun");

  let wantedCount = 0;
  if (rosterAfterSell != null && playerMin != null && rosterAfterSell < playerMin) {
    wantedCount = Math.min(Math.max(playerMin - rosterAfterSell, 1), 3);
  } else if (rosterAfterSell != null && playerOpt != null && rosterAfterSell < playerOpt) {
    wantedCount = Math.min(Math.max(playerOpt - rosterAfterSell, 1), plannedSellCount >= 2 ? 3 : 2);
  } else if (plannedSellCount >= 2 && topScore >= 58 && team.budgetStatus !== "critical") {
    wantedCount = 2;
  } else if (plannedSellCount >= 1 && topScore >= 52 && team.budgetStatus !== "critical") {
    wantedCount = 1;
  } else if (aggressiveBuy && topScore >= 65 && team.budgetStatus !== "critical") {
    wantedCount = 1;
  }

  const candidateWindow = wantedCount > 0 ? Math.min(buyCandidates.length, wantedCount + 12) : 0;
  const visibleCandidates = buyCandidates.slice(0, candidateWindow);
  if (cashAfterSell == null || !Number.isFinite(cashAfterSell)) {
    return visibleCandidates;
  }

  const selected: AiTransferPreviewRecommendation[] = [];
  let cashRemaining = cashAfterSell;
  for (const candidate of visibleCandidates) {
    const priceValue = candidate.price ?? candidate.marketValue ?? null;
    if (!isKnownPositiveMoney(priceValue)) {
      continue;
    }
    const cashBuffer = getPreviewCashBuffer({
      salaryTotal: team.salaryTotal ?? team.salary ?? null,
      rosterAfterSell,
      playerMin,
      wantedCount,
      plannedBuyCount: selected.length,
      strategySummary: team.explanation,
    });
    if (cashRemaining - priceValue < cashBuffer) {
      continue;
    }
    selected.push(candidate);
    cashRemaining -= priceValue;
    if (selected.length >= wantedCount) {
      break;
    }
  }

  return selected;
}

function chooseSellCandidates(team: AiSellPreviewTeamEntry) {
  const rosterCount = team.rosterSize ?? null;
  const playerMin = team.targetRosterMin ?? team.playerMin ?? null;
  const playerOpt = team.targetRosterOpt ?? null;
  const safeCandidates = team.sellCandidates.filter(
    (candidate) => !candidate.warnings.some((warning) => warning.includes("unter das Team-Minimum")),
  );
  const sellCapacity =
    rosterCount != null && playerMin != null
      ? Math.max(0, rosterCount - playerMin)
      : safeCandidates.length;
  if (sellCapacity <= 0) {
    return [];
  }
  const topPriority = safeCandidates[0]?.sellPriority ?? 0;
  const topProfitRatio =
    safeCandidates[0]?.expectedSellValue != null &&
    safeCandidates[0]?.marketValue != null &&
    safeCandidates[0].marketValue > 0
      ? (safeCandidates[0].expectedSellValue - safeCandidates[0].marketValue) / safeCandidates[0].marketValue
      : 0;
  const highLoyalty =
    team.explanation.includes("Bindet") ||
    team.explanation.includes("Loyal") ||
    team.explanation.includes("Mentor");
  const hasNegativeCash = team.cash != null && Number.isFinite(team.cash) && team.cash < 0;
  const topReasons = safeCandidates[0]?.reasonToSell ?? [];
  const hasExpiringContractPressure = safeCandidates.some((candidate) =>
    candidate.reasonToSell.some((reason) => reason.includes("Vertrag laeuft aus") || reason.includes("kurze Restvertragslaenge")),
  );
  const hasProfitWindow = safeCandidates.some((candidate) => {
    if (candidate.expectedSellValue == null || candidate.marketValue == null || candidate.marketValue <= 0) {
      return false;
    }
    const profitRatio = (candidate.expectedSellValue - candidate.marketValue) / candidate.marketValue;
    return profitRatio >= 0.1 && candidate.sellPriority >= 38;
  });
  const hasManagementSellReason = topReasons.some(
    (reason) =>
      reason.includes("negatives Teamcash") ||
      reason.includes("Performance blieb unter Erwartung") ||
      reason.includes("Vertrag laeuft aus") ||
      reason.includes("kurze Restvertragslaenge") ||
      reason.includes("Teamcash ist kritisch") ||
      reason.includes("Vorstand"),
  );

  let wantedCount = 0;
  if (rosterCount != null && playerOpt != null && rosterCount > playerOpt) {
    wantedCount = Math.min(Math.max(rosterCount - playerOpt, 1), 3);
  } else if (hasNegativeCash && topPriority >= 25) {
    wantedCount = 2;
  } else if (team.budgetPressure === "critical" && topPriority >= 55) {
    wantedCount = 2;
  } else if (!highLoyalty && hasManagementSellReason && topPriority >= 58) {
    wantedCount = 1;
  } else if (!highLoyalty && hasExpiringContractPressure && topPriority >= 48) {
    wantedCount = 1;
  } else if (!highLoyalty && hasProfitWindow && topPriority >= 38) {
    wantedCount = 1;
  } else if (!highLoyalty && topProfitRatio >= 0.18 && topPriority >= 42) {
    wantedCount = 1;
  } else if (!highLoyalty && topPriority >= 72) {
    wantedCount = 1;
  }

  const proactiveCandidates = safeCandidates.filter((candidate) => {
    const candidateProfitRatio =
      candidate.expectedSellValue != null && candidate.marketValue != null && candidate.marketValue > 0
        ? (candidate.expectedSellValue - candidate.marketValue) / candidate.marketValue
        : 0;
    const hasStrongReason = candidate.reasonToSell.some(
      (reason) =>
        reason.includes("negatives Teamcash") ||
        reason.includes("Performance blieb unter Erwartung") ||
        reason.includes("Vertrag laeuft aus") ||
        reason.includes("kurze Restvertragslaenge") ||
        reason.includes("Teamcash ist kritisch") ||
        reason.includes("Vorstand") ||
        reason.includes("Kader liegt ueber dem Optimum"),
    );
    return hasStrongReason || candidateProfitRatio >= 0.1 || candidate.sellPriority >= 68;
  });

  const maxWantedByContext =
    hasNegativeCash || team.budgetPressure === "critical" || (rosterCount != null && playerOpt != null && rosterCount > playerOpt)
      ? 3
      : highLoyalty
        ? 1
        : 2;
  const negativeCashRecoveryCandidates: AiSellPreviewCandidate[] = [];
  if (hasNegativeCash) {
    let projectedCash = team.cash ?? 0;
    for (const candidate of safeCandidates) {
      const expectedSellValue = candidate.expectedSellValue;
      if (!isKnownPositiveMoney(expectedSellValue)) {
        continue;
      }
      negativeCashRecoveryCandidates.push(candidate);
      projectedCash += expectedSellValue;
      if (projectedCash > 0 || negativeCashRecoveryCandidates.length >= sellCapacity) {
        break;
      }
    }
  }

  const finalWantedCount = Math.min(Math.max(wantedCount, proactiveCandidates.length > 1 ? 2 : wantedCount), maxWantedByContext, sellCapacity);

  return uniqueById(
    [...negativeCashRecoveryCandidates, ...proactiveCandidates.slice(0, finalWantedCount)],
    (candidate) => candidate.activePlayerId,
  ).slice(0, sellCapacity);
}

function buildProjectedState(input: {
  currentState: AiMarketPlanCurrentState;
  sellPlan: AiMarketPlanSellPlan;
  buyPlan: AiMarketPlanBuyPlan;
}) {
  const sellCount = input.sellPlan.candidates.length;
  const buyCount = input.buyPlan.candidates.length;

  return {
    cashAfterPlan:
      input.currentState.cash != null &&
      input.buyPlan.plannedSpend != null &&
      (sellCount === 0 || input.sellPlan.expectedSellValue != null)
        ? input.currentState.cash + (input.sellPlan.expectedSellValue ?? 0) - input.buyPlan.plannedSpend
        : null,
    rosterAfterPlan:
      input.currentState.rosterCount != null ? input.currentState.rosterCount - sellCount + buyCount : null,
    salaryAfterPlan:
      input.currentState.salaryTotal != null &&
      input.buyPlan.plannedSalaryAdded != null &&
      (sellCount === 0 || input.sellPlan.salaryFreed != null)
        ? input.currentState.salaryTotal - (input.sellPlan.salaryFreed ?? 0) + input.buyPlan.plannedSalaryAdded
        : null,
    marketValueAfterPlan:
      input.currentState.marketValueTotal != null &&
      input.buyPlan.plannedSpend != null &&
      (sellCount === 0 || input.sellPlan.expectedSellValue != null)
        ? input.currentState.marketValueTotal - (input.sellPlan.expectedSellValue ?? 0) + input.buyPlan.plannedSpend
        : null,
  } satisfies AiMarketPlanProjectedState;
}

function getTeamStatus(input: {
  controlMode: TeamControlMode;
  buyEnabled: boolean;
  sellEnabled: boolean;
  buyCandidates: AiTransferPreviewRecommendation[];
  sellCandidates: AiSellPreviewCandidate[];
  currentState: AiMarketPlanCurrentState;
  warnings: string[];
  blockingReasons: string[];
}) {
  if (input.controlMode !== "ai") {
    return "warning" as const;
  }
  if (!input.buyEnabled || !input.sellEnabled || input.blockingReasons.length > 0) {
    return "blocked" as const;
  }
  if (input.sellCandidates.length > 0 && input.buyCandidates.length > 0) {
    return "sell_then_buy" as const;
  }
  if (input.buyCandidates.length > 0) {
    return "buy_only" as const;
  }
  if (input.sellCandidates.length > 0) {
    return "sell_only" as const;
  }

  const rosterCount = input.currentState.rosterCount;
  const playerMin = input.currentState.playerMin;
  const playerOpt = input.currentState.playerOpt;
  const rosterNeedsBuy = rosterCount != null && playerMin != null && rosterCount < playerMin;
  const rosterNeedsSell = rosterCount != null && playerOpt != null && rosterCount > playerOpt;
  if (rosterNeedsBuy || rosterNeedsSell || input.warnings.length > 0) {
    return "warning" as const;
  }
  return "hold" as const;
}

function buildTeamEntry(input: {
  buyTeam: AiTransferPreviewTeamEntry | undefined;
  sellTeam: AiSellPreviewTeamEntry | undefined;
  teamScope: AiMarketPlanPreviewTeamScope;
  buyScanSkipped?: boolean;
  sellScanSkipped?: boolean;
}) {
  const buyTeam = input.buyTeam;
  const sellTeam = input.sellTeam;
  if (!buyTeam && !sellTeam) {
    return null;
  }

  const teamId = buyTeam?.teamId ?? sellTeam?.teamId ?? "";
  const controlMode = buyTeam?.controlMode ?? sellTeam?.controlMode ?? "manual";
  const buyEnabled = input.buyScanSkipped ? true : buyTeam?.aiTransferPreviewEnabled ?? false;
  const sellEnabled = input.sellScanSkipped ? true : sellTeam?.aiSellPreviewEnabled ?? false;
  const currentState: AiMarketPlanCurrentState = {
    cash: buyTeam?.cash ?? sellTeam?.cash ?? null,
    rosterCount: buyTeam?.rosterCount ?? buyTeam?.rosterSize ?? sellTeam?.rosterSize ?? null,
    playerMin: sellTeam?.targetRosterMin ?? sellTeam?.playerMin ?? buyTeam?.targetRosterMin ?? null,
    playerOpt: sellTeam?.targetRosterOpt ?? sellTeam?.playerOpt ?? buyTeam?.targetRosterOpt ?? null,
    salaryTotal: buyTeam?.salaryTotal ?? buyTeam?.salary ?? sellTeam?.salaryTotal ?? null,
    marketValueTotal: buyTeam?.marketValueTotal ?? sellTeam?.marketValueTotal ?? null,
  };

  const chosenSells = sellTeam ? chooseSellCandidates(sellTeam) : [];
  const expectedSellValue = chosenSells.length > 0 ? sumKnown(chosenSells.map((candidate) => candidate.expectedSellValue)) : 0;
  const cashAfterSell =
    currentState.cash != null && expectedSellValue != null
      ? currentState.cash + expectedSellValue
      : null;
  const chosenBuys = buyTeam ? chooseBuyCandidates(buyTeam, chosenSells.length, cashAfterSell) : [];
  const buyPlan: AiMarketPlanBuyPlan = {
    candidates: chosenBuys,
    plannedSpend: chosenBuys.length > 0 ? sumKnown(chosenBuys.map((candidate) => candidate.price)) : 0,
    plannedSalaryAdded: chosenBuys.length > 0 ? sumKnown(chosenBuys.map((candidate) => candidate.salary)) : 0,
    rosterAfterBuy: currentState.rosterCount != null ? currentState.rosterCount + chosenBuys.length : null,
    warnings: unique([
      ...chosenBuys.flatMap((candidate) => candidate.warnings),
      chosenBuys.length === 0 && currentState.rosterCount != null && currentState.playerMin != null && currentState.rosterCount < currentState.playerMin
        ? "Kader liegt unter Minimum, aber es wurde noch kein sauberer Kaufkandidat gefunden."
        : null,
    ]),
  };
  const sellPlan: AiMarketPlanSellPlan = {
    candidates: chosenSells,
    salaryFreed: chosenSells.length > 0 ? sumKnown(chosenSells.map((candidate) => candidate.salary)) : 0,
    expectedSellValue: chosenSells.length > 0 ? sumKnown(chosenSells.map((candidate) => candidate.expectedSellValue)) : 0,
    totalExpectedSellValue: chosenSells.length > 0 ? sumKnown(chosenSells.map((candidate) => candidate.expectedSellValue)) : 0,
    rosterAfterSell: currentState.rosterCount != null ? currentState.rosterCount - chosenSells.length : null,
    warnings: unique([
      ...chosenSells.flatMap((candidate) => candidate.warnings),
      chosenSells.some((candidate) => candidate.expectedSellValue == null)
        ? "Mindestens ein geplanter Verkauf hat keinen belastbaren Verkaufserloes."
        : null,
    ]),
  };

  const reasons = unique([
    buyTeam?.explanation,
    sellTeam?.explanation,
    currentState.rosterCount != null &&
    currentState.playerMin != null &&
    currentState.rosterCount < currentState.playerMin
      ? "Kader liegt unter dem Team-Minimum und braucht Zugaenge."
      : null,
    currentState.rosterCount != null &&
    currentState.playerOpt != null &&
    currentState.rosterCount > currentState.playerOpt
      ? "Kader liegt ueber dem Team-Optimum und bietet Verkaufsdruck."
      : null,
    chosenBuys[0]?.reason,
    chosenBuys[0]?.strategyNotes?.[0],
    chosenSells[0]?.reasonToSell?.[0],
    chosenSells[0]?.strategyFitSummary,
  ]);
  const warnings = unique([
    ...(buyTeam?.warnings ?? []),
    ...(sellTeam?.warnings ?? []),
    ...chosenBuys.flatMap((candidate) => candidate.warnings),
    ...chosenSells.flatMap((candidate) => candidate.warnings),
    chosenSells.some((candidate) => candidate.expectedSellValue == null)
      ? "Mindestens ein geplanter Verkauf hat keinen belastbaren Verkaufserloes."
      : null,
    input.teamScope === "all" && controlMode === "manual" ? "manuell gesteuertes Team – Marktplan nur informativ" : null,
    input.teamScope === "all" && controlMode === "passive" ? "passives Team – Marktplan nur informativ" : null,
  ]);
  const projectedState = buildProjectedState({
    currentState,
    sellPlan,
    buyPlan,
  });
  const blockingReasons = unique([
    !buyEnabled ? "ai_transfer_preview_disabled" : null,
    !sellEnabled ? "ai_sell_preview_disabled" : null,
    currentState.rosterCount != null &&
    currentState.playerMin != null &&
    currentState.rosterCount < currentState.playerMin &&
    chosenBuys.length === 0
      ? "roster_under_min_without_buy_candidate"
      : null,
    currentState.rosterCount != null &&
    currentState.playerOpt != null &&
    currentState.rosterCount > currentState.playerOpt &&
    chosenSells.length === 0
      ? "roster_over_opt_without_sell_candidate"
      : null,
    currentState.cash != null && currentState.cash < 0 && projectedState.cashAfterPlan != null && projectedState.cashAfterPlan <= 0
      ? "negative_cash_unresolved_after_safe_sells"
      : null,
    projectedState.cashAfterPlan != null && projectedState.cashAfterPlan <= 0
      ? "cash_after_market_plan_not_positive"
      : null,
    projectedState.cashAfterPlan != null &&
    projectedState.salaryAfterPlan != null &&
    projectedState.cashAfterPlan < Math.max(1, projectedState.salaryAfterPlan * 0.05)
      ? "cash_after_market_plan_below_reserve"
      : null,
    projectedState.rosterAfterPlan != null &&
    currentState.playerMin != null &&
    projectedState.rosterAfterPlan < currentState.playerMin
      ? "roster_after_market_plan_below_player_min"
      : null,
  ]);
  const status = getTeamStatus({
    controlMode,
    buyEnabled,
    sellEnabled,
    buyCandidates: chosenBuys,
    sellCandidates: chosenSells,
    currentState,
    warnings,
    blockingReasons,
  });

  const planSteps: AiMarketPlanStep[] = [
    ...chosenSells.map((candidate) => ({
      stepType: "sell" as const,
      playerId: candidate.playerId,
      playerName: candidate.playerName,
      amount: candidate.expectedSellValue,
      salaryImpact: candidate.salary != null ? -candidate.salary : null,
      rosterImpact: -1,
      reason: candidate.reasonsToSell[0] ?? candidate.strategyFitSummary,
      sourceStatus: candidate.expectedSellValue != null ? ("mapped" as const) : ("missing_source" as const),
    })),
    ...chosenBuys.map((candidate) => ({
      stepType: "buy" as const,
      playerId: candidate.playerId,
      playerName: candidate.name,
      amount: candidate.price,
      salaryImpact: candidate.salary,
      rosterImpact: 1,
      reason: candidate.reason,
      sourceStatus:
        candidate.price != null && candidate.salary != null
          ? ("mapped" as const)
          : ("partial" as const),
    })),
  ];

  if (status === "hold") {
    planSteps.push({
      stepType: "hold",
      reason: "Halte den Kader im aktuellen Marktfenster stabil.",
      sourceStatus: "mapped",
    });
  }

  if (status === "warning" && chosenBuys.length === 0 && chosenSells.length === 0) {
    planSteps.push({
      stepType: "warning",
      reason: "Vor einem Marktplan fehlen noch saubere Kauf- oder Verkaufskandidaten.",
      sourceStatus: "partial",
    });
  }

  return {
    teamId,
    teamCode: buyTeam?.teamCode ?? sellTeam?.teamCode ?? teamId,
    teamName: buyTeam?.teamName ?? sellTeam?.teamName ?? teamId,
    controlMode,
    aiTransferPreviewEnabled: buyEnabled,
    aiSellPreviewEnabled: sellEnabled,
    status,
    strategySummary: buyTeam?.explanation ?? sellTeam?.explanation ?? "Kein Teamprofil verfuegbar.",
    currentState,
    sellPlan,
    buyPlan,
    projectedState,
    planSteps,
    reasons,
    warnings,
    blockingReasons,
  } satisfies AiMarketPlanTeamEntry;
}

export async function buildAiMarketPlanPreview(params: AiMarketPlanPreviewParams = {}): Promise<AiMarketPlanPreviewResult> {
  const previewParams: AiTransferPreviewParams = {
    source: params.source === "prisma" ? "prisma" : "sqlite",
    saveId: params.saveId ?? null,
    seasonId: params.seasonId ?? null,
    teamId: params.teamId ?? null,
    teamScope: params.teamScope === "all" ? "all" : "ai",
  };
  const skipBuyScan = params.buyLimit === 0;
  const skipSellScan = params.sellLimit === 0;

  const [buyPreview, sellPreview] = await Promise.all([
    skipBuyScan
      ? Promise.resolve(null)
      : buildAiTransfermarktPreview({
          ...previewParams,
          limit: params.buyLimit ?? 90,
          fullScoringLimit: params.fullScoringLimit ?? null,
          buyNeedOnly: params.buyNeedOnly ?? false,
          forceBuyScanTeamIds: params.forceBuyScanTeamIds ?? null,
        }),
    skipSellScan
      ? Promise.resolve(null)
      : buildAiTransfermarktSellPreview({
          ...previewParams,
          limit: params.sellLimit ?? 6,
        }),
  ]);

  const teamIds = Array.from(new Set([...(buyPreview?.teams ?? []).map((team) => team.teamId), ...(sellPreview?.teams ?? []).map((team) => team.teamId)]));
  const buyTeamById = new Map((buyPreview?.teams ?? []).map((team) => [team.teamId, team] as const));
  const sellTeamById = new Map((sellPreview?.teams ?? []).map((team) => [team.teamId, team] as const));
  const teams = teamIds
    .map((teamId) =>
      buildTeamEntry({
        buyTeam: buyTeamById.get(teamId),
        sellTeam: sellTeamById.get(teamId),
        teamScope: previewParams.teamScope ?? "ai",
        buyScanSkipped: skipBuyScan,
        sellScanSkipped: skipSellScan,
      }),
    )
    .filter((entry): entry is AiMarketPlanTeamEntry => Boolean(entry))
    .sort((left, right) => {
      const rank = ["sell_then_buy", "buy_only", "sell_only", "hold", "warning", "blocked"];
      const statusDelta = rank.indexOf(left.status) - rank.indexOf(right.status);
      if (statusDelta !== 0) {
        return statusDelta;
      }
      return left.teamName.localeCompare(right.teamName, "de");
    });

  return {
    readOnly: true,
    source: buyPreview?.source ?? sellPreview?.source ?? previewParams.source ?? "sqlite",
    scope: buyPreview?.scope ?? sellPreview?.scope ?? {
      saveId: previewParams.saveId ?? "",
      seasonId: previewParams.seasonId ?? "",
      teamId: previewParams.teamId ?? null,
      teamScope: previewParams.teamScope ?? "ai",
    },
    totalTeams: teams.length,
    aiTeams: teams.filter((team) => team.controlMode === "ai").length,
    skippedManual: buyPreview?.skippedManual ?? sellPreview?.skippedManual ?? teams.filter((team) => team.controlMode === "manual").length,
    skippedPassive: buyPreview?.skippedPassive ?? sellPreview?.skippedPassive ?? teams.filter((team) => team.controlMode === "passive").length,
    skippedDisabled: Math.max(
      buyPreview?.skippedDisabled ?? 0,
      sellPreview?.skippedDisabled ?? 0,
      teams.filter((team) => team.controlMode === "ai" && (!team.aiTransferPreviewEnabled || !team.aiSellPreviewEnabled)).length,
    ),
    holdTeams: teams.filter((team) => team.status === "hold").length,
    buyOnlyTeams: teams.filter((team) => team.status === "buy_only").length,
    sellOnlyTeams: teams.filter((team) => team.status === "sell_only").length,
    sellThenBuyTeams: teams.filter((team) => team.status === "sell_then_buy").length,
    warningTeams: teams.filter((team) => team.status === "warning").length,
    blockedTeams: teams.filter((team) => team.status === "blocked").length,
    summary: {
      aiTeams: teams.filter((team) => team.controlMode === "ai").length,
      ready: teams.filter((team) => team.status === "buy_only" || team.status === "sell_only" || team.status === "sell_then_buy").length,
      hold: teams.filter((team) => team.status === "hold").length,
      buyOnly: teams.filter((team) => team.status === "buy_only").length,
      sellOnly: teams.filter((team) => team.status === "sell_only").length,
      sellThenBuy: teams.filter((team) => team.status === "sell_then_buy").length,
      warning: teams.filter((team) => team.status === "warning").length,
      blocked: teams.filter((team) => team.status === "blocked").length,
    },
    teams,
  };
}
