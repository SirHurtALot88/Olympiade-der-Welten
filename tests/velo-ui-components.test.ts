import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const veloUiPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/components/foundation/velo-ui";
const globalsPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css";
const foundationClientPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx";

describe("velo ui rollout contract", () => {
  it("exports shared velo components", async () => {
    const indexText = await fs.readFile(`${veloUiPath}/index.ts`, "utf8");
    expect(indexText).toContain("VeloStatOrbitChip");
    expect(indexText).toContain("VeloIntensityRail");
    expect(indexText).toContain("VeloImpactStrip");
    expect(indexText).toContain("VeloAttributeFocusTags");
  });

  it("wires css namespaces for velo rollout", async () => {
    const cssText = await fs.readFile(globalsPath, "utf8");
    expect(cssText).toContain(".velo-intensity-rail");
    expect(cssText).toContain(".velo-impact-strip");
    expect(cssText).toContain(".velo-scouting-disclosure");
    expect(cssText).toContain(".season-v2-team-card-grid");
  });

  it("wires teams v2 into foundation navigation", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");
    expect(fileText).toContain("TeamsV2Client");
    expect(fileText).toContain("teamsV2FocusCards");
  });

  it("wires velo rollout across lineup, arena, drawer and facilities", async () => {
    const [lineupText, arenaText, drawerText, facilitiesText, cssText] = await Promise.all([
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/matchday-arena-v2/MatchdayArenaV2Client.tsx", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/PlayerDetailDrawer.tsx", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/training-facilities-v2/TrainingFacilitiesV2Client.tsx", "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(lineupText).toContain("VeloStatOrbitRow");
    expect(lineupText).toContain("VeloImpactStrip");
    expect(lineupText).toContain("legacy-lineup-fit-strip");
    expect(arenaText).toContain("VeloImpactStrip");
    expect(arenaText).toContain("arena-v2-slot-impact-strip");
    expect(arenaText).toContain("mutatorBonus");
    expect(drawerText).toContain("VeloStatOrbitRow");
    expect(drawerText).toContain("player-drawer-scouting-disclosure");
    expect(facilitiesText).toContain("training-v2-facility-impact-strip");
    expect(facilitiesText).toContain("training-v2-facility-upgrade-strip");
    expect(cssText).toContain(".player-drawer-axis-orbit");
    expect(cssText).toContain(".arena-v2-slot-impact-strip");
  });
});
