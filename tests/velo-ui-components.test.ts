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

  it("wires classic teams v1 economy tiles into foundation", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");
    expect(fileText).toContain("teamEconomyTiles");
    expect(fileText).toContain("teams-v2-focus-card");
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

  it("uses impact strip for draft lineup intensity preview", async () => {
    const lineupText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx",
      "utf8",
    );
    expect(lineupText).toContain("draftIntensityPreview");
    expect(lineupText).toContain("legacy-lineup-draft-intensity-preview");
    expect(lineupText).toContain('label: "Taktik"');
    expect(lineupText).toContain('label: "Final"');
  });
});
