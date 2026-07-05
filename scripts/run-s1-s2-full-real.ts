/**
 * S1→S2 full real run: fresh save, 10 S1 matchdays, season_end, S2 preseason only.
 * Benchmark vs. fast-smoke from-save, optional live DB import + activate.
 *
 * Usage:
 *   node --import tsx scripts/run-s1-s2-full-real.ts \
 *     --benchmark outputs/s1-s2-transfer-from-save-2026-07-05T14-11-33/transfer-summary.json \
 *     --import-live --activate
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { closeDatabaseForMaintenance } from "@/lib/persistence/sqlite";
import { ensureIsolatedLongRunDatabase } from "@/lib/season/long-run-db-isolation";

import {
  PROJECT_ROOT,
  buildBenchmarkComparisonMarkdown,
  buildRunKpiSnapshot,
  loadBenchmarkSnapshotFromOutput,
  log,
} from "./s1-s2-transfer-shared";

const DEFAULT_BENCHMARK = path.join(
  PROJECT_ROOT,
  "outputs/s1-s2-transfer-from-save-2026-07-05T14-11-33/transfer-summary.json",
);
const LIVE_DB = path.join(PROJECT_ROOT, "data/persistence/oly-app.sqlite");

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function extractSaveId(logText: string): string | null {
  const match = logText.match(/fresh-season-1-\d+/);
  return match?.[0] ?? null;
}

function runLongRunSandbox(input: {
  outputDir: string;
  saveId?: string;
  finalSeason: number;
  stopAfter: "season_end" | "preseason";
  label: string;
  logFile: string;
}) {
  const scriptPath = path.join(PROJECT_ROOT, "scripts/long-run-sandbox-s1-s6.ts");
  const nodeOptions = process.env.NODE_OPTIONS?.includes("max-old-space-size")
    ? process.env.NODE_OPTIONS
    : "--max-old-space-size=8192";
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
    OLY_LONG_RUN_OUTPUT_DIR: input.outputDir,
    OLY_LONG_RUN_FINAL_SEASON: String(input.finalSeason),
    OLY_LONG_RUN_STOP_AFTER: input.stopAfter,
    OLY_LONG_RUN_LABEL: input.label,
    OLY_UNIFIED_PICK: process.env.OLY_UNIFIED_PICK ?? "1",
    OLY_LONG_RUN_PLANNER_MAX_TEAM_CYCLES: process.env.OLY_LONG_RUN_PLANNER_MAX_TEAM_CYCLES ?? "5",
    OLY_LONG_RUN_PLANNER_MAX_LEAGUE_ROUNDS: process.env.OLY_LONG_RUN_PLANNER_MAX_LEAGUE_ROUNDS ?? "5",
    OLY_LONG_RUN_BALANCE_PROFILE: process.env.OLY_LONG_RUN_BALANCE_PROFILE ?? "iterate",
    OLY_LONG_RUN_TEST_SOFT_DRAFT_SPEND: process.env.OLY_LONG_RUN_TEST_SOFT_DRAFT_SPEND ?? "1",
    OLY_LONG_RUN_RELAX_DRAFT_TOPUP_AUDIT: process.env.OLY_LONG_RUN_RELAX_DRAFT_TOPUP_AUDIT ?? "1",
    OLY_LONG_RUN_REQUIRE_NO_DEV_SERVER: process.env.OLY_LONG_RUN_REQUIRE_NO_DEV_SERVER ?? "1",
    OLY_LONG_RUN_ALLOW_DEV_SERVER: process.env.OLY_LONG_RUN_ALLOW_DEV_SERVER ?? "0",
    OLY_LONG_RUN_ACTIVATE_ON_FINISH: "0",
  };
  if (input.saveId) env.OLY_LONG_RUN_SAVE_ID = input.saveId;

  const result = spawnSync(process.execPath, ["--import", "tsx", scriptPath], {
    cwd: PROJECT_ROOT,
    env,
    encoding: "utf8",
  });
  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  fs.writeFileSync(input.logFile, combined);
  return { status: result.status ?? 1, log: combined };
}

function runImportScript(input: {
  sourceDb: string;
  sourceSaveId: string;
  targetName: string;
  targetSaveId?: string;
}) {
  const args = [
    "--import",
    "tsx",
    path.join(PROJECT_ROOT, "scripts/import-balancing-save-into-live-db.ts"),
    "--source-db",
    input.sourceDb,
    "--source-save-id",
    input.sourceSaveId,
    "--target-db",
    LIVE_DB,
    "--target-name",
    input.targetName,
  ];
  if (input.targetSaveId) {
    args.push("--target-save-id", input.targetSaveId);
  }
  return spawnSync(process.execPath, args, { cwd: PROJECT_ROOT, encoding: "utf8", stdio: "pipe" });
}

function runExportScripts(outputDir: string, saveId: string) {
  const exports: Array<{ name: string; args: string[]; outFile: string }> = [
    {
      name: "team-kpi-table",
      args: ["--import", "tsx", "scripts/export-team-kpi-table.ts", "--save-id", saveId, "--output", path.join(outputDir, "team-kpi-table.md")],
      outFile: "export-kpi.log",
    },
    {
      name: "team-finance-season",
      args: ["--import", "tsx", "scripts/export-team-finance-season-table.ts", "--save-id", saveId],
      outFile: "export-finance.log",
    },
  ];
  for (const entry of exports) {
    const result = spawnSync(process.execPath, entry.args, { cwd: PROJECT_ROOT, encoding: "utf8" });
    fs.writeFileSync(path.join(outputDir, entry.outFile), `${result.stdout ?? ""}${result.stderr ?? ""}`);
    if (entry.name === "team-finance-season" && result.stdout) {
      fs.writeFileSync(path.join(outputDir, "team-finance-season-table.md"), result.stdout);
    }
  }
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const benchmarkArg = argValue("--benchmark") ?? DEFAULT_BENCHMARK;
  const importLive = hasFlag("--import-live");
  const activate = hasFlag("--activate");
  const skipRun = hasFlag("--skip-run");
  const resumeDir = argValue("--resume-dir");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputDir = resumeDir
    ? path.isAbsolute(resumeDir)
      ? resumeDir
      : path.join(PROJECT_ROOT, resumeDir)
    : path.join(PROJECT_ROOT, "outputs", `s1-s2-full-real-${timestamp}`);
  fs.mkdirSync(outputDir, { recursive: true });

  log(`Output → ${outputDir}`);

  const dbIsolation = ensureIsolatedLongRunDatabase({ outputDir, projectRoot: PROJECT_ROOT });
  log(`DB → ${dbIsolation.sqlitePath} (isolated=${dbIsolation.isolated})`);
  process.env.OLY_APP_SQLITE_PATH = dbIsolation.sqlitePath;
  const persistence = createPersistenceService();

  let saveId: string | null = null;
  const manifestPath = path.join(outputDir, "run-manifest.txt");
  const existingManifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, "utf8") : null;
  let resumeSaveId = existingManifest?.match(/SAVE_ID=(.+)/)?.[1]?.trim() ?? null;
  if (!resumeSaveId && resumeDir) {
    const phase1LogPath = path.join(outputDir, "phase1-s1-full.log");
    if (fs.existsSync(phase1LogPath)) {
      resumeSaveId = extractSaveId(fs.readFileSync(phase1LogPath, "utf8"));
    }
  }

  function phase1AlreadyComplete(id: string) {
    const s = persistence.getSaveById(id);
    return (
      s?.gameState.season.id === "season-1" && (s.gameState.gamePhase ?? "") === "season_completed"
    );
  }

  if (!skipRun) {
    const skipPhase1 = Boolean(resumeDir && resumeSaveId && phase1AlreadyComplete(resumeSaveId));
    if (skipPhase1 && resumeSaveId) {
      saveId = resumeSaveId;
      log(`Resume: Phase 1 already complete (${saveId}) — skipping to Phase 2`);
    } else {
      log("Phase 1: S1 Draft + 10 MD + season_end…");
      const phase1 = runLongRunSandbox({
        outputDir,
        finalSeason: 1,
        stopAfter: "season_end",
        label: `S1-S2 Full Real S1 ${timestamp}`,
        logFile: path.join(outputDir, "phase1-s1-full.log"),
      });
      saveId = extractSaveId(phase1.log) ?? resumeSaveId;
      if (!saveId) {
        throw new Error("Phase 1: could not extract saveId from log");
      }
      if (phase1.status !== 0) {
        log(`WARN: Phase 1 exit ${phase1.status}`);
      }

      const phase1Save = persistence.getSaveById(saveId);
      const phase1LogComplete = phase1.log.includes("[long-run] STOP_AFTER=season_end —");
      const phase1DbComplete = phase1AlreadyComplete(saveId);
      if (!phase1LogComplete && !phase1DbComplete) {
        throw new Error("Phase 1 did not complete S1 season_end — check phase1-s1-full.log");
      }
      if (!phase1Save || phase1Save.gameState.season.id !== "season-1") {
        throw new Error(`Phase 1: expected season-1 save, got ${phase1Save?.gameState.season.id ?? "missing"}`);
      }
      if ((phase1Save.gameState.gamePhase ?? "") !== "season_completed") {
        throw new Error(`Phase 1: expected season_completed, got ${phase1Save.gameState.gamePhase ?? "missing"}`);
      }
      if (!phase1LogComplete) {
        log("WARN: Phase 1 missing STOP_AFTER log line — accepted via season_completed DB state");
      }

      fs.writeFileSync(manifestPath, `SAVE_ID=${saveId}\nPHASE=1\n`);
      log(`Phase 1 validated — season_completed, proceeding to Phase 2`);
    }

    log("Phase 2: S2 transition + preseason only…");

    const phase2 = runLongRunSandbox({
      outputDir,
      saveId,
      finalSeason: 2,
      stopAfter: "preseason",
      label: `S1-S2 Full Real S2 preseason ${timestamp}`,
      logFile: path.join(outputDir, "phase2-s2-preseason.log"),
    });
    fs.appendFileSync(path.join(outputDir, "run-manifest.txt"), `PHASE=2\nPHASE2_EXIT=${phase2.status}\n`);
    if (phase2.status !== 0) {
      log(`WARN: Phase 2 exit ${phase2.status}`);
    }
    const phase2Save = persistence.getSaveById(saveId!);
    const phase2LogComplete = phase2.log.includes("[long-run] STOP_AFTER=preseason — season-2");
    const phase2DbComplete =
      phase2Save?.gameState.season.id === "season-2" &&
      (phase2Save.gameState.gamePhase ?? "") === "season_active" &&
      phase2Save.gameState.matchdayState.matchdayId === "matchday-1" &&
      phase2Save.gameState.matchdayState.status !== "resolved";
    if (!phase2LogComplete && !phase2DbComplete) {
      throw new Error("Phase 2 did not stop after S2 preseason — check phase2-s2-preseason.log");
    }
    if (!phase2LogComplete) {
      log("WARN: Phase 2 missing STOP_AFTER log line — accepted via S2 preseason DB state");
    }
  } else {
    const manifest = fs.readFileSync(manifestPath, "utf8");
    saveId = manifest.match(/SAVE_ID=(.+)/)?.[1]?.trim() ?? null;
    if (!saveId) throw new Error("--skip-run requires existing run-manifest.txt with SAVE_ID");
  }

  const save = persistence.getSaveById(saveId!);
  if (!save) throw new Error(`Save missing after run: ${saveId}`);

  const realSnapshot = buildRunKpiSnapshot("Full Real Run", save);
  fs.writeFileSync(path.join(outputDir, "team-rows-after-preseason.json"), JSON.stringify(realSnapshot.teamRows, null, 2));
  fs.writeFileSync(path.join(outputDir, "economy-rows.json"), JSON.stringify(realSnapshot.economy.rows, null, 2));
  fs.writeFileSync(
    path.join(outputDir, "run-summary.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        saveId,
        sqlitePath: dbIsolation.sqlitePath,
        real: realSnapshot,
        hardGreen: realSnapshot.hardFails.length === 0,
      },
      null,
      2,
    ),
  );

  if (realSnapshot.hardFails.length > 0) {
    throw new Error(`Hard KPI fail: ${realSnapshot.hardFails.join(" | ")}`);
  }

  const benchmarkSnapshot = loadBenchmarkSnapshotFromOutput(benchmarkArg);
  if (benchmarkSnapshot) {
    const comparisonJson = {
      generatedAt: new Date().toISOString(),
      benchmark: benchmarkSnapshot,
      real: realSnapshot,
      delta: {
        s1SellCount: realSnapshot.s1SellCount - benchmarkSnapshot.s1SellCount,
        s2BuyCount: realSnapshot.s2BuyCount - benchmarkSnapshot.s2BuyCount,
        sellBuyGap: realSnapshot.economy.sellBuyCountGap - benchmarkSnapshot.economy.sellBuyCountGap,
        teamsAtOpt: realSnapshot.teamsAtOpt - benchmarkSnapshot.teamsAtOpt,
        avgCash: realSnapshot.avgCash - benchmarkSnapshot.avgCash,
        leagueExcessOverBuffer:
          realSnapshot.economy.leagueExcessOverBuffer - benchmarkSnapshot.economy.leagueExcessOverBuffer,
      },
    };
    fs.writeFileSync(path.join(outputDir, "benchmark-comparison.json"), JSON.stringify(comparisonJson, null, 2));
    fs.writeFileSync(
      path.join(outputDir, "benchmark-comparison.md"),
      buildBenchmarkComparisonMarkdown(benchmarkSnapshot, realSnapshot),
    );
    log("Benchmark comparison written");
  } else {
    log(`WARN: benchmark not found at ${benchmarkArg}`);
  }

  runExportScripts(outputDir, saveId);

  if (importLive) {
    closeDatabaseForMaintenance();
    delete process.env.OLY_APP_SQLITE_PATH;
    const livePersistence = createPersistenceService();
    const previousActive = livePersistence.getActiveSave();
    const importTargetSaveId = `${saveId}-real-${timestamp.replace(/-/g, "").slice(0, 8)}`;
    const rollbackManifest = {
      importedAt: new Date().toISOString(),
      previousActiveSaveId: previousActive?.saveId ?? null,
      previousActiveSaveName: previousActive?.name ?? null,
      importedSaveId: importTargetSaveId,
      sourceSaveId: saveId,
      sourceDb: dbIsolation.sqlitePath,
      outputDir,
    };
    fs.writeFileSync(path.join(outputDir, "import-rollback-manifest.json"), JSON.stringify(rollbackManifest, null, 2));

    log(`Importing into live DB as ${importTargetSaveId}…`);
    const importResult = runImportScript({
      sourceDb: dbIsolation.sqlitePath,
      sourceSaveId: saveId,
      targetSaveId: importTargetSaveId,
      targetName: `S1-S2 Full Real (${timestamp.slice(0, 10)})`,
    });
    fs.writeFileSync(
      path.join(outputDir, "import-live.log"),
      `${importResult.stdout ?? ""}${importResult.stderr ?? ""}`,
    );
    if (importResult.status !== 0) {
      throw new Error(`Live import failed — see import-live.log`);
    }

    if (activate) {
      closeDatabaseForMaintenance();
      delete process.env.OLY_APP_SQLITE_PATH;
      const activatedPersistence = createPersistenceService();
      const activated = activatedPersistence.activateSave(importTargetSaveId);
      if (!activated) throw new Error(`activateSave failed for ${importTargetSaveId}`);
      log(`Activated save ${importTargetSaveId} in live DB`);
      fs.appendFileSync(
        path.join(outputDir, "import-rollback-manifest.json"),
        `\nActivated: ${importTargetSaveId}\nRollback: activate previous save ${previousActive?.saveId ?? "n/a"} in UI\n`,
      );
    }
  }

  log(`Done → ${outputDir}`);
  log(
    `KPI: sell=${realSnapshot.s1SellCount} buy=${realSnapshot.s2BuyCount} gap=${realSnapshot.economy.sellBuyCountGap} opt=${realSnapshot.teamsAtOpt}/32 excess=${realSnapshot.economy.leagueExcessOverBuffer}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
