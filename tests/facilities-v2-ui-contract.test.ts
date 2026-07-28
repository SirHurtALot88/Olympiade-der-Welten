import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("facilities v2 ui contract", () => {
  it("uses central grid layout without player lane or coach copy", async () => {
    const [clientText, gridText, foundationText, cssText] = await Promise.all([
      // FacilitiesV2Client.tsx is now just a thin wrapper; the actual markup
      // lives in FacilitiesV2NewLook.tsx.
      fs.readFile(path.join(process.cwd(), "app/foundation/facilities-v2/FacilitiesV2NewLook.tsx"), "utf8"),
      // FacilityGridCard.tsx wurde nirgends gerendert und ist entfernt — die
      // Level-Leiste lebt in der geteilten Facility-UI, die tatsächlich benutzt wird.
      fs.readFile(path.join(process.cwd(), "app/foundation/facilities-v2/facility-ui-shared.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/globals.css"), "utf8"),
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
