import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("season standings v2 ui contract", () => {
  it("opens in data table view with gm board and no cards tab", async () => {
    const [seasonText, shellRouterBodyText, shellRouterBodyScopeText] = await Promise.all([
      fs.readFile(
        path.join(process.cwd(), "app/foundation/season-v2/SeasonStandingsV2Client.tsx"),
        "utf8",
      ),
      fs.readFile(path.join(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx"), "utf8"),
      fs.readFile(
        path.join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
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

  it("exposes sprint M form curve, mobile cards, prize preview, and pinned sticky team", async () => {
    const [seasonText, cssText] = await Promise.all([
      fs.readFile(
        path.join(process.cwd(), "app/foundation/season-v2/SeasonStandingsV2Client.tsx"),
        "utf8",
      ),
      fs.readFile(path.join(process.cwd(), "app/globals.css"), "utf8"),
    ]);

    expect(seasonText).toContain("season-v2-form-curve");
    expect(seasonText).toContain("season-v2-trend-arrow");
    expect(seasonText).toContain('data-testid="season-v2-mobile-cards-toggle"');
    expect(seasonText).toContain("season-v2-mobile-card-grid");
    expect(seasonText).toContain("season-v2-prize-preview");
    expect(seasonText).toContain("season-v2-pinned-team");

    expect(cssText).toContain(".season-v2-form-curve");
    expect(cssText).toContain(".season-v2-mobile-card-grid");
    expect(cssText).toContain(".season-v2-prize-preview");
  });

  it("exposes transfer history timeline layout toggle", async () => {
    const [historyText, cssText] = await Promise.all([
      fs.readFile(
        path.join(process.cwd(), "app/foundation/transfer-history-v2/TransferHistoryV2Client.tsx"),
        "utf8",
      ),
      fs.readFile(path.join(process.cwd(), "app/globals.css"), "utf8"),
    ]);

    expect(historyText).toContain('data-testid="transfer-history-layout-toggle"');
    expect(historyText).toContain("historyLayout");
    expect(cssText).toContain(".transfer-history-v2-layout-toggle");
  });
});
