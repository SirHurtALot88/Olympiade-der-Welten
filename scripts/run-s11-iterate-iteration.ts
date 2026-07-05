/**
 * Run one S11 iterate loop iteration: restore S10 baseline → topup → sell → buy → audit.
 *
 * Usage:
 *   OLY_APP_SQLITE_PATH=data/persistence/oly-app.sqlite OLY_LONG_RUN_ISOLATED_DB=0 \
 *   npx tsx scripts/run-s11-iterate-iteration.ts --iteration 1
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  analyzeBuyQuality,
  appendProgressLog,
  buildTeamRows,
  iterDir,
  PROJECT_ROOT,
  restoreSaveFromBaseline,
  runTransferPipeline,
  S10_BASELINE,
  type IterateMetrics,
  writeTransfersCsv,
} from "@/scripts/s11-iterate-shared";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  process.env.OLY_LONG_RUN_ISOLATED_DB = "0";

  const iteration = Number(argValue("--iteration") ?? "1");
  if (!Number.isFinite(iteration) || iteration < 1) {
    throw new Error("Missing or invalid --iteration (1..10)");
  }

  const saveId = argValue("--save-id") ?? "fresh-season-1-1783169019878";
  const sourceDb = path.resolve(PROJECT_ROOT, argValue("--source-db") ?? "outputs/s1-s10-validated-run-1/balancing-run.sqlite");
  const outputDir = path.resolve(PROJECT_ROOT, argValue("--output-dir") ?? "outputs/s11-iterate-10x");
  const cashFloor = Number(argValue("--floor") ?? 50);
  const outIter = iterDir(outputDir, iteration);

  fs.mkdirSync(outIter, { recursive: true });

  console.error(`[s11-iterate] iteration ${iteration} start`);

  const { restoreResult } = restoreSaveFromBaseline({ saveId, sourceDbPath: sourceDb });
  fs.writeFileSync(
    path.join(outIter, "restore.json"),
    JSON.stringify({ restoreResult, restoredAt: new Date().toISOString() }, null, 2),
  );

  const pipeline = await runTransferPipeline({ saveId, outputDir: outIter, cashFloor });
  const { result, gameState } = pipeline;

  const s10Rows = buildTeamRows(gameState);
  const buyQuality = analyzeBuyQuality(gameState, "season-11", s10Rows);
  const postRows = result.teamRows;

  const minRoster = postRows.reduce(
    (min, row) => (!min || row.roster < min.roster ? { teamCode: row.teamCode, roster: row.roster } : min),
    null as { teamCode: string; roster: number } | null,
  );

  const metrics: IterateMetrics = {
    iteration,
    runAt: new Date().toISOString(),
    saveId,
    atOpt: result.atOpt,
    emergencyPct: result.fidelity.emergencyPct,
    plannedPct: result.fidelity.plannedPct,
    marketBuys: result.fidelity.buys,
    seasonEndSells: pipeline.seasonEndSells,
    convergenceBuys: pipeline.convergence.appliedBuys,
    convergenceSells: pipeline.convergence.appliedSells,
    recoverySells: pipeline.recovery.sold,
    emergencyRepairTeams: pipeline.emergencyTeams,
    topUpTeams: pipeline.topUp.length,
    cashFloor,
    hoardingProxy: result.hoardingTeams,
    trashEstimatePct: buyQuality.trashEstimatePct,
    sensibleEstimatePct: buyQuality.sensibleEstimatePct,
    top8TrashPct: buyQuality.top8TrashPct,
    bottom8SensiblePct: buyQuality.bottom8SensiblePct,
    teamsBelowHardMin: postRows.filter((row) => row.belowHardMin).length,
    minRosterTeam: minRoster,
    cashUnderOptHighCash: postRows.filter((row) => !row.atOpt && row.cash > 30).length,
    zeroBuyTeamsUnderOpt: 0,
  };

  const s11Buys = (gameState.transferHistory ?? []).filter(
    (entry) => entry.seasonId === "season-11" && entry.transferType === "buy",
  );
  const teamsWithBuys = new Set(s11Buys.map((entry) => entry.toTeamId));
  metrics.zeroBuyTeamsUnderOpt = postRows.filter((row) => !row.atOpt && !teamsWithBuys.has(row.teamId)).length;

  fs.writeFileSync(path.join(outIter, "checkpoint.md"), result.markdown);
  fs.writeFileSync(path.join(outIter, "metrics.json"), JSON.stringify(metrics, null, 2));
  writeTransfersCsv(gameState, "season-11", path.join(outIter, "transfers-season-11.csv"));

  const deltaOpt = metrics.atOpt - S10_BASELINE.atOpt;
  const deltaEmergency = metrics.emergencyPct - S10_BASELINE.emergencyPct;

  appendProgressLog(
    outputDir,
    `Iter ${iteration}: Opt ${metrics.atOpt}/32 (Δ${deltaOpt >= 0 ? "+" : ""}${deltaOpt} vs S10), Emergency ${metrics.emergencyPct}% (Δ${deltaEmergency >= 0 ? "+" : ""}${deltaEmergency.toFixed(1)}pp), Buys ${metrics.marketBuys}, Hoarding ${metrics.hoardingProxy}`,
  );

  console.log(JSON.stringify({ iteration, metrics, checkpoint: path.join(outIter, "checkpoint.md") }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
