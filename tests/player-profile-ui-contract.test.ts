import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("player profile ui contract", () => {
  it("provides full-page player profile with tabs and projected classes report", async () => {
    const [profileText, foundationText, serviceText, previewText, drawerText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/player-profile/PlayerProfileClient.tsx",
        "utf8",
      ),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/player-profile-service.ts", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/projected-class-preview.ts", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/PlayerDetailDrawer.tsx", "utf8"),
    ]);

    expect(profileText).toContain("PlayerDetailDrawer");
    expect(profileText).toContain("PLAYER_PROFILE_TAB_ANCHORS");
    expect(foundationText).toContain("openPlayerProfileById");
    expect(foundationText).toContain("PlayerProfileClient");
    expect(serviceText).toContain("Übersicht");
    expect(previewText).toContain("buildProjectedClassPreview");
    expect(previewText).toContain("reclassRecommended");
    expect(drawerText).toContain("Achsen-Potential");
    expect(drawerText).toContain("data.potentialOverallDelta");
    expect(drawerText).toContain("data.trainingRouteImpact");
    expect(drawerText).toContain("headroomLabel");
  });
});
