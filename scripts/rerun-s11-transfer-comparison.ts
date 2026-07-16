/**
 * Restore save to pristine S10-end from isolated balancing DB, then re-run
 * S10 season_end sells + S11 preseason buys with current code for A/B comparison.
 *
 * Usage:
 *   OLY_APP_SQLITE_PATH=data/persistence/oly-app.sqlite \
 *   OLY_LONG_RUN_ISOLATED_DB=0 \
 *   npx tsx scripts/rerun-s11-transfer-comparison.ts \
 *     --save-id fresh-season-1-1783169019878 \
 *     --source-db outputs/s1-s10-validated-run-1/balancing-run.sqlite \
 *     --output-dir outputs/s1-s10-validated-run-1
 *
 * Flags:
 *   --restore-only   Only overwrite live save from source DB (no transfer rerun)
 *   --skip-restore   Skip restore; rerun transfers on current live state
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import Database from "better-sqlite3";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import {
  getTeamHardMinRequired,
  getTeamOptTarget,
  getTeamsNeedingConvergence,
  runEmergencyRosterRepairForTeams,
} from "@/lib/ai/ai-market-plan-convergence-service";
import { runPreseasonProactiveCashRecovery } from "@/lib/ai/preseason-cash-recovery-service";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  overwriteSaveFromSourceDb,
  readSaveDbSnapshot,
  type SaveDbSnapshot,
} from "@/lib/persistence/overwrite-save-from-source-db";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getDatabasePath } from "@/lib/persistence/sqlite";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import { getLongRunPlannerMaxLeagueRounds, getLongRunPlannerMaxTeamCycles } from "@/lib/season/long-run-profile";

import { seasonBuyFidelity } from "@/scripts/generate-balancing-report";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function fmt(value: number | null) {
  return value == null ? "—" : round(value, 1).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function log(message: string) {
  console.error(`[s11-rerun] ${message}`);
}

function topUpCash(gameState: GameState, floor: number) {
  const touched: Array<{ shortCode: string; before: number; after: number }> = [];
  for (const team of gameState.teams) {
    const cash = team.cash ?? 0;
    if (cash >= floor) continue;
    touched.push({ shortCode: team.shortCode, before: round(cash), after: floor });
    team.cash = floor;
  }
  return touched;
}

function buildCheckpointMarkdown(input: {
  saveId: string;
  seasonId: string;
  gameState: GameState;
  label: string;
}) {
  const { gameState, seasonId, saveId, label } = input;
  const teamRows = gameState.teams.map((team) => {
    const roster = gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    const hardMin = getTeamHardMinRequired(gameState, team.teamId);
    const optTarget = getTeamOptTarget(gameState, team.teamId);
    const salary = gameState.rosters
      .filter((entry) => entry.teamId === team.teamId)
      .reduce((sum, entry) => sum + (entry.salary ?? entry.upkeep ?? 0), 0);
    const mw = gameState.rosters
      .filter((entry) => entry.teamId === team.teamId)
      .reduce((sum, entry) => {
        const player = gameState.players.find((p) => p.id === entry.playerId);
        return sum + (player?.marketValue ?? player?.displayMarketValue ?? 0);
      }, 0);
    return {
      teamCode: team.shortCode,
      cash: team.cash ?? 0,
      mw,
      roster,
      hardMin,
      optTarget,
      salary,
      atOpt: roster >= optTarget,
    };
  });
  const atOpt = teamRows.filter((row) => row.atOpt).length;
  const fidelity = seasonBuyFidelity(gameState.transferHistory, seasonId);
  const hoardingTeams = teamRows.filter((row) => row.cash > 30 && row.mw < 200 && row.roster <= 9).length;

  const lines = [
    `# ${label}`,
    "",
    `**Save:** \`${saveId}\``,
    `**Season:** ${seasonId} · Phase: ${gameState.gamePhase ?? "?"}`,
    `**Erstellt:** ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- **Teams ≥ Opt:** ${atOpt}/32`,
    `- **Emergency-Filler-Quote:** ${fidelity.emergency}/${fidelity.buys} (${fidelity.emergencyPct}%)`,
    `- **Market-Buys:** ${fidelity.buys} (planned market ${fidelity.plannedMarket}, emergency ${fidelity.emergency})`,
    `- **Cash-Hoarding-Risiko (Cash>30, MW<200, Kader≤9):** ${hoardingTeams} teams`,
    "",
    "## Teams",
    "",
    "| Team | Cash | MW | Kader | hardMin | Opt | Gehalt | ≥Opt |",
    "|---|---:|---:|---:|---:|---:|---:|:--:|",
    ...teamRows.map(
      (row) =>
        `| ${row.teamCode} | ${fmt(row.cash)} | ${fmt(row.mw)} | ${row.roster} | ${row.hardMin} | ${row.optTarget} | ${fmt(row.salary)} | ${row.atOpt ? "✅" : "—"} |`,
    ),
    "",
  ];
  return { markdown: lines.join("\n"), atOpt, fidelity, hoardingTeams, teamRows };
}

function snapshotLine(snapshot: SaveDbSnapshot) {
  return `${snapshot.seasonId ?? "?"} · ${snapshot.gamePhase ?? "?"} · rosters=${snapshot.rosterCount} · transfer_history=${snapshot.transferHistoryCount} (S10=${snapshot.season10TransferCount}, S11=${snapshot.season11TransferCount})`;
}

function readRunMetrics(outputDir: string) {
  const firstRunPath = path.join(outputDir, "s11-preseason-test-results.md");
  const rerunPath = path.join(outputDir, "s11-rerun-comparison.md");
  const readFile = (filePath: string) => (fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null);

  const parse = (text: string | null) => {
    if (!text) return null;
    const pick = (pattern: RegExp) => text.match(pattern)?.[1] ?? null;
    return {
      topUpTeams: Number(pick(/Cash top-up: \*\*(\d+)\*\*/)),
      seasonEndSells: Number(pick(/S10 season_end sells: \*\*(\d+)\*\*/)),
      convergenceBuys: Number(pick(/S11 preseason buys \(convergence\): \*\*(\d+)\*\*/)),
      atOpt: pick(/\| Teams ≥ Opt \| 9\/32 \| (\d+)\/32/) ?? pick(/\| Teams ≥ Opt \| \d+\/32 \| (\d+)\/32/) ?? pick(/\*\*Teams ≥ Opt:\*\* (\d+)\/32/),
      emergencyPct: pick(/\| Emergency-Filler % \| 43\.6% \| ([\d.]+)%/) ?? pick(/\*\*Emergency-Filler-Quote:\*\* \d+\/\d+ \(([\d.]+)%\)/),
      marketBuys: pick(/\| Market Buys \(season\) \| 94 \| (\d+)/) ?? pick(/\| Market buys \(season-11\) \| 246 \| (\d+)/) ?? pick(/\*\*Market-Buys:\*\* (\d+)/),
      hoardingTeams: pick(/\| Cash-Hoarding teams \| .+ \| (\d+)/) ?? pick(/\*\*Cash-Hoarding-Risiko.*:\*\* (\d+)/),
      runAt: pick(/\*\*Run:\*\* (.+)/) ?? pick(/\*\*Rerun:\*\* (.+)/),
    };
  };

  return {
    run1: parse(readFile(firstRunPath)),
    run2: parse(readFile(rerunPath)),
  };
}

