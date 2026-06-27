import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("player profile ui contract", () => {
  it("provides full-page player profile with tabs and projected classes report", async () => {
    const [profileText, foundationText, serviceText, previewText, drawerText, trainingControlsText, chartText] =
      await Promise.all([
        fs.readFile(
          "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/player-profile/PlayerProfileClient.tsx",
          "utf8",
        ),
        fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx", "utf8"),
        fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/player-profile-service.ts", "utf8"),
        fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/projected-class-preview.ts", "utf8"),
        fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/PlayerDetailDrawer.tsx", "utf8"),
        fs.readFile(
          "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/player-profile/PlayerTrainingControls.tsx",
          "utf8",
        ),
        fs.readFile(
          "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/player-profile/PlayerAttributeProgressChart.tsx",
          "utf8",
        ),
      ]);

    expect(profileText).toContain("PlayerDetailDrawer");
    expect(profileText).toContain("PLAYER_PROFILE_TAB_ANCHORS");
    expect(profileText).toContain("trainingRow");
    expect(profileText).toContain("onSetTrainingMode");
    expect(foundationText).toContain("openPlayerProfileById");
    expect(foundationText).toContain("setPlayerProfileLoading(true)");
    expect(foundationText).toContain("PlayerProfileClient");
    expect(foundationText).toContain("playerProfileTrainingRow");
    expect(serviceText).toContain("Stats");
    expect(serviceText).toContain("player-drawer-training-controls");
    expect(previewText).toContain("buildProjectedClassPreview");
    expect(previewText).toContain("reclassRecommended");
    expect(drawerText).toContain("Achsen-Potential");
    expect(drawerText).toContain("data.potentialOverallDelta");
    expect(drawerText).toContain("data.trainingRouteImpact");
    expect(drawerText).toContain("headroomLabel");
    expect(drawerText).toContain("data.transferHistory");
    expect(drawerText).toContain("player-drawer-training-controls");
    expect(drawerText).toContain("player-drawer-transfer-history");
    expect(drawerText).toContain("PlayerAttributeProgressChart");
    expect(drawerText).toContain("PlayerTrainingControls");
    expect(drawerText).toContain("projectedClassPreview");
    expect(drawerText).toContain("Top 3 Klassen-Fit");
    expect(drawerText).toContain("PlayerCaPoStarStack");
    expect(drawerText).toContain("player-drawer-ca-po-stack");
    expect(drawerText).toContain("player-drawer-hero-axis-grid");
    expect(drawerText).toContain("player-drawer-stats-chart");
    expect(trainingControlsText).toContain("VeloIntensityRail");
    expect(chartText).toContain('data-testid="player-attribute-progress-chart"');
  });
});
