import fs from "node:fs/promises";
import path from "node:path";

import { buildAiLeagueManagementPreview } from "@/lib/ai/ai-team-management-preview-service";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import {
  buildPotentialAiUsagePreview,
  buildPlayerDevelopmentInsight,
  buildPlayerScoutPotentialFromGameState,
} from "@/lib/progression/player-potential-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

function csvCell(value: unknown) {
  const text =
    value == null
      ? ""
      : Array.isArray(value)
        ? value.join(" | ")
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  return /[,"\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "\n";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n")}\n`;
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

async function main() {
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save = persistence.getActiveSave() ?? bootstrapped.save;
  if (!save) throw new Error("Kein lokaler Save gefunden.");

  const outputDir = path.join(process.cwd(), "outputs", "potential-system-audit");
  await fs.mkdir(outputDir, { recursive: true });

  const ratings = buildPlayerRatingContractMap(save.gameState);
  const rosterByPlayerId = new Map(save.gameState.rosters.map((entry) => [entry.playerId, entry] as const));
  const teamById = new Map(save.gameState.teams.map((entry) => [entry.teamId, entry] as const));
  const managerPreview = buildAiLeagueManagementPreview(save.gameState);
  const teamPlanById = new Map(managerPreview.teams.map((entry) => [entry.teamId, entry] as const));

  const playerRows = save.gameState.players.map((player) => {
    const rating = ratings.get(player.id) ?? null;
    const roster = rosterByPlayerId.get(player.id) ?? null;
    const economy = resolvePlayerEconomyContract({ player, rosterEntry: roster ?? null });
    const scout = buildPlayerScoutPotentialFromGameState({ gameState: save.gameState, player });
    const insight = buildPlayerDevelopmentInsight({
      gameState: save.gameState,
      player,
      currentRating: rating?.ovrNormalized ?? null,
      performanceRating: rating?.ratingPps ?? rating?.ppsSeason ?? null,
      scoutPotential: scout,
    });
    const expectedSalaryPremium = economy.salary != null ? round(economy.salary * (scout.salaryExpectationPremiumPct / 100), 2) : null;
    const marketValuePremium = economy.marketValue != null ? round(economy.marketValue * (scout.marketValuePotentialPremiumPct / 100), 2) : null;
    return {
      playerId: player.id,
      playerName: player.name,
      teamId: roster?.teamId ?? "",
      teamCode: roster ? teamById.get(roster.teamId)?.shortCode ?? roster.teamId : "",
      currentRating: insight.currentRating,
      performanceRating: insight.performanceRating,
      potentialRangeRaw: insight.potentialRangeRaw ? `${insight.potentialRangeRaw.min}-${insight.potentialRangeRaw.max}` : "",
      potentialRangeDisplay: insight.potentialRangeDisplay ? `${insight.potentialRangeDisplay.min}-${insight.potentialRangeDisplay.max}` : "",
      scoutRating: scout.scoutRating,
      scoutConfidence: insight.scoutConfidence,
      confidenceLabel: insight.confidenceLabel,
      developmentGap: insight.developmentGap,
      trainingForm: insight.trainingForm,
      developmentRoute: insight.developmentRoute,
      growthOutlook: insight.growthOutlook,
      growthSpeed: insight.growthSpeed,
      netDevelopmentXP: insight.netDevelopmentXP,
      potentialGapFactor: insight.developmentFactors.potentialGapFactor,
      trainingFormFactor: insight.developmentFactors.trainingFormFactor,
      routeFitFactor: insight.developmentFactors.routeFitFactor,
      regressionPressure: insight.developmentFactors.regressionPressure,
      risk: insight.risk,
      potentialLabel: insight.potentialLabel,
      recommendation: insight.recommendation,
      marketValue: economy.marketValue,
      marketValuePotentialPremiumPct: scout.marketValuePotentialPremiumPct,
      marketValuePotentialPremium: marketValuePremium,
      salary: economy.salary,
      expectedSalaryPremiumPct: scout.salaryExpectationPremiumPct,
      expectedSalaryPremium,
      contractSalaryStable: true,
      reasons: insight.reasons,
      warnings: insight.warnings,
      reasonChips: insight.reasonChips,
    };
  });

  const aiUsageRows = playerRows
    .filter((row) => row.teamId)
    .map((row) => {
      const plan = teamPlanById.get(String(row.teamId));
      const potentialUsefulFor =
        plan?.profile.strategicIntent === "rebuild" || plan?.profile.strategicIntent === "youth_development"
          ? "training_buy_hold"
          : plan?.profile.strategicIntent === "win_now"
            ? "current_first_renewal_check"
            : plan?.profile.strategicIntent === "salary_control"
              ? "sell_or_salary_cap"
              : "balanced_market_training";
      return {
        teamCode: row.teamCode,
        playerId: row.playerId,
        playerName: row.playerName,
        strategicIntent: plan?.profile.strategicIntent ?? "",
        trainingPlan: plan ? `${plan.trainingPlan.selectedTrainingFocus}/${plan.trainingPlan.selectedTrainingIntensity}` : "",
        potentialUsefulFor,
        growthOutlook: row.growthOutlook,
        risk: row.risk,
        developmentGap: row.developmentGap,
        scoutConfidence: row.scoutConfidence,
        rebuildScore: buildPotentialAiUsagePreview({
          player: save.gameState.players.find((player) => player.id === row.playerId)!,
          context: "rebuild",
          currentRating: Number(row.currentRating),
          marketValue: Number(row.marketValue),
          scoutPotential: buildPlayerScoutPotentialFromGameState({
            gameState: save.gameState,
            player: save.gameState.players.find((player) => player.id === row.playerId)!,
          }),
        }).finalScore,
        winNowScore: buildPotentialAiUsagePreview({
          player: save.gameState.players.find((player) => player.id === row.playerId)!,
          context: "win_now",
          currentRating: Number(row.currentRating),
          marketValue: Number(row.marketValue),
          scoutPotential: buildPlayerScoutPotentialFromGameState({
            gameState: save.gameState,
            player: save.gameState.players.find((player) => player.id === row.playerId)!,
          }),
        }).finalScore,
        valueScore: buildPotentialAiUsagePreview({
          player: save.gameState.players.find((player) => player.id === row.playerId)!,
          context: "cash_value",
          currentRating: Number(row.currentRating),
          marketValue: Number(row.marketValue),
          scoutPotential: buildPlayerScoutPotentialFromGameState({
            gameState: save.gameState,
            player: save.gameState.players.find((player) => player.id === row.playerId)!,
          }),
        }).finalScore,
        recommendation: row.recommendation,
      };
    });

  const marketImpactRows = playerRows.map((row) => ({
    playerId: row.playerId,
    playerName: row.playerName,
    teamCode: row.teamCode,
    marketValue: row.marketValue,
    marketValuePotentialPremiumPct: row.marketValuePotentialPremiumPct,
    marketValuePotentialPremium: row.marketValuePotentialPremium,
    salary: row.salary,
    expectedSalaryPremiumPct: row.expectedSalaryPremiumPct,
    expectedSalaryPremium: row.expectedSalaryPremium,
    contractSalaryStable: row.contractSalaryStable,
    confidenceLabel: row.confidenceLabel,
    warning: Number(row.scoutConfidence) < 45 ? "low_confidence_caps_premium" : "",
  }));

  const drawerExamples = playerRows
    .filter((row) => ["breakout", "growth", "regression_risk"].includes(String(row.growthOutlook)))
    .slice(0, 12)
    .map((row) =>
      [
        `## ${row.playerName}`,
        `- Team: ${row.teamCode || "Free Agent"}`,
        `- Current / Performance: ${row.currentRating ?? "?"} / ${row.performanceRating ?? "?"}`,
        `- Potential Range: ${row.potentialRangeDisplay || "?"} (${row.potentialLabel})`,
        `- Scout Confidence: ${row.scoutConfidence}% (${row.confidenceLabel})`,
        `- Gap / Form / Route: ${row.developmentGap ?? "?"} / ${row.trainingForm} / ${row.developmentRoute}`,
        `- Outlook / Risk: ${row.growthOutlook} / ${row.risk}`,
        `- Empfehlung: ${row.recommendation}`,
        "",
      ].join("\n"),
    )
    .join("\n");

  const counts = playerRows.reduce<Record<string, number>>((acc, row) => {
    acc[String(row.growthOutlook)] = (acc[String(row.growthOutlook)] ?? 0) + 1;
    return acc;
  }, {});
  const markdown = [
    "# Potential System Audit",
    "",
    `Save: ${save.saveId}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Begriffe",
    "",
    "- Current Rating: aktuelle Fähigkeit aus OVR/Rating/Core.",
    "- Performance Rating: gelieferte Leistung aus PPs/MVS/Einsätzen, falls vorhanden.",
    "- Potential Range: unsichere Entwicklungsspanne auf Current-Skala; Anzeige wird an Current geclamped.",
    "- Scout Confidence: Verlässlichkeit der Range; niedrig = breite/unsichere Range.",
    "- Development Gap: Midpoint der Anzeige-Range minus Current.",
    "- Training Form: S+ bis F als lesbare Entwicklungsform.",
    "- Growth Outlook: Breakout, Growth, Stable, Stagnation oder Regression Risk.",
    "",
    "## Distribution",
    "",
    ...Object.entries(counts).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Safety",
    "",
    "- contractSalary bleibt stabil; Potential erzeugt nur Premium-/ExpectedSalary-Preview.",
    "- Low Confidence wird als Warning sichtbar und deckelt die Verlässlichkeit.",
    "- Range unter Current wird nicht mehr verwirrend als niedriges Ceiling dargestellt.",
  ].join("\n");

  await Promise.all([
    fs.writeFile(path.join(outputDir, "potential-system-audit.md"), `${markdown}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "potential-by-player.csv"), toCsv(playerRows), "utf8"),
    fs.writeFile(path.join(outputDir, "potential-ai-usage-preview.csv"), toCsv(aiUsageRows), "utf8"),
    fs.writeFile(path.join(outputDir, "potential-drawer-examples.md"), `${drawerExamples}\n`, "utf8"),
    fs.writeFile(path.join(outputDir, "potential-market-impact.csv"), toCsv(marketImpactRows), "utf8"),
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        saveId: save.saveId,
        outputDir,
        players: playerRows.length,
        growthOutlooks: counts,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
