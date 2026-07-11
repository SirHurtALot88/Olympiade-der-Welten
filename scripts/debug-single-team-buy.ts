import { loadEnvConfig } from "@next/env";
import path from "node:path";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { buildAiMarketPlanPreview } from "@/lib/ai/ai-market-plan-preview-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getAiManagerMarketSpendableCash } from "@/lib/ai/ai-manager-apply-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = process.argv[2] ?? "save-1782587077241-ziv9ap";
  const shortCode = process.argv[3] ?? "D-P";
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save missing: ${saveId}`);
  const team = save.gameState.teams.find((entry) => entry.shortCode === shortCode);
  if (!team) throw new Error(`Team missing: ${shortCode}`);

  const rosterCount = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
  const spendable = getAiManagerMarketSpendableCash(save.gameState, team.teamId, team.cash);
  console.log("team", shortCode, "roster", rosterCount, "cash", team.cash, "spendable", spendable, "rosterLimit", team.rosterLimit);

  const preview = await buildAiMarketPlanPreview({
    source: "sqlite",
    saveId,
    seasonId: save.gameState.season.id,
    teamId: team.teamId,
    teamScope: "all",
    buyLimit: 128,
    sellLimit: 4,
    buyNeedOnly: true,
    forceBuyScanTeamIds: [team.teamId],
  });
  const entry = preview.teams.find((row) => row.teamId === team.teamId);
  console.log("preview", entry?.status, "buys", entry?.buyPlan.candidates.length, "sells", entry?.sellPlan.candidates.length);
  console.log("warnings", entry?.warnings?.slice(0, 8));
  if (entry?.buyPlan.candidates[0]) {
    const top = entry.buyPlan.candidates[0];
    console.log("topBuy", top.playerName, top.price ?? top.marketValue);
  }

  const apply = await applyAiMarketPlanLocally({
    saveId,
    seasonId: save.gameState.season.id,
    teamId: team.teamId,
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    options: {
      applySellSteps: false,
      applyBuySteps: true,
      previewBuyLimit: 128,
      applyBuyStepsInBatch: 3,
      forceBuyScanTeamIds: [team.teamId],
      stopOnTeamFailure: false,
      returnGateRows: true,
    },
  });
  const teamResult = apply.teams.find((row) => row.teamId === team.teamId);
  console.log("apply", teamResult?.result, "executedBuys", teamResult?.executedBuys, "blockers", teamResult?.blockingReasons);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
