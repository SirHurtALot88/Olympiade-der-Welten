import { describe, expect, it } from "vitest";

import {
  buildFoundationHref,
  buildFoundationSearchParams,
  type FoundationUrlState,
} from "@/lib/foundation/foundation-navigation-history";

describe("foundation navigation history", () => {
  it("builds drilldown urls with panel and player context", () => {
    const state: FoundationUrlState = {
      view: "marketV2",
      team: "H-R",
      playerId: "player-1",
      panel: "offer",
      tab: null,
      facilityId: null,
      facilityAction: null,
    };

    expect(buildFoundationHref(state)).toBe("/foundation?view=marketV2&playerId=player-1&team=H-R&panel=offer");
    expect(buildFoundationSearchParams(state).get("panel")).toBe("offer");
    expect(buildFoundationSearchParams(state).get("facilityId")).toBeNull();
  });

  it("serializes facility drilldown params", () => {
    const state: FoundationUrlState = {
      view: "trainingV2",
      team: "H-R",
      panel: "facility",
      facilityId: "gym",
      facilityAction: "upgrade",
      tab: null,
      playerId: null,
    };

    expect(buildFoundationHref(state)).toContain("panel=facility");
    expect(buildFoundationHref(state)).toContain("facilityId=gym");
    expect(buildFoundationHref(state)).toContain("facilityAction=upgrade");
  });
});
