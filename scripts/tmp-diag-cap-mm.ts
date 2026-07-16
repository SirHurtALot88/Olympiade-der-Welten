import { loadEnvConfig } from "@next/env";
import path from "node:path";

import { buildAiTransfermarktPreview } from "@/lib/ai/ai-transfermarkt-preview-service";
import {
  buildPlannerEnvelope,
  capExplicitCountsByBudget,
} from "@/lib/ai/market-pick-engine/budget-envelope";
import { buildLeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import { resolveSimulatedPlannerSpendableCash } from "@/lib/ai/ai-market-slot-plan-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const persistence = createPersistenceService();
  const fresh = persistence.createFreshSeasonOneSave({ name: "cap debug" });
  for (const code of ["M-M", "H-R", "B-P"]) {
    const team = fresh.gameState.teams.find((entry) => entry.shortCode === code)!;
    const preview = await buildAiTransfermarktPreview({
      source: "sqlite",
      saveId: fresh.saveId,
      seasonId: fresh.gameState.season.id,
      teamId: team.teamId,
      teamScope: "all",
      limit: 5000,
      candidateScopeMode: "budget_wide",
    });
    const fa = preview.teams[0].recommendedBuys
      .map((entry) => entry.price ?? entry.marketValue)
      .filter((value): value is number => typeof value === "number" && value > 0);
    const spendable = resolveSimulatedPlannerSpendableCash({
      gameState: fresh.gameState,
      teamId: team.teamId,
      teamCash: team.cash ?? 0,
      simulatedRosterCount: 0,
    });
    const brackets = buildLeagueMarketBrackets(fa);
    const explicit = {
      superstarAllowed: 1,
      starAllowed: 2,
      coreNeeded: 4,
      specialistNeeded: 0,
      depthNeeded: 2,
      backupNeeded: 1,
      cheapFillNeeded: 0,
      premiumCap: 3,
    };
    console.log(`\n${code} spendable=${spendable} star=${brackets.star.targetMw} ss=${brackets.superstar.targetMw}`);
    const capped = capExplicitCountsByBudget({ counts: explicit, spendable, steps: 14, rosterGap: 10, brackets });
    console.log("capped", capped);
    const env = buildPlannerEnvelope({
      spendable,
      rosterGap: 10,
      missingToMin: 7,
      steps: 14,
      profile: {
        playerMin: 7,
        identityPlayerOpt: 10,
        effectiveOptTarget: 10,
        comfortTarget: 10,
        optFlexSlots: 0,
        starChaser: true,
        starAllowed: 2,
        superstarAllowed: 1,
        coreNeeded: 4,
        premiumFirst: true,
        qualityFloorMw: 12,
        disableCheapLanes: false,
        pickPhase: "fill_to_opt",
      },
      faPrices: fa,
      explicitCounts: explicit,
    });
    console.log("sequence", env.slotSequence.join(","));
    console.log("premium", env.slotSequence.filter((lane) => lane === "star" || lane === "superstar").length);
  }
}

main();
