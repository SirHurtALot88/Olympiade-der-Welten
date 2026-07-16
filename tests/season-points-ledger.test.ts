import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

describe("season points ledger", () => {
  it("uses the real rank-to-points table and distributes team points by base share", () => {
    const gameState = createFreshSeasonOneGameState();
    const teamA = gameState.teams[0];
    const teamB = gameState.teams[1];
    const [playerA1, playerA2, playerB1, playerB2] = gameState.players.slice(0, 4);

    expect(teamA).toBeTruthy();
    expect(teamB).toBeTruthy();
    expect(playerA1).toBeTruthy();
    expect(playerA2).toBeTruthy();
    expect(playerB1).toBeTruthy();
    expect(playerB2).toBeTruthy();

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
    ];
    gameState.seasonState.disciplineResults = [
      {
        id: "discipline-a",
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
        id: "discipline-b",
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
    ];
    gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-a-1",
        matchdayResultId: "result-1",
        teamId: teamA!.teamId,
        playerId: playerA1!.id,
        activePlayerId: playerA1!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 30,
        finalPlayerScore: 33,
        mutatorPpsBonus: 0.3,
        scoreContribution: 0.7,
        rankInTeam: 1,
        rankInDiscipline: 1,
        isTop10: true,
        isMvpCandidate: true,
        storyWeight: 0.7,
        createdAt: "2026-06-06T12:03:00.000Z",
      },
      {
        id: "perf-a-2",
        matchdayResultId: "result-1",
        teamId: teamA!.teamId,
        playerId: playerA2!.id,
        activePlayerId: playerA2!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 1,
        baseValue: 10,
        finalPlayerScore: 14,
        scoreContribution: 0.3,
        rankInTeam: 2,
        rankInDiscipline: 5,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 0.3,
        createdAt: "2026-06-06T12:04:00.000Z",
      },
      {
        id: "perf-b-1",
        matchdayResultId: "result-1",
        teamId: teamB!.teamId,
        playerId: playerB1!.id,
        activePlayerId: playerB1!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 20,
        finalPlayerScore: 18,
        scoreContribution: 0.5,
        rankInTeam: 1,
        rankInDiscipline: 7,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 0.5,
        createdAt: "2026-06-06T12:05:00.000Z",
      },
      {
        id: "perf-b-2",
        matchdayResultId: "result-1",
        teamId: teamB!.teamId,
        playerId: playerB2!.id,
        activePlayerId: playerB2!.id,
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        slotIndex: 1,
        baseValue: 20,
        finalPlayerScore: 13,
        scoreContribution: 0.5,
        rankInTeam: 2,
        rankInDiscipline: 9,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 0.5,
        createdAt: "2026-06-06T12:06:00.000Z",
      },
    ];

    const ledger = buildSeasonPointsLedger(gameState);
    const teamASummary = ledger.teamSummariesByTeamId.get(teamA!.teamId);
    const teamBSummary = ledger.teamSummariesByTeamId.get(teamB!.teamId);
    const perfA1 = ledger.pointEntriesByPerformanceId.get("perf-a-1");
    const perfA2 = ledger.pointEntriesByPerformanceId.get("perf-a-2");
    const perfB1 = ledger.pointEntriesByPerformanceId.get("perf-b-1");
    const perfB2 = ledger.pointEntriesByPerformanceId.get("perf-b-2");

    expect(teamASummary?.totalPoints).toBe(6.9);
    expect(teamBSummary?.totalPoints).toBe(6.2);
    expect(teamASummary?.reconciliationStatus).toBe("reconciled");
    expect(teamBSummary?.reconciliationStatus).toBe("reconciled");
    expect(teamASummary?.playerDerivedTotal).toBe(6.9);
    expect(teamASummary?.mutatorPpsBonus).toBe(0.3);
    expect(perfA1?.basePoints).toBe(4.95);
    expect(perfA1?.mutatorPpsBonus).toBe(0.3);
    expect(perfA1?.points).toBe(5.25);
    expect(perfA2?.points).toBe(1.65);
    expect(perfB1?.points).toBe(3.1);
    expect(perfB2?.points).toBe(3.1);
    expect(perfA1?.pointSource).toBe("rank_to_points_base_share");
  });
});
