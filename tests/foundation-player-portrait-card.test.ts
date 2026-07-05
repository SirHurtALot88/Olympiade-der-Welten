import { describe, expect, it } from "vitest";

import { getPoolHeatClass } from "@/lib/foundation/player-league-heat";
import {
  buildArenaOverlayStats,
  buildContextOverlayStats,
  buildLineupOverlayStats,
  buildMarketOverlayStats,
  buildScoutingOverlayStats,
  buildTrainingOverlayStats,
  shouldShowPortraitOrbit,
} from "@/lib/foundation/player-portrait-stat-presets";
import { createEmptyLeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";

describe("player league heat", () => {
  it("maps low values to heat-band-1 and high values to heat-band-8", () => {
    const pool = [10, 20, 30, 40, 50, 60, 70, 80];

    expect(getPoolHeatClass(10, pool)).toBe("heat-band-1");
    expect(getPoolHeatClass(80, pool)).toBe("heat-band-8");
  });

  it("returns empty class for missing values or tiny pools", () => {
    expect(getPoolHeatClass(null, [1, 2, 3])).toBe("");
    expect(getPoolHeatClass(50, [50])).toBe("");
  });
});

describe("player portrait stat presets", () => {
  const heatPools = createEmptyLeaguePlayerHeatPools();

  it("builds training overlay stats with forecast", () => {
    const stats = buildTrainingOverlayStats({
      caRating: 72,
      poDisplay: "4.5",
      netSetpoints: 1.2,
      regressionRisk: "high",
      trainingModeLabel: "Intensiv",
    });

    expect(stats.map((entry) => entry.label)).toEqual(["CA", "PO", "Forecast"]);
    expect(stats[2].value).toContain("+");
  });

  it("builds market overlay stats with fit and economy", () => {
    const stats = buildMarketOverlayStats({
      fitDisplay: "Gut",
      marketValue: "12 Mio",
      salary: "800k",
      ratio: "6%",
      needScore: "82",
      ovr: 74,
    });

    expect(stats[0].label).toBe("Fit");
    expect(stats.some((entry) => entry.label === "MW")).toBe(true);
    expect(stats.some((entry) => entry.label === "OVR")).toBe(true);
  });

  it("builds scouting overlay stats with status and potential band", () => {
    const stats = buildScoutingOverlayStats({
      scoutStatusLabel: "Aktiv 60%",
      caOverall: 68,
      poDisplay: "3–4",
      potentialBandLabel: "Solide",
      scoutMilestone: "Achsen offen",
    });

    expect(stats[0].value).toBe("Aktiv 60%");
    expect(stats.some((entry) => entry.label === "PO")).toBe(true);
  });

  it("builds lineup overlay stats with discipline fits and slot projection", () => {
    const stats = buildLineupOverlayStats({
      d1Score: "Power: 82",
      d2Score: "Speed: 71",
      slotProjection: "78 +2.1",
      qualityGroup: "Top-Fit",
      fatigueLabel: "Frisch",
    });

    expect(stats.map((entry) => entry.label)).toContain("D1");
    expect(stats.map((entry) => entry.label)).toContain("Slot");
    expect(stats.map((entry) => entry.label)).toContain("Fatigue");
  });

  it("builds arena overlay stats with rank and contribution", () => {
    const stats = buildArenaOverlayStats({
      rank: 2,
      scoreLabel: "84.2",
      pointsLabel: "12.4",
      contributionLabel: "+3.1",
    });

    expect(stats[0].label).toBe("Rang");
    expect(stats.some((entry) => entry.label === "Beitrag")).toBe(true);
  });

  it("limits overlay stats by context and density", () => {
    const compactTraining = buildContextOverlayStats({
      context: "training",
      density: "compact",
      contextData: {
        training: {
          caRating: 70,
          poDisplay: "4",
          netSetpoints: 0.5,
          regressionRisk: "low",
          trainingModeLabel: "Mittel",
        },
      },
      playerOvr: null,
      playerMvs: null,
      leagueHeatPools: heatPools,
    });

    expect(compactTraining.length).toBeLessThanOrEqual(4);

    const miniRoster = buildContextOverlayStats({
      context: "roster",
      density: "mini",
      playerOvr: 80,
      playerMvs: 30,
      leagueHeatPools: heatPools,
    });

    expect(miniRoster).toHaveLength(1);
  });

  it("hides orbit for mini density and non-roster compact contexts", () => {
    expect(shouldShowPortraitOrbit("training", "full")).toBe(false);
    expect(shouldShowPortraitOrbit("training", "compact")).toBe(false);
    expect(shouldShowPortraitOrbit("market", "compact")).toBe(false);
    expect(shouldShowPortraitOrbit("roster", "compact")).toBe(true);
    expect(shouldShowPortraitOrbit("roster", "mini")).toBe(false);
  });
});

describe("foundation player portrait card ui contract", () => {
  it("colors OVR/MVS with league heat and keeps axis orbit chips", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = process.cwd();

    const [cardText, homeText, cssText, presetsPath] = await Promise.all([
      fs.readFile(path.join(root, "components/foundation/player-portrait-card/FoundationPlayerPortraitCard.tsx"), "utf8"),
      fs.readFile(path.join(root, "app/foundation/home-v2/HomeV2Client.tsx"), "utf8"),
      fs.readFile(path.join(root, "app/globals.css"), "utf8"),
      fs.readFile(path.join(root, "lib/foundation/player-portrait-stat-presets.ts"), "utf8"),
    ]);

    expect(cardText).toContain("buildContextOverlayStats");
    expect(cardText).toContain("shouldShowPortraitOrbit");
    expect(cardText).toContain("foundation-player-portrait-stat");
    expect(cardText).toContain("VeloStatOrbitRow");
    expect(cardText).toContain("home-v2-player-orbit is-overlay");
    expect(cardText).toContain("is-team-layout");
    expect(cardText).toContain("is-full-art");
    expect(cardText).toContain("foundation-player-portrait-overlay");
    expect(cardText).toContain("buildContextOverlayStats");
    expect(cardText).toContain('density = "full"');
    expect(cardText).toContain("is-density-${density}");
    expect(cardText).toContain("interactive = true");
    expect(homeText).toContain("FoundationPlayerPortraitCard");
    expect(homeText).toContain("leagueHeatPools");
    expect(presetsPath).toContain("getPoolHeatClass");
    expect(presetsPath).toContain('"training"');
    expect(presetsPath).toContain('"market"');
    expect(presetsPath).toContain('"scouting"');
    expect(presetsPath).toContain('"lineup"');
    expect(presetsPath).toContain('"arena"');
    expect(cssText).toContain(".foundation-player-portrait-stat.heat-band-8");
    expect(cssText).toContain(".home-v2-player-orbit.is-overlay .velo-stat-orbit-chip.is-pow");
    expect(cssText).toContain(".foundation-player-portrait-card.is-density-compact");
    expect(cssText).toContain(".foundation-player-portrait-preview-panel");
  });
});

