import { describe, expect, it } from "vitest";

import { FOUNDATION_NAV_GROUPS } from "@/lib/foundation/foundation-nav-config";
import {
  applyFoundationSidebarOrder,
  reorderFoundationSidebarItems,
} from "@/lib/foundation/foundation-sidebar-order";

describe("foundation sidebar order", () => {
  it("reorders items within a group", () => {
    expect(
      reorderFoundationSidebarItems(
        ["homeV2", "inboxV2", "lineup", "matchdayArena", "seasonV2"],
        "seasonV2",
        "homeV2",
      ),
    ).toEqual(["seasonV2", "homeV2", "inboxV2", "lineup", "matchdayArena"]);
  });

  it("applies saved order while keeping new items at the end", () => {
    const matchdayGroup = FOUNDATION_NAV_GROUPS.find((group) => group.id === "matchday");
    expect(matchdayGroup).toBeDefined();

    const ordered = applyFoundationSidebarOrder(FOUNDATION_NAV_GROUPS, {
      matchday: ["seasonV2", "homeV2", "inboxV2", "lineup", "matchdayArena"],
    });

    const nextMatchday = ordered.find((group) => group.id === "matchday");
    expect(nextMatchday?.items.map((item) => item.id)).toEqual([
      "seasonV2",
      "homeV2",
      "inboxV2",
      "lineup",
      "matchdayArena",
    ]);
  });
});
