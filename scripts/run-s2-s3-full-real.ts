/**
 * S2→S3 full real run: resume active save at S2, play S2 matchdays + season_end,
 * then S3 preseason only. Optional live DB import + activate.
 *
 * Usage:
 *   OLY_LONG_RUN_ALLOW_DEV_SERVER=1 node --import tsx scripts/run-s2-s3-full-real.ts \
 *     --source-save-id fresh-season-1-1783268080411-real-20260705 \
 *     --import-live --activate
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import type { PersistedSaveGame } from "@/lib/persistence/types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { closeDatabaseForMaintenance } from "@/lib/persistence/sqlite";
import { ensureIsolatedLongRunDatabase } from "@/lib/season/long-run-db-isolation";

import { PROJECT_ROOT, buildRunKpiSnapshot, log } from "./s1-s2-transfer-shared";

const LIVE_DB = path.join(PROJECT_ROOT, "data/persistence/oly-app.sqlite");

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function runLongRunSandbox(input: {
  outputDir: string;
  saveId: string;
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
    OLY_LONG_RUN_SAVE_ID: input.saveId,
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

function buildS2S3Summary(save: PersistedSaveGame) {
  const base = buildRunKpiSnapshot("S2→S3 Full Real", save);
  const stressRows = Object.values(save.gameState.seasonState.teamRosterStressByTeamId ?? {});
  return {
    ...base,
    s2SellCount: save.gameState.transferHistory.filter((e) => e.seasonId === "season-2" && e.transferType === "sell").length,
    s3BuyCount: save.gameState.transferHistory.filter((e) => e.seasonId === "season-3" && e.transferType === "buy").length,
    depthStressTeams: stressRows.filter((row) => row.optBump > 0).length,
    depthStressSample: stressRows
      .filter((row) => row.optBump > 0)
      .slice(0, 8)
      .map((row) => {
        const team = save.gameState.teams.find((entry) => entry.teamId === row.teamId);
        return {
          teamCode: team?.shortCode ?? row.teamId,
          optBump: row.optBump,
          depthStressScore: row.depthStressScore,
          slotGapMatchdays: row.matchdaysWithSlotGaps,
        };
      }),
  };
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const importLive = hasFlag("--import-live");
  const activate = hasFlag("--activate");
  const sourceSaveId =
    argValue("--source-save-id") ??
    createPersistenceService().getActiveSave()?.saveId ??
    null;
  if (!sourceSaveId) {
    throw new Error("Missing --source-save-id and no active save in live DB");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputDir = path.join(PROJECT_ROOT, "outputs", `s2-s3-full-real-${timestamp}`);
  fs.mkdirSync(outputDir, { recursive: true });
  log(`Output → ${outputDir}`);
  log(`Source save → ${sourceSaveId}`);

  const dbIsolation = ensureIsolatedLongRunDatabase({ outputDir, projectRoot: PROJECT_ROOT });
  log(`DB → ${dbIsolation.sqlitePath} (isolated=${dbIsolation.isolated}, cloned=${dbIsolation.clonedFromShared})`);
  process.env.OLY_APP_SQLITE_PATH = dbIsolation.sqlitePath;
  const persistence = createPersistenceService();

  const sourceSave = persistence.getSaveById(sourceSaveId);
  if (!sourceSave) {
    throw new Error(`Source save ${sourceSaveId} not found in isolated DB clone`);
  }
  log(`Resume state: ${sourceSave.gameState.season.id} / ${sourceSave.gameState.matchdayState.matchdayId} / ${sourceSave.gameState.gamePhase ?? "unknown"}`);

  log("Phase 1: S2 matchdays + season_end…");
  const phase1 = runLongRunSandbox({
    outputDir,
    saveId: sourceSaveId,
    finalSeason: 2,
    stopAfter: "season_end",
    label: `S2-S3 Full Real S2 ${timestamp}`,
    logFile: path.join(outputDir, "phase1-s2-full.log"),
  });
  if (phase1.status !== 0) {
    log(`WARN: Phase 1 exit ${phase1.status}`);
  }

  const phase1Save = persistence.getSaveById(sourceSaveId);
  if (!phase1Save || phase1Save.gameState.season.id !== "season-2") {
    throw new Error(`Phase 1: expected season-2, got ${phase1Save?.gameState.season.id ?? "missing"}`);
  }
  if ((phase1Save.gameState.gamePhase ?? "") !== "season_completed") {
    throw new Error(`Phase 1: expected season_completed, got ${phase1Save.gameState.gamePhase ?? "missing"}`);
  }
  fs.writeFileSync(path.join(outputDir, "run-manifest.txt"), `SAVE_ID=${sourceSaveId}\nPHASE=1\n`);
  log("Phase 1 validated — S2 season_completed");

  log("Phase 2: S3 transition + preseason…");
  const phase2 = runLongRunSandbox({
    outputDir,
    saveId: sourceSaveId,
    finalSeason: 3,
    stopAfter: "preseason",
    label: `S2-S3 Full Real S3 preseason ${timestamp}`,
    logFile: path.join(outputDir, "phase2-s3-preseason.log"),
  });
  fs.appendFileSync(path.join(outputDir, "run-manifest.txt"), `PHASE=2\nPHASE2_EXIT=${phase2.status}\n`);
  if (phase2.status !== 0) {
    log(`WARN: Phase 2 exit ${phase2.status}`);
  }

  const finalSave = persistence.getSaveById(sourceSaveId);
  if (!finalSave || finalSave.gameState.season.id !== "season-3") {
    throw new Error(`Phase 2: expected season-3, got ${finalSave?.gameState.season.id ?? "missing"}`);
  }
  if ((finalSave.gameState.gamePhase ?? "") !== "season_active") {
    throw new Error(`Phase 2: expected season_active, got ${finalSave.gameState.gamePhase ?? "missing"}`);
  }

  const summary = buildS2S3Summary(finalSave);
  fs.writeFileSync(path.join(outputDir, "run-summary.json"), JSON.stringify({ generatedAt: new Date().toISOString(), ...summary, hardGreen: summary.hardFails.length === 0 }, null, 2));
  fs.writeFileSync(path.join(outputDir, "team-rows-after-preseason.json"), JSON.stringify(summary.teamRows, null, 2));

  if (summary.hardFails.length > 0) {
    throw new Error(`Hard KPI fail: ${summary.hardFails.join(" | ")}`);
  }

  log(
    `KPI: S2 sell=${summary.s2SellCount} S3 buy=${summary.s3BuyCount} opt=${summary.teamsAtOpt}/32 avgCash=${summary.avgCash} depthStressTeams=${summary.depthStressTeams}`,
  );

  if (importLive) {
    closeDatabaseForMaintenance();
    delete process.env.OLY_APP_SQLITE_PATH;
    const livePersistence = createPersistenceService();
    const previousActive = livePersistence.getActiveSave();
    const importTargetSaveId = `${sourceSaveId}-s2s3-${timestamp.replace(/-/g, "").slice(0, 8)}`;
    const rollbackManifest = {
      importedAt: new Date().toISOString(),
      previousActiveSaveId: previousActive?.saveId ?? null,
      previousActiveSaveName: previousActive?.name ?? null,
      importedSaveId: importTargetSaveId,
      sourceSaveId,
      sourceDb: dbIsolation.sqlitePath,
      outputDir,
    };
    fs.writeFileSync(path.join(outputDir, "import-rollback-manifest.json"), JSON.stringify(rollbackManifest, null, 2));

    log(`Importing into live DB as ${importTargetSaveId}…`);
    const importResult = runImportScript({
      sourceDb: dbIsolation.sqlitePath,
      sourceSaveId,
      targetSaveId: importTargetSaveId,
      targetName: `S2-S3 Full Real (${timestamp.slice(0, 10)})`,
    });
    fs.writeFileSync(path.join(outputDir, "import-live.log"), `${importResult.stdout ?? ""}${importResult.stderr ?? ""}`);
    if (importResult.status !== 0) {
      throw new Error("Live import failed — see import-live.log");
    }

    if (activate) {
      closeDatabaseForMaintenance();
      delete process.env.OLY_APP_SQLITE_PATH;
      const activatedPersistence = createPersistenceService();
      const activated = activatedPersistence.activateSave(importTargetSaveId);
      if (!activated) throw new Error(`activateSave failed for ${importTargetSaveId}`);
      log(`Activated save ${importTargetSaveId}`);
      fs.appendFileSync(
        path.join(outputDir, "import-rollback-manifest.json"),
        `\nActivated: ${importTargetSaveId}\nRollback: activate previous save ${previousActive?.saveId ?? "n/a"} in UI\n`,
      );
    }
  }

  log(`Done → ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
