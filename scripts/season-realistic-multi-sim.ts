/**
 * Realistic multi-season simulation on a prep'd draft-inspect save.
 *
 * Runs long-run-sandbox (matchdays + season-end loop) and emits a consolidated
 * balancing / performance report under outputs/balance-audit/.
 *
 * Usage:
 *   npx tsx scripts/season-realistic-multi-sim.ts --save-id <id> [--seasons 5] [--prep-export path]
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { getTeamHardMinRequired, getTeamOptTarget } from "@/lib/ai/ai-market-plan-convergence-service";
import { calculateOpenBuyoutCost } from "@/lib/market/contract-negotiation-preview";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { buildEconomyAuditReport } from "@/lib/season/economy-audit-report";
import { buildBuyEconomics, buildTransferFinanceAudit } from "@/lib/season/transfer-finance-audit";

const PROJECT_ROOT = path.resolve(__dirname, "..");

type PhaseMetric = {
  seasonId?: string;
  matchdayId?: string;
  phase?: string;
  durationMs?: number;
  itemCount?: number | null;
  status?: string;
};

function argValue(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((entry) => entry.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] ?? null;
  return null;
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function log(message: string) {
  console.error(`[realistic-multi-sim] ${message}`);
}

function gini(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) return 0;
  let weighted = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    weighted += (index + 1) * sorted[index]!;
  }
  return round((2 * weighted) / (sorted.length * sum) - (sorted.length + 1) / sorted.length, 4);
};

function readJsonIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function aggregatePhaseTimings(rows: PhaseMetric[]) {
  const byPhase = new Map<string, { count: number; totalMs: number; maxMs: number }>();
  for (const row of rows) {
    const phase = row.phase ?? "unknown";
    const durationMs = row.durationMs ?? 0;
    const current = byPhase.get(phase) ?? { count: 0, totalMs: 0, maxMs: 0 };
    current.count += 1;
    current.totalMs += durationMs;
    current.maxMs = Math.max(current.maxMs, durationMs);
    byPhase.set(phase, current);
  }
  return [...byPhase.entries()]
    .map(([phase, stats]) => ({
      phase,
      count: stats.count,
      totalMs: round(stats.totalMs),
      avgMs: round(stats.totalMs / Math.max(1, stats.count)),
      maxMs: round(stats.maxMs),
    }))
    .sort((left, right) => right.totalMs - left.totalMs);
}

function seasonsFromHistory(gameState: GameState) {
  const ids = new Set<string>();
  for (const entry of gameState.transferHistory) ids.add(entry.seasonId);
  for (const snapshot of gameState.seasonState.seasonSnapshots ?? []) ids.add(snapshot.seasonId);
  ids.add(gameState.season.id);
  return [...ids].sort((left, right) => left.localeCompare(right, "de", { numeric: true }));
}

function buildTransferSeasonStats(gameState: GameState) {
  return seasonsFromHistory(gameState).map((seasonId) => {
    const transfers = gameState.transferHistory.filter((entry) => entry.seasonId === seasonId);
    const buys = transfers.filter((entry) => entry.transferType === "buy");
    const sells = transfers.filter((entry) => entry.transferType === "sell");
    const exits = transfers.filter((entry) => entry.transferType === "contract_exit");
    const buyFees = buys.reduce((sum, entry) => sum + entry.fee, 0);
    const sellFees = sells.reduce((sum, entry) => sum + entry.fee, 0);
    const bySource = transfers.reduce<Record<string, number>>((acc, entry) => {
      const key = entry.source ?? "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return {
      seasonId,
      buyCount: buys.length,
      sellCount: sells.length,
      contractExitCount: exits.length,
      buyFees: round(buyFees),
      sellFees: round(sellFees),
      netFees: round(sellFees - buyFees),
      bySource,
    };
  });
}

function buildSellEconomics(gameState: GameState) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  const rosterByPlayer = new Map(gameState.rosters.map((entry) => [entry.playerId, entry]));

  return gameState.transferHistory
    .filter((entry): entry is TransferHistoryEntry => entry.transferType === "sell")
    .map((entry) => {
      const player = playerById.get(entry.playerId);
      const rosterSnapshot = rosterByPlayer.get(entry.playerId);
      const saleBreakdown = buildTransfermarktSaleFactorBreakdown(gameState, player, rosterSnapshot);
      const scheduleBuyout = rosterSnapshot?.yearlySalarySchedule?.length
        ? calculateOpenBuyoutCost(rosterSnapshot.yearlySalarySchedule, 0)
        : null;
      const remainingSalary =
        scheduleBuyout ??
        (entry.remainingContractLength > 0 ? round(entry.remainingContractLength * entry.salary) : 0);
      const salePrice = entry.fee;
      const netEffect = round(salePrice - remainingSalary);

      return {
        seasonId: entry.seasonId,
        playerId: entry.playerId,
        playerName: entry.playerName ?? player?.name ?? entry.playerId,
        fromTeamId: entry.fromTeamId,
        fee: round(salePrice),
        salePriceModel: saleBreakdown.salePrice,
        remainingSalaryObligation: round(remainingSalary),
        netCashEffect: netEffect,
        contractShape: rosterSnapshot?.contractShape ?? "unknown",
        source: entry.source ?? "",
      };
    });
}

function buildContractShapeBySeason(gameState: GameState, saveId: string) {
  return seasonsFromHistory(gameState).map((seasonId) => {
    const factorWindow = getSeasonEconomyFactorWindow({ saveId, seasonId, seasonState: gameState.seasonState });
    const minUpcomingFactor = Math.min(...factorWindow.map((row) => row.factor));
    const rosterAtSeason = gameState.rosters.filter((entry) => {
      const joined = entry.joinedSeasonId ?? "";
      return joined.localeCompare(seasonId, "de", { numeric: true }) <= 0;
    });
    const shapes = rosterAtSeason.reduce<Record<string, number>>((acc, entry) => {
      const shape = entry.contractShape ?? "balanced";
      acc[shape] = (acc[shape] ?? 0) + 1;
      return acc;
    }, {});

    return {
      seasonId,
      salaryFactorWindow: factorWindow.map((row) => ({
        label: row.seasonLabel,
        factor: row.factor,
        source: row.source,
      })),
      minUpcomingFactor: round(minUpcomingFactor),
      contractShapeDistribution: shapes,
      frontLoadedSharePct:
        rosterAtSeason.length > 0
          ? round(((shapes.front_loaded ?? 0) / rosterAtSeason.length) * 100, 1)
          : 0,
    };
  });
}

function buildRosterOptAchievement(gameState: GameState) {
  const rows = gameState.teams.map((team) => {
    const rosterCount = gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    const optTarget = getTeamOptTarget(gameState, team.teamId);
    const hardMin = getTeamHardMinRequired(gameState, team.teamId);
    return {
      teamId: team.teamId,
      shortCode: team.shortCode,
      rosterCount,
      optTarget,
      hardMin,
      atOpt: rosterCount >= optTarget,
      withinOneOfOpt: rosterCount >= optTarget - 1 && rosterCount <= optTarget + 1,
      belowHardMin: rosterCount < hardMin,
    };
  });
  const totalTeams = rows.length;
  return {
    seasonId: gameState.season.id,
    totalTeams,
    atOptCount: rows.filter((row) => row.atOpt).length,
    withinOneOfOptCount: rows.filter((row) => row.withinOneOfOpt).length,
    belowHardMinCount: rows.filter((row) => row.belowHardMin).length,
    atOptPct: totalTeams > 0 ? round((rows.filter((row) => row.atOpt).length / totalTeams) * 100, 1) : 0,
    teams: rows,
  };
}

function buildTransferBuySourceBreakdown(transfers: TransferHistoryEntry[]) {
  const bySource: Record<string, number> = {};
  for (const entry of transfers) {
    if (entry.transferType !== "buy") continue;
    const source = entry.source ?? "unknown";
    bySource[source] = (bySource[source] ?? 0) + 1;
  }
  const strategic =
    (bySource.ai_preseason_market_buy ?? 0) +
    (bySource["manual_transfer_window"] ?? 0) +
    (bySource.ai_season_end_market_buy ?? 0);
  const repair = bySource.preseason_roster_repair_buy ?? 0;
  return { bySource, strategicBuyCount: strategic, repairBuyCount: repair };
}

function buildCashWaterfall(gameState: GameState) {
  const snapshots = gameState.seasonState.seasonSnapshots ?? [];
  if (snapshots.length > 0) {
    return snapshots.map((snapshot) => {
      const cashValues = snapshot.finalStandings.map((row) => row.cashTotal ?? row.cashEnd ?? 0);
      return {
        seasonId: snapshot.seasonId,
        minCash: round(Math.min(...cashValues)),
        maxCash: round(Math.max(...cashValues)),
        avgCash: round(cashValues.reduce((sum, value) => sum + value, 0) / Math.max(cashValues.length, 1)),
        cashGini: gini(cashValues),
        negativeCashTeams: cashValues.filter((value) => value < 0).length,
        champion: snapshot.finalStandings.find((row) => row.rank === 1)?.teamCode ?? null,
      };
    });
  }

  const cashValues = gameState.teams.map((team) => team.cash);
  return [
    {
      seasonId: gameState.season.id,
      minCash: round(Math.min(...cashValues)),
      maxCash: round(Math.max(...cashValues)),
      avgCash: round(cashValues.reduce((sum, value) => sum + value, 0) / Math.max(cashValues.length, 1)),
      cashGini: gini(cashValues),
      negativeCashTeams: cashValues.filter((value) => value < 0).length,
      champion: null,
    },
  ];
}

function buildMarkdownSummary(report: Record<string, unknown>) {
  const timing = report.timing as { longRunTotalSec?: number; phaseAggregates?: Array<{ phase: string; totalMs: number; avgMs: number; maxMs: number }> };
  const transferStats = report.transferStats as Array<{ seasonId: string; buyCount: number; sellCount: number; buyFees: number; sellFees: number; netFees: number }>;
  const cashWaterfall = report.cashWaterfall as Array<{ seasonId: string; minCash: number; maxCash: number; avgCash: number; cashGini: number; negativeCashTeams: number }>;
  const contractShapes = report.contractEconomics as Array<{ seasonId: string; minUpcomingFactor: number; frontLoadedSharePct: number }>;
  const rosterOpt = report.rosterOptAchievement as { atOptPct?: number; atOptCount?: number; totalTeams?: number; belowHardMinCount?: number };
  const buySources = report.transferBuySources as { strategicBuyCount?: number; repairBuyCount?: number };

  return [
    "# Realistic Multi-Season Balance Report",
    "",
    `Save: \`${report.saveId}\``,
    `Seasons simulated: ${report.targetSeasons}`,
    `Long-run duration: ${timing.longRunTotalSec}s`,
    "",
    "## Cash by Season",
    ...cashWaterfall.map(
      (row) =>
        `- ${row.seasonId}: min ${row.minCash} · max ${row.maxCash} · avg ${row.avgCash} · Gini ${row.cashGini} · negative teams ${row.negativeCashTeams}`,
    ),
    "",
    "## Transfers by Season",
    ...transferStats.map(
      (row) =>
        `- ${row.seasonId}: ${row.buyCount} buys (${row.buyFees}) · ${row.sellCount} sells (${row.sellFees}) · net ${row.netFees}`,
    ),
    "",
    "## Roster OPT Achievement (final state)",
    `- at OPT: ${rosterOpt.atOptCount ?? 0}/${rosterOpt.totalTeams ?? 0} (${rosterOpt.atOptPct ?? 0}%)`,
    `- below hard min: ${rosterOpt.belowHardMinCount ?? 0}`,
    "",
    "## Buy Sources (league total)",
    `- strategic market buys: ${buySources.strategicBuyCount ?? 0}`,
    `- emergency repair buys: ${buySources.repairBuyCount ?? 0}`,
    "",
    "## Contract Shapes vs Salary Factor Window",
    ...contractShapes.map(
      (row) => `- ${row.seasonId}: min upcoming factor ${row.minUpcomingFactor} · front_loaded ${row.frontLoadedSharePct}%`,
    ),
    "",
    "## Performance Hotspots (top 10 phases by total ms)",
    ...(timing.phaseAggregates ?? [])
      .slice(0, 10)
      .map((row) => `- ${row.phase}: total ${row.totalMs}ms · avg ${row.avgMs}ms · max ${row.maxMs}ms`),
    "",
    `Full JSON: ${report.reportPath}`,
  ].join("\n");
}

async function main() {
  const startedAt = Date.now();
  loadEnvConfig(PROJECT_ROOT);

  const saveId = argValue("--save-id");
  if (!saveId) {
    throw new Error("Missing required --save-id (from season:prep-draft-inspect output).");
  }
  const targetSeasons = Number(argValue("--seasons") ?? "5");
  const prepExportPath = argValue("--prep-export");

  const persistence = createPersistenceService();
  const saveBefore = persistence.getSaveById(saveId);
  if (!saveBefore) throw new Error(`Save not found: ${saveId}`);

  const timestamp = Date.now();
  const outputDir = path.join(PROJECT_ROOT, "outputs", "balance-audit", `realistic-multi-${timestamp}`);
  fs.mkdirSync(outputDir, { recursive: true });

  log(`Starting long-run sandbox on ${saveId} → S${targetSeasons}…`);
  const longRunStartedAt = Date.now();
  execFileSync("tsx", [path.join(PROJECT_ROOT, "scripts", "long-run-sandbox-s1-s6.ts")], {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      OLY_LONG_RUN_SAVE_ID: saveId,
      OLY_LONG_RUN_FINAL_SEASON: String(targetSeasons),
      OLY_LONG_RUN_OUTPUT_DIR: outputDir,
      OLY_LONG_RUN_LABEL: `Realistic Multi S1-S${targetSeasons}`,
    },
  });
  const longRunMs = Date.now() - longRunStartedAt;

  const saveAfter = persistence.getSaveById(saveId);
  if (!saveAfter) throw new Error(`Save disappeared after simulation: ${saveId}`);

  const phaseTimings = readJsonIfExists<PhaseMetric[]>(path.join(outputDir, "five-season-phase-timings.json")) ?? [];
  const longRunSummary = readJsonIfExists<Record<string, unknown>>(path.join(outputDir, "multi-season-s1-s6-summary.json"));
  const prepExport = prepExportPath ? readJsonIfExists<Record<string, unknown>>(prepExportPath) : null;

  const transferStats = buildTransferSeasonStats(saveAfter.gameState);
  const sellEconomics = buildSellEconomics(saveAfter.gameState);
  const contractEconomics = buildContractShapeBySeason(saveAfter.gameState, saveId);
  const cashWaterfall = buildCashWaterfall(saveAfter.gameState);
  const phaseAggregates = aggregatePhaseTimings(phaseTimings);
  const economyAudit = buildEconomyAuditReport({ saveId, gameState: saveAfter.gameState });
  const transferFinanceAudit = buildTransferFinanceAudit(saveAfter.gameState);
  const buyEconomics = buildBuyEconomics(saveAfter.gameState);
  const rosterOptAchievement = buildRosterOptAchievement(saveAfter.gameState);
  const transferBuySources = buildTransferBuySourceBreakdown(saveAfter.gameState.transferHistory);
  fs.writeFileSync(path.join(outputDir, "transfer-finance-violations.json"), `${JSON.stringify({ violations: transferFinanceAudit.violations, doctrineStats: transferFinanceAudit.doctrineStats }, null, 2)}\n`);
  fs.writeFileSync(
    path.join(outputDir, "transfer-finance-by-season.csv"),
    [
      "seasonId,teamId,teamName,cashStart,cashEnd,buyFeesPaid,sellProceeds,netTransferCash,sponsorCashIn,salaryPaidOut,netSponsorCash,buyCount,sellCount,cashReconciliationDelta",
      ...transferFinanceAudit.rows.map((row) =>
        [
          row.seasonId,
          row.teamId,
          row.teamName,
          row.cashStart ?? "",
          row.cashEnd ?? "",
          row.buyFeesPaid,
          row.sellProceeds,
          row.netTransferCash,
          row.sponsorCashIn,
          row.salaryPaidOut,
          row.netSponsorCash,
          row.buyCount,
          row.sellCount,
          row.cashReconciliationDelta ?? "",
        ].join(","),
      ),
    ].join("\n"),
  );

  const reportPath = path.join(outputDir, "realistic-multi-report.json");
  const report = {
    generatedAt: new Date().toISOString(),
    saveId,
    saveName: saveAfter.name,
    targetSeasons,
    finalSeasonId: saveAfter.gameState.season.id,
    finalGamePhase: saveAfter.gameState.gamePhase,
    prepExport: prepExport
      ? {
          path: prepExportPath,
          timingMs: prepExport.timingMs ?? null,
          draftQuality: prepExport.draftQuality ?? null,
          cashRange: prepExport.cashRange ?? null,
        }
      : null,
    timing: {
      prepMs: prepExport?.timingMs ?? null,
      longRunTotalMs: longRunMs,
      longRunTotalSec: round(longRunMs / 1000, 1),
      totalPipelineMs: Date.now() - startedAt,
      phaseAggregates,
      rawPhaseCount: phaseTimings.length,
      slowestPhases: phaseAggregates.slice(0, 15),
    },
    longRunSummary,
    transferStats,
    sellEconomicsSummary: {
      sellCount: sellEconomics.length,
      avgNetCashEffect: sellEconomics.length
        ? round(sellEconomics.reduce((sum, row) => sum + row.netCashEffect, 0) / sellEconomics.length)
        : 0,
      negativeNetCount: sellEconomics.filter((row) => row.netCashEffect < 0).length,
    },
    sellEconomicsSample: sellEconomics.slice(0, 40),
    contractEconomics,
    cashWaterfall,
    economyAudit,
    transferFinanceAudit: {
      violationCount: transferFinanceAudit.violations.length,
      violations: transferFinanceAudit.violations,
      doctrineStats: transferFinanceAudit.doctrineStats,
    },
    buyEconomicsSummary: {
      buyCount: buyEconomics.length,
      avgTotalFirstYearCost: buyEconomics.length
        ? round(buyEconomics.reduce((sum, row) => sum + row.totalFirstYearCost, 0) / buyEconomics.length)
        : 0,
    },
    buyEconomicsSample: buyEconomics.slice(0, 40),
    rosterOptAchievement,
    transferBuySources,
    leagueTotals: {
      transferHistoryEntries: saveAfter.gameState.transferHistory.length,
      totalBuyFees: round(transferStats.reduce((sum, row) => sum + row.buyFees, 0)),
      totalSellFees: round(transferStats.reduce((sum, row) => sum + row.sellFees, 0)),
    },
    reportPath,
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "realistic-multi-summary.md"), `${buildMarkdownSummary(report)}\n`, "utf8");

  console.log("\n=== REALISTIC MULTI-SEASON REPORT ===");
  console.log(`saveId: ${saveId}`);
  console.log(`seasons: S1–S${targetSeasons} (final: ${report.finalSeasonId}, phase: ${report.finalGamePhase})`);
  console.log(`long-run timing: ${report.timing.longRunTotalSec}s`);
  console.log(`transfers: ${report.leagueTotals.transferHistoryEntries} entries · buys ${report.leagueTotals.totalBuyFees} · sells ${report.leagueTotals.totalSellFees}`);
  for (const row of cashWaterfall) {
    console.log(`  ${row.seasonId} cash: ${row.minCash}–${row.maxCash} (avg ${row.avgCash}, Gini ${row.cashGini})`);
  }
  console.log(
    `economy audit: ${economyAudit.ok ? "OK" : "WARN"} · repair buys ${economyAudit.preseasonRepairBuyCount} · sponsor season_end ${economyAudit.sponsorSeasonEndLogs}`,
  );
  console.log(
    `roster OPT: ${rosterOptAchievement.atOptCount}/${rosterOptAchievement.totalTeams} at opt (${rosterOptAchievement.atOptPct}%) · below hard min ${rosterOptAchievement.belowHardMinCount}`,
  );
  console.log(
    `buy sources: strategic ${transferBuySources.strategicBuyCount} · repair ${transferBuySources.repairBuyCount}`,
  );
  if (!economyAudit.ok) {
    for (const violation of economyAudit.violations) {
      console.log(`  violation: ${violation}`);
    }
  }
  console.log(`top phases:`);
  for (const row of phaseAggregates.slice(0, 5)) {
    console.log(`  ${row.phase}: ${row.totalMs}ms total (${row.count}x, max ${row.maxMs}ms)`);
  }
  console.log(`report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
