import {
  buildAiNeedsPicksCompare,
  type AiNeedsPicksCompareParams,
  type AiNeedsPicksPlannedPick,
  type AiNeedsPicksRunMode,
} from "@/lib/ai/ai-needs-picks-compare-service";

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
    blockingReasons: team.blockingReasons ?? [],
    compareStatus: team.compareStatus ?? null,
  };
}

export function isUnifiedPickEnabledForMarket() {
  const raw = process.env.OLY_UNIFIED_PICK?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
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
  if (legacyCount > 0) return legacyCount;
  if (rosterAfterSell != null && playerMin != null && rosterAfterSell < playerMin) {
    return Math.max(1, playerMin - rosterAfterSell);
  }
  if (rosterAfterSell != null && playerOpt != null && rosterAfterSell < playerOpt) {
    return Math.max(1, playerOpt - rosterAfterSell);
  }
  return 0;
}
