import { describe, expect, it } from "vitest";

import {
  shouldBuildPrizeV2Ui,
  shouldLoadPrizePreviewFeed,
} from "@/lib/foundation/tabs/prize-v2-derivations";
import {
  getPrizePreviewGlobalWarnings,
  getPrizePreviewHardBlocked,
  getPrizePreviewRows,
  getSelectedPrizePreviewRow,
} from "@/lib/foundation/tabs/use-prize-panel-derivations";

describe("prize-v2-derivations", () => {
  it("builds prize v2 ui only on prize sub-tab", () => {
    expect(shouldBuildPrizeV2Ui("prize", "sponsors")).toBe(false);
    expect(shouldBuildPrizeV2Ui("prize", "prize")).toBe(true);
    expect(shouldBuildPrizeV2Ui("teams", "prize")).toBe(false);
  });

  it("loads prize preview feed for cockpit and prize tab", () => {
    expect(shouldLoadPrizePreviewFeed("cockpit", "sponsors")).toBe(true);
    expect(shouldLoadPrizePreviewFeed("prize", "sponsors")).toBe(false);
    expect(shouldLoadPrizePreviewFeed("prize", "prize")).toBe(true);
    expect(shouldLoadPrizePreviewFeed("teams", "prize")).toBe(false);
  });

  it("derives prize preview rows and warnings from feed", () => {
    const feed = {
      items: [{ teamId: "t1", teamName: "Team 1" }],
      globalWarnings: ["warn-a"],
      blockedRules: ["prize_money_table_missing", "other_rule"],
    } as never;

    expect(getPrizePreviewRows(feed)).toEqual([{ teamId: "t1", teamName: "Team 1" }]);
    expect(getPrizePreviewRows(null)).toEqual([]);
    expect(getPrizePreviewGlobalWarnings(feed)).toEqual(["warn-a"]);
    expect(getPrizePreviewHardBlocked(feed)).toEqual(["prize_money_table_missing"]);
    expect(getSelectedPrizePreviewRow(feed.items, "t1")).toEqual(feed.items[0]);
    expect(getSelectedPrizePreviewRow(feed.items, "missing")).toBeNull();
  });
});
