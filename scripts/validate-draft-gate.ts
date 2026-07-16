/**
 * Validate S1 draft gate before continuing to season simulation.
 *
 * Usage: npx tsx scripts/validate-draft-gate.ts --save-id <id> [--audit-json <path>]
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import {
  DRAFT_MAX_CASH_TO_SALARY_RATIO,
  isDraftCashSalaryRatioOverCap,
  resolveDraftCashSalaryRatio,
} from "@/lib/ai/season1-draft-cash-planner";
import type { PhaseAuditResult } from "@/lib/season/long-run-phase-audit";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const MAX_TEAM_MW = 320;
const MAX_LEAGUE_AVG_MW = 280;

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  const auditJsonPath = argValue("--audit-json");
  if (!saveId) throw new Error("Missing --save-id");

  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const gs = save.gameState;
  const failures: string[] = [];
  const warnings: string[] = [];

  const s1Buys = gs.transferHistory.filter((e) => e.seasonId === "season-1" && e.transferType === "buy");
  const autoprep = s1Buys.filter((e) => e.source === "season1_autoprep_topup");
  const rosterFill = s1Buys.filter((e) => e.source === "ai_roster_fill");
  const otherBuys = s1Buys.filter((e) => e.source !== "ai_roster_fill" && e.source !== "season1_autoprep_topup");

  if (autoprep.length > 0) failures.push(`season1_autoprep_topup=${autoprep.length} (must be 0)`);
  if (otherBuys.length > 0) {
    failures.push(`unexpected S1 buy sources: ${[...new Set(otherBuys.map((e) => e.source ?? "?"))].join(", ")}`);
  }
  if (rosterFill.length === 0) failures.push("no ai_roster_fill draft buys");

  const playerById = new Map(gs.players.map((p) => [p.id, p]));
  const teamMwRows = gs.teams.map((team) => {
    const roster = gs.rosters.filter((r) => r.teamId === team.teamId);
    const mw = roster.reduce((sum, r) => {
      const p = playerById.get(r.playerId);
      const econ = p ? resolvePlayerEconomyContract({ player: p, rosterEntry: r }) : null;
      return sum + (econ?.marketValue ?? p?.marketValue ?? 0);
    }, 0);
    const salary = roster.reduce((sum, r) => {
      const p = playerById.get(r.playerId);
      const econ = p ? resolvePlayerEconomyContract({ player: p, rosterEntry: r }) : null;
      return sum + (econ?.salary ?? r.salary ?? 0);
    }, 0);
    const identity = gs.teamIdentities.find((e) => e.teamId === team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const cash = team.cash ?? 0;
    const cashSalaryRatio = resolveDraftCashSalaryRatio(cash, salary);
    return {
      code: team.shortCode,
      roster: roster.length,
      cash: round(cash),
      salary: round(salary),
      cashSalaryRatio,
      mw: round(mw),
      min: playerMin,
      opt: playerOpt,
    };
  });

  const cashSalaryOverCap = teamMwRows.filter(
    (row) => row.salary > 0 && isDraftCashSalaryRatioOverCap(row.cash, row.salary),
  );
  if (cashSalaryOverCap.length > 0) {
    warnings.push(
      `cash/salary>${DRAFT_MAX_CASH_TO_SALARY_RATIO}: ${cashSalaryOverCap
        .map((row) => `${row.code}=${row.cashSalaryRatio ?? "na"}`)
        .join(", ")}`,
    );
  }

  const leagueMwSum = teamMwRows.reduce((s, r) => s + r.mw, 0);
  const leagueMwAvg = round(leagueMwSum / teamMwRows.length);
  const maxTeam = teamMwRows.reduce((best, row) => (row.mw > best.mw ? row : best), teamMwRows[0]!);
  const minTeam = teamMwRows.reduce((best, row) => (row.mw < best.mw ? row : best), teamMwRows[0]!);

  if (maxTeam.mw > MAX_TEAM_MW) {
    failures.push(`max team MW ${maxTeam.code}=${maxTeam.mw} > ${MAX_TEAM_MW}`);
  }
  if (leagueMwAvg > MAX_LEAGUE_AVG_MW) {
    failures.push(`league avg MW ${leagueMwAvg} > ${MAX_LEAGUE_AVG_MW}`);
  }

  const underMin = teamMwRows.filter((r) => r.roster < r.min);
  if (underMin.length > 0) {
    failures.push(`teams under min: ${underMin.map((r) => `${r.code}:${r.roster}/${r.min}`).join(", ")}`);
  }

  if (auditJsonPath && fs.existsSync(auditJsonPath)) {
    const audit = JSON.parse(fs.readFileSync(auditJsonPath, "utf8")) as PhaseAuditResult;
    const reds = audit.checks.filter((c) => c.status === "RED");
    if (reds.length > 0) {
      failures.push(`audit RED: ${reds.map((c) => c.id).join(", ")}`);
    }
  }

  const report = {
    saveId,
    pass: failures.length === 0,
    failures,
    warnings,
    draft: {
      ai_roster_fill: rosterFill.length,
      season1_autoprep_topup: autoprep.length,
      totalS1Buys: s1Buys.length,
    },
    mw: {
      leagueSum: round(leagueMwSum),
      leagueAvg: leagueMwAvg,
      max: maxTeam,
      min: minTeam,
    },
    topMwTeams: [...teamMwRows].sort((a, b) => b.mw - a.mw).slice(0, 5),
    lowMwTeams: [...teamMwRows].sort((a, b) => a.mw - b.mw).slice(0, 5),
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
