import { describe, expect, it } from "vitest";

import {
  compareTeamRosterPlayersByOvrOrMarketValue,
  getTeamRosterPlayerOvrSortKey,
} from "@/lib/foundation/team-roster-player-sort";

describe("team-roster-player-sort", () => {
  it("prefers OVR over market value for the primary sort key", () => {
    expect(getTeamRosterPlayerOvrSortKey(82, 40)).toBe(82);
    expect(getTeamRosterPlayerOvrSortKey(null, 40)).toBe(40);
    expect(getTeamRosterPlayerOvrSortKey(undefined, 25)).toBe(25);
  });

  it("sorts players without OVR by market value descending", () => {
    const rows = [
      { ovr: null, marketValue: 12, mvs: null, name: "Billig" },
      { ovr: null, marketValue: 48, mvs: null, name: "Teuer" },
      { ovr: null, marketValue: 30, mvs: null, name: "Mittel" },
    ];

    const sorted = [...rows].sort((left, right) =>
      compareTeamRosterPlayersByOvrOrMarketValue({ left, right }),
    );

    expect(sorted.map((row) => row.name)).toEqual(["Teuer", "Mittel", "Billig"]);
  });

  it("keeps OVR-ranked players ahead of MW-only fallbacks when OVR exceeds MW", () => {
    const rows = [
      { ovr: null, marketValue: 50, mvs: null, name: "MW-only" },
      { ovr: 70, marketValue: 10, mvs: null, name: "Rated" },
    ];

    const sorted = [...rows].sort((left, right) =>
      compareTeamRosterPlayersByOvrOrMarketValue({ left, right }),
    );

    expect(sorted.map((row) => row.name)).toEqual(["Rated", "MW-only"]);
  });

  it("uses MVS and name as tiebreakers after the primary key", () => {
    const left = { ovr: 60, marketValue: 20, mvs: 4, name: "Alpha" };
    const right = { ovr: 60, marketValue: 20, mvs: 8, name: "Beta" };

    expect(compareTeamRosterPlayersByOvrOrMarketValue({ left, right })).toBeGreaterThan(0);
    expect(
      compareTeamRosterPlayersByOvrOrMarketValue({
        left: { ...left, mvs: 8 },
        right: { ...right, mvs: 8 },
      }),
    ).toBeLessThan(0);
  });
});
