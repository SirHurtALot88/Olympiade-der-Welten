/**
 * Export sell preview candidates vs executed market sells for a save/season.
 * Usage: npx tsx scripts/export-sell-candidate-vs-execution.ts --save-id <id> [--season-id season-3]
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { buildAiMarketPlanPreview } from "@/lib/ai/ai-market-plan-preview-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");
loadEnvConfig(PROJECT_ROOT);

function parseArgs() {
  const args = process.argv.slice(2);
  let saveId: string | null = null;
  let seasonId: string | null = null;
  let outputDir = path.join(PROJECT_ROOT, "outputs", "transfer-audit");
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--save-id") saveId = args[index + 1] ?? null;
    if (args[index] === "--season-id") seasonId = args[index + 1] ?? null;
    if (args[index] === "--output-dir") outputDir = args[index + 1] ?? outputDir;
  }
  if (!saveId) throw new Error("--save-id required");
  return { saveId, seasonId, outputDir };
}

async function main() {
  const { saveId, seasonId, outputDir } = parseArgs();
  fs.mkdirSync(outputDir, { recursive: true });
  process.env.OLY_APP_SQLITE_PATH =
    process.env.OLY_APP_SQLITE_PATH ?? path.join(PROJECT_ROOT, "data", "oly-app.sqlite");

  const preview = await buildAiMarketPlanPreview({
    source: "sqlite",
    saveId,
    seasonId: seasonId ?? undefined,
    teamScope: "ai",
  });

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  const executedSells = new Set(
    (save?.gameState.transferHistory ?? [])
      .filter((entry) => entry.transferType === "sell" && entry.fromTeamId != null)
      .filter((entry) => !seasonId || entry.seasonId === seasonId)
      .map((entry) => `${entry.fromTeamId}::${entry.playerId}`),
  );

  const rows = ["seasonId,teamId,teamName,playerId,playerName,compositeScore,expectedSellValue,executed,status"];
  for (const team of preview.teams) {
    for (const candidate of team.sellPlan.candidates) {
      const key = `${team.teamId}::${candidate.playerId}`;
      rows.push(
        [
          preview.seasonId,
          team.teamId,
          team.teamName,
          candidate.playerId,
          candidate.playerName ?? "",
          candidate.strategicSellScore ?? candidate.sellPriority ?? "",
          candidate.expectedSellValue ?? "",
          executedSells.has(key) ? "yes" : "no",
          team.status,
        ].join(","),
      );
    }
  }

  const outPath = path.join(outputDir, `sell-candidate-vs-execution-${saveId}.csv`);
  fs.writeFileSync(outPath, rows.join("\n"));
  console.log(`Wrote ${rows.length - 1} rows to ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
