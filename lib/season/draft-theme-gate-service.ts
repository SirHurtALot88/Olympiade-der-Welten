import {
  buildTeamThemeCompositionAudit,
  getTeamThemeCompositionTarget,
  type TeamThemeCompositionAuditRow,
  type TeamThemeStatus,
} from "@/lib/ai/team-theme-composition-service";
import type { GameState, RosterEntry } from "@/lib/data/olyDataTypes";

export type DraftThemeGateResult = {
  pass: boolean;
  failures: string[];
  warnings: string[];
  statusCounts: Partial<Record<TeamThemeStatus, number>>;
  hardRedTeams: Array<{ teamId: string; code: string; primaryPct: number; minPct: number; outsiders: number }>;
  strongWarnTeams: Array<{ teamId: string; code: string; primaryPct: number; minPct: number }>;
  rows: TeamThemeCompositionAuditRow[];
};

function roundPct(value: number) {
  return Math.round(value * 1000) / 10;
}

export function reconstructDraftRostersFromHistory(gameState: GameState): RosterEntry[] {
  const draftBuys = gameState.transferHistory.filter(
    (entry) => entry.seasonId === "season-1" && entry.transferType === "buy" && entry.source === "ai_roster_fill",
  );
  const rosterByKey = new Map<string, RosterEntry>();
  for (const buy of draftBuys) {
    if (!buy.toTeamId) continue;
    const existing = gameState.rosters.find((entry) => entry.playerId === buy.playerId && entry.teamId === buy.toTeamId);
    rosterByKey.set(`${buy.playerId}:${buy.toTeamId}`, {
      ...(existing ?? {
        id: `draft-reconstruct-${buy.toTeamId}-${buy.playerId}`,
        teamId: buy.toTeamId,
        playerId: buy.playerId,
        salary: buy.salary ?? 0,
        upkeep: buy.salary ?? 0,
        currentValue: buy.marketValue ?? buy.fee ?? 0,
        contractLength: buy.remainingContractLength ?? 1,
        roleTag: "prospect" as const,
        joinedSeasonId: buy.seasonId,
      }),
    });
  }
  return [...rosterByKey.values()];
}

export function auditDraftThemeComposition(gameState: GameState): DraftThemeGateResult {
  const draftRosters = reconstructDraftRostersFromHistory(gameState);
  const draftGameState: GameState = { ...gameState, rosters: draftRosters };
  const rows = buildTeamThemeCompositionAudit(draftGameState);
  const failures: string[] = [];
  const warnings: string[] = [];
  const statusCounts = rows.reduce<Partial<Record<TeamThemeStatus, number>>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team]));
  const hardRedTeams: DraftThemeGateResult["hardRedTeams"] = [];
  const strongWarnTeams: DraftThemeGateResult["strongWarnTeams"] = [];

  for (const row of rows) {
    const target = getTeamThemeCompositionTarget(row.teamId);
    if (!target) continue;
    const code = teamById.get(row.teamId)?.shortCode ?? row.teamId;
    const primaryPct = roundPct(row.primaryThemeShare);
    const minPct = roundPct(target.minimumShare);
    if (target.strictness === "hard" && row.status === "red_below_minimum") {
      hardRedTeams.push({
        teamId: row.teamId,
        code,
        primaryPct,
        minPct,
        outsiders: row.outsiderCount,
      });
      failures.push(`hard_theme_red:${code}:${primaryPct}%<${minPct}%`);
    } else if (target.strictness === "strong" && row.primaryThemeShare + 0.001 < target.minimumShare) {
      strongWarnTeams.push({ teamId: row.teamId, code, primaryPct, minPct });
      warnings.push(`strong_theme_below_min:${code}:${primaryPct}%<${minPct}%`);
    }
    if ((target.strictness === "hard" || target.strictness === "strong") && row.outsiderCount > 2) {
      warnings.push(`theme_outsider_cap:${code}:${row.outsiderCount}`);
    }
  }

  return {
    pass: failures.length === 0,
    failures,
    warnings,
    statusCounts,
    hardRedTeams,
    strongWarnTeams,
    rows,
  };
}
