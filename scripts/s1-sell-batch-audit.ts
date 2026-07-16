/**
 * S1 season_end sell batch audit from a full-sim MD10 baseline (no fast bootstrap).
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import Database from "better-sqlite3";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import { applySeasonEndRosterStressLedger } from "@/lib/ai/season-roster-stress-service";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import { applySeasonEndContractTick, previewSeasonEndContracts } from "@/lib/contracts/contract-renewal-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildSoldPlayerSeasonBans } from "@/lib/market/transfer-sold-cooldown";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { closeDatabaseForMaintenance } from "@/lib/persistence/sqlite";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { runSeasonStartReset } from "@/lib/persistence/season-start-reset-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import {
  finalizeSeasonOneBootstrapPhase,
  finalizeSeasonOneDraftAuditReady,
} from "@/lib/season/long-run-canonical";
import { ensureIsolatedLongRunDatabase } from "@/lib/season/long-run-db-isolation";
import {
  getLongRunPlannerMaxLeagueRounds,
  getLongRunPlannerMaxTeamCycles,
} from "@/lib/season/long-run-profile";
import { isTransferActionAllowed } from "@/lib/season/transfer-season-policy";

import {
  applyQuickSimSeasonEndStack,
  collectTeamRows,
  countDraftBuys,
  log,
  resolvePersistenceFromEnv,
  round,
  setAllTeamsAi,
  type TeamRow,
} from "./s1-s2-transfer-shared";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_DRAFT_SEED = "s1-draft-batch:2026-07-06T09-49-24:run-2";
const DEFAULT_DRAFT_STEPS = 14;

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function parseRuns(argv: string[]) {
  const idx = argv.indexOf("--runs");
  if (idx >= 0 && argv[idx + 1]) {
    const parsed = Number(argv[idx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }
  return 10;
}

function hashFingerprint(parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

function leagueCash(gameState: { teams: Array<{ cash?: number | null }> }) {
  return round(gameState.teams.reduce((sum, team) => sum + (team.cash ?? 0), 0));
}

function leagueSalary(gameState: PersistedSaveGame["gameState"]) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return round(
    gameState.rosters.reduce((sum, entry) => {
      const player = playerById.get(entry.playerId);
      const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      return sum + (economy.salary ?? entry.salary ?? entry.upkeep ?? 0);
    }, 0),
  );
}

function teamSalary(gameState: PersistedSaveGame["gameState"], teamId: string) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return round(
    gameState.rosters
      .filter((entry) => entry.teamId === teamId)
      .reduce((sum, entry) => {
        const player = playerById.get(entry.playerId);
        const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
        return sum + (economy.salary ?? entry.salary ?? entry.upkeep ?? 0);
      }, 0),
  );
}

function checkpointCopySqlite(sourceDbPath: string, targetPath: string) {
  const db = new Database(sourceDbPath, { readonly: true });
  try {
    db.exec(`VACUUM INTO '${targetPath.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${targetPath}${suffix}`;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  }
}

function copySqliteWithSidecars(source: string, target: string) {
  checkpointCopySqlite(source, target);
}

function cloneBaselineForRun(sourceDbPath: string, runDir: string): string {
  fs.mkdirSync(runDir, { recursive: true });
  const targetPath = path.join(runDir, "balancing-run.sqlite");
  checkpointCopySqlite(sourceDbPath, targetPath);
  closeDatabaseForMaintenance();
  process.env.OLY_APP_SQLITE_PATH = targetPath;
  return targetPath;
}

function buildPreSellSnapshot(save: PersistedSaveGame, teamRows: TeamRow[]) {
  return {
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    gamePhase: save.gameState.gamePhase ?? null,
    matchdayId: save.gameState.matchdayState.matchdayId,
    matchdaysResolved: (save.gameState.seasonState.matchdayResults ?? []).filter(
      (entry) => entry.seasonId === "season-1",
    ).length,
    leagueCash: leagueCash(save.gameState),
    leagueRoster: teamRows.reduce((sum, row) => sum + row.roster, 0),
    leagueSalary: leagueSalary(save.gameState),
    teamsAtMin: teamRows.filter((row) => row.atMin).length,
    teamsAtOpt: teamRows.filter((row) => row.atOpt).length,
    avgCashPerTeam: round(teamRows.reduce((sum, row) => sum + row.cash, 0) / Math.max(1, teamRows.length)),
    simulationMode: "full_matchday_simulation",
    fastBootstrapUsed: false,
  };
}

async function runFullSimMd10Baseline(input: {
  outputDir: string;
  draftSeed: string;
  draftSteps: number;
}): Promise<{ saveId: string; sqlitePath: string; meta: Record<string, unknown> }> {
  const baselineRunDir = path.join(input.outputDir, "baseline-run");
  await mkdir(baselineRunDir, { recursive: true });
  const started = Date.now();

  closeDatabaseForMaintenance();
  delete process.env.OLY_APP_SQLITE_PATH;
  const dbIsolation = ensureIsolatedLongRunDatabase({ outputDir: baselineRunDir, projectRoot: PROJECT_ROOT });
  const persistence = createPersistenceService();

  log(`Creating batch-equivalent draft (seed=${input.draftSeed})…`, "s1-sell-batch");
  const fresh = persistence.createFreshSeasonOneSave({
    name: `S1 Sell Batch MD10 Baseline ${new Date().toISOString()}`,
  });
  await runSeasonStartReset({
    source: "sqlite",
    saveId: fresh.saveId,
    seasonId: fresh.gameState.season.id,
    dryRun: false,
    confirmToken: SEASON_START_RESET_CONFIRM_TOKEN,
  });

  let save = persistence.getSaveById(fresh.saveId) ?? fresh;
  save = setAllTeamsAi(save, persistence);

  const draftStarted = Date.now();
  const preview = await runAiPicksExecutePreview(
    {
      source: "sqlite",
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      dryRun: false,
      confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
      teamScope: "all",
      allowSetupAllTeams: true,
      stepsPerTeam: input.draftSteps,
      runMode: "season1_optimum_execute",
      draftSeed: input.draftSeed,
    },
    persistence,
  );
  save = persistence.getSaveById(save.saveId) ?? save;
  save = finalizeSeasonOneDraftAuditReady(save, persistence);
  save = finalizeSeasonOneBootstrapPhase(save, persistence).save;
  save = setAllTeamsAi(save, persistence);

  const draftTeamRows = collectTeamRows(save.gameState);
  const draftMeta = {
    appliedPicks: preview.appliedPicks ?? countDraftBuys(save.gameState),
    teamsAtMin: draftTeamRows.filter((row) => row.atMin).length,
    teamsAtOpt: draftTeamRows.filter((row) => row.atOpt).length,
    draftDurationMs: Date.now() - draftStarted,
    blockingReasons: preview.blockingReasons ?? [],
  };
  log(`Draft ready: ${save.saveId} · min=${draftMeta.teamsAtMin}/32 opt=${draftMeta.teamsAtOpt}/32`, "s1-sell-batch");

  log(`Running 10 real matchdays (pre_season_end stop)…`, "s1-sell-batch");
  execFileSync(process.execPath, ["--import", "tsx", path.join(PROJECT_ROOT, "scripts", "long-run-sandbox-s1-s6.ts")], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=8192",
      OLY_APP_SQLITE_PATH: dbIsolation.sqlitePath,
      OLY_LONG_RUN_OUTPUT_DIR: baselineRunDir,
      OLY_LONG_RUN_SAVE_ID: save.saveId,
      OLY_LONG_RUN_STOP_AFTER: "pre_season_end",
      OLY_LONG_RUN_FINAL_SEASON: "1",
      OLY_LONG_RUN_ALLOW_DEV_SERVER: "1",
    },
    stdio: "inherit",
  });

  const baselineDbPath = path.join(input.outputDir, "baseline-md10.sqlite");
  copySqliteWithSidecars(dbIsolation.sqlitePath, baselineDbPath);
  closeDatabaseForMaintenance();
  process.env.OLY_APP_SQLITE_PATH = baselineDbPath;
  save = resolvePersistenceFromEnv().getSaveById(save.saveId)!;
  const teamRows = collectTeamRows(save.gameState);
  const meta = {
    ...buildPreSellSnapshot(save, teamRows),
    draftSeed: input.draftSeed,
    draftSteps: input.draftSteps,
    draft: draftMeta,
    durationMs: Date.now() - started,
    sqlitePath: baselineDbPath,
  };
  await writeFile(path.join(input.outputDir, "baseline-md10.json"), JSON.stringify(meta, null, 2));
  await writeFile(path.join(input.outputDir, "baseline-team-rows-pre-sell.json"), JSON.stringify(teamRows, null, 2));
  return { saveId: save.saveId, sqlitePath: baselineDbPath, meta };
}

async function preparePreSellSeasonEnd(save: PersistedSaveGame, persistence: PersistenceService) {
  let current = (await applyQuickSimSeasonEndStack(save, persistence)).save;
  const contractPreview = previewSeasonEndContracts(current);
  if (contractPreview.blockingReasons.length === 0) {
    const contractApply = applySeasonEndContractTick(current, contractPreview.confirmToken, persistence, contractPreview);
    if (contractApply.applied) current = persistence.getSaveById(current.saveId) ?? current;
  }
  return persistence.saveSingleplayerState(current.saveId, applySeasonEndRosterStressLedger(current.gameState, current.gameState.season.id));
}

type SellRunMetrics = {
  run: number;
  fingerprint: string;
  sellPlayerIdsHash: string;
  sellPlayerIds: string[];
  appliedSells: number;
  teamsWithSell: number;
  marketSells: number;
  contractExitsPrep: number;
  contractExitsSession: number;
  cash: {
    beforeSell: number;
    afterSell: number;
    delta: number;
    grossSellFees: number;
    totalBuyoutPaid: number;
    teamsNegativeAfter: string[];
  };
  salary: { beforeTotal: number; afterTotal: number };
  roster: {
    teamsBelowMin: string[];
    zeroRosterTeams: string[];
    teamsNeedingS2PreseasonBuys: number;
  };
  soldThisSeasonCooldown: Array<{ playerId: string; fromTeamId: string; fee: number | null }>;
  blockingReasons: string[];
  warnings: string[];
  durationMs: number;
};

async function runSellOnly(input: {
  run: number;
  baselineDbPath: string;
  sourceSaveId: string;
  outputDir: string;
}): Promise<SellRunMetrics> {
  const runDir = path.join(input.outputDir, `run-${String(input.run).padStart(2, "0")}`);
  cloneBaselineForRun(input.baselineDbPath, runDir);
  const persistence = resolvePersistenceFromEnv();
  let save = persistence.getSaveById(input.sourceSaveId)!;
  save = setAllTeamsAi(save, persistence);
  const started = Date.now();
  const historyBeforePrep = save.gameState.transferHistory.length;

  save = await preparePreSellSeasonEnd(save, persistence);
  const prepHistory = save.gameState.transferHistory.slice(historyBeforePrep);
  const contractExitsPrep = prepHistory.filter((e) => e.transferType === "contract_exit").length;
  const historyAfterPrep = save.gameState.transferHistory.length;

  const rowsBeforeSell = collectTeamRows(save.gameState);
  const rosterIdsBeforeSell = new Set(save.gameState.rosters.map((entry) => entry.playerId));
  const cashBeforeSell = leagueCash(save.gameState);
  const salaryBeforeSell = leagueSalary(save.gameState);
  const cashByTeamBefore = new Map(save.gameState.teams.map((team) => [team.teamId, round(team.cash ?? 0)]));

  const session = await runTransferWindowSession({
    saveId: save.saveId,
    seasonId: "season-1",
    persistence,
    phase: "season_end",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    maxTeamCycles: getLongRunPlannerMaxTeamCycles(),
    maxLeagueRounds: getLongRunPlannerMaxLeagueRounds(),
    allowBuys: isTransferActionAllowed("season-1", "season_end_market_buy"),
    skipIfExistingMarketTransfers: false,
    progressLog: false,
  });

  save = persistence.getSaveById(save.saveId)!;
  const rowsAfterSell = collectTeamRows(save.gameState);
  const cashAfterSell = leagueCash(save.gameState);
  const sellSessionHistory = save.gameState.transferHistory.slice(historyAfterPrep);
  const marketSells =
    sellSessionHistory.filter((e) => e.transferType === "sell").length > 0
      ? sellSessionHistory.filter((e) => e.transferType === "sell")
      : save.gameState.transferHistory.filter(
          (entry) =>
            entry.seasonId === "season-1" &&
            entry.transferType === "sell" &&
            !rosterIdsBeforeSell.has(entry.playerId) &&
            save.gameState.rosters.every((row) => row.playerId !== entry.playerId),
        );
  const soldPlayerIdsFromRoster = [...rosterIdsBeforeSell].filter(
    (playerId) => !save.gameState.rosters.some((entry) => entry.playerId === playerId),
  );
  const contractExitsSession = sellSessionHistory.filter((e) => e.transferType === "contract_exit").length;
  const grossSellFees = round(marketSells.reduce((sum, entry) => sum + (entry.fee ?? 0), 0));
  const netCashFromSells = round(cashAfterSell - cashBeforeSell);
  const totalBuyoutPaid = round(Math.max(0, grossSellFees - netCashFromSells));
  const teamsWithSell = session.perTeam.filter((team) => team.appliedSells > 0).length;
  const teamsBelowMin = rowsAfterSell.filter((row) => row.roster < row.playerMin).map((row) => `${row.teamCode}:${row.roster}/${row.playerMin}`);
  const zeroRosterTeams = rowsAfterSell.filter((row) => row.roster === 0).map((row) => row.teamCode);
  const sellPlayerIds = (marketSells.length > 0 ? marketSells.map((entry) => entry.playerId) : soldPlayerIdsFromRoster).sort();
  const sellPlayerIdsHash = hashFingerprint(sellPlayerIds);

  return {
    run: input.run,
    fingerprint: hashFingerprint([
      String(session.appliedSells),
      sellPlayerIdsHash,
      String(cashAfterSell),
      teamsBelowMin.join(","),
    ]),
    sellPlayerIdsHash,
    sellPlayerIds,
    appliedSells: session.appliedSells,
    teamsWithSell,
    marketSells: marketSells.length,
    contractExitsPrep,
    contractExitsSession,
    cash: {
      beforeSell: cashBeforeSell,
      afterSell: cashAfterSell,
      delta: netCashFromSells,
      grossSellFees,
      totalBuyoutPaid,
      teamsNegativeAfter: save.gameState.teams.filter((t) => (t.cash ?? 0) < 0).map((t) => t.shortCode ?? t.teamId),
    },
    salary: { beforeTotal: salaryBeforeSell, afterTotal: leagueSalary(save.gameState) },
    roster: {
      teamsBelowMin,
      zeroRosterTeams,
      teamsNeedingS2PreseasonBuys: teamsBelowMin.length,
    },
    soldThisSeasonCooldown: [...buildSoldPlayerSeasonBans(save.gameState, "season-1").values()].map((ban) => ({
      playerId: ban.playerId,
      fromTeamId: ban.fromTeamId,
      fee: ban.fee,
    })),
    blockingReasons: session.blockingReasons,
    warnings: session.warnings.slice(0, 20),
    durationMs: Date.now() - started,
  };
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const runs = parseRuns(process.argv.slice(2));
  const draftSeed = argValue("--draft-seed") ?? DEFAULT_DRAFT_SEED;
  const draftSteps = Number(argValue("--steps-per-team") ?? String(DEFAULT_DRAFT_STEPS));
  const skipBaseline = hasFlag("--skip-baseline");
  const baselineDbArg = argValue("--baseline-db");
  const outputDirArg = argValue("--output-dir");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputDir =
    outputDirArg ??
    path.join(PROJECT_ROOT, "outputs", skipBaseline && baselineDbArg ? path.dirname(baselineDbArg) : `s1-sell-batch-md10-${timestamp}`);
  await mkdir(outputDir, { recursive: true });

  let baselineDbPath: string;
  let sourceSaveId: string;
  let baselineMeta: Record<string, unknown>;

  if (skipBaseline) {
    baselineDbPath = path.isAbsolute(baselineDbArg ?? "")
      ? baselineDbArg!
      : path.join(PROJECT_ROOT, baselineDbArg ?? "baseline-md10.sqlite");
    const db = new Database(baselineDbPath, { readonly: true });
    sourceSaveId =
      (db.prepare("SELECT save_id FROM saves ORDER BY updated_at DESC LIMIT 1").get() as { save_id: string }).save_id;
    db.close();
    const metaPath = path.join(path.dirname(baselineDbPath), "baseline-md10.json");
    baselineMeta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : { saveId: sourceSaveId };
  } else {
    const baseline = await runFullSimMd10Baseline({ outputDir, draftSeed, draftSteps });
    baselineDbPath = baseline.sqlitePath;
    sourceSaveId = baseline.saveId;
    baselineMeta = baseline.meta;
  }

  const results: SellRunMetrics[] = [];
  for (let run = 1; run <= runs; run += 1) {
    log(`Sell run ${run}/${runs}…`, "s1-sell-batch");
    const metrics = await runSellOnly({ run, baselineDbPath, sourceSaveId, outputDir });
    results.push(metrics);
    await writeFile(path.join(outputDir, `run-${String(run).padStart(2, "0")}`, "sell-metrics.json"), JSON.stringify(metrics, null, 2));
    log(`Run ${run}: sells=${metrics.appliedSells} teams=${metrics.teamsWithSell} belowMin=${metrics.roster.teamsBelowMin.length} fp=${metrics.fingerprint}`, "s1-sell-batch");
  }

  const fps = [...new Set(results.map((r) => r.fingerprint))];
  const phs = [...new Set(results.map((r) => r.sellPlayerIdsHash))];
  const summary = {
    runs,
    baseline: baselineMeta,
    identical: fps.length === 1,
    identicalPlayerLists: phs.length === 1,
    results,
  };
  await writeFile(path.join(outputDir, "batch-summary.json"), JSON.stringify(summary, null, 2));

  const table = [
    "| Run | Sells | Teams w/sell | Contract prep | Contract session | Below min | Zero | Cash Δ | Gross | Buyout | FP |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...results.map(
      (r) =>
        `| ${r.run} | ${r.appliedSells} | ${r.teamsWithSell} | ${r.contractExitsPrep} | ${r.contractExitsSession} | ${r.roster.teamsBelowMin.length} | ${r.roster.zeroRosterTeams.length} | ${r.cash.delta} | ${r.cash.grossSellFees} | ${r.cash.totalBuyoutPaid} | \`${r.fingerprint}\` |`,
    ),
  ].join("\n");

  const first = results[0];
  await writeFile(
    path.join(outputDir, "summary.md"),
    [
      "# S1 Season-End Sell Batch Audit (MD10 Full-Sim Baseline)",
      "",
      `- Output: \`${outputDir}\``,
      `- Baseline save: \`${baselineMeta.saveId}\` · MD=${baselineMeta.matchdaysResolved} · full sim (no fast bootstrap)`,
      `- Draft seed: \`${baselineMeta.draftSeed ?? draftSeed}\``,
      `- Pre-sell: cash=${baselineMeta.leagueCash} roster=${baselineMeta.leagueRoster} salary=${baselineMeta.leagueSalary} min/opt=${baselineMeta.teamsAtMin}/${baselineMeta.teamsAtOpt}`,
      "",
      "## Determinism",
      summary.identical ? "**Deterministic** — identical fingerprints." : `**Variation** — ${fps.length} unique fingerprints.`,
      summary.identicalPlayerLists ? "**Sell player lists identical.**" : `**Sell lists differ** — ${phs.length} unique hashes.`,
      "",
      table,
      "",
      "## Additional checks (run 1)",
      `- Contract exits prep/session: ${first?.contractExitsPrep} / ${first?.contractExitsSession}`,
      `- S2 preseason teams needing buys: ${first?.roster.teamsNeedingS2PreseasonBuys}/32`,
      `- Negative cash teams: ${first?.cash.teamsNegativeAfter.join(", ") || "none"}`,
      `- Sold-this-season cooldown: ${first?.soldThisSeasonCooldown.length} players`,
      `- Salary Σ: ${first?.salary.beforeTotal} → ${first?.salary.afterTotal}`,
      `- Blockers: ${first?.blockingReasons.join(", ") || "none"}`,
      `- Warnings: ${first?.warnings.slice(0, 5).join("; ") || "none"}`,
    ].join("\n"),
  );

  console.log(JSON.stringify({ outputDir, baselineSaveId: sourceSaveId, identical: summary.identical, results: summary.results.map((r) => ({ run: r.run, appliedSells: r.appliedSells, fp: r.fingerprint })) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
