/**
 * Full real-engine S1→S2 transfer report from MD10 baseline (10 real matchdays, no bootstrap).
 *
 * Pipeline:
 *   MD10 baseline → S1 season_end sell → S2 preseason buy → S2 10 MD → S2 season_end sell
 *
 * Usage:
 *   NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/s1-s2-full-transfer-report.ts
 *   npx tsx scripts/s1-s2-full-transfer-report.ts --resume-from outputs/s1-s2-full-transfer-...
 *   npx tsx scripts/s1-s2-full-transfer-report.ts --report-only --output-dir outputs/...
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import Database from "better-sqlite3";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { runPreseasonProactiveCashRecovery } from "@/lib/ai/preseason-cash-recovery-service";
import { applySeasonEndRosterStressLedger } from "@/lib/ai/season-roster-stress-service";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import { applySeasonEndContractTick, previewSeasonEndContracts } from "@/lib/contracts/contract-renewal-service";
import { buildSoldPlayerSeasonBans } from "@/lib/market/transfer-sold-cooldown";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { closeDatabaseForMaintenance } from "@/lib/persistence/sqlite";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import {
  getLongRunPlannerMaxLeagueRounds,
  getLongRunPlannerMaxTeamCycles,
} from "@/lib/season/long-run-profile";
import { isTransferActionAllowed } from "@/lib/season/transfer-season-policy";

import {
  PROJECT_ROOT,
  applyQuickSimSeasonEndStack,
  cloneSourceDatabase,
  collectTeamRows,
  log,
  resolvePersistenceFromEnv,
  round,
  setAllTeamsAi,
  type TeamRow,
} from "./s1-s2-transfer-shared";

const DEFAULT_BASELINE_DIR = path.join(
  PROJECT_ROOT,
  "outputs/s1-sell-batch-md10-2026-07-06T12-25-36",
);

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function checkpointSqliteWal(sqlitePath: string) {
  if (!fs.existsSync(sqlitePath)) return;
  const db = new Database(sqlitePath);
  try {
    db.exec("PRAGMA wal_checkpoint(FULL);");
  } finally {
    db.close();
  }
}

function appendPipelineLog(outputDir: string, message: string) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(path.join(outputDir, "pipeline.log"), line);
  log(message, "s1-s2-report");
}

function estimatePipelineDurationMs(outputDir: string, fallbackMs: number) {
  const md10 = path.join(outputDir, "checkpoint-md10-pre-sell.json");
  const end = path.join(outputDir, "multi-season-s1-s6-summary.json");
  if (fs.existsSync(md10) && fs.existsSync(end)) {
    const delta = fs.statSync(end).mtimeMs - fs.statSync(md10).mtimeMs;
    if (delta > 0) return delta;
  }
  const pipelineLog = path.join(outputDir, "pipeline.log");
  if (fs.existsSync(pipelineLog)) {
    const lines = fs.readFileSync(pipelineLog, "utf8").trim().split("\n").filter(Boolean);
    if (lines.length >= 2) {
      const firstTs = lines[0]?.match(/^\[([^\]]+)\]/)?.[1];
      const lastTs = lines.at(-1)?.match(/^\[([^\]]+)\]/)?.[1];
      if (firstTs && lastTs) {
        const delta = Date.parse(lastTs) - Date.parse(firstTs);
        if (Number.isFinite(delta) && delta > 0) return delta;
      }
    }
  }
  return fallbackMs;
}

function readCheckpointJson<T>(outputDir: string, filename: string): T | null {
  const filePath = path.join(outputDir, filename);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function resolveSaveIdFromOutput(outputDir: string): string {
  const fromArg = argValue("--save-id");
  if (fromArg) return fromArg;
  const simState = readCheckpointJson<{ saveId?: string }>(outputDir, "simulation-start-state.json");
  if (simState?.saveId) return simState.saveId;
  const multi = readCheckpointJson<{ saveId?: string }>(outputDir, "multi-season-s1-s6-summary.json");
  if (multi?.saveId) return multi.saveId;
  const sqlitePath = path.join(outputDir, "balancing-run.sqlite");
  const db = new Database(sqlitePath, { readonly: true });
  try {
    const row = db.prepare("SELECT save_id FROM saves ORDER BY updated_at DESC LIMIT 1").get() as
      | { save_id: string }
      | undefined;
    if (!row?.save_id) throw new Error(`No save in ${sqlitePath}`);
    return row.save_id;
  } finally {
    db.close();
  }
}

function s2LongRunComplete(outputDir: string) {
  return fs.existsSync(path.join(outputDir, "multi-season-s1-s6-summary.json"));
}

function leagueCash(gameState: { teams: Array<{ cash?: number | null }> }) {
  return round(gameState.teams.reduce((sum, team) => sum + (team.cash ?? 0), 0));
}

type TransferCounts = {
  buys: number;
  sells: number;
  contractExits: number;
  grossBuyFees: number;
  grossSellFees: number;
};

function countTransfers(
  history: Array<{ seasonId: string; transferType: string; fee?: number | null }>,
  seasonId: string,
): TransferCounts {
  const rows = history.filter((entry) => entry.seasonId === seasonId);
  const buys = rows.filter((entry) => entry.transferType === "buy");
  const sells = rows.filter((entry) => entry.transferType === "sell");
  const contractExits = rows.filter((entry) => entry.transferType === "contract_exit");
  return {
    buys: buys.length,
    sells: sells.length,
    contractExits: contractExits.length,
    grossBuyFees: round(buys.reduce((sum, entry) => sum + (entry.fee ?? 0), 0)),
    grossSellFees: round(sells.reduce((sum, entry) => sum + (entry.fee ?? 0), 0)),
  };
}

function summarizeTeamRows(rows: TeamRow[]) {
  return {
    teamsAtMin: rows.filter((row) => row.atMin).length,
    teamsAtOpt: rows.filter((row) => row.atOpt).length,
    belowMin: rows.filter((row) => row.roster < row.playerMin).map((row) => `${row.teamCode}:${row.roster}/${row.playerMin}`),
    zeroRoster: rows.filter((row) => row.roster === 0).map((row) => row.teamCode),
    negativeCash: rows.filter((row) => row.cash < 0).map((row) => row.teamCode),
    avgCash: round(rows.reduce((sum, row) => sum + row.cash, 0) / Math.max(1, rows.length)),
    totalRoster: rows.reduce((sum, row) => sum + row.roster, 0),
  };
}

function resolveDefaultBaseline(): { dbPath: string; saveId: string } {
  const baselineDb = argValue("--baseline-db") ?? path.join(DEFAULT_BASELINE_DIR, "baseline-md10.sqlite");
  if (!fs.existsSync(baselineDb)) {
    throw new Error(`MD10 baseline missing: ${baselineDb}. Run s1-sell-batch-audit.ts first.`);
  }
  const metaPath = path.join(path.dirname(baselineDb), "baseline-md10.json");
  let saveId = argValue("--save-id");
  if (!saveId && fs.existsSync(metaPath)) {
    saveId = (JSON.parse(fs.readFileSync(metaPath, "utf8")) as { saveId?: string }).saveId ?? null;
  }
  if (!saveId) {
    const db = new Database(baselineDb, { readonly: true });
    try {
      saveId =
        (db.prepare("SELECT save_id FROM saves ORDER BY updated_at DESC LIMIT 1").get() as { save_id: string } | undefined)
          ?.save_id ?? null;
    } finally {
      db.close();
    }
  }
  if (!saveId) throw new Error("Could not resolve saveId for baseline DB");
  return { dbPath: baselineDb, saveId };
}

async function preparePreSellSeasonEnd(save: Parameters<typeof applyQuickSimSeasonEndStack>[0], persistence: ReturnType<typeof createPersistenceService>) {
  let current = (await applyQuickSimSeasonEndStack(save, persistence)).save;
  const contractPreview = previewSeasonEndContracts(current);
  if (contractPreview.blockingReasons.length === 0) {
    const contractApply = applySeasonEndContractTick(current, contractPreview.confirmToken, persistence, contractPreview);
    if (contractApply.applied) current = persistence.getSaveById(current.saveId) ?? current;
  }
  return persistence.saveSingleplayerState(
    current.saveId,
    applySeasonEndRosterStressLedger(current.gameState, current.gameState.season.id),
  );
}

async function runS1SellAndS2Preseason(input: {
  saveId: string;
  persistence: ReturnType<typeof createPersistenceService>;
  outputDir: string;
}) {
  let save = input.persistence.getSaveById(input.saveId)!;
  save = setAllTeamsAi(save, input.persistence);

  const md10Rows = collectTeamRows(save.gameState);
  fs.writeFileSync(path.join(input.outputDir, "checkpoint-md10-pre-sell.json"), JSON.stringify(summarizeTeamRows(md10Rows), null, 2));

  log("S1 season_end prep (sponsor/prize/contracts/stress)…", "s1-s2-report");
  save = await preparePreSellSeasonEnd(save, input.persistence);

  log("S1 season_end sell…", "s1-s2-report");
  const s1Sell = await runTransferWindowSession({
    saveId: save.saveId,
    seasonId: "season-1",
    persistence: input.persistence,
    phase: "season_end",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    maxTeamCycles: getLongRunPlannerMaxTeamCycles(),
    maxLeagueRounds: getLongRunPlannerMaxLeagueRounds(),
    allowBuys: isTransferActionAllowed("season-1", "season_end_market_buy"),
    skipIfExistingMarketTransfers: false,
    progressLog: true,
  });
  save = input.persistence.getSaveById(save.saveId)!;
  const afterS1Sell = summarizeTeamRows(collectTeamRows(save.gameState));
  fs.writeFileSync(path.join(input.outputDir, "checkpoint-s1-after-sell.json"), JSON.stringify({ session: s1Sell.appliedSells, ...afterS1Sell }, null, 2));

  log("Transition S1 → S2…", "s1-s2-report");
  const setup = buildPreSeasonNextSeasonSetupToken(save);
  const next = applyPreSeasonNextSeasonSetupLightweight(save, setup.confirmToken, input.persistence);
  if (!next.applied) {
    throw new Error(`S2 transition blocked: ${next.blockingReasons.join(" | ")}`);
  }
  save = input.persistence.getSaveById(save.saveId)!;

  log("S2 preseason cash recovery…", "s1-s2-report");
  await runPreseasonProactiveCashRecovery({ saveId: save.saveId, seasonId: "season-2", persistence: input.persistence });

  log("S2 preseason buy…", "s1-s2-report");
  const s2Buy = await runTransferWindowSession({
    saveId: save.saveId,
    seasonId: "season-2",
    persistence: input.persistence,
    phase: "preseason",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    maxTeamCycles: getLongRunPlannerMaxTeamCycles(),
    maxLeagueRounds: getLongRunPlannerMaxLeagueRounds(),
    allowBuys: true,
    skipIfExistingMarketTransfers: false,
    progressLog: true,
  });
  save = input.persistence.getSaveById(save.saveId)!;
  const afterS2Preseason = summarizeTeamRows(collectTeamRows(save.gameState));
  fs.writeFileSync(
    path.join(input.outputDir, "checkpoint-s2-after-preseason.json"),
    JSON.stringify({ sessionBuys: s2Buy.appliedBuys, sessionSells: s2Buy.appliedSells, ...afterS2Preseason }, null, 2),
  );

  return { save, s1Sell, s2Buy };
}

function runS2MatchdaysAndSell(input: { outputDir: string; saveId: string }) {
  const sqlitePath = path.join(input.outputDir, "balancing-run.sqlite");
  const logPath = path.join(input.outputDir, "long-run-s2.log");
  closeDatabaseForMaintenance();
  checkpointSqliteWal(sqlitePath);

  const scriptPath = path.join(PROJECT_ROOT, "scripts/long-run-sandbox-s1-s6.ts");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_OPTIONS: process.env.NODE_OPTIONS?.includes("max-old-space-size")
      ? process.env.NODE_OPTIONS
      : "--max-old-space-size=8192",
    OLY_APP_SQLITE_PATH: sqlitePath,
    OLY_LONG_RUN_OUTPUT_DIR: input.outputDir,
    OLY_AUTOPREP_OUTPUT_DIR: input.outputDir,
    OLY_LONG_RUN_SAVE_ID: input.saveId,
    OLY_LONG_RUN_FINAL_SEASON: "2",
    OLY_LONG_RUN_LABEL: "S2 MD + season_end sell",
    OLY_LONG_RUN_REQUIRE_NO_DEV_SERVER: "0",
    OLY_LONG_RUN_ALLOW_DEV_SERVER: "1",
    OLY_LONG_RUN_ACTIVATE_ON_FINISH: "0",
    OLY_UNIFIED_PICK: process.env.OLY_UNIFIED_PICK ?? "1",
  };

  fs.appendFileSync(logPath, `\n--- S2 long-run started ${new Date().toISOString()} save=${input.saveId} ---\n`);
  appendPipelineLog(input.outputDir, `S2 long-run child start (stdio → ${path.basename(logPath)})`);

  const logFd = fs.openSync(logPath, "a");
  let result: ReturnType<typeof spawnSync>;
  try {
    result = spawnSync(process.execPath, ["--import", "tsx", scriptPath], {
      cwd: PROJECT_ROOT,
      env,
      stdio: ["ignore", logFd, logFd],
    });
  } finally {
    fs.closeSync(logFd);
  }

  if (result.error) {
    throw new Error(`S2 long-run spawn failed: ${result.error.message} — see ${logPath}`);
  }
  if (result.signal) {
    throw new Error(`S2 long-run killed by signal ${result.signal} — see ${logPath}`);
  }
  if (result.status !== 0) {
    throw new Error(`S2 long-run failed (exit ${result.status}) — see ${logPath}`);
  }
  appendPipelineLog(input.outputDir, "S2 long-run child finished OK");
}

function buildReport(input: {
  outputDir: string;
  saveId: string;
  sqlitePath: string;
  durationMs: number;
  checkpoints: Record<string, unknown>;
  checkpointFiles?: Record<string, unknown>;
}) {
  closeDatabaseForMaintenance();
  process.env.OLY_APP_SQLITE_PATH = input.sqlitePath;
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(input.saveId);
  if (!save) throw new Error(`Save missing: ${input.saveId}`);

  const teamRows = collectTeamRows(save.gameState);
  const s1 = countTransfers(save.gameState.transferHistory, "season-1");
  const s2 = countTransfers(save.gameState.transferHistory, "season-2");
  const roster = summarizeTeamRows(teamRows);

  let multiSeasonSummary: Record<string, unknown> | null = null;
  const summaryPath = path.join(input.outputDir, "multi-season-s1-s6-summary.json");
  if (fs.existsSync(summaryPath)) {
    multiSeasonSummary = JSON.parse(fs.readFileSync(summaryPath, "utf8")) as Record<string, unknown>;
  }
  const openBlockers = (multiSeasonSummary?.openTechnicalBugs as string[] | undefined) ?? [];
  const financeViolations =
    ((multiSeasonSummary?.guardChecks as { transferFinanceViolations?: string[] } | undefined)
      ?.transferFinanceViolations as string[] | undefined) ?? [];
  const s2SeasonSummary =
    ((multiSeasonSummary?.summaries as Array<Record<string, unknown>> | undefined) ?? []).find(
      (entry) => entry.seasonId === "season-2",
    ) ?? null;
  const hardBlockers = openBlockers.filter(
    (entry) => !entry.includes("insufficient_cash") && !entry.includes("team_roster_empty"),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    saveId: input.saveId,
    sqlitePath: input.sqlitePath,
    durationMs: input.durationMs,
    finalSeasonId: save.gameState.season.id,
    finalGamePhase: save.gameState.gamePhase ?? null,
    finalMatchday: save.gameState.matchdayState.matchdayId,
    leagueCash: leagueCash(save.gameState),
    transfers: { season1: s1, season2: s2, sellBuyGap: s1.sells - s2.buys },
    rosterFinal: roster,
    soldCooldown: {
      season1: buildSoldPlayerSeasonBans(save.gameState, "season-1").size,
      season2: buildSoldPlayerSeasonBans(save.gameState, "season-2").size,
    },
    checkpoints: input.checkpoints,
    checkpointFiles: input.checkpointFiles ?? null,
    s2SeasonSummary,
    transferFinanceViolations: financeViolations,
    openTechnicalBugs: openBlockers,
    hardBlockers,
    pass:
      hardBlockers.length === 0 &&
      roster.negativeCash.length === 0 &&
      financeViolations.length === 0,
  };

  fs.writeFileSync(path.join(input.outputDir, "transfer-report.json"), JSON.stringify(report, null, 2));

  const md = [
    "# S1→S2 Full Transfer Report (MD10 baseline, real engine)",
    "",
    `- **Save:** \`${input.saveId}\``,
    `- **Duration:** ${Math.round(input.durationMs / 1000)}s`,
    `- **Final:** ${report.finalSeasonId} · ${report.finalGamePhase} · ${report.finalMatchday}`,
    "",
    "## Checkpoints",
    "",
    input.checkpointFiles?.md10PreSell
      ? `- MD10 pre-sell: ${JSON.stringify(input.checkpointFiles.md10PreSell)}`
      : "",
    input.checkpointFiles?.s1AfterSell
      ? `- S1 after sell: ${JSON.stringify(input.checkpointFiles.s1AfterSell)}`
      : "",
    input.checkpointFiles?.s2AfterPreseason
      ? `- S2 after preseason: ${JSON.stringify(input.checkpointFiles.s2AfterPreseason)}`
      : "",
    "",
    "## S1 — nach 10 MD, dann Verkauf",
    "",
    `| | |`,
    `| --- | --- |`,
    `| Market sells (history) | ${s1.sells} (${s1.grossSellFees}M gross) |`,
    `| Session sells (checkpoint) | ${input.checkpoints.s1SellApplied ?? "—"} |`,
    `| Contract exits | ${s1.contractExits} |`,
    "",
    "## S2 — Preseason Kauf → 10 MD → Verkauf",
    "",
    `| | |`,
    `| --- | --- |`,
    `| Market buys | ${s2.buys} (${s2.grossBuyFees}M fees) |`,
    `| Market sells | ${s2.sells} (${s2.grossSellFees}M gross) |`,
    `| Contract exits | ${s2.contractExits} |`,
    `| Preseason session buys (checkpoint) | ${input.checkpoints.s2BuyApplied ?? "—"} |`,
    `| Sell/Buy gap (S1 sells − S2 buys) | ${s1.sells - s2.buys} |`,
    s2SeasonSummary
      ? `| S2 long-run: MD | ${s2SeasonSummary.matchdaysResolved} |`
      : "",
    s2SeasonSummary ? `| S2 long-run: market sells | ${s2SeasonSummary.sellCount} |` : "",
    s2SeasonSummary ? `| S2 long-run: contract exits | ${s2SeasonSummary.contractExitCount} |` : "",
    "",
    "## Endstand",
    "",
    `| | |`,
    `| --- | --- |`,
    `| Teams ≥ Min | ${roster.teamsAtMin}/32 |`,
    `| Teams ≥ Opt | ${roster.teamsAtOpt}/32 |`,
    `| Liga-Cash Σ | ${report.leagueCash} |`,
    `| Unter Min | ${roster.belowMin.join(", ") || "—"} |`,
    `| Kader 0 | ${roster.zeroRoster.join(", ") || "—"} |`,
    `| Negatives Cash | ${roster.negativeCash.join(", ") || "—"} |`,
    "",
    hardBlockers.length === 0 ? "**Keine harten openTechnicalBugs.**" : hardBlockers.map((e) => `- ${e}`).join("\n"),
    "",
    financeViolations.length > 0
      ? ["## Cash-Reconciliation-Warnungen", "", ...financeViolations.map((e) => `- ${e}`)].join("\n")
      : "",
    "",
    report.pass ? "**Status: PASS**" : "**Status: WARN/FAIL** (siehe Blockers/Reconciliation)",
    "",
    `Output: \`${input.outputDir}\``,
  ].join("\n");
  fs.writeFileSync(path.join(input.outputDir, "transfer-report.md"), md);
  return report;
}

function loadCheckpointBundle(outputDir: string) {
  return {
    md10PreSell: readCheckpointJson(outputDir, "checkpoint-md10-pre-sell.json"),
    s1AfterSell: readCheckpointJson(outputDir, "checkpoint-s1-after-sell.json"),
    s2AfterPreseason: readCheckpointJson(outputDir, "checkpoint-s2-after-preseason.json"),
  };
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const started = Date.now();
  const reportOnly = hasFlag("--report-only");
  const resumeFrom = argValue("--resume-from");
  const outputDirArg = argValue("--output-dir");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputDir =
    resumeFrom ??
    outputDirArg ??
    path.join(PROJECT_ROOT, "outputs", `s1-s2-full-transfer-${timestamp}`);

  if (reportOnly && !resumeFrom && !outputDirArg) {
    throw new Error("--report-only requires --output-dir or --resume-from");
  }

  fs.mkdirSync(outputDir, { recursive: true });
  if (!reportOnly) {
    appendPipelineLog(outputDir, `Pipeline start${resumeFrom ? " (resume)" : ""} → ${outputDir}`);
  }

  const sqlitePath = path.join(outputDir, "balancing-run.sqlite");
  let saveId = resolveSaveIdFromOutput(outputDir);
  let checkpoints: Record<string, unknown> = {};
  const checkpointFiles = loadCheckpointBundle(outputDir);
  if (checkpointFiles.s1AfterSell && typeof checkpointFiles.s1AfterSell === "object") {
    const cp = checkpointFiles.s1AfterSell as { session?: number };
    checkpoints.s1SellApplied = cp.session ?? null;
  }
  if (checkpointFiles.s2AfterPreseason && typeof checkpointFiles.s2AfterPreseason === "object") {
    const cp = checkpointFiles.s2AfterPreseason as { sessionBuys?: number; sessionSells?: number };
    checkpoints.s2BuyApplied = cp.sessionBuys ?? null;
    checkpoints.s2PreseasonSellApplied = cp.sessionSells ?? null;
  }

  if (reportOnly) {
    if (!fs.existsSync(sqlitePath)) throw new Error(`Missing ${sqlitePath} for --report-only`);
    const report = buildReport({
      outputDir,
      saveId,
      sqlitePath,
      durationMs: estimatePipelineDurationMs(outputDir, Date.now() - started),
      checkpoints,
      checkpointFiles,
    });
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const persistence = resolvePersistenceFromEnv();
  const hasS2PreseasonCheckpoint = fs.existsSync(path.join(outputDir, "checkpoint-s2-after-preseason.json"));

  if (resumeFrom || hasS2PreseasonCheckpoint) {
    appendPipelineLog(outputDir, `Resume from checkpoints (save ${saveId})`);
    if (!fs.existsSync(sqlitePath)) throw new Error(`Missing ${sqlitePath} for resume`);
    process.env.OLY_APP_SQLITE_PATH = sqlitePath;
    closeDatabaseForMaintenance();
  } else {
    const { dbPath: baselineDb, saveId: baselineSaveId } = resolveDefaultBaseline();
    appendPipelineLog(outputDir, `MD10 baseline clone ${baselineSaveId} ← ${baselineDb}`);
    cloneSourceDatabase(baselineDb, outputDir);
    saveId = baselineSaveId;
    const save = persistence.getSaveById(saveId);
    if (!save) throw new Error(`Baseline save missing after clone: ${saveId}`);

    appendPipelineLog(outputDir, "S1 sell + S2 preseason transfer sessions start");
    const result = await runS1SellAndS2Preseason({ saveId, persistence, outputDir });
    appendPipelineLog(
      outputDir,
      `S1 sell + S2 preseason done (sells=${result.s1Sell.appliedSells} buys=${result.s2Buy.appliedBuys})`,
    );
    checkpoints = {
      s1SellApplied: result.s1Sell.appliedSells,
      s2BuyApplied: result.s2Buy.appliedBuys,
      s2PreseasonSellApplied: result.s2Buy.appliedSells,
    };
    Object.assign(checkpointFiles, loadCheckpointBundle(outputDir));
  }

  if (!s2LongRunComplete(outputDir)) {
    appendPipelineLog(outputDir, "S2 matchdays + season_end sell via long-run-sandbox");
    runS2MatchdaysAndSell({ outputDir, saveId });
  } else {
    appendPipelineLog(outputDir, "S2 long-run already complete — skipping");
  }

  appendPipelineLog(outputDir, "Building transfer report");
  const report = buildReport({
    outputDir,
    saveId,
    sqlitePath,
    durationMs: estimatePipelineDurationMs(outputDir, Date.now() - started),
    checkpoints,
    checkpointFiles,
  });

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  const resumeFrom = argValue("--resume-from");
  const outputDirArg = argValue("--output-dir");
  const outputDir =
    resumeFrom ??
    outputDirArg ??
    path.join(PROJECT_ROOT, "outputs", `s1-s2-full-transfer-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`);
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    appendPipelineLog(outputDir, `FATAL: ${error instanceof Error ? error.message : String(error)}`);
  } catch {
    // best-effort crash log
  }
  console.error(error);
  process.exit(1);
});
