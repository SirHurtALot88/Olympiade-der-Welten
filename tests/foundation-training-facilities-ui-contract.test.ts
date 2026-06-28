import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const foundationClientPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx";
const facilitiesV2Path = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/facilities-v2/FacilitiesV2Client.tsx";
const trainingCompactPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/training-compact/TrainingCompactClient.tsx";
const trainingViewSharedPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/training-facilities-v2/training-view-shared.tsx";
const globalsPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css";

describe("foundation training and facilities ui contract", () => {
  it("routes the main navigation into compact training and facilities v2 grid", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");

    expect(fileText).toContain('| "trainingCompact"');
    expect(fileText).toContain('| "trainingV2"');
    expect(fileText).toContain('{ id: "trainingCompact", label: "Training"');
    expect(fileText).toContain('{ id: "trainingV2", label: "Gebäude"');
    expect(fileText).toContain('return "foundation-training-compact";');
    expect(fileText).toContain('return "foundation-facilities-v2";');
    expect(fileText).toContain('id="foundation-training-compact"');
    expect(fileText).toContain('id="foundation-facilities-v2"');
    expect(fileText).toContain("<TrainingCompactClient");
    expect(fileText).toContain("<FacilitiesV2Client");
    const facilitiesText = await fs.readFile(facilitiesV2Path, "utf8");
    expect(facilitiesText).toContain('data-testid="foundation-facilities-v2"');
  });

  it("keeps the facilities grid focused on upgrades, maintenance and level strips", async () => {
    const [fileText, gridText] = await Promise.all([
      fs.readFile(facilitiesV2Path, "utf8"),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/facilities-v2/FacilityGridCard.tsx",
        "utf8",
      ),
    ]);

    expect(fileText).toContain("Gebäude");
    expect(fileText).toContain("facilities-v2-grid");
    expect(gridText).toContain("FacilityLevelStrip");
    expect(fileText).toContain("Upgrade");
    expect(fileText).toContain("Wartung");
    expect(fileText).toContain("FacilityDecisionModal");
    expect(fileText).not.toContain("TrainingPlayerLane");
  });

  it("keeps compact training focused on player development controls", async () => {
    const fileText = await fs.readFile(trainingCompactPath, "utf8");

    expect(fileText).toContain('data-testid="foundation-training-compact"');
    expect(fileText).toContain("TrainingPlayerLane");
    expect(fileText).toContain("organicForecast.netSetpoints");
    expect(fileText).toContain("Training");
  });

  it("still builds training and facilities around local preview services", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");

    expect(fileText).toContain("buildPlayerProgressionForecast");
    expect(fileText).toContain("buildOrganicSeasonProgression");
    expect(fileText).toContain("organicByPlayerId");
    expect(fileText).toContain("Organische Saison-Entwicklung");
    expect(fileText).toContain("Organische Entwicklung anwenden");
    expect(fileText).toContain("organicNetSetpoints");
    expect(fileText).toContain("buildTrainingPlayerRowView");
    expect(fileText).toContain("trainingModeDraft");
    expect(fileText).toContain("async function setPlayerTrainingMode");
    expect(fileText).toContain("player.trainingMode ?? \"mittel\"");
    expect(fileText).toContain("persistLocalGameStateImmediately(nextGameState)");
    expect(fileText).toContain("getTeamFacilityState");
    expect(fileText).toContain("calculateFacilityUpkeep");
    expect(fileText).toContain("calculateFacilityIncome");
    expect(fileText).toContain("applyTrainingXpFacilityModifiers");
    expect(fileText).toContain("applyRecoveryFacilityModifiers");
    expect(fileText).toContain("applyUpgradeCostFacilityModifiers");
    expect(fileText).toContain("/api/facilities/upgrade");
  });

  it("keeps the modern v2 layout classes wired up", async () => {
    const cssText = await fs.readFile(globalsPath, "utf8");

    expect(cssText).toContain(".training-v2-shell");
    expect(cssText).toContain(".training-compact-shell");
    expect(cssText).toContain(".training-v2-lane");
    expect(cssText).toContain(".training-v2-rider-card");
    expect(cssText).toContain(".facilities-v2-grid");
    expect(cssText).toContain(".facilities-v2-card");
    expect(cssText).toContain(".facilities-v2-level-strip");
    expect(cssText).toContain(".facilities-v2-action-bar");
  });

  it("uses full-art portrait cards with training context presets in the player lane", async () => {
    const [trainingText, cssText] = await Promise.all([
      fs.readFile(trainingViewSharedPath, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(trainingText).toContain("FoundationPlayerPortraitCard");
    expect(trainingText).toContain('context="training"');
    expect(trainingText).toContain('density="full"');
    expect(trainingText).toContain("organicForecast.netSetpoints");
    expect(trainingText).toContain("forecast.regressionRisk");
    expect(trainingText).toContain("trainingModeLabel");
    expect(trainingText).toContain("footerSlot");
    expect(trainingText).toContain("team-portraits-grid");
    expect(cssText).toContain(".foundation-player-portrait-card.is-density-compact");
  });
});
