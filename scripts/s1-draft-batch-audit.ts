import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import {
  buildLeagueMarketBrackets,
  classifyMarketBracket,
} from "@/lib/ai/market-pick-engine/market-brackets";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { getDatabase } from "@/lib/persistence/sqlite";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function parseRuns(argv: string[]) {
  const idx = argv.indexOf("--runs");
  if (idx >= 0 && argv[idx + 1]) {
    const parsed = Number(argv[idx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }
  return 10;
}

function parseStepsPerTeam(argv: string[]) {
  const idx = argv.indexOf("--steps-per-team");
  if (idx >= 0 && argv[idx + 1]) {
    const parsed = Number(argv[idx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }
  return 14;
}

function parseCashBonus(argv: string[]) {
  const idx = argv.indexOf("--cash-bonus");
  if (idx >= 0 && argv[idx + 1]) {
    const parsed = Number(argv[idx + 1]);
    if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed);
  }
  return 0;
}

function hasFlag(argv: string[], flag: string) {
  return argv.includes(flag);
}

/** Planner quality gate uses team.budget as startingCash — bump cash and budget together. */
function addCashToAllTeams(save: PersistedSaveGame, persistence: PersistenceService, bonus: number) {
  if (bonus <= 0) return save;
  return persistence.saveSingleplayerState(save.saveId, {
    ...save.gameState,
    teams: save.gameState.teams.map((team) => {
      const cash = round((team.cash ?? 0) + bonus);
      const budget =
        Number.isFinite(team.budget) && team.budget > 0 ? round(team.budget + bonus) : cash;
      return { ...team, cash, budget };
    }),
  });
}

type RunRow = {
  run: number;
  saveId: string;
  durationMs: number;
  appliedPicks: number;
  teamsAtMin: number;
  teamsAtOpt: number;
  teamCount: number;
  qualityGatePassed: boolean;
  optRate80: boolean;
  allTeamsAtMin: boolean;
  cashBonus: number;
  avgStartBudget: number;
  avgCashLeft: number;
  avgSpend: number;
  sumMw: number;
  superstars: number;
  stars: number;
  core: number;
  depth: number;
  backup: number;
  reserve: number;
  blockingReasons: string[];
};

function summarizeBracketRuns(results: RunRow[]) {
  const runs = results.length;
  const avg = (pick: (row: RunRow) => number) =>
    round(results.reduce((sum, row) => sum + pick(row), 0) / Math.max(runs, 1), 1);
  return {
    runs,
    opt80Hits: `${results.filter((row) => row.optRate80).length}/${runs}`,
    allMinHits: `${results.filter((row) => row.allTeamsAtMin).length}/${runs}`,
    qualityGateHits: `${results.filter((row) => row.qualityGatePassed).length}/${runs}`,
    avgTeamsAtOpt: avg((row) => row.teamsAtOpt),
    avgTeamsAtMin: avg((row) => row.teamsAtMin),
    avgDurationSec: Math.round(results.reduce((sum, row) => sum + row.durationMs, 0) / Math.max(runs, 1) / 1000),
    avgStartBudget: avg((row) => row.avgStartBudget),
    avgCashLeft: avg((row) => row.avgCashLeft),
    avgSpend: avg((row) => row.avgSpend),
    avgSumMw: Math.round(results.reduce((sum, row) => sum + row.sumMw, 0) / Math.max(runs, 1)),
    avgSuperstars: avg((row) => row.superstars),
    avgStars: avg((row) => row.stars),
    avgCore: avg((row) => row.core),
    avgDepth: avg((row) => row.depth),
    avgBackup: avg((row) => row.backup),
    avgReserve: avg((row) => row.reserve),
    avgPicks: avg((row) => row.appliedPicks),
    perRun: results,
  };
}

async function runBatch(input: {
  persistence: PersistenceService;
  runs: number;
  stepsPerTeam: number;
  cashBonus: number;
  batchLabel: string;
  timestamp: string;
}) {
  const results: RunRow[] = [];

  for (let run = 1; run <= input.runs; run += 1) {
    let fresh = input.persistence.createFreshSeasonOneSave({
      name: `S1 Batch ${input.batchLabel} ${run}/${input.runs} ${new Date().toISOString()}`,
    });
    if (input.cashBonus > 0) {
      fresh = addCashToAllTeams(fresh, input.persistence, input.cashBonus);
    }
    const avgStartBudget = round(
      fresh.gameState.teams.reduce((sum, team) => sum + (team.budget ?? team.cash ?? 0), 0) /
        Math.max(fresh.gameState.teams.length, 1),
    );

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
        stepsPerTeam: input.stepsPerTeam,
        runMode: "season1_optimum_execute",
        draftSeed: `s1-draft-batch:${input.batchLabel}:${input.timestamp}:run-${run}`,
      },
      input.persistence,
    );
    const durationMs = Date.now() - started;
    const save = input.persistence.getSaveById(fresh.saveId);
    if (!save) throw new Error(`Save missing after run ${run}`);

    const teamCount = save.gameState.teams.length;
    let teamsAtMin = 0;
    let teamsAtOpt = 0;
    let cashSum = 0;
    for (const team of save.gameState.teams) {
      const identity = save.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
      const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
      const rosterAfter = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
      if (rosterAfter >= playerMin) teamsAtMin += 1;
      if (rosterAfter >= playerOpt) teamsAtOpt += 1;
      cashSum += team.cash ?? 0;
    }

    const playerById = new Map(save.gameState.players.map((player) => [player.id, player]));
    let sumMw = 0;
    for (const entry of save.gameState.rosters) {
      const player = playerById.get(entry.playerId);
      const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      sumMw += economy.marketValue ?? 0;
    }

    const draftBuys = save.gameState.transferHistory.filter(
      (entry) => entry.transferType === "buy" && entry.seasonId === save.gameState.season.id,
    );
    const prices = draftBuys.map((entry) => entry.fee ?? entry.marketValue ?? 0).filter((value) => value > 0);
    const totalSpend = round(prices.reduce((sum, value) => sum + value, 0));
    const brackets = buildLeagueMarketBrackets(prices);
    const bracketCounts: Record<string, number> = {};
    for (const price of prices) {
      const tier = classifyMarketBracket(price, brackets);
      bracketCounts[tier] = (bracketCounts[tier] ?? 0) + 1;
    }

    const row: RunRow = {
      run,
      saveId: fresh.saveId,
      durationMs,
      appliedPicks: preview.globalExecution.appliedPickCount,
      teamsAtMin,
      teamsAtOpt,
      teamCount,
      qualityGatePassed: preview.qualityGate.passed,
      optRate80: teamsAtOpt >= Math.ceil(teamCount * 0.8),
      allTeamsAtMin: teamsAtMin === teamCount,
      cashBonus: input.cashBonus,
      avgStartBudget,
      avgCashLeft: round(cashSum / teamCount),
      avgSpend: round(totalSpend / teamCount),
      sumMw: round(sumMw),
      stars: bracketCounts.Star ?? 0,
      superstars: bracketCounts.Superstar ?? 0,
      core: bracketCounts.Core ?? 0,
      depth: bracketCounts.Depth ?? 0,
      backup: bracketCounts.Backup ?? 0,
      reserve: bracketCounts.Reserve ?? 0,
      blockingReasons: preview.blockingReasons.slice(0, 5),
    };
    results.push(row);
    console.error(
      `[s1-draft-batch] ${input.batchLabel} run ${run}/${input.runs}: min=${teamsAtMin}/32 opt=${teamsAtOpt}/32 gate=${row.qualityGatePassed ? "pass" : "fail"} SS=${row.superstars} Star=${row.stars} Core=${row.core} spend=${row.avgSpend} cash=${row.avgCashLeft} (${Math.round(durationMs / 1000)}s)`,
    );
    deleteSave(fresh.saveId);
  }

  return summarizeBracketRuns(results);
}

function deleteSave(saveId: string) {
  const database = getDatabase();
  const childTables = [
    "seasons",
    "season_states",
    "matchday_states",
    "game_metadata",
    "teams",
    "team_identities",
    "players",
    "player_baselines",
    "disciplines",
    "rosters",
    "contracts",
    "transfer_listings",
    "transfer_history",
    "game_logs",
    "mapping_reports",
  ];
  const delSave = database.prepare("DELETE FROM saves WHERE save_id = ?");
  const childStmts = childTables.map((table) => database.prepare(`DELETE FROM ${table} WHERE save_id = ?`));
  const tx = database.transaction(() => {
    for (const stmt of childStmts) stmt.run(saveId);
    delSave.run(saveId);
  });
  tx();
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const argv = process.argv.slice(2);
  const persistence = createPersistenceService();
  const runs = parseRuns(argv);
  const stepsPerTeam = parseStepsPerTeam(argv);
  const cashBonus = parseCashBonus(argv);
  const withBaseline = hasFlag(argv, "--with-baseline");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const label = cashBonus > 0 ? `plus${cashBonus}` : "standard";
  const outputDir = path.join(PROJECT_ROOT, "outputs", `s1-draft-batch-${label}-${timestamp}`);
  await mkdir(outputDir, { recursive: true });

  console.error(
    `[s1-draft-batch] ${runs} runs · ${stepsPerTeam} steps/team · cashBonus=${cashBonus}${withBaseline ? " + baseline" : ""} · output ${outputDir}`,
  );

  const bonusSummary = await runBatch({
    persistence,
    runs,
    stepsPerTeam,
    cashBonus,
    batchLabel: label,
    timestamp,
  });

  let baselineSummary: ReturnType<typeof summarizeBracketRuns> | null = null;
  if (withBaseline && cashBonus > 0) {
    baselineSummary = await runBatch({
      persistence,
      runs,
      stepsPerTeam,
      cashBonus: 0,
      batchLabel: "baseline",
      timestamp,
    });
  }

  const payload = {
    cashBonus,
    stepsPerTeam,
    bonus: bonusSummary,
    baseline: baselineSummary,
  };

  await writeFile(path.join(outputDir, "batch-summary.json"), JSON.stringify(payload, null, 2));

  function formatRunTable(summary: ReturnType<typeof summarizeBracketRuns>, title: string) {
    return [
      `## ${title}`,
      "",
      `- Startbudget Ø/Team: **${summary.avgStartBudget}** · Ausgabe Ø/Team: **${summary.avgSpend}** · Cash übrig Ø/Team: **${summary.avgCashLeft}**`,
      `- Liga-Σ MW: **${summary.avgSumMw}** · Picks Ø: **${summary.avgPicks}**`,
      `- Brackets Ø: SS **${summary.avgSuperstars}** · Star **${summary.avgStars}** · Core **${summary.avgCore}** · Depth **${summary.avgDepth}** · Backup **${summary.avgBackup}** · Reserve **${summary.avgReserve}**`,
      `- Min **${summary.allMinHits}** · Opt≥80% **${summary.opt80Hits}** · Gate **${summary.qualityGateHits}** · Ø ${summary.avgDurationSec}s`,
      "",
      "| Run | Min | Opt | Gate | SS | Star | Core | Depth | Backup | Res | Picks | Spend | Cash | Σ MW |",
      "|-----|-----|-----|------|----|------|------|-------|--------|-----|-------|-------|------|------|",
      ...summary.perRun.map(
        (row) =>
          `| ${row.run} | ${row.teamsAtMin}/32 | ${row.teamsAtOpt}/32 | ${row.qualityGatePassed ? "✓" : "✗"} | ${row.superstars} | ${row.stars} | ${row.core} | ${row.depth} | ${row.backup} | ${row.reserve} | ${row.appliedPicks} | ${row.avgSpend} | ${row.avgCashLeft} | ${row.sumMw} |`,
      ),
    ].join("\n");
  }

  const mdParts = [
    `# S1 Draft Batch — ${cashBonus > 0 ? `+${cashBonus} Cash/Budget` : "Standard"}`,
    "",
    formatRunTable(bonusSummary, cashBonus > 0 ? `+${cashBonus} Mio (${runs} Runs)` : `Standard (${runs} Runs)`),
  ];

  if (baselineSummary) {
    mdParts.push(
      "",
      formatRunTable(baselineSummary, `Baseline Standard (${runs} Runs)`),
      "",
      "## Delta (+Bonus vs Baseline)",
      "",
      "| Metrik | Baseline | +Bonus | Δ |",
      "|--------|----------|--------|---|",
      `| Ø Ausgabe/Team | ${baselineSummary.avgSpend} | ${bonusSummary.avgSpend} | ${round(bonusSummary.avgSpend - baselineSummary.avgSpend, 1)} |`,
      `| Ø Cash übrig | ${baselineSummary.avgCashLeft} | ${bonusSummary.avgCashLeft} | ${round(bonusSummary.avgCashLeft - baselineSummary.avgCashLeft, 1)} |`,
      `| Liga-Σ MW | ${baselineSummary.avgSumMw} | ${bonusSummary.avgSumMw} | ${bonusSummary.avgSumMw - baselineSummary.avgSumMw} |`,
      `| SS / Star / Core | ${baselineSummary.avgSuperstars} / ${baselineSummary.avgStars} / ${baselineSummary.avgCore} | ${bonusSummary.avgSuperstars} / ${bonusSummary.avgStars} / ${bonusSummary.avgCore} | — |`,
      `| Depth / Backup / Res | ${baselineSummary.avgDepth} / ${baselineSummary.avgBackup} / ${baselineSummary.avgReserve} | ${bonusSummary.avgDepth} / ${bonusSummary.avgBackup} / ${bonusSummary.avgReserve} | — |`,
    );
  }

  await writeFile(path.join(outputDir, "summary.md"), mdParts.join("\n"));
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
