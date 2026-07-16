import { describe, expect, it } from "vitest";

import {
  buildLeagueLeaderBoards,
  type LeagueLeaderSourceRow,
  type LeagueTrainingLeaderSourceRow,
} from "@/lib/foundation/league-leaders-service";

const seasonRows: LeagueLeaderSourceRow[] = [
  {
    playerId: "p1",
    name: "Alpha",
    teamId: "t1",
    teamCode: "ALP",
    teamName: "Alpha Team",
    pps: 80,
    ppPow: 25,
    ppSpe: 20,
    ppMen: 18,
    ppSoc: 17,
    ovr: 72,
    mvs: 68,
  },
  {
    playerId: "p2",
    name: "Beta",
    teamId: "t2",
    teamCode: "BET",
    teamName: "Beta Team",
    pps: 90,
    ppPow: 22,
    ppSpe: 28,
    ppMen: 19,
    ppSoc: 21,
    ovr: 75,
    mvs: 70,
  },
  {
    playerId: "p3",
    name: "Gamma",
    teamId: "t3",
    teamCode: "GAM",
    teamName: "Gamma Team",
    pps: 70,
    ppPow: 30,
    ppSpe: 15,
    ppMen: 12,
    ppSoc: 13,
    ovr: 69,
    mvs: 66,
  },
];

const trainingRows: LeagueTrainingLeaderSourceRow[] = [
  {
    playerId: "p1",
    name: "Alpha",
    teamId: "t1",
    teamCode: "ALP",
    teamName: "Alpha Team",
    trainingForecast: 1.2,
  },
  {
    playerId: "p2",
    name: "Beta",
    teamId: "t2",
    teamCode: "BET",
    teamName: "Beta Team",
    trainingForecast: 2.8,
  },
  {
    playerId: "p3",
    name: "Gamma",
    teamId: "t3",
    teamCode: "GAM",
    teamName: "Gamma Team",
    trainingForecast: 0.4,
  },
];

describe("buildLeagueLeaderBoards", () => {
  it("builds top categories with default limit and stable ordering", () => {
    const boards = buildLeagueLeaderBoards({ seasonRows, trainingRows });

    expect(boards).toHaveLength(8);
    expect(boards.map((board) => board.id)).toEqual([
      "pps",
      "pow",
      "spe",
      "men",
      "soc",
      "mvs",
      "ovr",
      "training",
    ]);

    const ppsBoard = boards.find((board) => board.id === "pps");
    expect(ppsBoard?.entries).toHaveLength(seasonRows.length);
    expect(ppsBoard?.entries[0]).toMatchObject({
      rank: 1,
      playerId: "p2",
      value: 90,
    });

    const powBoard = boards.find((board) => board.id === "pow");
    expect(powBoard?.entries[0]?.playerId).toBe("p3");

    const trainingBoard = boards.find((board) => board.id === "training");
    expect(trainingBoard?.entries[0]).toMatchObject({
      playerId: "p2",
      displayValue: "+2,8 SP",
    });
  });

  it("respects custom limits and skips training when no rows are provided", () => {
    const boards = buildLeagueLeaderBoards({ seasonRows, limit: 2 });

    expect(boards).toHaveLength(7);
    expect(boards.every((board) => board.entries.length <= 2)).toBe(true);
    expect(boards.find((board) => board.id === "training")).toBeUndefined();
  });
});
