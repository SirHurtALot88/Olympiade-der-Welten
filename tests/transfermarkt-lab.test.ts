import { describe, expect, it } from "vitest";

import { getTransfermarktLabMode, getTransfermarktPortraitModel, isBrowserSafePortrait } from "@/lib/market/transfermarkt-lab";

describe("transfermarkt lab helpers", () => {
  it("treats filesystem portrait paths as unresolved", () => {
    expect(isBrowserSafePortrait("/Users/example/test.jpg")).toBe(false);
    expect(isBrowserSafePortrait("https://example.com/test.jpg")).toBe(true);
    expect(isBrowserSafePortrait("/images/test.jpg")).toBe(true);
  });

  it("uses placeholder data when portrait is not browser-safe", () => {
    const portrait = getTransfermarktPortraitModel({
      playerId: "p1",
      name: "Citrine Miri",
      className: "Warlord",
      race: "Demon",
      marketValue: 1,
      salary: 1,
      salaryStatus: "known",
      pow: 1,
      spe: 1,
      men: 1,
      soc: 1,
      powTier: "F",
      speTier: "F",
      menTier: "F",
      socTier: "F",
      topDisciplineScores: [],
      portraitPath: "/Users/example/test.jpg",
      portraitUrl: null,
      imageUrl: null,
      availabilityReason: "free_agent",
    });

    expect(portrait.src).toBeNull();
    expect(portrait.initials).toBe("CM");
    expect(portrait.warning).toBe("missing_or_unresolved_portrait");
  });

  it("uses table mode when items are present", () => {
    expect(
      getTransfermarktLabMode({
        busy: false,
        data: {
          items: [{}],
          total: 10,
        } as never,
        errors: [],
        hasActiveFilters: false,
      }),
    ).toBe("table");
  });

  it("uses error mode when api errors are present", () => {
    expect(
      getTransfermarktLabMode({
        busy: false,
        data: null,
        errors: ["boom"],
        hasActiveFilters: false,
      }),
    ).toBe("error");
  });

  it("uses empty state only when total is 0 without filters", () => {
    expect(
      getTransfermarktLabMode({
        busy: false,
        data: {
          items: [],
          total: 0,
        } as never,
        errors: [],
        hasActiveFilters: false,
      }),
    ).toBe("empty");
  });

  it("uses filtered empty state when filters are active", () => {
    expect(
      getTransfermarktLabMode({
        busy: false,
        data: {
          items: [],
          total: 0,
        } as never,
        errors: [],
        hasActiveFilters: true,
      }),
    ).toBe("filtered_empty");
  });
});
