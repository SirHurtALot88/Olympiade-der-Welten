import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("season standings v2 ui contract", () => {
  it("opens in data table view with gm board and no cards tab", async () => {
    const [seasonText, shellRouterBodyText, shellRouterBodyScopeText] = await Promise.all([
      // SeasonStandingsV2Client.tsx is now a thin wrapper; markup lives in SeasonStandingsNewLook.tsx.
      fs.readFile(
        path.join(process.cwd(), "app/foundation/season-v2/SeasonStandingsNewLook.tsx"),
        "utf8",
      ),
      fs.readFile(path.join(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx"), "utf8"),
      fs.readFile(
        path.join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
        "utf8",
      ),
    ]);
    const foundationText = `${shellRouterBodyText}\n${shellRouterBodyScopeText}`;

    // NOTE: the mode system was reworked — `SeasonV2ViewMode`/"table"/"gms"/
    // "cards" became `NlStandingsMode` = "board" | "daten" | "vereine", and
    // the New Look now defaults to "board" (not the "daten"/table view). The
    // "cards" concept is indeed gone (confirmed: `.not.toContain('"cards"')`
    // below still holds), matching this test's own expectation there — but
    // the default view changing from table to "board" is a real behavior
    // change, and "Datenansicht"/"Vergangene Saisons"/history-strip/
    // table-skeleton-row have no matching string in SeasonStandingsNewLook.tsx
    // at all. Looks like a real feature-loss/behavior-change (see final
    // report), left red intentionally rather than guessed at.
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
      // SeasonStandingsV2Client.tsx is now a thin wrapper; markup lives in SeasonStandingsNewLook.tsx.
      fs.readFile(
        path.join(process.cwd(), "app/foundation/season-v2/SeasonStandingsNewLook.tsx"),
        "utf8",
      ),
      fs.readFile(path.join(process.cwd(), "app/globals.css"), "utf8"),
    ]);

    // NOTE: none of these six markers (form curve chart, trend arrows, mobile
    // cards toggle/grid, prize preview strip, pinned/sticky team row) appear
    // anywhere in SeasonStandingsNewLook.tsx under these or any related name
    // (checked for "trend", "mobile-card", "prize-preview"/"Preisgeld",
    // "pinned"/"sticky" — all empty). The matching CSS classes below are still
    // present in globals.css as dead rules. This looks like a real feature
    // loss (see final report), left red intentionally.
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
      // TransferHistoryV2Client.tsx is now a thin wrapper; markup lives in TransferHistoryV2NewLook.tsx.
      fs.readFile(
        path.join(process.cwd(), "app/foundation/transfer-history-v2/TransferHistoryV2NewLook.tsx"),
        "utf8",
      ),
      fs.readFile(path.join(process.cwd(), "app/globals.css"), "utf8"),
    ]);

    // NOTE: the timeline/table layout toggle itself is intact (`historyLayout`
    // state, "timeline"/"table" switch), but it's now rendered via the shared
    // NlSubTabs component (components/foundation/new-look/NlSubTabs.tsx),
    // which doesn't accept/render a data-testid prop at all — so the specific
    // "transfer-history-layout-toggle" testid is gone (same pattern as the
    // shared subtab components elsewhere in this redesign). Left red
    // intentionally (see final report) rather than silently dropped.
    expect(historyText).toContain('data-testid="transfer-history-layout-toggle"');
    expect(historyText).toContain("historyLayout");
    expect(cssText).toContain(".transfer-history-v2-layout-toggle");
  });
});
