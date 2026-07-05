/**
 * S11 fix validation on the LIVE save (OLY_LONG_RUN_ISOLATED_DB=0).
 *
 * 1. Cash top-up (teams < floor)
 * 2. S10 season_end sell session (if save still on season-10 season_completed)
 * 3. Advance to season-11 preseason
 * 4. Preseason buy convergence (+ emergency repair fallback)
 * 5. Write checkpoint audit markdown
 *
 * Usage:
 *   OLY_LONG_RUN_ISOLATED_DB=0 npx tsx scripts/run-s11-fix-validation.ts \
 *     --save-id fresh-season-1-1783169019878 \
 *     --output-dir outputs/s1-s10-validated-run-1
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

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
import { createPersistenceService } from "@/lib/persistence/persistence-service";
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

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function fmt(value: number | null) {
  return value == null ? "—" : round(value, 1).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function log(message: string) {
  console.error(`[s11-fix-validation] ${message}`);
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

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  process.env.OLY_LONG_RUN_ISOLATED_DB = "0";

  const saveId = argValue("--save-id") ?? "fresh-season-1-1783169019878";
  const outputDir = path.resolve(PROJECT_ROOT, argValue("--output-dir") ?? "outputs/s1-s10-validated-run-1");
  const cashFloor = Number(argValue("--floor") ?? 50);
  fs.mkdirSync(outputDir, { recursive: true });

  const persistence = createPersistenceService();
  let save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  log(`Start: ${saveId} · ${save.gameState.season.id} · ${save.gameState.gamePhase ?? "?"}`);

  const baseline = buildCheckpointMarkdown({
    saveId,
    seasonId: "season-10-baseline",
    gameState: structuredClone(save.gameState),
    label: "S10 Baseline (pre-fix snapshot from current DB state)",
  });

  const topUp = topUpCash(save.gameState, cashFloor);
  if (topUp.length > 0) {
    save = persistence.saveSingleplayerState(saveId, save.gameState);
    log(`Cash top-up: ${topUp.length} teams to ${cashFloor}`);
  }

  const seasonBefore = save.gameState.season.id;
  const phaseBefore = save.gameState.gamePhase ?? "";

  let seasonEndSells = 0;
  if (seasonBefore === "season-10" && phaseBefore === "season_completed") {
    log("Running S10 season_end sell session…");
    const seasonEnd = await runTransferWindowSession({
      saveId,
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
    log(`S10 season_end: sells=${seasonEnd.appliedSells} buys=${seasonEnd.appliedBuys} warnings=${seasonEnd.warnings.length}`);
    save = persistence.getSaveById(saveId)!;
  }

  if ((save.gameState.gamePhase ?? "") === "season_completed") {
    const setup = buildPreSeasonNextSeasonSetupToken(save);
    const next = applyPreSeasonNextSeasonSetupLightweight(save, setup.confirmToken, persistence);
    if (!next.applied) {
      throw new Error(`S11 setup blocked: ${next.blockingReasons.join(" | ")}`);
    }
    save = persistence.getSaveById(saveId)!;
    log(`Advanced to ${save.gameState.season.id} · ${save.gameState.gamePhase ?? "?"}`);
  }

  const seasonId = save.gameState.season.id;
  if (seasonId !== "season-11") {
    throw new Error(`Expected season-11 after setup, got ${seasonId}`);
  }

  log("Preseason proactive cash recovery…");
  const recovery = await runPreseasonProactiveCashRecovery({ saveId, seasonId, persistence });
  log(`Cash recovery: sold=${recovery.sold} teams=${recovery.teamsAffected}`);

  log("Preseason planner convergence (buy-only)…");
  const convergence = await runTransferWindowSession({
    saveId,
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

  save = persistence.getSaveById(saveId)!;
  const stillNeeding = getTeamsNeedingConvergence(save.gameState);
  if (stillNeeding.length > 0) {
    log(`Emergency repair for ${stillNeeding.length} teams still below Opt…`);
    runEmergencyRosterRepairForTeams({
      saveId,
      seasonId,
      teamIds: stillNeeding.map((entry) => entry.teamId),
      persistence,
      outputDir,
    });
    save = persistence.getSaveById(saveId)!;
  }

  const result = buildCheckpointMarkdown({
    saveId,
    seasonId,
    gameState: save.gameState,
    label: "S11 Preseason Results (post-fix)",
  });

  const resultsPath = path.join(outputDir, "s11-preseason-test-results.md");
  const planPath = path.join(outputDir, "s11-fix-implementation-plan.md");

  const comparison = [
    "# S11 Preseason Test Results",
    "",
    `**Save:** \`${saveId}\` (live DB)`,
    `**Run:** ${new Date().toISOString()}`,
    "",
    "## Actions",
    "",
    `- Cash top-up: **${topUp.length}** teams → ${cashFloor} C`,
    `- S10 season_end sells: **${seasonEndSells}**`,
    `- S11 preseason buys (convergence): **${convergence.appliedBuys}**`,
    `- S11 preseason sells (recovery): **${recovery.sold}** proactive + **${convergence.appliedSells}** convergence`,
    "",
    "## vs S10 Baseline",
    "",
    "| Metric | S10 Baseline | S11 Preseason | Δ |",
    "|---|---:|---:|---:|",
    `| Teams ≥ Opt | 9/32 | ${result.atOpt}/32 | ${result.atOpt - 9 >= 0 ? "+" : ""}${result.atOpt - 9} |`,
    `| Emergency-Filler % | 43.6% | ${result.fidelity.emergencyPct}% | ${round(result.fidelity.emergencyPct - 43.6, 1)} pp |`,
    `| Market Buys | 94 | ${result.fidelity.buys} | ${result.fidelity.buys - 94 >= 0 ? "+" : ""}${result.fidelity.buys - 94} |`,
    `| Cash-Hoarding teams | 16* | ${result.hoardingTeams} | ${result.hoardingTeams - 16 >= 0 ? "+" : ""}${result.hoardingTeams - 16} |`,
    "",
    "*S10 baseline from checkpoint-season-10.md (16 teams >20 cash in S10 economy audit; hoarding proxy uses Cash>30, MW<200, Kader≤9).",
    "",
    result.markdown.split("\n").slice(4).join("\n"),
  ].join("\n");

  fs.writeFileSync(resultsPath, comparison);
  log(`Wrote ${resultsPath}`);

  if (!fs.existsSync(planPath)) {
    log(`Plan file missing at ${planPath} — will be written separately`);
  }

  console.log(
    JSON.stringify(
      {
        saveId,
        topUpCount: topUp.length,
        seasonEndSells,
        s11Buys: convergence.appliedBuys,
        atOpt: result.atOpt,
        emergencyPct: result.fidelity.emergencyPct,
        hoardingTeams: result.hoardingTeams,
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
