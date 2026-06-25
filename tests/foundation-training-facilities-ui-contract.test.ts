import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const foundationClientPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx";
const trainingV2Path = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/training-facilities-v2/TrainingFacilitiesV2Client.tsx";
const globalsPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css";

describe("foundation training and facilities ui contract", () => {
  it("routes the main navigation into Training V2", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");

    expect(fileText).toContain('| "trainingV2"');
    expect(fileText).toContain('{ id: "trainingV2", label: "Training & Gebäude"');
    expect(fileText).toContain('return "foundation-training-facilities-v2";');
    expect(fileText).toContain('return "trainingV2";');
    expect(fileText).toContain('id="foundation-training-facilities-v2"');
  });

  it("keeps the new training surface focused on development, facilities and season-end xp", async () => {
    const fileText = await fs.readFile(trainingV2Path, "utf8");

    expect(fileText).toContain("Training & Gebaeude");
    expect(fileText).toContain("Entwicklung steuern, Gebaeude lesen, Wachstum sauber planen.");
    expect(fileText).toContain("Unterhalt, Zustand und naechster Hebel");
    expect(fileText).toContain("Gebaeude-Wirkung");
    expect(fileText).toContain("Upgrade pruefen");
    expect(fileText).toContain("Upgrade bestaetigen");
    expect(fileText).toContain("Wartung pruefen");
    expect(fileText).toContain("Wartung bestaetigen");
    expect(fileText).toContain("Season-End Entwicklung");
    expect(fileText).toContain("XP-Upgrades bestaetigen");
  });

  it("still builds training and facilities around local preview services", async () => {
    const [fileText, trainingText] = await Promise.all([
      fs.readFile(foundationClientPath, "utf8"),
      fs.readFile(trainingV2Path, "utf8"),
    ]);

    expect(fileText).toContain("buildPlayerProgressionForecast");
    expect(fileText).toContain("PLAYER_PROGRESSION_XP_CONSTANTS");
    expect(fileText).toContain("trainingModeDraft");
    expect(trainingText).toContain("trainingModeReadOnly = readOnly");
    expect(fileText).toContain("async function setPlayerTrainingMode");
    expect(fileText).toContain("player.trainingMode ?? \"mittel\"");
    expect(fileText).toContain("persistLocalGameStateImmediately(nextGameState)");
    expect(fileText).toContain("getTeamFacilityState");
    expect(fileText).toContain("calculateFacilityUpkeep");
    expect(fileText).toContain("calculateFacilityIncome");
    expect(fileText).toContain("applyTrainingXpFacilityModifiers");
    expect(fileText).toContain("applyRecoveryFacilityModifiers");
    expect(fileText).toContain("applyUpgradeCostFacilityModifiers");
    expect(fileText).toContain("getScoutingConfidence");
    expect(fileText).toContain("getAnalyticsForecastQuality");
    expect(fileText).toContain("/api/facilities/upgrade");
  });

  it("keeps the modern v2 layout classes wired up", async () => {
    const cssText = await fs.readFile(globalsPath, "utf8");

    expect(cssText).toContain(".training-v2-shell");
    expect(cssText).toContain(".training-v2-lane");
    expect(cssText).toContain(".training-v2-player-card");
    expect(cssText).toContain(".training-v2-facility-card");
    expect(cssText).toContain(".training-v2-preview-card");
    expect(cssText).toContain(".training-v2-seasonend");
  });
});
