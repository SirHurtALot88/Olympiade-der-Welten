/**
 * Audit Slot-Brief plan vs planned picks for one team (S1 draft / season1_optimum_execute).
 *
 * Usage:
 *   node --import tsx scripts/slot-brief-draft-audit.ts W-L
 *   OLY_DEBUG_TEAM=W-L node --import tsx scripts/slot-brief-draft-audit.ts
 */
import { loadEnvConfig } from "@next/env";
import path from "node:path";

import { buildAiNeedsPicksCompare } from "@/lib/ai/ai-needs-picks-compare-service";
import { classifyMarketBracket, buildLeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const persistence = createPersistenceService();
  const teamCode = process.argv[2] ?? process.env.OLY_DEBUG_TEAM ?? "W-L";
  const steps = Number(process.env.OLY_DEBUG_STEPS ?? "13");

  const fresh = persistence.createFreshSeasonOneSave({ name: `Slot-Brief audit ${teamCode} ${Date.now()}` });
  const draftSeed = process.env.OLY_DEBUG_SEED ?? `slot-brief-${teamCode}:${fresh.saveId}`;

  const result = await buildAiNeedsPicksCompare({
    source: "sqlite",
    saveId: fresh.saveId,
    seasonId: fresh.gameState.season.id,
    teamId: teamCode,
    teamScope: "single",
    steps,
    runMode: "season1_optimum_execute",
    draftSeed,
  });

  const team = result.teams.find((entry) => entry.teamCode === teamCode) ?? result.teams[0];
  if (!team) {
    console.log("No team entry.");
    return;
  }

  const briefs = team.planner.slotBriefs ?? [];
  const prices = team.plannedPicks.map((pick) => pick.price).filter((v): v is number => v != null);
  const brackets = prices.length > 0 ? buildLeagueMarketBrackets(prices) : null;

  console.log(`\n=== Slot-Brief Audit: ${team.teamCode} ${team.teamName} ===`);
  console.log(`Cash: ${team.currentRosterState.cash} | Planned picks: ${team.plannedPicks.length}`);
  console.log(`Slot plan: ${team.planner.slotPlan.join(" → ")}`);
  console.log(`\nBriefs (${briefs.length}):`);
  for (const brief of briefs) {
    console.log(
      `  #${brief.step} ${brief.lane.padEnd(10)} | ${brief.purposeLabel} | target=${brief.targetMw ?? "?"}M ceiling=${brief.ceilingMw ?? "?"}M`,
    );
  }

  console.log(`\nPicks vs Brief:`);
  for (const pick of team.plannedPicks) {
    const bracket =
      pick.price != null && brackets ? classifyMarketBracket(pick.price, brackets) : pick.slotBracket ?? "?";
    const purpose = pick.slotPurposeLabel ?? "—";
    const axes = [pick.slotPrimaryAxis, pick.slotSecondaryAxis].filter(Boolean).join("+") || "—";
    const purposeScore = pick.scoreBreakdown?.slotPurposeMatchScore ?? null;
    const envelopeScore = pick.scoreBreakdown?.envelopeSpreadFitScore ?? null;
    console.log(
      `  #${pick.step} ${pick.lane.padEnd(10)} | brief: ${purpose}`,
    );
    console.log(
      `       → ${pick.playerName} (${pick.price ?? "?"}M, ${bracket}) axis=${pick.candidateAxis ?? "?"} briefAxes=${axes} purposeScore=${purposeScore} envelopeScore=${envelopeScore}`,
    );
  }

  const ssCount = team.plannedPicks.filter((pick) => {
    if (pick.slotBracket === "Superstar") return true;
    if (pick.price != null && brackets) return classifyMarketBracket(pick.price, brackets) === "Superstar";
    return pick.lane === "superstar";
  }).length;
  const starCount = team.plannedPicks.filter((pick) => {
    if (pick.slotBracket === "Star") return true;
    if (pick.price != null && brackets) return classifyMarketBracket(pick.price, brackets) === "Star";
    return pick.lane === "star";
  }).length;
  console.log(`\nBracket summary: SS=${ssCount} ST=${starCount} total=${team.plannedPicks.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
