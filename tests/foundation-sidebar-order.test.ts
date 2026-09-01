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

    // Die gespeicherte Reihenfolge steht bewusst NICHT als feste Liste da. Sie wird aus der
    // Konfiguration gezogen und einmal umgedreht — sonst pruefte der Test die Konfiguration
    // statt die Funktion, und jeder neue Reiter liesse ihn scheitern, obwohl genau dessen
    // Verhalten ("neue Eintraege hinten anhaengen") hier die Zusage ist.
    const alle = matchdayGroup!.items.map((item) => item.id);
    const gespeichert = [...alle].reverse().slice(1);
    const neuling = alle.find((id) => !gespeichert.includes(id));
    expect(neuling).toBeDefined();

    const ordered = applyFoundationSidebarOrder(FOUNDATION_NAV_GROUPS, {
      matchday: gespeichert,
    });

    const nextMatchday = ordered.find((group) => group.id === "matchday");
    expect(nextMatchday?.items.map((item) => item.id)).toEqual([...gespeichert, neuling]);
  });
});
