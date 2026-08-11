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

  it("builds training overlay stats with forecast only (CA/PO come from the shared ability-stars slot, not text)", () => {
    const stats = buildTrainingOverlayStats({
      netSetpoints: 1.2,
      regressionRisk: "high",
      trainingModeLabel: "Intensiv",
    });

    expect(stats.map((entry) => entry.label)).toEqual(["Forecast"]);
    expect(stats[0].value).toContain("+");
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
      // HomeV2Client.tsx is now a thin wrapper; the actual markup lives in HomeV2NewLook.tsx.
      fs.readFile(path.join(root, "app/foundation/home-v2/HomeV2NewLook.tsx"), "utf8"),
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
      // TransfermarktV2Client.tsx ist ein dünner Wrapper — das Markt-Markup liegt im NewLook.
      fs.readFile(path.join(root, "app/foundation/transfermarkt-v2/TransfermarktV2NewLook.tsx"), "utf8"),
    ]);

    expect(previewText).toContain('role="tooltip"');
    expect(previewText).toContain("createPortal");
    expect(previewText).toContain("aria-describedby");
    expect(previewText).toContain('event.key === "Escape"');
    expect(previewText).toContain('matchMedia("(hover: none)")');
    expect(foundationText).toContain("FoundationPlayerPortraitPreview");
    expect(teamsText).toContain("FoundationPlayerPortraitPreview");
    // Das Kader-Grid rendert seit dem "Neuen Look" die VOLLE Portraitkarte inline
    // (FoundationTeamsNewLook.tsx → FoundationPlayerPortraitCard mit OVR/PPs/MVS-
    // Rängen). Eine Hover-Preview derselben Karte über der Karte wäre Doppelung,
    // deshalb gibt es dort bewusst keinen `context="roster"`-Preview-Wrapper mehr.
    // Der Vertrag hält jetzt fest, was tatsächlich gerendert wird.
    expect(teamsText).toContain("FoundationPlayerPortraitCard");
    // Die Markt-Kandidatenliste rendert ihre Portraits jetzt wieder mit der
    // Hover-Vorschau samt Kernwerten — auf dem Transfermarkt entscheidet man
    // genau danach, und vorher standen die Werte nur in der Detailspalte.
    expect(marketText).toContain("FoundationPlayerPortraitPreview");
    expect(marketText).toContain('context="market"');
  });
});

describe("lineup v2 portrait hover preview ui contract", () => {
  it("wraps v2 roster portraits with portrait hover preview", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = process.cwd();

    // LegacyLineupFocusV2Board.tsx is no longer mounted anywhere (LegacyLineupLabClient.tsx
    // always renders LineupNewLook.tsx for the lineup board now); LineupNewLook.tsx is the
    // live successor and reuses the same wiring under renamed identifiers
    // (wrapLineupV2PortraitPreview -> wrapNlPortraitPreview, context "roster" -> "lineupCandidate",
    // see the "identische Props wie `wrapLineupV2PortraitPreview` im v2-Board" comment there).
    const boardText = await fs.readFile(
      path.join(root, "app/foundation/legacy-lineup-lab/LineupNewLook.tsx"),
      "utf8",
    );

    expect(boardText).toContain("FoundationPlayerPortraitPreview");
    expect(boardText).toContain("wrapNlPortraitPreview");
    expect(boardText).toContain('context="lineupCandidate"');
    expect(boardText).toContain("player.coreStats.pow");
  });
});

// Die frühere "lineup portrait hover preview ui contract"-Gruppe stand hier:
// Sie pinnte ausschließlich `wrapLineupPortraitHoverPreview` in
// LegacyLineupLabClient.tsx — eine Funktion, die seit
// SHOW_CLASSIC_LINEUP_WORKSPACE = false nie mehr aufgerufen wurde (der
// klassische Roster-Kartenbaum, der sie einband, ist tot). Mit dem
// Dead-Code-Cleanup ist die Funktion samt ihres einzigen Imports
// (FoundationPlayerPortraitPreview, createEmptyLeaguePlayerHeatPools) entfernt;
// der lebende Nachfolger ist bereits oben über "wrapNlPortraitPreview" in
// LineupNewLook.tsx abgedeckt. Die Gruppe testete also keine echte Funktion
// mehr, sondern nur die Existenz toten Codes — deshalb komplett gestrichen
// statt auf eine andere Datei umgebogen.
