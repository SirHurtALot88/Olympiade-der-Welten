import { describe, expect, it } from "vitest";

import {
  DEFAULT_ROSTER_MAX,
  deriveRosterTargets,
  deriveSeason1TargetRosterSize,
  getTeamPlayerMax,
  resolveSeason1FatigueInjuryRosterBuffer,
} from "@/lib/foundation/roster-limits";

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

  it("scales the Season-1 fatigue/injury buffer with playerOpt and clamps it to 1-3", () => {
    expect(resolveSeason1FatigueInjuryRosterBuffer(7)).toBe(1);
    expect(resolveSeason1FatigueInjuryRosterBuffer(9)).toBe(2);
    expect(resolveSeason1FatigueInjuryRosterBuffer(11)).toBe(2);
    expect(resolveSeason1FatigueInjuryRosterBuffer(13)).toBe(2);
    expect(resolveSeason1FatigueInjuryRosterBuffer(14)).toBe(3);
  });

  it("adds the Season-1 buffer to playerOpt but never exceeds playerMax", () => {
    expect(deriveSeason1TargetRosterSize(9, 14)).toBe(11);
    expect(deriveSeason1TargetRosterSize(13, 14)).toBe(14);
    expect(deriveSeason1TargetRosterSize(14, 14)).toBe(14);
  });
});
