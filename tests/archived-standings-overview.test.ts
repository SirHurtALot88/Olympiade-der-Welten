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
      transfers: 25,
      disciplineValues: {
        tdm: 50,
        staffel: 44.5,
        schach: 49,
        basketball: 50,
      },
    });
    expect(result[1]?.teamId).toBe("A-A");
    expect(result[1]?.points).toBe(100);
    expect(result[1]?.disciplineValues.tdm).toBe(20);
    expect(result[1]?.disciplineValues.staffel).toBe(25.5);
    expect(result[1]?.disciplineValues.schach).toBe(26);
    expect(result[1]?.disciplineValues.basketball).toBe(30);
  });

  it("aggregates discipline values from merged snapshot player performances", () => {
    const snapshot: SeasonSnapshotRecord = {
      snapshotId: "season-snapshot__season-1",
      seasonId: "season-1",
      seasonName: "Season 1",
      archivedAt: "2026-06-16T12:00:00.000Z",
      status: "partial",
      finalStandings: [
        {
          teamId: "A-A",
          teamCode: "A-A",
          teamName: "Arcane Archers",
          rank: 1,
          points: 42,
          disciplinePoints: 42,
          disciplinePointsByArea: { pow: 10, spe: 12, men: 8, soc: 12 },
          cashEnd: 100,
          rosterEnd: 10,
          salaryEnd: 10,
          marketValueEnd: 100,
          transferCount: 0,
          transferBuyCount: 0,
          transferSellCount: 0,
          transferNet: 0,
        },
      ],
      playerPerformances: [],
      playerPerformanceSnapshots: [
        {
          playerId: "p1",
          playerName: "Player One",
          teamId: "A-A",
          teamCode: "A-A",
          teamName: "Arcane Archers",
          seasonId: "season-1",
          appearances: 2,
          totalContribution: 18,
          totalPoints: 18,
          disciplineBreakdown: [
            {
              disciplineId: "mini-dm",
              disciplineName: "Mini DM",
              appearances: 1,
              totalContribution: 10,
              averageContribution: 10,
              averageFinalScore: 10,
            },
            {
              disciplineId: "fechten",
              disciplineName: "Fechten",
              appearances: 1,
              totalContribution: 8,
              averageContribution: 8,
              averageFinalScore: 8,
            },
          ],
        },
      ],
    };

    const result = buildArchivedSeasonStandingsOverviewItems(snapshot);

    expect(result[0]?.disciplineValues.mini_dm).toBe(10);
    expect(result[0]?.disciplineValues.fechten).toBe(8);
    expect(result[0]?.disciplineValues.schach).toBe(8);
  });
});
