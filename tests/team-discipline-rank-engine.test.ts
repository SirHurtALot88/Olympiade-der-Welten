import { describe, expect, it } from "vitest";

import {
  buildPreviousTeamDisciplineRankLookup,
  buildTeamDisciplineRankDeltaPack,
  computeTeamDisciplineRankDelta,
  resolvePreviousSeasonId,
} from "@/lib/foundation/team-discipline-rank-engine";

describe("team-discipline-rank-engine", () => {
  it("resolves previous season id", () => {
    expect(resolvePreviousSeasonId("season-1")).toBeNull();
    expect(resolvePreviousSeasonId("season-3")).toBe("season-2");
  });

  it("computes rank delta with lower rank as improvement", () => {
    expect(computeTeamDisciplineRankDelta(20, 16)).toBe(4);
    expect(computeTeamDisciplineRankDelta(8, 12)).toBe(-4);
    expect(computeTeamDisciplineRankDelta(5, 5)).toBeNull();
    expect(computeTeamDisciplineRankDelta(null, 3)).toBeNull();
  });

  it("builds delta pack for summary columns only when scores exist", () => {
    const deltas = buildTeamDisciplineRankDeltaPack(
      {
        totalRank: 16,
        powRank: 4,
        speRank: 0,
        menRank: 9,
        socRank: 11,
        scorePack: { total: 100, pow: 20, spe: 0, men: 15, soc: 12, disciplines: {} },
      },
      {
        teamId: "team-a",
        teamName: "Team A",
        totalRank: 20,
        powRank: 7,
        speRank: 3,
        menRank: 12,
        socRank: 8,
      },
    );

    expect(deltas).toEqual({
      total: 4,
      pow: 3,
      spe: null,
      men: 3,
      soc: -3,
    });
  });

  it("builds previous rank lookup from season snapshots", () => {
    const lookup = buildPreviousTeamDisciplineRankLookup(
      [
        {
          seasonId: "season-1",
          teamDisciplineRankSnapshots: [
            {
              teamId: "team-a",
              teamName: "Team A",
              totalRank: 12,
              powRank: 5,
              speRank: 6,
              menRank: 7,
              socRank: 8,
            },
          ],
        },
        {
          seasonId: "season-2",
          teamDisciplineRankSnapshots: [
            {
              teamId: "team-a",
              teamName: "Team A",
              totalRank: 8,
              powRank: 3,
              speRank: 4,
              menRank: 5,
              socRank: 6,
            },
          ],
        },
      ],
      "season-2",
    );

    expect(lookup.get("team-a")?.totalRank).toBe(12);
  });
});
