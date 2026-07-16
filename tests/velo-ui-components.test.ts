import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const veloUiPath = path.join(process.cwd(), "components/foundation/velo-ui");
const globalsPath = path.join(process.cwd(), "app/globals.css");
const foundationClientPath = path.join(process.cwd(), "app/foundation/FoundationPageClient.tsx");
const teamsDetailPanelPath =
  path.join(process.cwd(), "app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx");

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
    const fileText = await fs.readFile(teamsDetailPanelPath, "utf8");
    expect(fileText).toContain("teamEconomyTiles");
    expect(fileText).toContain("teams-v2-focus-card");
  });

  it("wires velo rollout across lineup, arena, drawer and facilities", async () => {
    const [lineupText, arenaText, drawerText, cssText] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/matchday-arena-v2/MatchdayArenaV2Client.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/foundation/PlayerDetailDrawer.tsx"), "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(lineupText).toContain("FoundationPlayerPortraitCard");
    expect(lineupText).toContain("VeloImpactStrip");
    expect(lineupText).toContain("legacy-lineup-scoreboard-impact-strip");
    expect(arenaText).toContain("VeloImpactStrip");
    expect(arenaText).toContain("arena-v2-slot-impact-strip");
    expect(arenaText).toContain("mutatorBonus");
    expect(drawerText).toContain("player-drawer-axis-chip");
    expect(drawerText).toContain("player-drawer-scouting-disclosure");
    expect(cssText).toContain(".player-drawer-axis-orbit");
    expect(cssText).toContain(".arena-v2-slot-impact-strip");
  });

  it("keeps draft intensity preview data for form board while removing duplicate header strip", async () => {
    const lineupText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
      "utf8",
    );
    expect(lineupText).toContain("draftIntensityPreview");
    expect(lineupText).not.toContain("legacy-lineup-draft-intensity-preview");
    expect(lineupText).not.toMatch(/label: "Base"[\s\S]*legacy-lineup-draft-controls/);
  });
});
