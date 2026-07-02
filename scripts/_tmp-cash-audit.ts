/**
 * Temporary cash/salary audit — delete after use.
 * Usage: node --import tsx scripts/_tmp-cash-audit.ts --save-id <id>
 */
import { loadEnvConfig } from "@next/env";
import path from "node:path";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import {
  DRAFT_MAX_CASH_TO_SALARY_RATIO,
  isDraftCashSalaryRatioOverCap,
  resolveDraftCashSalaryRatio,
} from "@/lib/ai/season1-draft-cash-planner";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  if (!saveId) throw new Error("Missing --save-id");

  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const gs = save.gameState;
  const playerById = new Map(gs.players.map((p) => [p.id, p]));
  const rows = gs.teams
    .map((team) => {
      const roster = gs.rosters.filter((r) => r.teamId === team.teamId);
      const salary = roster.reduce((sum, r) => {
        const p = playerById.get(r.playerId);
        const econ = p ? resolvePlayerEconomyContract({ player: p, rosterEntry: r }) : null;
        return sum + (econ?.salary ?? r.salary ?? 0);
      }, 0);
      const cash = team.cash ?? 0;
      const ratio = resolveDraftCashSalaryRatio(cash, salary);
      const overCap = salary > 0 && isDraftCashSalaryRatioOverCap(cash, salary);
      return {
        code: team.shortCode,
        cash: Number(cash.toFixed(2)),
        salary: Number(salary.toFixed(2)),
        ratio,
        overCap,
      };
    })
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0));

  const overCap = rows.filter((r) => r.overCap);
  const wl = rows.find((r) => r.code === "W-L") ?? null;
  const ratios = rows.map((r) => r.ratio).filter((v): v is number => v != null);
  const median =
    ratios.length > 0
      ? Number(
          ratios.sort((a, b) => a - b)[Math.floor(ratios.length / 2)]!.toFixed(3),
        )
      : null;

  console.log(
    JSON.stringify(
      {
        saveId,
        cap: DRAFT_MAX_CASH_TO_SALARY_RATIO,
        teamCount: rows.length,
        overCapCount: overCap.length,
        medianRatio: median,
        wl,
        overCapTeams: overCap,
        allTeams: rows,
      },
      null,
      2,
    ),
  );
}

main();
