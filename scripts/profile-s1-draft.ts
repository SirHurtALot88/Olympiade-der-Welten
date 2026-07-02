import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const persistence = createPersistenceService();
  const saveId = argValue("--save-id");
  if (!saveId) {
    throw new Error("Provide --save-id <id>");
  }

  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);
  const seasonId = save.gameState.season.id;

  console.error(`[profile-draft] dry-run picks · save ${saveId} · season ${seasonId}`);
  const startedAt = Date.now();
  const result = await runAiPicksExecutePreview(
    {
      source: "sqlite",
      saveId,
      seasonId,
      dryRun: true,
      teamScope: "all",
      allowSetupAllTeams: true,
      stepsPerTeam: 16,
      runMode: seasonId === "season-1" ? "season1_optimum_execute" : "default",
      draftSeed: `${saveId}:${seasonId}:profile`,
    },
    persistence,
  );
  const wallMs = Date.now() - startedAt;

  console.log("\n=== S1 DRAFT PREVIEW PROFILE (dry-run) ===");
  console.log(`season:         ${seasonId}`);
  console.log(`wall time:      ${wallMs} ms (${(wallMs / 1000).toFixed(1)} s)`);
  console.log(`previewMs:      ${result.performance.previewMs} ms`);
  console.log(`teams:          ${result.teams.length}`);
  console.log(`planned picks:  ${result.globalPreview.appliedPickCount}`);
  console.log("--- per team (previewMs) ---");
  for (const row of [...result.performance.teamTimings].sort((a, b) => b.previewMs - a.previewMs)) {
    console.log(`  ${row.teamCode.padEnd(4)} ${row.previewMs.toFixed(0)} ms · planned=${row.plannedPicks}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
