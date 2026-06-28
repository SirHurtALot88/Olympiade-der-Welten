import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const scoutingPath = path.join(root, "app/foundation/scouting-center-v2/ScoutingCenterV2Client.tsx");
const legacyLineupPath = path.join(root, "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx");
const arenaCardPath = path.join(root, "components/matchday-arena/MatchdayArenaPlayerCard.tsx");
const globalsPath = path.join(root, "app/globals.css");

describe("foundation scouting and workflow portrait ui contract", () => {
  it("renders scouting target cards as full-art portraits with scouting context stats", async () => {
    const [scoutingText, cssText] = await Promise.all([
      fs.readFile(scoutingPath, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(scoutingText).toContain("FoundationPlayerPortraitCard");
    expect(scoutingText).toContain('context="scouting"');
    expect(scoutingText).toContain('density="full"');
    expect(scoutingText).toContain("getPlayerPortraitBrowserUrl");
    expect(scoutingText).toContain("scoutStatusLabel");
    expect(scoutingText).toContain("potentialBandLabel");
    expect(scoutingText).toContain("scouting-hub-v2-target-card");
    expect(cssText).toContain(".foundation-player-portrait-card");
  });

  it("uses compact lineup portrait cards in the legacy matchday pool", async () => {
    const lineupText = await fs.readFile(legacyLineupPath, "utf8");

    expect(lineupText).toContain("FoundationPlayerPortraitCard");
    expect(lineupText).toContain('context="lineup"');
    expect(lineupText).toContain('density="compact"');
    expect(lineupText).toContain("legacy-matchday-player-card");
    expect(lineupText).toContain("slotProjection");
    expect(lineupText).toContain("interactive={false}");
  });

  it("wraps matchday arena player cards around the arena portrait preset", async () => {
    const arenaText = await fs.readFile(arenaCardPath, "utf8");

    expect(arenaText).toContain("FoundationPlayerPortraitCard");
    expect(arenaText).toContain('context="arena"');
    expect(arenaText).toContain("is-portrait-card");
    expect(arenaText).toContain("scoreLabel");
    expect(arenaText).toContain("contributionLabel");
  });
});
