import { describe, expect, it } from "vitest";

import { DEFAULT_ROSTER_MAX, deriveRosterTargets, getTeamPlayerMax } from "@/lib/foundation/roster-limits";

describe("roster limits", () => {
  it("uses 14 as central hard max while keeping playerOpt independent", () => {
    const team = { rosterLimit: 12 };
    const identity = { playerMin: 8, playerOpt: 11 };

    expect(DEFAULT_ROSTER_MAX).toBe(14);
    expect(getTeamPlayerMax(team, identity)).toBe(14);
    expect(deriveRosterTargets(team, identity)).toEqual({
      playerMin: 8,
      playerOpt: 11,
      playerMax: 14,
    });
  });

  it("allows team-specific max 14 without forcing playerOpt to 14", () => {
    const team = { rosterLimit: 14 };
    const identity = { playerMin: 8, playerOpt: 11 };

    expect(getTeamPlayerMax(team, identity)).toBe(14);
    expect(deriveRosterTargets(team, identity)).toEqual({
      playerMin: 8,
      playerOpt: 11,
      playerMax: 14,
    });
  });

  it("forces a fixed minimum of 8 even when identity playerMin is lower", () => {
    const team = { rosterLimit: 14 };
    const identity = { playerMin: 7, playerOpt: 9 };

    expect(deriveRosterTargets(team, identity)).toEqual({
      playerMin: 8,
      playerOpt: 9,
      playerMax: 14,
    });
  });

  it("caps legacy oversized roster limits at 14", () => {
    const team = { rosterLimit: 18 };
    const identity = { playerMin: 8, playerOpt: 15 };

    expect(getTeamPlayerMax(team, identity)).toBe(14);
    expect(deriveRosterTargets(team, identity)).toEqual({
      playerMin: 8,
      playerOpt: 14,
      playerMax: 14,
    });
  });
});
