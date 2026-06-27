/**
 * Verifies that a save did NOT execute cash-prize-apply and uses sponsor season_end settlement instead.
 *
 * Usage:
 *   npx tsx scripts/verify-cash-economy-audit.ts --save-id <id>
 */

import { loadEnvConfig } from "@next/env";
import path from "node:path";

import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

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

function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  if (!saveId) {
    console.error("Usage: npx tsx scripts/verify-cash-economy-audit.ts --save-id <id>");
    process.exit(1);
  }

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    console.error(`Save not found: ${saveId}`);
    process.exit(1);
  }

  const cashPrizeLogs = save.gameState.seasonState.cashPrizeApplyLogs ?? [];
  const sponsorLogs = save.gameState.seasonState.sponsorPayoutLogs ?? [];
  const violations: string[] = [];

  const appliedCashPrize = cashPrizeLogs.filter((log) => log.action === "apply");
  if (appliedCashPrize.length > 0) {
    violations.push(`FAIL: cash_prize_apply executed ${appliedCashPrize.length}x`);
  }

  const baseFirst = sponsorLogs.filter((log) => log.phase === "base_first");
  if (baseFirst.length > 0) {
    violations.push(`FAIL: sponsor base_first executed ${baseFirst.length}x (expected deferred for AI)`);
  }

  const seasonEnd = sponsorLogs.filter((log) => log.phase === "season_end");
  const seasonsWithEnd = [...new Set(seasonEnd.map((log) => log.seasonId))].sort();
  const cashValues = save.gameState.teams.map((team) => team.cash);

  const report = {
    saveId,
    seasonId: save.gameState.season.id,
    gamePhase: save.gameState.gamePhase,
    ok: violations.length === 0,
    violations,
    cashPrizeApplyLogs: appliedCashPrize.length,
    sponsorBaseFirstLogs: baseFirst.length,
    sponsorSeasonEndLogs: seasonEnd.length,
    seasonsWithSponsorEndSettlement: seasonsWithEnd,
    leagueCash: {
      min: Math.min(...cashValues),
      max: Math.max(...cashValues),
      avg: round(cashValues.reduce((sum, value) => sum + value, 0) / cashValues.length),
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exit(2);
  }
}

main();
