import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const shellRouterPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationShellRouter.tsx";
const shellRouterBodyScopePath =
  "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx";
const crossTabTrainingPath =
  "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/tabs/use-foundation-cross-tab-training.ts";
const trainingPanelDerivationsPath =
  "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/tabs/use-training-panel-derivations.ts";
const facilityEffectsPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/facilities/facility-effects.ts";
const foundationPageTypesPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/tabs/foundation-page-types.ts";
const moduleHelpersPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/tabs/foundation-page-module-helpers.tsx";
const facilitiesV2Path = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/facilities-v2/FacilitiesV2Client.tsx";
const trainingCompactPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/training-compact/TrainingCompactClient.tsx";
const trainingViewSharedPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/training-facilities-v2/training-view-shared.tsx";
const globalsPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css";

describe("foundation training and facilities ui contract", () => {
  it("routes the main navigation into compact training and facilities v2 grid", async () => {
    const [pageTypesText, moduleHelpersText, shellRouterText, trainingCompactShellHostText, shellRouterBodyText, facilitiesText] =
      await Promise.all([
        fs.readFile(foundationPageTypesPath, "utf8"),
        fs.readFile(moduleHelpersPath, "utf8"),
        fs.readFile(shellRouterPath, "utf8"),
        fs.readFile(
          "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/training-compact/FoundationTrainingCompactShellHost.tsx",
          "utf8",
        ),
        fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationShellRouterBody.tsx", "utf8"),
        fs.readFile(facilitiesV2Path, "utf8"),
      ]);

    expect(pageTypesText).toContain('| "trainingCompact"');
    expect(pageTypesText).toContain('| "trainingV2"');
    expect(moduleHelpersText).toContain('{ id: "trainingCompact", label: "Training"');
    expect(moduleHelpersText).toContain('{ id: "trainingV2", label: "Gebäude"');
    expect(moduleHelpersText).toContain('return "foundation-training-compact";');
    expect(moduleHelpersText).toContain('return "foundation-facilities-v2";');
    expect(shellRouterText).toContain('id="foundation-training-compact"');
    expect(trainingCompactShellHostText).toContain("<TrainingCompactClient");
    expect(shellRouterBodyText).toContain("<FacilitiesV2Client");
    expect(facilitiesText).toContain('id="foundation-facilities-v2"');
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
    // The training/facilities wiring this test guards moved out of the
    // FoundationPageClient monolith into the shell-router-body scope hook and
    // dedicated per-tab derivation hooks during the Foundation perf split.
    const [scopeText, crossTabTrainingText, trainingDerivationsText, facilityEffectsText] = await Promise.all([
      fs.readFile(shellRouterBodyScopePath, "utf8"),
      fs.readFile(crossTabTrainingPath, "utf8"),
      fs.readFile(trainingPanelDerivationsPath, "utf8"),
      fs.readFile(facilityEffectsPath, "utf8"),
    ]);

    expect(scopeText).toContain("buildPlayerProgressionForecast");
    expect(trainingDerivationsText).toContain("buildOrganicSeasonProgression");
    expect(trainingDerivationsText).toContain("buildTrainingPlayerRowView");
    expect(scopeText).toContain("trainingModeDraft");
    expect(scopeText).toContain("async function setPlayerTrainingMode");
    expect(trainingDerivationsText).toContain("player.trainingMode ?? \"mittel\"");
    expect(scopeText).toContain("persistLocalGameStateImmediately(nextGameState)");
    expect(scopeText).toContain("getTeamFacilityState");
    expect(crossTabTrainingText).toContain("calculateFacilityUpkeep");
    expect(crossTabTrainingText).toContain("calculateFacilityIncome");
    expect(crossTabTrainingText).toContain("applyTrainingXpFacilityModifiers");
    expect(crossTabTrainingText).toContain("applyRecoveryFacilityModifiers");
    expect(facilityEffectsText).toContain("applyUpgradeCostFacilityModifiers");
    expect(scopeText).toContain("/api/facilities/upgrade");
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
