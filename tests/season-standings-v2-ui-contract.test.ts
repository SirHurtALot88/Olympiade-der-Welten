import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("season standings v2 ui contract", () => {
  it("opens in data table view with virtualized board and cards fallback", async () => {
    const [seasonText, cssText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/season-v2/SeasonStandingsV2Client.tsx",
        "utf8",
      ),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css", "utf8"),
    ]);

    expect(seasonText).toContain('const SEASON_V2_DEFAULT_MODE: SeasonV2ViewMode = "table"');
    expect(seasonText).toContain('seasonV2Mode === "table"');
    expect(seasonText).toContain('seasonV2Mode === "cards"');
    expect(seasonText).toContain("Datenansicht");
    expect(seasonText).toContain("SeasonTeamCard");
    expect(seasonText).toContain('data-virtualized="true"');
    expect(seasonText).toContain("season-v2-player-rail");
    expect(seasonText).toContain("season-v2-player-mini-card");
    expect(cssText).toContain(".season-v2-cards-scroll");
    expect(cssText).toContain(".season-v2-trend-pill");
  });
});
