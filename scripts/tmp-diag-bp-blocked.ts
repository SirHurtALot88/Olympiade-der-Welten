import path from "node:path";
import Database from "better-sqlite3";
import { loadEnvConfig } from "@next/env";

import { planUnifiedTeamPicks } from "@/lib/ai/unified-pick-planner-service";
import { getTeamHardMinRequired, getTeamOptTarget, teamNeedsMarketConvergence, teamSkipsPreseasonMarketBuys } from "@/lib/ai/ai-market-plan-convergence-service";
import { resolveUnifiedMarketPickSteps } from "@/lib/ai/unified-pick-planner-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const dbPath = path.join(PROJECT_ROOT, "outputs/tmp-s2-unified-mode-check/balancing-run.sqlite");
  process.env.OLY_APP_SQLITE_PATH = dbPath;
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare("SELECT save_id FROM saves ORDER BY updated_at DESC LIMIT 1").get() as { save_id: string };
  db.close();

  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(row.save_id)!;
  const gs = save.gameState;

  const bp = gs.teams.find((t) => t.shortCode === "B-P")!;
  const roster = gs.rosters.filter((r) => r.teamId === bp.teamId);
  const hardMin = getTeamHardMinRequired(gs, bp.teamId);
  const optTarget = getTeamOptTarget(gs, bp.teamId);
  console.log(`B-P: roster=${roster.length} hardMin=${hardMin} opt=${optTarget} cash=${bp.cash} budget=${bp.budget}`);
  console.log(`teamNeedsMarketConvergence=${teamNeedsMarketConvergence(gs, bp.teamId)} teamSkipsPreseasonMarketBuys=${teamSkipsPreseasonMarketBuys(gs, bp.teamId)}`);

  const steps = resolveUnifiedMarketPickSteps({
    currentState: { rosterCount: roster.length, playerMin: hardMin, playerOpt: optTarget },
    sellPlan: { candidates: [] },
    buyPlan: { candidates: [] },
  });
  console.log(`resolveUnifiedMarketPickSteps -> ${steps}`);

  const planned = await planUnifiedTeamPicks({
    saveId: save.saveId,
    seasonId: gs.season.id,
    teamId: bp.teamId,
    steps: Math.max(steps, 7),
    runMode: "season1_optimum_execute",
  });
  console.log(`plannedPicks=${planned.plannedPicks.length}`);
  console.log(`warnings=${JSON.stringify(planned.warnings, null, 2)}`);
  console.log(`blockingReasons=${JSON.stringify(planned.blockingReasons, null, 2)}`);
  console.log(`compareStatus=${planned.compareStatus}`);
  for (const pick of planned.plannedPicks.slice(0, 10)) {
    console.log(`pick: ${pick.playerName} price=${pick.price} lane=${(pick as any).lane} status=${pick.status}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
