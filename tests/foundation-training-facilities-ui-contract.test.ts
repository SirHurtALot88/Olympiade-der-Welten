import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const foundationClientPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx";
const trainingV2Path = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/training-facilities-v2/TrainingFacilitiesV2Client.tsx";
const trainingCompactPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/training-compact/TrainingCompactClient.tsx";
const globalsPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css";

describe("foundation training and facilities ui contract", () => {
  it("routes the main navigation into compact training and facilities v2", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");

    expect(fileText).toContain('| "trainingCompact"');
    expect(fileText).toContain('| "trainingV2"');
    expect(fileText).toContain('{ id: "trainingCompact", label: "Training"');
    expect(fileText).toContain('{ id: "trainingV2", label: "Gebäude"');
    expect(fileText).toContain('return "foundation-training-compact";');
    expect(fileText).toContain('return "foundation-training-facilities-v2";');
    expect(fileText).toContain('id="foundation-training-compact"');
    expect(fileText).toContain("<TrainingCompactClient");
    const trainingV2Text = await fs.readFile(trainingV2Path, "utf8");
    expect(trainingV2Text).toContain('data-testid="foundation-training-facilities-v2"');
  });

  it("keeps the facilities surface focused on upgrades, maintenance and facility effects", async () => {
    const fileText = await fs.readFile(trainingV2Path, "utf8");

    expect(fileText).toContain("Gebaeude & Infrastruktur");
    expect(fileText).toContain("layoutMode");
    expect(fileText).toContain("Training & Gebaeude");
    expect(fileText).toContain("Entwicklung steuern, Gebaeude lesen, Wachstum sauber planen.");
    expect(fileText).toContain("Unterhalt, Zustand und naechster Hebel");
    expect(fileText).toContain("Gebaeude-Wirkung");
    expect(fileText).toContain("Upgrade pruefen");
    expect(fileText).toContain("Upgrade bestaetigen");
    expect(fileText).toContain("Wartung pruefen");
    expect(fileText).toContain("Wartung bestaetigen");
  });

  it("keeps compact training focused on player development controls", async () => {
    const fileText = await fs.readFile(trainingCompactPath, "utf8");

    expect(fileText).toContain('data-testid="foundation-training-compact"');
    expect(fileText).toContain("TrainingPlayerLane");
    expect(fileText).toContain("Gebaeude oeffnen");
    expect(fileText).toContain("Kader entwickeln");
  });

  it("still builds training and facilities around local preview services", async () => {
    const [fileText, trainingText] = await Promise.all([
      fs.readFile(foundationClientPath, "utf8"),
      fs.readFile(trainingV2Path, "utf8"),
    ]);

    expect(fileText).toContain("buildPlayerProgressionForecast");
    expect(fileText).toContain("buildTrainingPlayerRowView");
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
    expect(fileText).toContain("/api/facilities/upgrade");
  });

  it("keeps the modern v2 layout classes wired up", async () => {
    const cssText = await fs.readFile(globalsPath, "utf8");

    expect(cssText).toContain(".training-v2-shell");
    expect(cssText).toContain(".training-compact-shell");
    expect(cssText).toContain(".training-v2-lane");
    expect(cssText).toContain(".training-v2-player-card");
    expect(cssText).toContain(".training-v2-facility-card");
    expect(cssText).toContain(".training-v2-preview-card");
    expect(cssText).toContain(".training-v2-workspace.is-facilities-only");
  });
});
