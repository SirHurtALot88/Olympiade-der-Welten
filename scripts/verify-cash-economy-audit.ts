/**
 * Verifies that a save did NOT execute cash-prize-apply and uses sponsor season_end settlement instead.
 *
 * Usage:
 *   npx tsx scripts/verify-cash-economy-audit.ts --save-id <id>
 */

import { loadEnvConfig } from "@next/env";
import path from "node:path";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { buildEconomyAuditReport } from "@/lib/season/economy-audit-report";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((entry) => entry.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] ?? null;
  return null;
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

  const report = buildEconomyAuditReport({ saveId, gameState: save.gameState });
  const controlSettings = buildTeamControlSettingsMap(save.gameState.teams, save.gameState.seasonState.teamControlSettings);
  const manualTeamIds = new Set(
    save.gameState.teams
      .filter((team) => (controlSettings[team.teamId]?.controlMode ?? "manual") === "manual")
      .map((team) => team.teamId),
  );
  const baseFirst = save.gameState.seasonState.sponsorPayoutLogs?.filter((log) => log.phase === "base_first") ?? [];
  const unexpectedBaseFirst = baseFirst.filter((log) => !manualTeamIds.has(log.teamId));
  if (unexpectedBaseFirst.length > 0) {
    report.violations.push(`sponsor_base_first_executed_for_ai:${unexpectedBaseFirst.length}`);
    report.ok = false;
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exit(2);
  }
}

main();
