import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { buildMatchdaySummary } from "@/lib/foundation/matchday-summary";

describe("matchday summary presenter", () => {
  it("separates matchday ranking from cumulative season ranking and computes rank deltas", () => {
    const gameState = createFreshSeasonOneGameState();
    const [teamA, teamB] = gameState.teams;
    const rosterA = gameState.rosters.filter((entry) => entry.teamId === teamA?.teamId).slice(0, 2);
    const rosterB = gameState.rosters.filter((entry) => entry.teamId === teamB?.teamId).slice(0, 2);

    expect(teamA).toBeTruthy();
    expect(teamB).toBeTruthy();
    expect(rosterA).toHaveLength(2);
    expect(rosterB).toHaveLength(2);

    gameState.season.matchdayIds = ["matchday-1", "matchday-2"];
    gameState.matchdayState.matchdayId = "matchday-2";
    gameState.seasonState.matchdayResults = [
      {
        id: "result-1",
        saveId: "save-local",
        seasonId: gameState.season.id,
        matchdayId: "matchday-1",
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 2,
        teamsReady: 2,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-06T12:00:00.000Z",
        updatedAt: "2026-06-06T12:00:00.000Z",
      },
      {
        id: "result-2",
        saveId: "save-local",
        seasonId: gameState.season.id,
        matchdayId: "matchday-2",
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 2,
        teamsReady: 2,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-07T12:00:00.000Z",
        updatedAt: "2026-06-07T12:00:00.000Z",
      },
    ];
    gameState.seasonState.disciplineResults = [
      {
        id: "discipline-a-md1",
        matchdayResultId: "result-1",
        teamId: teamA!.teamId,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 1,
        baseScore: 40,
        totalScore: 47,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-06T12:01:00.000Z",
      },
      {
        id: "discipline-b-md1",
        matchdayResultId: "result-1",
        teamId: teamB!.teamId,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 2,
        baseScore: 25,
        totalScore: 31,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-06T12:02:00.000Z",
      },
      {
        id: "discipline-a-md2-d1",
        matchdayResultId: "result-2",
        teamId: teamA!.teamId,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 2,
        baseScore: 20,
        totalScore: 24,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-07T12:01:00.000Z",
      },
      {
        id: "discipline-b-md2-d1",
        matchdayResultId: "result-2",
        teamId: teamB!.teamId,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 1,
        baseScore: 50,
        totalScore: 56,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-07T12:02:00.000Z",
      },
      {
        id: "discipline-a-md2-d2",
        matchdayResultId: "result-2",
        teamId: teamA!.teamId,
        disciplineId: "mini-dm-2",
        disciplineSide: "d2",
        rank: 2,
        baseScore: 20,
        totalScore: 24,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-07T12:03:00.000Z",
      },
      {
        id: "discipline-b-md2-d2",
        matchdayResultId: "result-2",
        teamId: teamB!.teamId,
        disciplineId: "mini-dm-2",
        disciplineSide: "d2",
        rank: 1,
        baseScore: 50,
        totalScore: 56,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-07T12:04:00.000Z",
      },
    ];
    gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-a-md1",
        matchdayResultId: "result-1",
        teamId: teamA!.teamId,
        playerId: rosterA[0]!.playerId,
        activePlayerId: rosterA[0]!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 40,
        finalPlayerScore: 47,
        scoreContribution: 1,
        rankInTeam: 1,
        rankInDiscipline: 1,
        isTop10: true,
        isMvpCandidate: true,
        storyWeight: 1,
        createdAt: "2026-06-06T12:05:00.000Z",
      },
      {
        id: "perf-b-md1",
        matchdayResultId: "result-1",
        teamId: teamB!.teamId,
        playerId: rosterB[0]!.playerId,
        activePlayerId: rosterB[0]!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 25,
        finalPlayerScore: 31,
        scoreContribution: 1,
        rankInTeam: 1,
        rankInDiscipline: 2,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 1,
        createdAt: "2026-06-06T12:06:00.000Z",
      },
      ...(["d1", "d2"] as const).flatMap((side, index) => [
        {
          id: `perf-a-md2-${side}`,
          matchdayResultId: "result-2",
          teamId: teamA!.teamId,
          playerId: rosterA[index]!.playerId,
          activePlayerId: rosterA[index]!.id,
          disciplineId: side === "d1" ? "mini-dm" : "mini-dm-2",
          disciplineSide: side,
          slotIndex: 0,
          baseValue: 20,
          finalPlayerScore: 24,
          scoreContribution: 1,
          rankInTeam: 1,
          rankInDiscipline: 2,
          isTop10: true,
          isMvpCandidate: false,
          storyWeight: 1,
          createdAt: "2026-06-07T12:05:00.000Z",
        },
        {
          id: `perf-b-md2-${side}`,
          matchdayResultId: "result-2",
          teamId: teamB!.teamId,
          playerId: rosterB[index]!.playerId,
          activePlayerId: rosterB[index]!.id,
          disciplineId: side === "d1" ? "mini-dm" : "mini-dm-2",
          disciplineSide: side,
          slotIndex: 0,
          baseValue: 50,
          finalPlayerScore: 56,
          mutatorScoreBonus: side === "d1" ? 6 : null,
          mutatorPpsBonus: side === "d1" ? 0.3 : null,
          scoreContribution: 1,
          rankInTeam: 1,
          rankInDiscipline: 1,
          isTop10: true,
          isMvpCandidate: true,
          storyWeight: 1,
          createdAt: "2026-06-07T12:06:00.000Z",
        },
      ]),
    ];

    const summary = buildMatchdaySummary(gameState, { matchdayId: "matchday-2" });
    const teamBRow = summary.teamRows.find((row) => row.teamId === teamB!.teamId);

    expect(summary.hasResult).toBe(true);
    expect(summary.topTeams[0]?.teamId).toBe(teamB!.teamId);
    expect(summary.topTeams[0]?.matchdayRank).toBe(1);
    expect(teamBRow?.rankDelta).toBe(1);
    expect(teamBRow?.rankDirection).toBe("up");
    expect(summary.topPlayers[0]?.teamId).toBe(teamB!.teamId);
    expect(summary.topPlayers[0]?.mutatorScoreBonus).toBe(6);
    expect(summary.topPlayers[0]?.mutatorPpsBonus).toBe(0.3);
  });
});