async function runTransferPipeline(input: {
  saveId: string;
  outputDir: string;
  cashFloor: number;
}) {
  const persistence = createPersistenceService();
  let save = persistence.getSaveById(input.saveId);
  if (!save) throw new Error(`Save not found: ${input.saveId}`);

  log(`Pipeline start: ${input.saveId} · ${save.gameState.season.id} · ${save.gameState.gamePhase ?? "?"}`);

  const topUp = topUpCash(save.gameState, input.cashFloor);
  if (topUp.length > 0) {
    save = persistence.saveSingleplayerState(input.saveId, save.gameState);
    log(`Cash top-up: ${topUp.length} teams to ${input.cashFloor}`);
  }

  const seasonBefore = save.gameState.season.id;
  const phaseBefore = save.gameState.gamePhase ?? "";

  let seasonEndSells = 0;
  if (seasonBefore === "season-10" && phaseBefore === "season_completed") {
    log("Running S10 season_end sell session…");
    const seasonEnd = await runTransferWindowSession({
      saveId: input.saveId,
      seasonId: "season-10",
      persistence,
      phase: "season_end",
      dryRun: false,
      confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
      transferPhase: "manual_transfer_window",
      teamScope: "all",
      maxTeamCycles: getLongRunPlannerMaxTeamCycles(),
      maxLeagueRounds: getLongRunPlannerMaxLeagueRounds(),
      allowBuys: false,
      skipIfExistingMarketTransfers: false,
      progressLog: true,
    });
    seasonEndSells = seasonEnd.appliedSells;
    log(`S10 season_end: sells=${seasonEnd.appliedSells} buys=${seasonEnd.appliedBuys}`);
    save = persistence.getSaveById(input.saveId)!;
  }

  if ((save.gameState.gamePhase ?? "") === "season_completed") {
    const setup = buildPreSeasonNextSeasonSetupToken(save);
    const next = applyPreSeasonNextSeasonSetupLightweight(save, setup.confirmToken, persistence);
    if (!next.applied) {
      throw new Error(`S11 setup blocked: ${next.blockingReasons.join(" | ")}`);
    }
    save = persistence.getSaveById(input.saveId)!;
    log(`Advanced to ${save.gameState.season.id} · ${save.gameState.gamePhase ?? "?"}`);
  }

  const seasonId = save.gameState.season.id;
  if (seasonId !== "season-11") {
    throw new Error(`Expected season-11 after setup, got ${seasonId}`);
  }

  log("Preseason proactive cash recovery…");
  const recovery = await runPreseasonProactiveCashRecovery({ saveId: input.saveId, seasonId, persistence });
  log(`Cash recovery: sold=${recovery.sold} teams=${recovery.teamsAffected}`);

  log("Preseason planner convergence (buy-only)…");
  const convergence = await runTransferWindowSession({
    saveId: input.saveId,
    seasonId,
    persistence,
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
  log(`Preseason convergence: buys=${convergence.appliedBuys} sells=${convergence.appliedSells}`);

  save = persistence.getSaveById(input.saveId)!;
  const stillNeeding = getTeamsNeedingConvergence(save.gameState);
  let emergencyTeams = 0;
  if (stillNeeding.length > 0) {
    emergencyTeams = stillNeeding.length;
    log(`Emergency repair for ${stillNeeding.length} teams still below Opt…`);
    runEmergencyRosterRepairForTeams({
      saveId: input.saveId,
      seasonId,
      teamIds: stillNeeding.map((entry) => entry.teamId),
      persistence,
      outputDir: input.outputDir,
    });
    save = persistence.getSaveById(input.saveId)!;
  }

  const result = buildCheckpointMarkdown({
    saveId: input.saveId,
    seasonId,
    gameState: save.gameState,
    label: "S11 Preseason Results (rerun with current fixes)",
  });

  return {
    topUp,
    seasonEndSells,
    recovery,
    convergence,
    emergencyTeams,
    result,
  };
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  process.env.OLY_LONG_RUN_ISOLATED_DB = "0";

  const saveId = argValue("--save-id") ?? "fresh-season-1-1783169019878";
  const sourceDb = argValue("--source-db") ?? "outputs/s1-s10-validated-run-1/balancing-run.sqlite";
  const outputDir = path.resolve(PROJECT_ROOT, argValue("--output-dir") ?? "outputs/s1-s10-validated-run-1");
  const cashFloor = Number(argValue("--floor") ?? 50);
  const restoreOnly = hasFlag("--restore-only");
  const skipRestore = hasFlag("--skip-restore");
  const targetDb = getDatabasePath();

  fs.mkdirSync(outputDir, { recursive: true });

  let restoreResult: ReturnType<typeof overwriteSaveFromSourceDb> | null = null;
  let liveBefore: SaveDbSnapshot | null = null;

  if (!skipRestore) {
    const live = new Database(targetDb, { readonly: true });
    liveBefore = readSaveDbSnapshot(live, saveId);
    live.close();
    if (!liveBefore) {
      throw new Error(`Live save ${saveId} not found in ${targetDb}`);
    }

    log(`Live before restore: ${snapshotLine(liveBefore)}`);
    restoreResult = overwriteSaveFromSourceDb({
      sourceDbPath: sourceDb,
      targetDbPath: targetDb,
      saveId,
      preserveTargetStatus: true,
    });
    log(`Restored from isolated DB: ${snapshotLine(restoreResult.targetSnapshotAfter)}`);

    if (restoreResult.targetSnapshotAfter.seasonId !== "season-10" || restoreResult.targetSnapshotAfter.gamePhase !== "season_completed") {
      throw new Error(
        `Restored state is not S10 season_completed: ${snapshotLine(restoreResult.targetSnapshotAfter)}`,
      );
    }
    if (restoreResult.targetSnapshotAfter.season11TransferCount > 0) {
      throw new Error(`Restored state still has season-11 transfers (${restoreResult.targetSnapshotAfter.season11TransferCount}).`);
    }
  }

  if (restoreOnly) {
    console.log(JSON.stringify({ saveId, restored: Boolean(restoreResult), liveBefore, restoreResult }, null, 2));
    return;
  }

  const pipeline = await runTransferPipeline({ saveId, outputDir, cashFloor });
  const { run1, run2 } = readRunMetrics(outputDir);
  const comparisonPath = path.join(outputDir, argValue("--output-md") ?? "s11-rerun-v2-post-opt-guard.md");

  const delta = (after: number, before: number | string | null | undefined) => {
    if (before == null || before === "" || Number.isNaN(Number(before))) return "—";
    const diff = after - Number(before);
    return `${diff >= 0 ? "+" : ""}${diff}`;
  };

  const comparison = [
    "# S11 Rerun v2 — Post-Opt Buy Guard",
    "",
    `**Save:** \`${saveId}\``,
    `**Rerun:** ${new Date().toISOString()}`,
    `**Fix:** Post-Opt market buy guard (no buys when roster ≥ Opt; unified steps capped to gap, not S1 14-step floor)`,
    `**Live DB:** \`${targetDb}\``,
    `**Restore source:** \`${path.resolve(PROJECT_ROOT, sourceDb)}\``,
    "",
    "## Restore",
    "",
    skipRestore
      ? "- Restore **skipped** (`--skip-restore`); pipeline ran on current live state."
      : [
          `- **Live before:** ${liveBefore ? snapshotLine(liveBefore) : "—"}`,
          `- **Isolated source:** ${restoreResult ? snapshotLine(restoreResult.sourceSnapshot) : "—"}`,
          `- **Live after restore:** ${restoreResult ? snapshotLine(restoreResult.targetSnapshotAfter) : "—"}`,
          `- Cash top-up baseline: teams below ${cashFloor} C → ${cashFloor} C (same as run1)`,
        ].join("\n"),
    "",
    "## Actions (v2 rerun)",
    "",
    `- Cash top-up: **${pipeline.topUp.length}** teams → ${cashFloor} C`,
    `- S10 season_end sells: **${pipeline.seasonEndSells}**`,
    `- S11 preseason buys (convergence): **${pipeline.convergence.appliedBuys}**`,
    `- S11 preseason sells (recovery): **${pipeline.recovery.sold}** proactive + **${pipeline.convergence.appliedSells}** convergence`,
    `- Emergency repair teams: **${pipeline.emergencyTeams}**`,
    "",
    "## Run1 vs Run2 vs v2 (post-opt guard)",
    "",
    "| Metric | Run1 (pre-guard) | Run2 (clean rerun) | v2 (this run) | Δ v2−run1 |",
    "|---|---:|---:|---:|---:|",
    `| Cash top-up teams | ${run1?.topUpTeams ?? "—"} | ${run2?.topUpTeams ?? "—"} | ${pipeline.topUp.length} | ${delta(pipeline.topUp.length, run1?.topUpTeams)} |`,
    `| S10 season_end sells | ${run1?.seasonEndSells ?? "—"} | ${run2?.seasonEndSells ?? "—"} | ${pipeline.seasonEndSells} | ${delta(pipeline.seasonEndSells, run1?.seasonEndSells)} |`,
    `| S11 convergence buys | ${run1?.convergenceBuys ?? "—"} | ${run2?.convergenceBuys ?? "—"} | ${pipeline.convergence.appliedBuys} | ${delta(pipeline.convergence.appliedBuys, run1?.convergenceBuys)} |`,
    `| Teams ≥ Opt | ${run1?.atOpt ?? "16"}/32 | ${run2?.atOpt ?? "0"}/32 | ${pipeline.result.atOpt}/32 | ${delta(pipeline.result.atOpt, run1?.atOpt ?? 16)} |`,
    `| Emergency-Filler % | ${run1?.emergencyPct ?? "31.7"}% | ${run2?.emergencyPct ?? "7.6"}% | ${pipeline.result.fidelity.emergencyPct}% | ${run1?.emergencyPct ? `${round(pipeline.result.fidelity.emergencyPct - Number(run1.emergencyPct), 1)} pp` : "—"} |`,
    `| Market buys (season-11) | ${run1?.marketBuys ?? "246"} | ${run2?.marketBuys ?? "132"} | ${pipeline.result.fidelity.buys} | ${delta(pipeline.result.fidelity.buys, run1?.marketBuys ?? 246)} |`,
    `| Cash-hoarding teams | ${run1?.hoardingTeams ?? "0"} | ${run2?.hoardingTeams ?? "19"} | ${pipeline.result.hoardingTeams} | ${delta(pipeline.result.hoardingTeams, run1?.hoardingTeams ?? 0)} |`,
    "",
    run1?.runAt ? `*Run1 timestamp: ${run1.runAt} (s11-preseason-test-results.md)*` : "",
    run2?.runAt ? `*Run2 timestamp: ${run2.runAt} (s11-rerun-comparison.md)*` : "",
    "",
    "## S10 Baseline (checkpoint-season-10.md)",
    "",
    "| Metric | S10 end | v2 S11 | Δ vs S10 |",
    "|---|---:|---:|---:|",
    `| Teams ≥ Opt | 9/32 | ${pipeline.result.atOpt}/32 | ${delta(pipeline.result.atOpt, 9)} |`,
    `| Emergency-Filler % | 43.6% | ${pipeline.result.fidelity.emergencyPct}% | ${round(pipeline.result.fidelity.emergencyPct - 43.6, 1)} pp |`,
    `| Market buys (season) | 94 (S10) | ${pipeline.result.fidelity.buys} (S11) | — |`,
    "",
    pipeline.result.markdown.split("\n").slice(4).join("\n"),
  ]
    .filter(Boolean)
    .join("\n");

  fs.writeFileSync(comparisonPath, comparison);
  log(`Wrote ${comparisonPath}`);

  console.log(
    JSON.stringify(
      {
        saveId,
        restored: Boolean(restoreResult),
        topUpCount: pipeline.topUp.length,
        seasonEndSells: pipeline.seasonEndSells,
        s11Buys: pipeline.convergence.appliedBuys,
        s11MarketBuysTotal: pipeline.result.fidelity.buys,
        atOpt: pipeline.result.atOpt,
        emergencyPct: pipeline.result.fidelity.emergencyPct,
        hoardingTeams: pipeline.result.hoardingTeams,
        comparisonPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
