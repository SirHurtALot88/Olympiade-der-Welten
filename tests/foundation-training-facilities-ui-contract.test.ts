import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const foundationClientPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx";
const globalsPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css";

describe("foundation training and facilities ui contract", () => {
  it("exposes the Training & Gebaeude tab as a preview-only Foundation view", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");

    expect(fileText).toContain('| "training"');
    expect(fileText).toContain('{ id: "training", label: "Training & Gebäude" }');
    expect(fileText).toContain('id="foundation-training-facilities"');
    expect(fileText).toContain("SQLite / lokal");
    expect(fileText).toContain("Dieser Reiter schreibt keine Trainings-, Gebaeude- oder Cash-Werte.");
  });

  it("keeps training modes local and shows XP forecasts from preview data", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");

    expect(fileText).toContain("type TrainingModeDraft = PlayerTrainingMode");
    expect(fileText).toContain("trainingModeConfigs");
    expect(fileText).toContain("buildPlayerProgressionForecast");
    expect(fileText).toContain("PLAYER_PROGRESSION_XP_CONSTANTS");
    expect(fileText).toContain("trainingModeDraft");
    expect(fileText).toContain("Performance-XP");
    expect(fileText).toContain("Einsatz · MVS · gedeckelte PPs");
    expect(fileText).toContain("preview_only");
  });

  it("renders facilities through the local preview/confirm upgrade service", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");

    expect(fileText).toContain("FACILITY_CATALOG");
    expect(fileText).toContain("SPECIALIST_WING_VARIANTS");
    expect(fileText).toContain("getTeamFacilityState");
    expect(fileText).toContain("calculateFacilityUpkeep");
    expect(fileText).toContain("calculateFacilityIncome");
    expect(fileText).toContain("applyTrainingXpFacilityModifiers");
    expect(fileText).toContain("applyRecoveryFacilityModifiers");
    expect(fileText).toContain("applyUpgradeCostFacilityModifiers");
    expect(fileText).toContain("getScoutingConfidence");
    expect(fileText).toContain("getAnalyticsForecastQuality");
    expect(fileText).toContain('status: "preview_only"');
    expect(fileText).toContain("not_built");
    expect(fileText).toContain("upgradeCost");
    expect(fileText).toContain("Level 0");
    expect(fileText).toContain("nextLevel");
    expect(fileText).toContain("upkeep_due_per_season");
    expect(fileText).toContain("income_sources: fan_shop/arena_upgrade");
    expect(fileText).toContain("Upgrade prüfen");
    expect(fileText).toContain("Upgrade bestätigen");
    expect(fileText).toContain("runFacilityUpgradePreview");
    expect(fileText).toContain("confirmFacilityUpgrade");
    expect(fileText).toContain("/api/facilities/upgrade");
    expect(fileText).toContain("Facility Finance Forecast");
    expect(fileText).toContain("Facility Effects Forecast");
    expect(fileText).toContain("Base Training-XP");
    expect(fileText).toContain("Recovery-Forecast");
    expect(fileText).toContain("Academy Low-Tier Cost");
    expect(fileText).toContain("potential_source_missing");
    expect(fileText).not.toContain("/api/training");
  });

  it("keeps the new management surface card-based and compact", async () => {
    const cssText = await fs.readFile(globalsPath, "utf8");

    expect(cssText).toContain(".training-facilities-panel");
    expect(cssText).toContain(".training-summary-grid");
    expect(cssText).toContain(".training-player-card");
    expect(cssText).toContain(".training-facility-card");
    expect(cssText).toContain(".training-cash-forecast");
  });
});
