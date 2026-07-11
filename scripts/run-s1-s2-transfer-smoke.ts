/**
 * S1→S2 Transfer Fast-Smoke: fresh S1 draft, bootstrap season_completed, S1-end sell, S2 preseason buy.
 *
 * Usage:
 *   node --import tsx scripts/run-s1-s2-transfer-smoke.ts
 *   node --import tsx scripts/run-s1-s2-transfer-smoke.ts --runs 3
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { runSeasonStartReset } from "@/lib/persistence/season-start-reset-service";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import {
  finalizeSeasonOneBootstrapPhase,
  finalizeSeasonOneDraftAuditReady,
  runCanonicalSeasonOneBootstrap,
} from "@/lib/season/long-run-canonical";
import { ensureIsolatedLongRunDatabase } from "@/lib/season/long-run-db-isolation";

import {
  PROJECT_ROOT,
  buildTransferReport,
  collectTeamRows,
  countDraftBuys,
  log,
  round,
  runTransferPipeline,
  setAllTeamsAi,
  type TransferRunResult,
} from "./s1-s2-transfer-shared";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function assertCleanStart(save: PersistedSaveGame, stage: string) {
  const state = save.gameState;
  const issues = [
    state.rosters.length > 0 ? `rosters:${state.rosters.length}` : null,
    state.transferHistory.length > 0 ? `transferHistory:${state.transferHistory.length}` : null,
  ].filter((entry): entry is string => Boolean(entry));
  if (issues.length > 0) {
    throw new Error(`Clean start failed at ${stage}: ${issues.join(" | ")}`);
  }
}

async function runSingleSmoke(input: { label: string; outputDir: string; rankShuffle: number; seed: number }): Promise<TransferRunResult> {
  fs.mkdirSync(input.outputDir, { recursive: true });
  delete process.env.OLY_APP_SQLITE_PATH;
  const isolation = ensureIsolatedLongRunDatabase({ outputDir: input.outputDir, projectRoot: PROJECT_ROOT });
  log(`${input.label}: isolated DB → ${isolation.sqlitePath}`);

  const persistence = createPersistenceService();
  const started = Date.now();

  const created = persistence.createFreshSeasonOneSave({
    name: `${input.label} ${new Date().toISOString()}`,
  });
  const reset = await runSeasonStartReset({
    source: "sqlite",
    saveId: created.saveId,
    seasonId: created.gameState.season.id,
    dryRun: false,
    confirmToken: SEASON_START_RESET_CONFIRM_TOKEN,
  });
  if (reset.status !== "applied") {
    throw new Error(`${input.label}: season-start-reset blocked: ${reset.blockingReasons.join(" | ")}`);
  }

  let save = persistence.getSaveById(created.saveId) ?? created;
  assertCleanStart(save, "after season-start-reset");
  save = setAllTeamsAi(save, persistence);

  log(`${input.label}: S1 draft…`);
  const bootstrap = await runCanonicalSeasonOneBootstrap(save, persistence);
  if (bootstrap.blockers.length > 0) {
    throw new Error(`${input.label}: S1 draft blocked: ${bootstrap.blockers.join(" | ")}`);
  }
  save = finalizeSeasonOneDraftAuditReady(bootstrap.save, persistence);
  save = finalizeSeasonOneBootstrapPhase(save, persistence).save;

  const draftBaselinePath = path.join(PROJECT_ROOT, "outputs/s1-draft-baseline.sqlite");
  try {
    fs.copyFileSync(isolation.sqlitePath, draftBaselinePath);
    log(`Draft baseline copy → ${draftBaselinePath}`);
  } catch {
    // non-fatal
  }

  const draftRows = collectTeamRows(save.gameState);
  const draftMeta = {
    picks: countDraftBuys(save.gameState),
    teamsAtMin: draftRows.filter((row) => row.atMin).length,
    teamsAtOpt: draftRows.filter((row) => row.atOpt).length,
    avgCash: round(draftRows.reduce((sum, row) => sum + row.cash, 0) / Math.max(1, draftRows.length)),
    blockers: bootstrap.blockers,
  };

  return runTransferPipeline({
    label: input.label,
    save,
    persistence,
    outputDir: input.outputDir,
    sqlitePath: isolation.sqlitePath,
    startedAt: started,
    bootstrapOpts: { rankShuffle: input.rankShuffle, seed: input.seed },
    draftMeta,
  });
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const runs = Math.max(1, Number(argValue("--runs") ?? "1"));
  const rankShuffle = Number(argValue("--rank-shuffle") ?? "0");
  const seed = Number(argValue("--seed") ?? "42");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const rootOutput = path.join(PROJECT_ROOT, "outputs", `s1-s2-transfer-smoke-${timestamp}`);
  fs.mkdirSync(rootOutput, { recursive: true });

  log(`Output → ${rootOutput}`);
  log(`Runs: ${runs}`);

  const results: TransferRunResult[] = [];
  for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
    const label = `Run ${runIndex}`;
    const outputDir = path.join(rootOutput, `run${runIndex}-${timestamp}`);
    results.push(
      await runSingleSmoke({
        label,
        outputDir,
        rankShuffle,
        seed: seed + runIndex - 1,
      }),
    );
  }

  const report = buildTransferReport(
    results,
    "S1→S2 Transfer Fast-Smoke",
    "Pfad: frischer S1-Draft → Sponsor/Preisgeld-Preview → Fast `season_completed` → S1-Ende-Verkauf → S2-Transition → S2-Preseason-Kauf. Single-Cash S2+ (10% MW Puffer).",
  );
  fs.writeFileSync(path.join(rootOutput, "report.md"), report);
  fs.writeFileSync(
    path.join(rootOutput, "transfer-summary.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        runCount: results.length,
        allHardGreen: results.every((row) => row.hardFails.length === 0),
        runs: results.map((row) => ({
          label: row.label,
          saveId: row.saveId,
          hardFails: row.hardFails,
          economy: row.economy,
          draft: row.draft,
          afterSell: {
            totalSells: row.afterSell.totalSells,
            zeroRosterTeams: row.afterSell.zeroRosterTeams,
          },
          afterPreseason: {
            totalBuys: row.afterPreseason.totalBuys,
            teamsAtMin: row.afterPreseason.teamsAtMin,
            teamsAtOpt: row.afterPreseason.teamsAtOpt,
            avgCash: row.afterPreseason.avgCash,
          },
        })),
      },
      null,
      2,
    ),
  );

  log(`Done → ${rootOutput}`);
  if (results.some((row) => row.hardFails.length > 0)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
