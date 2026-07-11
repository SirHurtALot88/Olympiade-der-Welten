import { loadEnvConfig } from "@next/env";
import path from "node:path";

import { buildAiNeedsPicksCompare } from "@/lib/ai/ai-needs-picks-compare-service";
import { buildPlannerEnvelope, capExplicitCountsByBudget } from "@/lib/ai/market-pick-engine/budget-envelope";
import { buildLeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import { resolveSimulatedPlannerSpendableCash } from "@/lib/ai/ai-market-slot-plan-service";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const persistence = createPersistenceService();
  const fresh = persistence.createFreshSeasonOneSave({ name: `Star planner diag ${Date.now()}` });
  const teamCodes = (process.argv.slice(2).length ? process.argv.slice(2) : ["M-M", "H-R", "Z-H", "B-P"]).map((c) =>
    c.toUpperCase(),
  );

  for (const teamCode of teamCodes) {
    const team = fresh.gameState.teams.find(
      (entry) => (entry.shortCode ?? entry.teamId).toUpperCase() === teamCode,
    );
    const identity = fresh.gameState.teamIdentities.find((entry) => entry.teamId === team?.teamId);
    const rosterCount = fresh.gameState.rosters.filter((entry) => entry.teamId === team?.teamId).length;
    const { playerOpt, playerMin } = deriveRosterTargets(team, identity);
    const spendable =
      team != null
        ? resolveSimulatedPlannerSpendableCash({
            gameState: fresh.gameState,
            teamId: team.teamId,
            teamCash: team.cash ?? 0,
            simulatedRosterCount: rosterCount,
          })
        : null;
    console.log(
      `\n--- ${teamCode} pre-check roster=${rosterCount} min=${playerMin} opt=${playerOpt} gap=${playerOpt - rosterCount} cash=${team?.cash} spendable=${spendable} ambition=${identity?.ambition} finances=${identity?.finances}`,
    );

    const compare = await buildAiNeedsPicksCompare({
      source: "sqlite",
      saveId: fresh.saveId,
      seasonId: fresh.gameState.season.id,
      teamId: teamCode,
      steps: 14,
      runMode: "season1_optimum_execute",
      draftSeed: `diag-star:${fresh.saveId}`,
      candidateScopeMode: "budget_wide",
    });
    const entry = compare.teams[0];
    if (!entry) {
      console.log(`\n=== ${teamCode}: NOT FOUND ===`);
      continue;
    }
    const p = entry.planner;
    const lanes = p?.slotPlan ?? [];
    const env = p?.envelopeSlots ?? [];
    console.log(`\n=== ${entry.teamCode} cash=${entry.cashBefore} roster=${entry.rosterBefore} opt=${entry.targetRosterOpt} ===`);
    console.log(
      `starAllowed=${p?.starAllowed} superstarAllowed=${p?.superstarAllowed} core=${p?.coreNeeded} depth=${p?.depthNeeded} backup=${p?.backupNeeded}`,
    );
    console.log(`slotPlan: ${lanes.join(",")}`);
    console.log(
      `slot counts: star=${lanes.filter((l) => l === "star").length} ss=${lanes.filter((l) => l === "superstar").length} core=${lanes.filter((l) => l === "core").length}`,
    );
    if (env.length) {
      console.log(
        "envelope targets:",
        env.map((s, i) => `${i}:${s.lane}@${s.targetMw}(ceil ${s.ceilingMw})`).join(" | "),
      );
    }
    const active = entry.plannedPicks.filter((pick) => pick.status !== "blocked");
    console.log(`planned picks: ${active.length}`);
    for (const pick of active.slice(0, 16)) {
      console.log(
        `  step=${pick.step} lane=${pick.pickLane} ${pick.playerName} mv=${pick.marketValue} status=${pick.status}`,
      );
    }
    const premiumPicks = active.filter((pick) => pick.pickLane === "star" || pick.pickLane === "superstar");
    console.log(`premium picks: ${premiumPicks.length}`);
    if (entry.cashStrategy) {
      console.log(
        `cashStrategy: season1LaneSpendPool=${entry.cashStrategy.season1LaneSpendPool} laneSpendCapsSum=${entry.cashStrategy.laneSpendCapsSum}`,
      );
    }
    if (p?.warnings?.length) {
      console.log("planner warnings:", p.warnings.slice(0, 6).join(" | "));
    }

    // simulate capExplicitCountsByBudget with typical explicit counts
    if (team && spendable != null) {
      const brackets = buildLeagueMarketBrackets([]);
      const explicit = {
        superstarAllowed: 1,
        starAllowed: 2,
        coreNeeded: 3,
        specialistNeeded: 0,
        depthNeeded: 4,
        backupNeeded: 3,
        cheapFillNeeded: 0,
        premiumCap: 3,
      };
      const capped = capExplicitCountsByBudget({
        counts: explicit,
        spendable,
        steps: 14,
        rosterGap: Math.max(playerOpt - rosterCount, 0),
        brackets,
      });
      console.log("capExplicitCountsByBudget(simulated premium=3):", capped);
      const env = buildPlannerEnvelope({
        spendable,
        rosterGap: Math.max(playerOpt - rosterCount, 0),
        missingToMin: Math.max(playerMin - rosterCount, 0),
        steps: 14,
        profile: {
          playerMin,
          identityPlayerOpt: playerOpt,
          effectiveOptTarget: playerOpt,
          comfortTarget: playerOpt,
          optFlexSlots: 0,
          starChaser: true,
          starAllowed: 2,
          superstarAllowed: 1,
          coreNeeded: 3,
          premiumFirst: true,
          qualityFloorMw: 12,
          disableCheapLanes: false,
          pickPhase: "fill_to_opt",
        },
        explicitCounts: explicit,
      });
      console.log(
        "forced envelope sequence:",
        env.slotSequence.join(","),
        "stars=",
        env.slotSequence.filter((l) => l === "star" || l === "superstar").length,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
