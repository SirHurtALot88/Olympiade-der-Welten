import { describe, expect, it } from "vitest";

import { computeTeamDisciplineRanks } from "@/lib/lineups/team-discipline-ranks";

describe("computeTeamDisciplineRanks", () => {
  it("uses the sum of the top 6 discipline scores per team", () => {
    const scoreByPlayerAndDiscipline = new Map<string, number>([
      ["a1::mini-dm", 90],
      ["a2::mini-dm", 80],
      ["a3::mini-dm", 70],
      ["a4::mini-dm", 60],
      ["a5::mini-dm", 50],
      ["a6::mini-dm", 40],
      ["a7::mini-dm", 1],
      ["b1::mini-dm", 65],
      ["b2::mini-dm", 64],
      ["b3::mini-dm", 63],
      ["b4::mini-dm", 62],
      ["b5::mini-dm", 61],
      ["b6::mini-dm", 60],
      ["b7::mini-dm", 59],
    ]);

    const input = {
      teamIds: ["A-A", "B-B"],
      disciplineIds: ["mini-dm"],
      rosterAssignments: [
        { teamId: "A-A", playerId: "a1" },
        { teamId: "A-A", playerId: "a2" },
        { teamId: "A-A", playerId: "a3" },
        { teamId: "A-A", playerId: "a4" },
        { teamId: "A-A", playerId: "a5" },
        { teamId: "A-A", playerId: "a6" },
        { teamId: "A-A", playerId: "a7" },
        { teamId: "B-B", playerId: "b1" },
        { teamId: "B-B", playerId: "b2" },
        { teamId: "B-B", playerId: "b3" },
        { teamId: "B-B", playerId: "b4" },
        { teamId: "B-B", playerId: "b5" },
        { teamId: "B-B", playerId: "b6" },
        { teamId: "B-B", playerId: "b7" },
      ],
      scoreByPlayerAndDiscipline,
    };

    const aRanks = computeTeamDisciplineRanks({
      ...input,
      teamId: "A-A",
    });
    const bRanks = computeTeamDisciplineRanks({
      ...input,
      teamId: "B-B",
    });

    expect(aRanks["mini-dm"]).toMatchObject({
      score: 390,
      rank: 1,
      rankSource: "active_roster_top6_sum_discipline_score",
    });
    expect(bRanks["mini-dm"]).toMatchObject({
      score: 375,
      rank: 2,
      rankSource: "active_roster_top6_sum_discipline_score",
    });
  });
});
