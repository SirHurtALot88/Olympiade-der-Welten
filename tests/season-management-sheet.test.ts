import { describe, expect, it } from "vitest";

import { inspectSeasonManagementSheet, mapSeasonManagementRowsToTeams } from "@/lib/foundation/season-management-sheet";

describe("season management sheet", () => {
  it("reads Startbudget from the season management sheet export", async () => {
    const fakeFetch: typeof fetch = (async () =>
      new Response(
        [
          "Name,Player,Power,Speed,Mental,Social,Ambition,Finances,Board Confidence,Harmony,Manners,Popularity,Cooperation,Startbudget,Player Min,Player Opt",
          "Armageddon Aftermath,F,0,18,2,0,8.5,1,1,1,1,1,2,175,10,11",
          "Black Panthers,F,4,9,7,0,6,1.5,4.5,6.5,8.5,8.5,6,275,8,10",
        ].join("\n"),
        { status: 200 },
      )) as typeof fetch;

    const result = await inspectSeasonManagementSheet(fakeFetch);

    expect(result.rows[0]).toMatchObject({
      teamName: "Armageddon Aftermath",
      startBudget: 175,
      playerMin: 10,
      playerOpt: 11,
    });
    expect(result.rows[1]).toMatchObject({
      teamName: "Black Panthers",
      startBudget: 275,
    });
  });

  it("maps management sheet rows to teams by team name", () => {
    const mapping = mapSeasonManagementRowsToTeams(
      [
        {
          teamName: "Armageddon Aftermath",
          startBudget: 175,
          playerMin: 10,
          playerOpt: 11,
          warnings: [],
        },
      ],
      [{ teamId: "A-A", teamName: "Armageddon Aftermath" }],
    );

    expect(mapping.mappedRows[0]).toMatchObject({
      teamId: "A-A",
      resolvedTeamName: "Armageddon Aftermath",
      startBudget: 175,
    });
    expect(mapping.missingMappings).toEqual([]);
  });
});
