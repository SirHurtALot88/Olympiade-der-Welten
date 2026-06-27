import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("season standings v2 ui contract", () => {
  it("opens in data table view with gm board and no cards tab", async () => {
    const [seasonText, foundationText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/season-v2/SeasonStandingsV2Client.tsx",
        "utf8",
      ),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx", "utf8"),
    ]);

    expect(seasonText).toContain('const SEASON_V2_DEFAULT_MODE: SeasonV2ViewMode = "table"');
    expect(seasonText).toContain('seasonV2Mode === "table"');
    expect(seasonText).toContain('seasonV2Mode === "gms"');
    expect(seasonText).not.toContain('"cards"');
    expect(seasonText).toContain("Datenansicht");
    expect(seasonText).toContain("Vergangene Saisons");
    expect(seasonText).toContain("season-v2-history-strip");
    expect(seasonText).toContain("Saison wählen");
    expect(foundationText).toContain('{ id: "table", label: "Datenansicht" }');
    expect(foundationText).toContain('{ id: "gms", label: "Manager" }');
    expect(foundationText).not.toContain('{ id: "cards", label: "Karten" }');
  });
});