describe("foundation player portrait preview ui contract", () => {
  it("renders hover preview via portal with tooltip semantics", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = process.cwd();

    const [previewText, foundationText, teamsText, marketText] = await Promise.all([
      fs.readFile(path.join(root, "components/foundation/player-portrait-card/FoundationPlayerPortraitPreview.tsx"), "utf8"),
      fs.readFile(path.join(root, "app/foundation/FoundationShellRouterBody.tsx"), "utf8"),
      fs.readFile(path.join(root, "app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx"), "utf8"),
      fs.readFile(path.join(root, "app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx"), "utf8"),
    ]);

    expect(previewText).toContain('role="tooltip"');
    expect(previewText).toContain("createPortal");
    expect(previewText).toContain("aria-describedby");
    expect(previewText).toContain('event.key === "Escape"');
    expect(previewText).toContain('matchMedia("(hover: none)")');
    expect(foundationText).toContain("FoundationPlayerPortraitPreview");
    expect(teamsText).toContain("FoundationPlayerPortraitPreview");
    expect(teamsText).toContain('context="roster"');
    expect(marketText).toContain("FoundationPlayerPortraitPreview");
    expect(marketText).toContain('context="market"');
  });
});

describe("teams portraits tab contract", () => {
  it("adds a portraits subnav tab and grid in the teams detail panel", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = process.cwd();

    const [shellText, panelText, portraitsTabText] = await Promise.all([
      fs.readFile(path.join(root, "app/foundation/FoundationShellRouterBody.tsx"), "utf8"),
      fs.readFile(path.join(root, "app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx"), "utf8"),
      fs.readFile(path.join(root, "app/foundation/teams-v2/FoundationTeamsPortraitsTab.tsx"), "utf8"),
    ]);

    expect(shellText).toContain('{ id: "portraits", label: "Portraits" }');
    expect(shellText).toContain('"roster" | "contracts" | "portraits"');
    expect(panelText).toContain('selectedTeamDetailTab === "portraits"');
    expect(panelText).toContain("FoundationTeamsPortraitsTab");
    expect(portraitsTabText).toContain('data-testid="team-portraits-grid"');
    expect(panelText).toContain("team-contracts-table");
    expect(portraitsTabText).toContain("FoundationPlayerPortraitCard");
    expect(portraitsTabText).toContain("roleTag={entry.roleTag}");
    expect(portraitsTabText).toContain("playerClassName={player.className}");
    expect(panelText).toContain("FoundationPlayerPortraitPreview");
  });
});
