import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("facilities v2 ui contract", () => {
  it("uses central grid layout without player lane or coach copy", async () => {
    const [clientText, gridText, foundationText, cssText] = await Promise.all([
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/facilities-v2/FacilitiesV2Client.tsx", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/facilities-v2/FacilityGridCard.tsx", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationShellRouterBody.tsx", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css", "utf8"),
    ]);

    expect(clientText).toContain('data-testid="foundation-facilities-v2"');
    expect(clientText).toContain('data-testid="facilities-v2-grid"');
    expect(clientText).toContain('data-testid="facilities-v2-action-bar"');
    expect(clientText).not.toContain("TrainingPlayerLane");
    expect(clientText).not.toContain("FoundationSubNav");
    expect(clientText).not.toContain("training-v2-kicker");
    expect(gridText).toContain("FacilityLevelStrip");
    expect(foundationText).toContain("<FacilitiesV2Client");
    expect(foundationText).toContain('activeView === "trainingV2"');
    expect(foundationText).not.toMatch(/activeView === "trainingV2"[\s\S]{0,400}layoutMode="combined"/);
    expect(cssText).toContain(".facilities-v2-grid");
    expect(cssText).toContain(".facilities-v2-level-strip");
    expect(cssText).toContain(".facilities-v2-action-bar");
  });
});
