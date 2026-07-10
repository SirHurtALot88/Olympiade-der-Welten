import {
  buildAiNeedsPicksCompare,
  type AiNeedsPicksCompareParams,
  type AiNeedsPicksPlannedPick,
  type AiNeedsPicksRunMode,
} from "@/lib/ai/ai-needs-picks-compare-service";
import type { AiTransferPreviewRecommendation } from "@/lib/ai/ai-transfermarkt-preview-service";
import {
  PLANNER_TIGHT_BUDGET_CASH_PER_SLOT,
  prefersReserveLaneOverCheapFill,
} from "@/lib/ai/planner-opt-buy-policy";

export type UnifiedTeamPickPlanInput = {
  saveId: string;
  seasonId: string;
  teamId: string;
  steps: number;
  runMode?: AiNeedsPicksRunMode;
  excludedPlayerIds?: string[];
  draftSeed?: string | null;
  source?: AiNeedsPicksCompareParams["source"];
};

export type UnifiedTeamPickPlanResult = {
  teamId: string;
  plannedPicks: AiNeedsPicksPlannedPick[];
  warnings: string[];
  blockingReasons: string[];
  compareStatus: string | null;
};

/**
 * Single entry point for team pick planning — wraps the proven S1 compare planner.
 * S1 draft and S2 market buys should both call this (different pools via transfer preview).
 */
export async function planUnifiedTeamPicks(input: UnifiedTeamPickPlanInput): Promise<UnifiedTeamPickPlanResult> {
  const compare = await buildAiNeedsPicksCompare({
    source: input.source ?? "sqlite",
    saveId: input.saveId,
    seasonId: input.seasonId,
    teamId: input.teamId,
    steps: Math.max(1, Math.min(Math.round(input.steps), 16)),
    runMode: input.runMode ?? "default",
    excludedPlayerIds: input.excludedPlayerIds ?? [],
    draftSeed: input.draftSeed ?? null,
    teamScope: "all",
  });

  const team = compare.teams.find((entry) => entry.teamId === input.teamId) ?? compare.teams[0] ?? null;
  if (!team) {
    return {
      teamId: input.teamId,
      plannedPicks: [],
      warnings: ["unified_pick_team_missing"],
      blockingReasons: ["unified_pick_team_missing"],
      compareStatus: null,
    };
  }

  return {
    teamId: team.teamId,
    plannedPicks: team.plannedPicks ?? [],
    warnings: team.warnings ?? [],
    blockingReasons: team.planner?.blockingReasons ?? [],
    compareStatus: team.compareStatus ?? null,
  };
}

export function isUnifiedPickEnabledForMarket() {
  const raw = process.env.OLY_UNIFIED_PICK?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}

/** Avg spendable cash per Opt-gap pick below this → prefer backup/cheap_fill lanes (~9C reserve bracket). */
export const OPT_REBUILD_RESERVE_BUDGET_PER_PICK_THRESHOLD = PLANNER_TIGHT_BUDGET_CASH_PER_SLOT;

export function applyTightBudgetReserveLaneBias(input: {
  rosterGap: number;
  missingToMin: number;
  cash: number | null;
  coreNeeded: number;
  cheapFillNeeded: number;
  backupNeeded: number;
  depthNeeded: number;
  specialistNeeded: number;
  season1OptimumMode?: boolean;
}) {
  if (input.season1OptimumMode || input.rosterGap <= 0) {
    return {
      coreNeeded: input.coreNeeded,
      cheapFillNeeded: input.cheapFillNeeded,
      backupNeeded: input.backupNeeded,
      depthNeeded: input.depthNeeded,
      specialistNeeded: input.specialistNeeded,
      preferReserveLanes: false,
      avgBudgetPerPick: null as number | null,
    };
  }
  const avgBudgetPerPick =
    input.cash != null && Number.isFinite(input.cash) && input.cash > 0 ? input.cash / input.rosterGap : null;
  const preferReserveLanes = prefersReserveLaneOverCheapFill({
    rosterGap: input.rosterGap,
    cash: input.cash,
  });
  if (!preferReserveLanes) {
    return {
      coreNeeded: input.coreNeeded,
      cheapFillNeeded: input.cheapFillNeeded,
      backupNeeded: input.backupNeeded,
      depthNeeded: input.depthNeeded,
      specialistNeeded: input.specialistNeeded,
      preferReserveLanes: false,
      avgBudgetPerPick,
    };
  }
  const depthNeeded = Math.min(input.depthNeeded, 1);
  const cheapFillNeeded = 0;
  const backupNeeded = Math.max(
    input.backupNeeded,
    Math.max(input.missingToMin, input.rosterGap - depthNeeded - Math.min(input.specialistNeeded, 1)),
  );
  return {
    coreNeeded: 0,
    cheapFillNeeded,
    backupNeeded,
    depthNeeded,
    specialistNeeded: Math.min(input.specialistNeeded, 1),
    preferReserveLanes: true,
    avgBudgetPerPick,
  };
}

