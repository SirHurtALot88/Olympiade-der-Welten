import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildMultiseasonRebuyReport } from "@/lib/season/multiseason-rebuy-report";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  if (!saveId) throw new Error("Provide --save-id <id>");
  const outputDir = argValue("--output-dir") ?? path.join(PROJECT_ROOT, "outputs");
  fs.mkdirSync(outputDir, { recursive: true });

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const report = buildMultiseasonRebuyReport({ gameState: save.gameState, saveId });
  const jsonPath = path.join(outputDir, "multiseason-rebuy-report.json");
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const csvRows = report.topPairs.map((pair) => ({
    teamCode: pair.teamCode,
    playerId: pair.playerId,
    playerName: pair.playerName,
    buyCount: pair.buyCount,
    buySeasons: pair.buySeasons.join("|"),
    crossSeasonRebuy: pair.crossSeasonRebuy,
    sameSeasonRebuy: pair.sameSeasonRebuy,
  }));
  const columns = ["teamCode", "playerId", "playerName", "buyCount", "buySeasons", "crossSeasonRebuy", "sameSeasonRebuy"];
  const csvPath = path.join(outputDir, "multiseason-rebuy-report.csv");
  fs.writeFileSync(
    csvPath,
    [columns.join(","), ...csvRows.map((row) => columns.map((column) => csvEscape(row[column as keyof typeof row])).join(","))].join("\n") + "\n",
  );

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${csvPath}`);
  console.log(
    `Summary: ${report.pairsWithMultipleBuys} rebuy pairs (${report.crossSeasonRebuyPairs} cross-season, ${report.sameSeasonRebuyPairs} same-season) across ${report.teamsWithRebuys} teams`,
  );
}

main();
