import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import {
  buildLeagueMarketBrackets,
  classifyMarketBracket,
} from "@/lib/ai/market-pick-engine/market-brackets";
import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function log(message: string) {
  console.error(`[s1-draft-fresh-audit] ${message}`);
}

function parseStepsPerTeam(argv: string[]) {
  const flagIndex = argv.indexOf("--steps-per-team");
  if (flagIndex >= 0 && argv[flagIndex + 1]) {
    const parsed = Number(argv[flagIndex + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }
  return 14;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const persistence = createPersistenceService();
  const stepsPerTeam = parseStepsPerTeam(process.argv.slice(2));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputDir = path.join(PROJECT_ROOT, "outputs", `s1-draft-audit-${timestamp}`);
  await mkdir(outputDir, { recursive: true });
  log(`Output → ${outputDir}`);

  const fresh = persistence.createFreshSeasonOneSave({
    name: `S1 Draft Audit ${new Date().toISOString()}`,
  });
  log(`Fresh S1 save: ${fresh.saveId}`);
  log(`Steps per team: ${stepsPerTeam}`);

  const started = Date.now();
  const preview = await runAiPicksExecutePreview(
    {
      source: "sqlite",
      saveId: fresh.saveId,
      seasonId: fresh.gameState.season.id,
      dryRun: false,
      confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
      teamScope: "all",
      allowSetupAllTeams: true,
      stepsPerTeam,
      runMode: "season1_optimum_execute",
      draftSeed: `s1-draft-fresh-audit:${fresh.saveId}`,
    },
    persistence,
  );
  const durationMs = Date.now() - started;

  log(
    `Draft: planned=${preview.globalExecution.plannedPickCount} applied=${preview.globalExecution.appliedPickCount} gate=${preview.qualityGate.passed ? "pass" : "fail"} (${Math.round(durationMs / 1000)}s)`,
  );
  if (preview.blockingReasons.length > 0) {
    log(`Blocking reasons: ${preview.blockingReasons.join(" | ")}`);
  }

  const save = persistence.getSaveById(fresh.saveId);
  if (!save) throw new Error("Save missing after S1 draft");
  const gameState: GameState = save.gameState;

  const teamRows = gameState.teams.map((team) => {
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const rosterAfter = gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    return {
      teamId: team.teamId,
      teamCode: team.shortCode ?? team.teamId,
      rosterAfter,
      playerMin,
      playerOpt,
      reachedMin: rosterAfter >= playerMin,
      reachedOpt: rosterAfter >= playerOpt,
      cashAfter: round(team.cash ?? 0),
    };
  });

  const teamsAtMin = teamRows.filter((row) => row.reachedMin).length;
  const teamsAtOpt = teamRows.filter((row) => row.reachedOpt).length;
  const teamsBelowMin = teamRows.filter((row) => !row.reachedMin);
  const teamsWithNegativeCash = teamRows.filter((row) => row.cashAfter < -0.01);
  const teamCount = teamRows.length;

  // Bracket distribution from the freshly applied draft buys (this run only).
  const draftBuys = gameState.transferHistory.filter(
    (entry): entry is TransferHistoryEntry =>
      entry.transferType === "buy" && entry.seasonId === gameState.season.id,
  );
  const draftPrices = draftBuys.map((entry) => entry.fee ?? entry.marketValue ?? 0).filter((value) => value > 0);
  const leagueBrackets = buildLeagueMarketBrackets(draftPrices);
  const bracketCounts = new Map<string, number>();
  for (const price of draftPrices) {
    const tier = classifyMarketBracket(price, leagueBrackets);
    bracketCounts.set(tier, (bracketCounts.get(tier) ?? 0) + 1);
  }

  log(`Roster: min=${teamsAtMin}/${teamCount} opt=${teamsAtOpt}/${teamCount}`);

  const checks = {
    qualityGatePassed: preview.qualityGate.passed,
    noBlockingReasons: preview.blockingReasons.length === 0,
    allTeamsAtMin: teamsAtMin === teamCount,
    optRate80: teamsAtOpt >= Math.ceil(teamCount * 0.8),
    noNegativeCash: teamsWithNegativeCash.length === 0,
    appliedMatchesPlanned:
      preview.globalExecution.appliedPickCount === preview.globalExecution.plannedPickCount,
    traceParity: preview.traceParity.dryRunExecuteTraceMatch,
  };
  const verdict = Object.values(checks).every(Boolean) ? "sauber" : "nicht sauber";

  const kpi = {
    saveId: fresh.saveId,
    seasonId: gameState.season.id,
    stepsPerTeam,
    durationMs,
    enginePickSelection: "default(true)",
    plannedPicks: preview.globalExecution.plannedPickCount,
    appliedPicks: preview.globalExecution.appliedPickCount,
    teamCount,
    teamsAtMin,
    teamsAtOpt,
    teamsBelowMin: teamsBelowMin.map((row) => `${row.teamCode}:${row.rosterAfter}/${row.playerMin}`),
    teamsWithNegativeCash: teamsWithNegativeCash.map((row) => `${row.teamCode}:${row.cashAfter}`),
    qualityGate: {
      passed: preview.qualityGate.passed,
      blockingReasons: preview.qualityGate.blockingReasons,
      warnings: preview.qualityGate.warnings.slice(0, 20),
      metrics: preview.qualityGate.metrics,
    },
    blockingReasons: preview.blockingReasons,
    traceParity: preview.traceParity.dryRunExecuteTraceMatch,
    bracketFloors: {
      superstar: leagueBrackets.superstar.floorMw,
      star: leagueBrackets.star.floorMw,
      core: leagueBrackets.core.floorMw,
      depth: leagueBrackets.depth.floorMw,
      backup: leagueBrackets.backup.floorMw,
    },
    bracketDistribution: Object.fromEntries(bracketCounts),
    checks,
    verdict,
  };

  const summary = [
    "# Fresh S1 Draft Audit (DRAFT ONLY)",
    "",
    `- Fresh save: \`${fresh.saveId}\` (${gameState.season.id})`,
    `- Steps/team: ${stepsPerTeam} · Dauer: ${Math.round(durationMs / 1000)}s · Engine-Pick: default(true)`,
    `- Picks: planned ${preview.globalExecution.plannedPickCount} / applied ${preview.globalExecution.appliedPickCount} (${checks.appliedMatchesPlanned ? "PASS" : "FAIL"})`,
    `- Quality Gate: ${preview.qualityGate.passed ? "PASS" : "FAIL"}`,
    `- Blocking reasons: ${preview.blockingReasons.length === 0 ? "keine" : preview.blockingReasons.join(" | ")}`,
    `- Trace parity (dryRun==execute): ${preview.traceParity.dryRunExecuteTraceMatch ? "PASS" : "FAIL"}`,
    `- Teams ≥ Min: ${teamsAtMin}/${teamCount} (${checks.allTeamsAtMin ? "PASS" : "FAIL"})`,
    `- Teams ≥ Opt: ${teamsAtOpt}/${teamCount} (${checks.optRate80 ? "PASS" : "FAIL"}, target ≥${Math.ceil(teamCount * 0.8)})`,
    `- Teams unter Min: ${teamsBelowMin.length === 0 ? "keine" : teamsBelowMin.map((row) => `${row.teamCode} ${row.rosterAfter}/${row.playerMin}`).join(", ")}`,
    `- Teams negatives Cash: ${teamsWithNegativeCash.length === 0 ? "keine" : teamsWithNegativeCash.map((row) => `${row.teamCode} ${row.cashAfter}`).join(", ")}`,
    `- Bracket-Verteilung: ${[...bracketCounts.entries()].map(([tier, count]) => `${tier}:${count}`).join(", ") || "n/a"}`,
    "",
    `## Verdict: ${verdict.toUpperCase()}`,
  ].join("\n");

  await writeFile(path.join(outputDir, "kpi.json"), JSON.stringify(kpi, null, 2));
  await writeFile(path.join(outputDir, "summary.md"), summary);
  log(`Done. Verdict=${verdict}. KPI → ${outputDir}`);

  console.log(JSON.stringify({ saveId: fresh.saveId, ...checks, verdict, outputDir }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
