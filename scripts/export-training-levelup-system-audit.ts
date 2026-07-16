import fs from "node:fs";
import path from "node:path";

import { createGameStateFromSeed, loadSeedData } from "@/lib/data/dataAdapter";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildPlayerSeasonPerformanceMap } from "@/lib/foundation/player-season-performance";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";
import {
  DEVELOPMENT_POINTS_PER_LEVEL,
  DEVELOPMENT_XP_PER_LEVEL,
  TRAINING_ATTRIBUTE_LABELS,
  buildPlayerDevelopmentLevelupModel,
} from "@/lib/training/training-levelup-service";

function csvEscape(value: unknown) {
  const text = Array.isArray(value) ? value.join("|") : value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(outputDir: string, fileName: string, rows: Array<Record<string, unknown>>) {
  fs.mkdirSync(outputDir, { recursive: true });
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  fs.writeFileSync(
    path.join(outputDir, fileName),
    `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`,
    "utf8",
  );
}

function writeMarkdown(outputDir: string, fileName: string, lines: string[]) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, fileName), `${lines.join("\n")}\n`, "utf8");
}

function main() {
  const outputDir = path.join(process.cwd(), "outputs", "training-levelup-system");
  const gameState = createGameStateFromSeed(loadSeedData());
  const ratingByPlayerId = buildPlayerRatingContractMap(gameState);
  const performanceByPlayerId = buildPlayerSeasonPerformanceMap(gameState);
  const rosterByPlayerId = new Map(gameState.rosters.map((entry) => [entry.playerId, entry] as const));
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));

  const models = gameState.players.map((player) => {
    const roster = rosterByPlayerId.get(player.id) ?? null;
    const profile = roster ? getTeamStrategyProfile(gameState, roster.teamId) : null;
    const forecast = buildPlayerProgressionForecast({
      gameState,
      player,
      playerRating: ratingByPlayerId.get(player.id) ?? null,
      seasonPerformance: performanceByPlayerId.get(player.id) ?? null,
      trainingModeByPlayerId: player.trainingMode ? { [player.id]: player.trainingMode } : null,
      currentXP: player.currentXP ?? 0,
      spentXP: player.spentXP ?? 0,
      lifetimeXP: player.lifetimeXP ?? null,
    });
    return {
      player,
      roster,
      team: roster ? teamById.get(roster.teamId) ?? null : null,
      model: buildPlayerDevelopmentLevelupModel({
        gameState,
        player,
        forecast,
        teamId: roster?.teamId ?? null,
        profile,
      }),
    };
  });

  writeCsv(
    outputDir,
    "training-levelup-by-player.csv",
    models.map(({ player, roster, team, model }) => ({
      playerId: player.id,
      playerName: player.name,
      teamId: roster?.teamId ?? "",
      teamName: team?.name ?? "",
      developmentLevel: model.level.developmentLevel,
      progressPct: model.level.progressPct,
      trainingPointsAvailable: model.level.trainingPointsAvailable,
      levelUpsAvailable: model.level.levelUpsAvailable,
      netDevelopmentXP: model.level.netDevelopmentXP,
      regressionRisk: model.level.regressionRisk,
      trainingForm: model.level.trainingForm,
      developmentRoute: model.level.developmentRoute,
      lastTrend: model.level.lastTrend,
    })),
  );

  writeCsv(
    outputDir,
    "attribute-affinity-by-player.csv",
    models.map(({ player, model }) => ({
      playerId: player.id,
      playerName: player.name,
      signature1: model.affinity.signatureAttributes[0],
      signature1Label: TRAINING_ATTRIBUTE_LABELS[model.affinity.signatureAttributes[0]],
      signature2: model.affinity.signatureAttributes[1],
      signature2Label: TRAINING_ATTRIBUTE_LABELS[model.affinity.signatureAttributes[1]],
      weakAttribute: model.affinity.weakAttribute,
      weakLabel: TRAINING_ATTRIBUTE_LABELS[model.affinity.weakAttribute],
      reasons: model.affinity.reasons,
    })),
  );

  writeCsv(
    outputDir,
    "levelup-notifications.csv",
    models.flatMap(({ player, model }) =>
      model.notifications.map((notification) => ({
        playerId: player.id,
        playerName: player.name,
        notification,
      })),
    ),
  );

  writeCsv(
    outputDir,
    "signature-shift-audit.csv",
    models.map(({ player, model }) => ({
      playerId: player.id,
      playerName: player.name,
      canShift: model.signatureShift.canShift,
      oldSignatureAttributes: model.signatureShift.oldSignatureAttributes,
      newSignatureAttributes: model.signatureShift.newSignatureAttributes,
      oldWeakAttribute: model.signatureShift.oldWeakAttribute,
      newWeakAttribute: model.signatureShift.newWeakAttribute,
      reason: model.signatureShift.reason,
      notification: model.signatureShift.notification,
    })),
  );

  writeCsv(
    outputDir,
    "ai-training-point-allocation-preview.csv",
    models.map(({ player, roster, model }) => ({
      playerId: player.id,
      playerName: player.name,
      teamId: roster?.teamId ?? "",
      pointsAvailable: model.level.trainingPointsAvailable,
      pointsSpent: model.aiAllocation.pointsSpent,
      pointsRemaining: model.aiAllocation.pointsRemaining,
      recommendedAttributes: model.aiAllocation.recommendedAttributes,
      spendPlan: model.aiAllocation.spendPlan.map((entry) => `${entry.attribute}:${entry.cost}:${entry.reason}`),
      reasons: model.aiAllocation.reasons,
    })),
  );

  writeCsv(
    outputDir,
    "in-season-regression-events.csv",
    models.map(({ player, model }) => ({
      playerId: player.id,
      playerName: player.name,
      visible: model.regressionEvent.visible,
      risk: model.regressionEvent.risk,
      attribute: model.regressionEvent.attribute,
      delta: model.regressionEvent.delta,
      reason: model.regressionEvent.reason,
    })),
  );

  writeCsv(
    outputDir,
    "development-delta-preview.csv",
    models.flatMap(({ player, model }) =>
      model.upgradePreview.map((preview) => ({
        playerId: player.id,
        playerName: player.name,
        attribute: preview.attribute,
        label: preview.label,
        affinity: preview.affinity,
        currentValue: preview.currentValue,
        nextValue: preview.nextValue,
        cost: preview.finalCost,
        attributeDelta: preview.attributeDelta,
        topDisciplineDeltas: preview.topDisciplineDeltas.map((delta) => `${delta.label}:${delta.delta}`),
        currentRatingDelta: preview.currentRatingDelta,
        marketValuePreviewDelta: preview.marketValuePreviewDelta,
        expectedSalaryPreviewDelta: preview.expectedSalaryPreviewDelta,
        contractSalaryStable: preview.contractSalaryStable,
        blocked: preview.blocked,
        blockReason: preview.blockReason,
      })),
    ),
  );

  writeMarkdown(outputDir, "training-levelup-system-audit.md", [
    "# Training Level-Up & Attribute Affinity V2",
    "",
    `Source: seed snapshot`,
    `Players: ${models.length}`,
    `Development XP pro Level: ${DEVELOPMENT_XP_PER_LEVEL}`,
    `Trainingspunkte pro Level-Up: ${DEVELOPMENT_POINTS_PER_LEVEL}`,
    "",
    "## Guards",
    "- Jeder Development-Level-Up gibt exakt 10 Trainingspunkte.",
    "- Attributkosten: 1-30=1, 31-60=2, 61-85=3, 86-99=4.",
    "- Signature reduziert Kosten um 1, Minimum 1.",
    "- Weak erhoeht Kosten um 1.",
    "- Attribute sind bei 99 geblockt.",
    "- contractSalary bleibt stabil; expectedSalary/MW sind Preview-Werte.",
    "",
    "## Distribution",
    `- Spieler mit offenen Trainingspunkten: ${models.filter((row) => row.model.level.trainingPointsAvailable > 0).length}`,
    `- Spieler mit sichtbarem Regression Risk: ${models.filter((row) => row.model.regressionEvent.visible).length}`,
    `- Signature-Shift-Preview moeglich: ${models.filter((row) => row.model.signatureShift.canShift).length}`,
  ]);

  console.log(JSON.stringify({ outputDir, players: models.length }, null, 2));
}

main();

