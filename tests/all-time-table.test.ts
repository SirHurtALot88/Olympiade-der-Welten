import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildAllTimeTableModel } from "@/lib/foundation/all-time-table";

function buildGameState(partial: Partial<GameState>): GameState {
  return {
    season: { id: "season-3", name: "Season 3" },
    seasonState: { seasonSnapshots: [] },
    teams: [],
    ...partial,
  } as GameState;
}

function team(teamId: string, teamCode: string, teamName: string) {
  return { teamId, shortCode: teamCode, name: teamName } as unknown as GameState["teams"][number];
}

function standing(input: {
  teamId: string;
  teamCode: string;
  teamName: string;
  rank: number | null;
  points: number | null;
  marketValueEnd?: number | null;
  marketValueTotalEnd?: number | null;
  cashEnd?: number | null;
  cashTotal?: number | null;
}) {
  return {
    teamId: input.teamId,
    teamCode: input.teamCode,
    teamName: input.teamName,
    rank: input.rank,
    points: input.points,
    marketValueEnd: input.marketValueEnd ?? null,
    marketValueTotalEnd: input.marketValueTotalEnd,
    cashEnd: input.cashEnd ?? null,
    cashTotal: input.cashTotal,
    disciplinePointsByArea: {},
  };
}

describe("all-time-table", () => {
  it("ranks the leader by cumulative points, falling back to the silver-medal tie-break when points and titles are equal", () => {
    const model = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [
                standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, points: 50 }),
                standing({ teamId: "t2", teamCode: "BBB", teamName: "Beta", rank: 2, points: 0 }),
              ],
              playerPerformances: [],
            },
            {
              seasonId: "season-2",
              seasonName: "Season 2",
              finalStandings: [
                standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 3, points: 0 }),
                standing({ teamId: "t2", teamCode: "BBB", teamName: "Beta", rank: 1, points: 50 }),
              ],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha"), team("t2", "BBB", "Beta")],
      }),
    });

    // Both teams: 50 cumulative points, 1 title each (gold ties). Beta also
    // has a silver (rank 2 in season-1) while Alpha has none (rank 3 in
    // season-2 is neither silver nor bronze) — the silver-count tie-break
    // decides in Beta's favor.
    expect(model.rows.find((row) => row.teamId === "t1")?.cumulativePoints).toBe(50);
    expect(model.rows.find((row) => row.teamId === "t2")?.cumulativePoints).toBe(50);
    expect(model.rows.find((row) => row.teamId === "t1")?.titles).toBe(1);
    expect(model.rows.find((row) => row.teamId === "t2")?.titles).toBe(1);
    expect(model.rows.find((row) => row.teamId === "t2")?.medals.silver).toBe(1);
    expect(model.rows.find((row) => row.teamId === "t1")?.medals.silver).toBe(0);
    expect(model.leader?.teamId).toBe("t2");
    expect(model.leader?.allTimeRank).toBe(1);
    expect(model.rows.find((row) => row.teamId === "t1")?.allTimeRank).toBe(2);
  });

  it("breaks a full tie (points/titles/medals) on best rank, then avg rank, then team name", () => {
    const bestRankModel = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [
                standing({ teamId: "t1", teamCode: "AAA", teamName: "Zeta", rank: 4, points: 10 }),
                standing({ teamId: "t2", teamCode: "BBB", teamName: "Alpha", rank: 5, points: 10 }),
              ],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Zeta"), team("t2", "BBB", "Alpha")],
      }),
    });
    // Same points, no titles/medals for either team — bestRank (4 vs 5) decides.
    expect(bestRankModel.rows[0].teamId).toBe("t1");
    expect(bestRankModel.rows[0].bestRank).toBe(4);
    expect(bestRankModel.rows[1].bestRank).toBe(5);

    const avgRankModel = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [
                standing({ teamId: "t1", teamCode: "AAA", teamName: "Zeta", rank: 4, points: 5 }),
                standing({ teamId: "t2", teamCode: "BBB", teamName: "Alpha", rank: 4, points: 5 }),
              ],
              playerPerformances: [],
            },
            {
              seasonId: "season-2",
              seasonName: "Season 2",
              finalStandings: [
                standing({ teamId: "t1", teamCode: "AAA", teamName: "Zeta", rank: 6, points: 5 }),
                standing({ teamId: "t2", teamCode: "BBB", teamName: "Alpha", rank: 8, points: 5 }),
              ],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Zeta"), team("t2", "BBB", "Alpha")],
      }),
    });
    // Same points/bestRank (both 4) — avgRank ((4+6)/2=5 vs (4+8)/2=6) decides.
    expect(avgRankModel.rows[0].teamId).toBe("t1");
    expect(avgRankModel.rows[0].avgRank).toBe(5);
    expect(avgRankModel.rows[1].avgRank).toBe(6);

    const nameModel = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [
                standing({ teamId: "t1", teamCode: "AAA", teamName: "Zeta", rank: 4, points: 5 }),
                standing({ teamId: "t2", teamCode: "BBB", teamName: "Alpha", rank: 4, points: 5 }),
              ],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Zeta"), team("t2", "BBB", "Alpha")],
      }),
    });
    // Everything tied (points/titles/medals/bestRank/avgRank) — German
    // locale team-name comparison decides: "Alpha" sorts before "Zeta".
    expect(nameModel.rows[0].teamId).toBe("t2");
    expect(nameModel.rows[1].teamId).toBe("t1");
  });

  it("computes MW peak/first/now and growth abs+pct, preferring the *Total variant with an honest fallback", () => {
    const model = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              // Older snapshot: only the non-Total field is populated.
              finalStandings: [
                standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, points: 10, marketValueEnd: 100 }),
              ],
              playerPerformances: [],
            },
            {
              seasonId: "season-2",
              seasonName: "Season 2",
              finalStandings: [
                standing({
                  teamId: "t1",
                  teamCode: "AAA",
                  teamName: "Alpha",
                  rank: 1,
                  points: 10,
                  marketValueEnd: 999, // should be ignored in favor of Total
                  marketValueTotalEnd: 180,
                }),
              ],
              playerPerformances: [],
            },
            {
              seasonId: "season-3",
              seasonName: "Season 3",
              finalStandings: [
                standing({
                  teamId: "t1",
                  teamCode: "AAA",
                  teamName: "Alpha",
                  rank: 2,
                  points: 5,
                  marketValueTotalEnd: 150,
                }),
              ],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
    });

    const row = model.rows.find((entry) => entry.teamId === "t1");
    expect(row).toBeDefined();
    expect(row?.mwFirst).toBe(100);
    expect(row?.mwPeak).toBe(180);
    expect(row?.mwNow).toBe(150);
    expect(row?.mwGrowthAbs).toBe(50);
    expect(row?.mwGrowthPct).toBe(50);
    expect(model.biggestMwGrowth?.teamId).toBe("t1");
  });

  it("merges the live season last and dedupes it against an already-archived season id", () => {
    const withLive = buildAllTimeTableModel({
      gameState: buildGameState({
        season: { id: "season-2", name: "Season 2" } as unknown as GameState["season"],
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, points: 40 })],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
      liveStandingsByTeamId: {
        t1: { rank: 1, points: 15, marketValue: 200, cash: 30 },
      },
    });

    const liveRow = withLive.rows.find((entry) => entry.teamId === "t1");
    expect(liveRow?.seasons).toHaveLength(2);
    expect(liveRow?.seasons[1].isLive).toBe(true);
    expect(liveRow?.seasons[1].seasonId).toBe("season-2");
    expect(liveRow?.cumulativePoints).toBe(55);

    // Same live season id as an already-archived snapshot → no duplicate entry.
    const dedupedModel = buildAllTimeTableModel({
      gameState: buildGameState({
        season: { id: "season-1", name: "Season 1" } as unknown as GameState["season"],
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, points: 40 })],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
      liveStandingsByTeamId: {
        t1: { rank: 1, points: 999, marketValue: 999, cash: 999 },
      },
    });
    const dedupedRow = dedupedModel.rows.find((entry) => entry.teamId === "t1");
    expect(dedupedRow?.seasons).toHaveLength(1);
    expect(dedupedRow?.cumulativePoints).toBe(40);

    // Without a live-standings input, no live row is invented even though the
    // live season id differs from the archive.
    const withoutLive = buildAllTimeTableModel({
      gameState: buildGameState({
        season: { id: "season-2", name: "Season 2" } as unknown as GameState["season"],
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, points: 40 })],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
    });
    const noLiveRow = withoutLive.rows.find((entry) => entry.teamId === "t1");
    expect(noLiveRow?.seasons).toHaveLength(1);
  });

  it("exposes a null/false/0 tri-state for hasArchive/hasHistory before, and after, archiving", () => {
    const compactLoad = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: { seasonSnapshots: undefined } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
    });
    expect(compactLoad.hasArchive).toBe(false);
    expect(compactLoad.hasHistory).toBe(false);
    expect(compactLoad.archivedSeasonCount).toBe(0);
    // Team identities still resolve from `gameState.teams` even pre-archive-load.
    expect(compactLoad.rows).toHaveLength(1);
    expect(compactLoad.rows[0].cumulativePoints).toBe(0);
    // A "leader" always resolves to rows[0] when there is at least one team —
    // but the title/MW-growth/cash-peak leaders stay honestly null without
    // any real (non-zero/finite) value to point to.
    expect(compactLoad.leader?.teamId).toBe("t1");
    expect(compactLoad.mostTitles).toBeNull();
    expect(compactLoad.biggestMwGrowth).toBeNull();
    expect(compactLoad.richestEver).toBeNull();

    const zeroSeasons = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: { seasonSnapshots: [] } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
    });
    expect(zeroSeasons.hasArchive).toBe(true);
    expect(zeroSeasons.hasHistory).toBe(false);
    expect(zeroSeasons.archivedSeasonCount).toBe(0);

    const oneSeason = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-1",
              seasonName: "Season 1",
              finalStandings: [standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, points: 40 })],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
    });
    expect(oneSeason.hasArchive).toBe(true);
    expect(oneSeason.hasHistory).toBe(true);
    expect(oneSeason.archivedSeasonCount).toBe(1);
    expect(oneSeason.rows[0].avgRank).toBe(1);
    expect(oneSeason.rows[0].bestRank).toBe(1);
    expect(oneSeason.rows[0].titles).toBe(1);
  });

  it("sorts snapshots numerically by season id (season-2 before season-10) and caps chart-ready seasons", () => {
    const model = buildAllTimeTableModel({
      gameState: buildGameState({
        seasonState: {
          seasonSnapshots: [
            {
              seasonId: "season-10",
              seasonName: "Season 10",
              finalStandings: [standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 1, points: 10 })],
              playerPerformances: [],
            },
            {
              seasonId: "season-2",
              seasonName: "Season 2",
              finalStandings: [standing({ teamId: "t1", teamCode: "AAA", teamName: "Alpha", rank: 2, points: 20 })],
              playerPerformances: [],
            },
          ],
        } as unknown as GameState["seasonState"],
        teams: [team("t1", "AAA", "Alpha")],
      }),
    });

    const row = model.rows.find((entry) => entry.teamId === "t1");
    expect(row?.seasons.map((season) => season.seasonId)).toEqual(["season-2", "season-10"]);
    expect(model.seasonLabels).toHaveLength(2);
  });
});
