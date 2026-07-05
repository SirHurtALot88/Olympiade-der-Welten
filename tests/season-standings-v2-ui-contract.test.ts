import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("season standings v2 ui contract", () => {
  it("opens in data table view with gm board and no cards tab", async () => {
    const [seasonText, shellRouterBodyText, shellRouterBodyScopeText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/season-v2/SeasonStandingsV2Client.tsx",
        "utf8",
      ),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationShellRouterBody.tsx", "utf8"),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx",
        "utf8",
      ),
    ]);
    const foundationText = `${shellRouterBodyText}\n${shellRouterBodyScopeText}`;

    expect(seasonText).toContain('const SEASON_V2_DEFAULT_MODE: SeasonV2ViewMode = "table"');
    expect(seasonText).toContain('seasonV2Mode === "table"');
    expect(seasonText).toContain('seasonV2Mode === "gms"');
    expect(seasonText).not.toContain('"cards"');
    expect(seasonText).toContain("Datenansicht");
    expect(seasonText).toContain("Vergangene Saisons");
    expect(seasonText).toContain("season-v2-history-strip");
    expect(seasonText).toContain("season-v2-table-skeleton-row");
    expect(seasonText).toContain("isLoading = false");
    expect(foundationText).toContain("FoundationSeasonV2Panel");
    expect(foundationText).toContain('shouldLoadSeasonOverviewFeed');
    expect(foundationText).toContain('homeV2Tab === "office"');
    expect(foundationText).toContain('{ id: "gms", label: "Manager" }');
    expect(foundationText).not.toContain('{ id: "cards", label: "Karten" }');
  });
});
