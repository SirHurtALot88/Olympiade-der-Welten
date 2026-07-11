/**
 * Export buy preview candidates vs buy gate execution rows.
 * Usage: npx tsx scripts/export-buy-candidate-vs-execution.ts --save-id <id>
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { buildAiMarketPlanPreview } from "@/lib/ai/ai-market-plan-preview-service";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");
loadEnvConfig(PROJECT_ROOT);

function parseArgs() {
  const args = process.argv.slice(2);
  let saveId: string | null = null;
  let outputDir = path.join(PROJECT_ROOT, "outputs", "transfer-audit");
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--save-id") saveId = args[index + 1] ?? null;
    if (args[index] === "--output-dir") outputDir = args[index + 1] ?? outputDir;
  }
  if (!saveId) throw new Error("--save-id required");
  return { saveId, outputDir };
}

async function main() {
  const { saveId, outputDir } = parseArgs();
  fs.mkdirSync(outputDir, { recursive: true });
  process.env.OLY_APP_SQLITE_PATH =
    process.env.OLY_APP_SQLITE_PATH ?? path.join(PROJECT_ROOT, "data", "oly-app.sqlite");

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`save ${saveId} not found`);

  const apply = await applyAiMarketPlanLocally({
    saveId,
    seasonId: save.gameState.season.id,
    dryRun: true,
    options: { previewOnly: false },
  });

  const preview = await buildAiMarketPlanPreview({
    source: "sqlite",
    saveId,
    seasonId: save.gameState.season.id,
    teamScope: "ai",
  });

  const gateRows = (apply.diagnostics?.buyGateRows ?? []) as Array<Record<string, unknown>>;
  const gateByPlayer = new Map(gateRows.map((row) => [`${row.teamId}::${row.playerId}`, row] as const));

  const rows = ["teamId,teamName,playerId,playerName,previewScore,price,gateStatus,gateReasons,planStatus"];
  for (const team of preview.teams) {
    for (const candidate of team.buyPlan.candidates) {
      const gate = gateByPlayer.get(`${team.teamId}::${candidate.playerId}`);
      rows.push(
        [
          team.teamId,
          team.teamName,
          candidate.playerId,
          candidate.playerName ?? candidate.name ?? "",
          candidate.overallRecommendationScore ?? candidate.score ?? "",
          candidate.price ?? candidate.marketValue ?? "",
          gate?.status ?? "",
          gate?.reasons ?? "",
          team.status,
        ].join(","),
      );
    }
  }

  const outPath = path.join(outputDir, `buy-candidate-vs-execution-${saveId}.csv`);
  fs.writeFileSync(outPath, rows.join("\n"));
  console.log(`Wrote ${rows.length - 1} rows to ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