export function mapPlannedPicksToBuyCandidates<T extends { playerId: string }>(
  plannedPicks: AiNeedsPicksPlannedPick[],
  pool: T[],
): T[] {
  const byId = new Map(pool.map((entry) => [entry.playerId, entry]));
  const selected: T[] = [];
  const used = new Set<string>();
  for (const pick of plannedPicks) {
    if (!pick.playerId || used.has(pick.playerId)) continue;
    const candidate = byId.get(pick.playerId);
    if (!candidate) continue;
    selected.push(candidate);
    used.add(pick.playerId);
  }
  return selected;
}

/** Fallback when market-plan pool and compare pool diverge — use compare pick metadata directly. */
export function mapPlannedPicksToBuyRecommendations(
  plannedPicks: AiNeedsPicksPlannedPick[],
): AiTransferPreviewRecommendation[] {
  const selected: AiTransferPreviewRecommendation[] = [];
  const used = new Set<string>();
  for (const pick of plannedPicks) {
    if (!pick.playerId || used.has(pick.playerId)) continue;
    if (pick.price == null || pick.price <= 0) continue;
    used.add(pick.playerId);
    selected.push({
      playerId: pick.playerId,
      playerName: pick.playerName,
      name: pick.playerName,
      className: pick.className,
      race: pick.race,
      ovr: pick.ovr,
      mvs: pick.mvs,
      price: pick.price,
      marketValue: pick.price,
      salary: pick.salary,
      contractLength: null,
      cashAfter: null,
      rosterAfter: null,
      salaryAfter: null,
      teamFit: pick.focusTeamFitScore ?? null,
      fitSummary: pick.laneReason || "Unified compare pick",
      sportsSummary: "",
      budgetReason: [],
      warnings: [],
      overallRecommendationScore: 0,
      score: 0,
      reason: pick.laneReason || "unified_compare_pick",
      fitNotes: [],
      riskNotes: [],
      strategyNotes: [],
    });
  }
  return selected;
}

export function resolveUnifiedMarketPickSteps(team: {
  currentState: { rosterCount: number | null; playerMin: number | null; playerOpt: number | null };
  sellPlan: { candidates: unknown[] };
  buyPlan: { candidates: unknown[] };
}) {
  const roster = team.currentState.rosterCount;
  const playerMin = team.currentState.playerMin;
  const playerOpt = team.currentState.playerOpt;
  const rosterAfterSell =
    roster != null ? roster - team.sellPlan.candidates.length : null;
  const legacyCount = team.buyPlan.candidates.length;
  if (rosterAfterSell != null && playerOpt != null && rosterAfterSell >= playerOpt) {
    return legacyCount > 0 ? legacyCount : 0;
  }
  if (legacyCount > 0) return legacyCount;
  if (rosterAfterSell != null && playerMin != null && rosterAfterSell < playerMin) {
    return Math.max(1, playerMin - rosterAfterSell);
  }
  if (rosterAfterSell != null && playerOpt != null && rosterAfterSell < playerOpt) {
    return Math.max(1, playerOpt - rosterAfterSell);
  }
  return 0;
}
