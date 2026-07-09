/**
 * Resilient S1–SN multi-season orchestrator with fix-and-resume checkpoints.
 *
 * Usage:
 *   tsx scripts/run-resilient-multiseason.ts --save-id <id> [--seasons 5] [--output-dir outputs/...]
 *   tsx scripts/run-resilient-multiseason.ts --fresh [--seasons 5] [--output-dir outputs/...]
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  buildPlayerAvailabilityByPlayerId,
  countSeasonInjuryEvents,
  collectTeamFatigueInjuryMetrics,
} from "@/lib/season/long-run-fatigue-collect";
import {
  logPhaseAuditObservations,
  logRunPausedObservation,
  logSlowPhaseObservation,
} from "@/lib/season/long-run-observation-log";
import {
  syncPerformanceObservations,
  writeLongRunPerformanceReport,
} from "@/lib/season/long-run-performance-analysis";
import { runPhaseAuditDe, type PhaseAuditResult } from "@/lib/season/long-run-phase-audit";
import { resolveBalanceProfile } from "@/lib/season/long-run-profile";
import { filterHardOpenTechnicalBugs, isSoftPhaseAuditRed } from "@/lib/season/long-run-soft-blockers";
import { ensureIsolatedLongRunDatabase } from "@/lib/season/long-run-db-isolation";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((entry) => entry.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] ?? null;
  return null;
}

function parseSeasonNumber(seasonId: string) {
  const match = seasonId.match(/(\d+)/);
  return match ? Number(match[1]) : 1;
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function log(message: string) {
  console.error(`[resilient-multiseason] ${message}`);
}

function readJsonIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function getNextSeasonTarget(saveSeasonId: string, gamePhase: string | undefined, targetSeasons: number) {
  const current = parseSeasonNumber(saveSeasonId);
  if ((gamePhase ?? "") === "season_completed") {
    if (current >= targetSeasons) return null;
    return current + 1;
  }
  return current;
}

function findLatestAuditJson(outputDir: string, saveId: string, phase: string, expectedSeasonId?: string) {
  const direct = path.join(outputDir, `long-run-audit-${phase}-${saveId}.json`);
  const candidates = fs.existsSync(direct) ? [direct] : [];
  const matches = fs
    .readdirSync(outputDir)
    .filter((name) => name.startsWith(`long-run-audit-${phase}-`) && name.endsWith(".json"))
    .map((name) => path.join(outputDir, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  for (const candidate of [...candidates, ...matches]) {
    if (!expectedSeasonId) return candidate;
    const audit = readJsonIfExists<PhaseAuditResult>(candidate);
    if (audit?.seasonId === expectedSeasonId) return candidate;
  }
  return null;
}

function writePausedManifest(input: {
  outputDir: string;
  saveId: string;
  seasonId: string;
  phase: string;
  reason: string;
  resumeCommand: string;
  openTechnicalBugs: string[];
  audit?: PhaseAuditResult | null;
}) {
  const manifest = {
    pausedAt: new Date().toISOString(),
    saveId: input.saveId,
    seasonId: input.seasonId,
    phase: input.phase,
    reason: input.reason,
    openTechnicalBugs: input.openTechnicalBugs,
    auditRed: input.audit?.checks.filter((entry) => entry.status === "RED").map((entry) => `${entry.id}:${entry.detail}`) ?? [],
    resumeCommand: input.resumeCommand,
  };
  fs.writeFileSync(path.join(input.outputDir, "RUN-PAUSED.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  logRunPausedObservation(input.outputDir, {
    phase: input.phase,
    reason: input.reason,
    seasonId: input.seasonId,
  });
  log(`PAUSED: ${input.reason}`);
  log(`Resume: ${input.resumeCommand}`);
}

function buildFatigueInjuryReport(saveId: string, targetSeasons: number) {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) return "# Fatigue/Injury Report\n\nSave missing.\n";

  const lines = [
    "# Fatigue/Injury Multiseason Report",
    "",
    `- Save: \`${saveId}\``,
    `- Final: ${save.gameState.season.id} · ${save.gameState.gamePhase ?? "?"}`,
    "",
    "## Per Season",
    "",
    "| Season | MD Results | Injury Events | Ø Fatigue | Max Fatigue |",
    "|---|---:|---:|---:|---:|",
  ];

  for (let seasonNumber = 1; seasonNumber <= targetSeasons; seasonNumber += 1) {
    const seasonId = `season-${seasonNumber}`;
    const mdCount = (save.gameState.seasonState.matchdayResults ?? []).filter((entry) => entry.seasonId === seasonId).length;
    const injuries = countSeasonInjuryEvents(save.gameState, seasonId);
    const rostered = save.gameState.rosters
      .map((entry) => save.gameState.players.find((player) => player.id === entry.playerId))
      .filter((player): player is NonNullable<typeof player> => Boolean(player));
    const fatigueValues = rostered.map((player) => player.fatigue ?? 0);
    const avgFatigue = fatigueValues.length
      ? round(fatigueValues.reduce((sum, value) => sum + value, 0) / fatigueValues.length)
      : 0;
    const maxFatigue = fatigueValues.length ? round(Math.max(...fatigueValues)) : 0;
    lines.push(`| ${seasonId} | ${mdCount} | ${injuries} | ${avgFatigue} | ${maxFatigue} |`);
  }

  lines.push("", "## Per Team (final save)", "");
  const playerById = new Map(save.gameState.players.map((player) => [player.id, player]));
  const availabilityByPlayerId = buildPlayerAvailabilityByPlayerId(save.gameState);
  for (const team of [...save.gameState.teams].sort((left, right) => left.shortCode.localeCompare(right.shortCode))) {
    const roster = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const metrics = collectTeamFatigueInjuryMetrics({
      gameState: save.gameState,
      team,
      roster,
      playerById,
      seasonId: save.gameState.season.id,
      availabilityByPlayerId,
    });
    lines.push(
      `- **${team.shortCode}**: injuredNow=${metrics.injuredNow}, recovering=${metrics.recoveringNow}, fatigueAvg=${metrics.fatigueAvg}, fatigueMax=${metrics.fatigueMax}, fatigueP90=${metrics.fatigueP90}`,
    );
  }

  const historyCount = save.gameState.players.filter((player) => (player.injuryHistory ?? []).length > 0).length;
  lines.push("", `- Players with injuryHistory: **${historyCount}** / ${save.gameState.players.length}`);
  return `${lines.join("\n")}\n`;
}

function runAutoTuneOrganic(saveId: string, seasonId: string) {
  const autoTuneScript = path.join(PROJECT_ROOT, "scripts", "long-run-auto-tune-organic.ts");
  return spawnSync(process.execPath, ["--import", "tsx", autoTuneScript, "--save-id", saveId, "--season-id", seasonId, "--apply"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    env: process.env,
  });
}

async function bootstrapFreshSeasonOneSave(outputDir: string) {
  const scriptPath = path.join(PROJECT_ROOT, "scripts", "long-run-sandbox-s1-s6.ts");
  const nodeOptions = process.env.NODE_OPTIONS?.includes("max-old-space-size")
    ? process.env.NODE_OPTIONS
    : "--max-old-space-size=8192";
  const result = spawnSync(process.execPath, ["--import", "tsx", scriptPath], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
      OLY_LONG_RUN_REQUIRE_NO_DEV_SERVER: process.env.OLY_LONG_RUN_REQUIRE_NO_DEV_SERVER ?? "1",
      OLY_LONG_RUN_ALLOW_DEV_SERVER: process.env.OLY_LONG_RUN_ALLOW_DEV_SERVER ?? "0",
      OLY_ENABLE_EMERGENCY_REPAIR: process.env.OLY_ENABLE_EMERGENCY_REPAIR ?? "1",
      OLY_LONG_RUN_STOP_AFTER: "draft",
      OLY_LONG_RUN_OUTPUT_DIR: outputDir,
      OLY_LONG_RUN_LABEL: "Resilient Multi S1-S5 Fresh Draft",
    },
  });
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const saveMatch =
    combined.match(/STOP_AFTER=draft — Save `([^`]+)` bereit/) ??
    combined.match(/\[long-run\] created (fresh-season-1-\d+)/);
  if (result.status !== 0 || !saveMatch) {
    throw new Error(
      `Fresh S1 draft bootstrap failed (exit ${result.status ?? "?"}): ${combined.split("\n").slice(-8).join(" | ")}`,
    );
  }
  return saveMatch[1];
}

function runFinalExports(saveId: string, outputDir: string, targetSeasons: number) {
  const scripts = [
    {
      name: "balancing-report",
      args: ["--import", "tsx", path.join(PROJECT_ROOT, "scripts", "generate-balancing-report.ts"), "--save-id", saveId, "--output-dir", outputDir, "--seasons", String(targetSeasons)],
    },
    {
      name: "multiseason-final-audit",
      args: ["--import", "tsx", path.join(PROJECT_ROOT, "scripts", "multiseason-final-audit.ts"), "--save-id", saveId, "--history"],
      outFile: "multiseason-final-audit-history.txt",
    },
    {
      name: "multiseason-rebuy-report",
      args: ["--import", "tsx", path.join(PROJECT_ROOT, "scripts", "export-multiseason-rebuy-report.ts"), "--save-id", saveId, "--output-dir", outputDir],
      outFile: "multiseason-rebuy-report.txt",
    },
    {
      name: "facility-levels",
      args: ["--import", "tsx", path.join(PROJECT_ROOT, "scripts", "dump-facility-levels.ts"), "--save-id", saveId],
      outFile: "facility-levels.txt",
    },
  ];
  for (const entry of scripts) {
    if (entry.outFile) {
      const result = spawnSync(process.execPath, entry.args, { cwd: PROJECT_ROOT, encoding: "utf8", env: process.env });
      fs.writeFileSync(path.join(outputDir, entry.outFile), `${result.stdout ?? ""}${result.stderr ?? ""}`);
      if (result.status === 0) log(`Wrote ${entry.outFile}`);
      else log(`WARN: ${entry.name} failed`);
    } else {
      const result = spawnSync(process.execPath, entry.args, { cwd: PROJECT_ROOT, encoding: "utf8", stdio: "pipe", env: process.env });
      if (result.status === 0) log(`Wrote balancing-report.md`);
      else log(`WARN: ${entry.name} failed: ${result.stderr || result.stdout}`);
    }
  }
  const strategicCsv = path.join(outputDir, "strategic-transfer-market-by-team.csv");
  if (fs.existsSync(strategicCsv)) {
    fs.copyFileSync(strategicCsv, path.join(outputDir, "planned-vs-filler-by-team.csv"));
    log("Copied planned-vs-filler-by-team.csv from strategic-transfer export");
  }
}

function runLongRunSeason(input: {
  saveId: string;
  finalSeason: number;
  outputDir: string;
}) {
  const scriptPath = path.join(PROJECT_ROOT, "scripts", "long-run-sandbox-s1-s6.ts");
  const nodeOptions = process.env.NODE_OPTIONS?.includes("max-old-space-size")
    ? process.env.NODE_OPTIONS
    : "--max-old-space-size=8192";
  return spawnSync(process.execPath, ["--import", "tsx", scriptPath], {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
      OLY_LONG_RUN_REQUIRE_NO_DEV_SERVER: process.env.OLY_LONG_RUN_REQUIRE_NO_DEV_SERVER ?? "1",
      OLY_LONG_RUN_ALLOW_DEV_SERVER: process.env.OLY_LONG_RUN_ALLOW_DEV_SERVER ?? "0",
      OLY_ENABLE_EMERGENCY_REPAIR: process.env.OLY_ENABLE_EMERGENCY_REPAIR ?? "1",
      OLY_LONG_RUN_SAVE_ID: input.saveId,
      OLY_LONG_RUN_FINAL_SEASON: String(input.finalSeason),
      OLY_LONG_RUN_STOP_AFTER: "season_end",
      OLY_LONG_RUN_OUTPUT_DIR: input.outputDir,
      OLY_LONG_RUN_LABEL: `Resilient Multi S1-S${input.finalSeason}`,
    },
  });
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  log("Resilient multiseason orchestrator starting…");
  const fresh = process.argv.includes("--fresh");
  let saveId = argValue("--save-id");

  const targetSeasons = Number(argValue("--seasons") ?? "5");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputDir =
    argValue("--output-dir") ??
    (fresh
      ? path.join(PROJECT_ROOT, "outputs", `resilient-s1s5-${timestamp}`)
      : path.join(PROJECT_ROOT, "outputs", "realistic-5y", `${saveId ?? "unknown"}-${Date.now()}`));
  fs.mkdirSync(outputDir, { recursive: true });

  const dbIsolation = ensureIsolatedLongRunDatabase({ outputDir, projectRoot: PROJECT_ROOT });
  log(`DB: ${dbIsolation.sqlitePath} (isolated=${dbIsolation.isolated}${dbIsolation.clonedFromShared ? ", cloned-from-shared" : ""})`);

  const persistence = createPersistenceService();
  if (fresh) {
    saveId = await bootstrapFreshSeasonOneSave(outputDir);
    log(`Fresh save bootstrapped: ${saveId}`);
  }
  if (!saveId) throw new Error("Missing --save-id (or pass --fresh)");

  let save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  log(`Output: ${outputDir}`);
  log(`Target: S1→S${targetSeasons}`);

  const resumeCommand =
    `node --import tsx scripts/run-resilient-multiseason.ts --save-id ${saveId} --seasons ${targetSeasons} --output-dir ${outputDir}`;

  const balanceProfile = resolveBalanceProfile();
  const tuneRetriesBySeason = new Map<number, number>();
  const MAX_TUNE_RETRIES = 2;
  log(`Balance profile: ${balanceProfile}`);

  while (true) {
    save = persistence.getSaveById(saveId) ?? save;
    const nextSeason = getNextSeasonTarget(save.gameState.season.id, save.gameState.gamePhase, targetSeasons);
    if (nextSeason == null) {
      log(`Complete: ${save.gameState.season.id} · ${save.gameState.gamePhase}`);
      break;
    }

    log(`Running through season-${nextSeason} (STOP_AFTER=season_end)…`);
    const seasonStartedAt = Date.now();
    const result = runLongRunSeason({ saveId, finalSeason: nextSeason, outputDir });
    logSlowPhaseObservation(outputDir, {
      phase: "season_end",
      durationMs: Date.now() - seasonStartedAt,
      seasonId: `season-${nextSeason}`,
    });
    writeLongRunPerformanceReport(outputDir);
    syncPerformanceObservations(outputDir);

    save = persistence.getSaveById(saveId);
    if (!save) throw new Error(`Save disappeared: ${saveId}`);

    const summary = readJsonIfExists<{
      openTechnicalBugs?: string[];
      finalSeasonId?: string;
      finalGamePhase?: string;
    }>(path.join(outputDir, "multi-season-s1-s6-summary.json"));

    const seasonEndAuditPath = findLatestAuditJson(outputDir, saveId, "season_end", `season-${nextSeason}`);
    const preseasonAuditPath = findLatestAuditJson(outputDir, saveId, "preseason", `season-${nextSeason}`);
    let seasonEndAudit = seasonEndAuditPath ? readJsonIfExists<PhaseAuditResult>(seasonEndAuditPath) : null;
    const preseasonAudit = preseasonAuditPath ? readJsonIfExists<PhaseAuditResult>(preseasonAuditPath) : null;
    if (seasonEndAudit && seasonEndAudit.seasonId !== save.gameState.season.id) {
      log(`WARN: stale season_end audit (${seasonEndAudit.seasonId} ≠ ${save.gameState.season.id}) — recompute`);
      seasonEndAudit = null;
    }
    if (!seasonEndAudit && (save.gameState.gamePhase ?? "") === "season_completed") {
      seasonEndAudit = runPhaseAuditDe(save, "season_end", {});
    }
    if (preseasonAudit) logPhaseAuditObservations(outputDir, preseasonAudit);
    if (seasonEndAudit) logPhaseAuditObservations(outputDir, seasonEndAudit);

    const openTechnicalBugs = filterHardOpenTechnicalBugs(summary?.openTechnicalBugs ?? []);
    const collectHardAuditReds = (audit: PhaseAuditResult | null) =>
      audit?.checks.filter(
        (entry) => entry.status === "RED" && !isSoftPhaseAuditRed(entry.id, audit.seasonId, audit.phase),
      ) ?? [];
    const auditRed = [...collectHardAuditReds(preseasonAudit), ...collectHardAuditReds(seasonEndAudit)];

    // long-run-sandbox-s1-s6.ts itself sets process.exitCode=2 whenever organic_peak_net_corridor
    // (or a few other hard bugs) shows up in openTechnicalBugs — the exact same condition the
    // auditRed/openTechnicalBugs-based retry logic below is meant to handle for the "iterate"
    // balance profile. Previously this early check pre-empted that logic unconditionally, so
    // "iterate" never actually got a chance to auto-tune-and-continue past a peak-corridor RED.
    // Only treat a non-zero exit as a hard, unexplained crash (pause immediately) when the audit/
    // technical-bug data we already extracted from the run's own JSON output gives no explanation.
    if ((result.status == null || result.status !== 0) && openTechnicalBugs.length === 0 && auditRed.length === 0) {
      writePausedManifest({
        outputDir,
        saveId,
        seasonId: save.gameState.season.id,
        phase: preseasonAudit?.hasRed ? "preseason" : "season_end",
        reason: `long-run exit ${result.status ?? "signal"}${result.signal ? ` (${result.signal})` : ""}${result.error ? `: ${result.error.message}` : ""}`,
        resumeCommand,
        openTechnicalBugs,
        audit: preseasonAudit?.hasRed ? preseasonAudit : seasonEndAudit,
      });
      process.exit(2);
    }

    if (openTechnicalBugs.length > 0 || auditRed.length > 0) {
      const peakCorridorRed = auditRed.some((entry) => entry.id === "organic_peak_net_corridor");
      const organicOnlyRed = auditRed.some((entry) => entry.id === "season_end_organic_only");
      const onlyFinanceRed =
        auditRed.length > 0 &&
        auditRed.every((entry) => entry.id === "transfer_finance_clean" || entry.id === "economy_plausible");
      if (onlyFinanceRed && openTechnicalBugs.every((entry) => entry.includes("negative_cash") || entry.includes("transfer_finance:"))) {
        log(`WARN: Finance RED (${auditRed.map((entry) => entry.id).join(", ")}) — continuing with balance flag`);
      } else {
        // long-run-sandbox-s1-s6.ts mirrors the same organic_peak_net_corridor RED into its own
        // openTechnicalBugs list (see the "season_end_audit" entries), which is the same signal as
        // auditRed here, not a distinct additional blocker — so allow those mirrored entries through
        // instead of requiring openTechnicalBugs to be completely empty.
        const peakOnlyHardRed =
          auditRed.length > 0 &&
          auditRed.every((entry) => entry.id === "organic_peak_net_corridor") &&
          openTechnicalBugs.every((entry) => entry.includes("organic_peak_net_corridor"));
        const seasonIdForTune = `season-${nextSeason}`;
        if (peakCorridorRed && !organicOnlyRed) {
          const retries = (tuneRetriesBySeason.get(nextSeason) ?? 0) + 1;
          tuneRetriesBySeason.set(nextSeason, retries);
          log(`organic_peak_net_corridor RED on ${seasonIdForTune} — auto-tune (${retries}/${MAX_TUNE_RETRIES})`);
          const tuneRun = runAutoTuneOrganic(saveId, seasonIdForTune);
          if (tuneRun.status === 0) {
            log("Auto-tune applied.");
          } else {
            log(`Auto-tune failed: ${tuneRun.stderr || tuneRun.stdout}`);
          }
          if (balanceProfile === "iterate" && peakOnlyHardRed && retries <= MAX_TUNE_RETRIES) {
            log(`Peak RED — continuing (iterate profile, tune ${retries}/${MAX_TUNE_RETRIES})`);
          } else {
            writePausedManifest({
              outputDir,
              saveId,
              seasonId: save.gameState.season.id,
              phase: auditRed[0]?.id ?? "blocker",
              reason:
                auditRed.length > 0
                  ? `Audit RED: ${auditRed.map((entry) => entry.id).join(", ")}`
                  : `Technical blockers: ${openTechnicalBugs.slice(0, 3).join(" | ")}`,
              resumeCommand,
              openTechnicalBugs,
              audit: seasonEndAudit ?? preseasonAudit,
            });
            process.exit(2);
          }
        } else {
          writePausedManifest({
            outputDir,
            saveId,
            seasonId: save.gameState.season.id,
            phase: auditRed[0]?.id ?? "blocker",
            reason:
              auditRed.length > 0
                ? `Audit RED: ${auditRed.map((entry) => entry.id).join(", ")}`
                : `Technical blockers: ${openTechnicalBugs.slice(0, 3).join(" | ")}`,
            resumeCommand,
            openTechnicalBugs,
            audit: seasonEndAudit ?? preseasonAudit,
          });
          process.exit(2);
        }
      }
    }

    const completedSeason = parseSeasonNumber(save.gameState.season.id);
    if ((save.gameState.gamePhase ?? "") !== "season_completed" || completedSeason < nextSeason) {
      writePausedManifest({
        outputDir,
        saveId,
        seasonId: save.gameState.season.id,
        phase: "season_end",
        reason: `Season ${nextSeason} not completed (phase=${save.gameState.gamePhase}, season=${save.gameState.season.id})`,
        resumeCommand,
        openTechnicalBugs,
        audit: seasonEndAudit,
      });
      process.exit(2);
    }

    log(`Season-${nextSeason} OK (${save.gameState.season.id} · ${save.gameState.gamePhase})`);
  }

  const report = buildFatigueInjuryReport(saveId, targetSeasons);
  fs.writeFileSync(path.join(outputDir, "fatigue-injury-multiseason-report.md"), report);
  log(`Wrote fatigue-injury-multiseason-report.md`);

  const teamKpiScript = path.join(PROJECT_ROOT, "scripts", "export-team-kpi-table.ts");
  const teamKpiOutput = path.join(outputDir, "team-kpi-table.md");
  const teamKpiRun = spawnSync(process.execPath, ["--import", "tsx", teamKpiScript, "--save-id", saveId, "--output", teamKpiOutput], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
  });
  if (teamKpiRun.status === 0) {
    log(`Wrote team-kpi-table.md`);
  } else {
    log(`WARN: team-kpi-table export failed: ${teamKpiRun.stderr || teamKpiRun.stdout}`);
  }

  const finalSave = persistence.getSaveById(saveId);
  if (
    !finalSave ||
    parseSeasonNumber(finalSave.gameState.season.id) < targetSeasons ||
    (finalSave.gameState.gamePhase ?? "") !== "season_completed"
  ) {
    writePausedManifest({
      outputDir,
      saveId,
      seasonId: finalSave?.gameState.season.id ?? "?",
      phase: "final",
      reason: "Final season target not reached",
      resumeCommand,
      openTechnicalBugs: [],
    });
    process.exit(2);
  }

  log(`SUCCESS: ${targetSeasons}-season simulation complete.`);
  runFinalExports(saveId, outputDir, targetSeasons);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
