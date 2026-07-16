import { loadEnvConfig } from "@next/env";
import path from "node:path";

import { buildAiNeedsPicksCompare } from "@/lib/ai/ai-needs-picks-compare-service";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import type { FormCardColor } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const COLOR: Record<FormCardColor, string> = { red: "POW", green: "SPE", blue: "MEN", yellow: "SOC" };

function fmtM(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value / 1_000_000).toFixed(2)}M`;
}

function fmtCoverage(coverage: Record<FormCardColor, number> | undefined) {
  if (!coverage) return "—";
  return (["red", "green", "blue", "yellow"] as FormCardColor[])
    .map((color) => `${COLOR[color]}=${coverage[color] ?? 0}`)
    .join(" ");
}

async function dumpTeam(teamCode: string, saveId: string, seasonId: string, steps: number, focusStep: number) {
  const draftSeed = `colorspam-example:${saveId}:${teamCode}`;
  const persistence = createPersistenceService();
  const fresh = persistence.getSaveById(saveId);
  if (!fresh) throw new Error(`Save missing: ${saveId}`);

  const result = await buildAiNeedsPicksCompare({
    source: "sqlite",
    saveId,
    seasonId,
    teamId: teamCode,
    teamScope: "all",
    steps,
    runMode: "season1_optimum_execute",
    draftSeed,
  });

  const team = result.teams.find((entry) => entry.teamCode === teamCode) ?? result.teams[0];
  if (!team) throw new Error(`No compare entry for ${teamCode}`);

  const gm = getTeamGeneralManager(fresh.gameState, team.teamId);
  console.log(`\n${"=".repeat(80)}`);
  console.log(`=== ${team.teamCode} ${team.teamName} ===`);
  console.log(`GM: ${gm?.profile?.archetype ?? "?"} | draftSeed: ${draftSeed}`);
  console.log(`Planned picks: ${team.plannedPicks.length}\n`);

  for (const pick of team.plannedPicks) {
    console.log(
      `Step ${pick.step}: ${pick.playerName} (${pick.className}, ${COLOR[pick.formColor ?? "blue"]}) ${fmtM(pick.price)} | score=${pick.finalScore.toFixed(1)} | colorspam=${pick.scoreBreakdown.colorspamPenalty}`,
    );
    console.log(`  Coverage before: ${fmtCoverage(pick.formColorCoverageBefore)}`);
  }

  const targetStep =
    focusStep > 0
      ? team.plannedPicks.find((pick) => pick.step === focusStep)
      : team.plannedPicks.find((pick) => pick.step === 7 || pick.step === 8) ??
        team.plannedPicks.find((pick) => {
          const counts = pick.formColorCoverageBefore;
          if (!counts) return false;
          return Math.max(counts.red, counts.green, counts.blue, counts.yellow) >= 5;
        });

  if (!targetStep?.topScoredAlternatives?.length) {
    console.log("\nNo step with topScoredAlternatives found.");
    return;
  }

  console.log(`\n--- Top candidates at step ${targetStep.step} (before: ${fmtCoverage(targetStep.formColorCoverageBefore)}) ---`);
  console.log(
    `Lane: ${targetStep.pickLane} | winner: ${targetStep.playerName} (${COLOR[targetStep.formColor ?? "blue"]}) score=${targetStep.finalScore.toFixed(1)} colorspam=${targetStep.scoreBreakdown.colorspamPenalty}`,
  );
  console.log(
    "rank | player                  | class        | color | price   | final | cspam | need | ident | fcov | classSpam",
  );
  console.log("-".repeat(110));

  for (const alt of targetStep.topScoredAlternatives.slice(0, 12)) {
    const marker = alt.playerId === targetStep.playerId ? " ← PICK" : "";
    console.log(
      `${String(alt.rank).padStart(4)} | ${alt.playerName.slice(0, 23).padEnd(23)} | ${alt.className.slice(0, 12).padEnd(12)} | ${COLOR[alt.formColor ?? "blue"].padEnd(3)} | ${fmtM(alt.price).padStart(7)} | ${alt.finalScore.toFixed(1).padStart(5)} | ${String(alt.colorspamPenalty).padStart(5)} | ${String(alt.needMatchScore).padStart(4)} | ${String(alt.teamIdentityScore).padStart(5)} | ${String(alt.formColorCoverageScore).padStart(4)} | ${String(alt.classSpamPenalty).padStart(9)}${marker}`,
    );
  }

  const top5 = targetStep.topScoredAlternatives.slice(0, 5);
  const colorMix = top5.reduce(
    (acc, alt) => {
      const key = alt.formColor ?? "red";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  console.log(
    `\nTop-5 color mix: ${Object.entries(colorMix)
      .map(([color, count]) => `${COLOR[color as FormCardColor] ?? color}=${count}`)
      .join(" ")}`,
  );
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  process.env.OLY_DEBUG_PICK_SCORING = "1";

  const teams = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const teamCodes = teams.length > 0 ? teams : ["W-W", "C-S"];
  const steps = Number(process.env.OLY_DEBUG_STEPS ?? "10");
  const focusStep = Number(process.env.OLY_FOCUS_STEP ?? "0");

  const persistence = createPersistenceService();
  const fresh = persistence.createFreshSeasonOneSave({ name: `Colorspam example ${Date.now()}` });
  console.log(`Fresh save: ${fresh.saveId}`);

  for (const teamCode of teamCodes) {
    await dumpTeam(teamCode, fresh.saveId, fresh.gameState.season.id, steps, focusStep);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
