import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("training facilities v2 ui contract", () => {
  it("keeps legacy combined client for reference but gebäude nav uses FacilitiesV2Client", async () => {
    const [legacyText, foundationText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/training-facilities-v2/TrainingFacilitiesV2Client.tsx",
        "utf8",
      ),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx", "utf8"),
    ]);

    expect(legacyText).toContain("layoutMode");
    expect(foundationText).toContain("FacilitiesV2Client");
    expect(foundationText).toContain('id="foundation-facilities-v2"');
  });
});
