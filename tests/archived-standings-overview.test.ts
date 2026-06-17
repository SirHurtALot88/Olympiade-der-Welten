import { describe, expect, it } from "vitest";

import { buildArchivedSeasonStandingsOverviewItems } from "@/lib/season/archived-standings-overview";
import type { SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";

describe("buildArchivedSeasonStandingsOverviewItems", () => {
  it("maps archived final standings to the season overview contract", () => {
    const snapshot: SeasonSnapshotRecord = {
      snapshotId: "season-snapshot__season-1",
      seasonId: "season-1",
      seasonName: "Season 1",
      archivedAt: "2026-06-16T12:00:00.000Z",
      status: "completed",
      finalStandings: [
        {
          teamId: "A-A",
          teamCode: "A-A",
          teamName: "Arcane Archers",
          rank: 2,
          points: 100,
          disciplinePoints: 101.5,
          disciplinePointsByArea: { pow: 20, spe: 25.5, men: 26, soc: 30 },
          cashEnd: 122.25,
          rosterEnd: 10,
          salaryEnd: 12,
          marketValueEnd: 200,
          transferCount: 3,
          transferBuyCount: 2,
          transferSellCount: 1,
          transferNet: -15,
        },
        {
          teamId: "G-G",
          teamCode: "G-G",
          teamName: "Golden Gladiators",
          rank: 1,
          points: 190,
          disciplinePoints: 193.5,
          disciplinePointsByArea: { pow: 50, spe: 44.5, men: 49, soc: 50 },
          cashEnd: 250,
          rosterEnd: 10,
          salaryEnd: 20,
          marketValueEnd: 400,
          transferCount: 4,
          transferBuyCount: 3,
          transferSellCount: 1,
          transferNet: 25,
        },
      ],
      playerPerformances: [],
    };

    const result = buildArchivedSeasonStandingsOverviewItems(snapshot);

    expect(result[0]).toMatchObject({
      teamId: "G-G",
      rank: 1,
      points: 190,
      cash: 250,
      cashTotal: 250,
      guv: 25,
      transfers: 4,
      disciplineValues: { pow: 50, spe: 44.5, men: 49, soc: 50 },
    });
    expect(result[1]?.teamId).toBe("A-A");
  });
});
