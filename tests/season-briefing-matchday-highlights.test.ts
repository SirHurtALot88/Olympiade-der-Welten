import { describe, expect, it } from "vitest";

import { resolveSeasonBriefingMatchdayHighlights } from "@/lib/foundation/tabs/use-foundation-cross-tab-season-briefing";

describe("resolveSeasonBriefingMatchdayHighlights", () => {
  it("marks 11 and 12 slot matchdays as heavy roster", () => {
    expect(
      resolveSeasonBriefingMatchdayHighlights({
        discipline1PlayerCount: 5,
        discipline2PlayerCount: 6,
        sameCategory: false,
      }),
    ).toEqual({
      totalSlots: 11,
      isHeavyRoster: true,
      isHeavySameColor: false,
    });

    expect(
      resolveSeasonBriefingMatchdayHighlights({
        discipline1PlayerCount: 6,
        discipline2PlayerCount: 6,
        sameCategory: false,
      }),
    ).toEqual({
      totalSlots: 12,
      isHeavyRoster: true,
      isHeavySameColor: false,
    });
  });

  it("uses multicolor only when heavy roster and same category", () => {
    expect(
      resolveSeasonBriefingMatchdayHighlights({
        discipline1PlayerCount: 6,
        discipline2PlayerCount: 6,
        sameCategory: true,
      }),
    ).toEqual({
      totalSlots: 12,
      isHeavyRoster: true,
      isHeavySameColor: true,
    });
  });

  it("ignores incomplete slot counts", () => {
    expect(
      resolveSeasonBriefingMatchdayHighlights({
        discipline1PlayerCount: 6,
        discipline2PlayerCount: null,
        sameCategory: false,
      }),
    ).toEqual({
      totalSlots: null,
      isHeavyRoster: false,
      isHeavySameColor: false,
    });
  });
});
