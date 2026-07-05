import { describe, expect, it } from "vitest";

import type { GameState, InjuryEventRecord, MatchdayResultRecord, PlayerDisciplinePerformanceRecord } from "@/lib/data/olyDataTypes";
import { MATCHDAY_FATIGUE_LOAD } from "@/lib/fatigue/fatigue-injury-service";
import {
  computeTeamSeasonAverageMatchdayFatigue,
  countTeamSeasonInjuries,
} from "@/lib/foundation/team-history-health-metrics";

function buildPerformance(
  partial: Partial<PlayerDisciplinePerformanceRecord> & Pick<PlayerDisciplinePerformanceRecord, "playerId" | "matchdayResultId">,
): PlayerDisciplinePerformanceRecord {
  return {
    id: partial.id ?? `${partial.playerId}-${partial.matchdayResultId}`,
    matchdayResultId: partial.matchdayResultId,
    teamId: partial.teamId ?? "t1",
    playerId: partial.playerId,
    activePlayerId: partial.activePlayerId ?? null,
    disciplineId: partial.disciplineId ?? "mini-dm",
    disciplineSide: partial.disciplineSide ?? "d1",
    slotIndex: partial.slotIndex ?? 1,
    baseValue: partial.baseValue ?? 50,
    finalPlayerScore: partial.finalPlayerScore ?? 50,
    scoreContribution: partial.scoreContribution ?? 25,
    rankInTeam: partial.rankInTeam ?? 1,
    rankInDiscipline: partial.rankInDiscipline ?? 1,
    isTop10: partial.isTop10 ?? false,
    isMvpCandidate: partial.isMvpCandidate ?? false,
    storyWeight: partial.storyWeight ?? null,
    createdAt: partial.createdAt ?? "2026-06-01T00:00:00.000Z",
  };
}

function buildMatchdayResult(
  partial: Partial<MatchdayResultRecord> & Pick<MatchdayResultRecord, "id" | "matchdayId">,
): MatchdayResultRecord {
  return {
    saveId: partial.saveId ?? "save-1",
    seasonId: partial.seasonId ?? "season-1",
    status: partial.status ?? "preview_applied",
    sourceVersion: partial.sourceVersion ?? "test",
    teamsTotal: partial.teamsTotal ?? 2,
    teamsReady: partial.teamsReady ?? 2,
    teamsUnderfilled: partial.teamsUnderfilled ?? 0,
    teamsMissingLineup: partial.teamsMissingLineup ?? 0,
    teamsInvalidLineup: partial.teamsInvalidLineup ?? 0,
    teamsMissingScoreCoverage: partial.teamsMissingScoreCoverage ?? 0,
    warningsCount: partial.warningsCount ?? 0,
    createdAt: partial.createdAt ?? "2026-06-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-06-01T00:00:00.000Z",
    ...partial,
  };
}

function buildInjuryEvent(
  partial: Partial<InjuryEventRecord> & Pick<InjuryEventRecord, "matchdayId" | "playerId" | "fatigueBefore">,
): InjuryEventRecord {
  return {
    eventId: partial.eventId ?? `${partial.playerId}-${partial.matchdayId}`,
    seasonId: partial.seasonId ?? "season-1",
    teamId: partial.teamId ?? "t1",
    riskPercent: partial.riskPercent ?? 0,
    roll: partial.roll ?? 0,
    result: partial.result ?? "injured",
    unavailableForMatchdays: 1,
    source: partial.source ?? "fatigue_injury_risk_v1",
    timestamp: partial.timestamp ?? "2026-06-01T00:00:00.000Z",
    ...partial,
  };
}

function minimalGameState(overrides?: Partial<GameState>): GameState {
  return {
    season: { id: "season-2", name: "Season 2", currentMatchday: 1, matchdayIds: ["md-1"] },
    teams: [{ teamId: "t1", shortCode: "G-G", name: "G-G", budget: 310, cash: 50, rosterLimit: 32, humanControlled: false }],
    teamIdentities: [{ teamId: "t1", playerMin: 8, playerOpt: 12 }],
    players: [
      { id: "p1", name: "A", gender: "female", race: "human", rating: 40, potential: 50, trainingMode: "mittel" },
      { id: "p2", name: "B", gender: "female", race: "human", rating: 38, potential: 48, trainingMode: "mittel" },
    ],
    rosters: [
      { id: "r1", teamId: "t1", playerId: "p1", contractLength: 2, salary: 10, upkeep: 0, roleTag: "starter", joinedSeasonId: "season-2" },
      { id: "r2", teamId: "t1", playerId: "p2", contractLength: 2, salary: 12, upkeep: 0, roleTag: "starter", joinedSeasonId: "season-2" },
    ],
    transferHistory: [],
    contracts: [],
    transferListings: [],
    seasonState: {
      matchdayResults: [buildMatchdayResult({ id: "result-md-1", matchdayId: "md-1", seasonId: "season-2" })],
      playerDisciplinePerformances: [
        buildPerformance({ playerId: "p1", matchdayResultId: "result-md-1", teamId: "t1" }),
        buildPerformance({ playerId: "p2", matchdayResultId: "result-md-1", teamId: "t1" }),
      ],
      injuryEvents: [
        buildInjuryEvent({ eventId: "e1", playerId: "p1", matchdayId: "md-1", seasonId: "season-2", teamId: "t1", fatigueBefore: 50 }),
        buildInjuryEvent({ eventId: "e2", playerId: "p2", matchdayId: "md-1", seasonId: "season-2", teamId: "t1", fatigueBefore: 62, result: "healthy" }),
        buildInjuryEvent({ eventId: "e3", playerId: "p1", matchdayId: "old-md-1", seasonId: "season-1", teamId: "t1", fatigueBefore: 40 }),
      ],
      seasonSnapshots: [
        {
          seasonId: "season-1",
          seasonName: "Season 1",
          archivedAt: "2026-06-01T00:00:00.000Z",
          finalStandings: [],
          playerPerformances: [
            {
              playerId: "p1",
              playerName: "A",
              teamId: "t1",
              teamCode: "G-G",
              teamName: "G-G",
              appearances: 1,
              totalContribution: 10,
              averageContribution: 10,
              averageFinalScore: 50,
              top10Count: 0,
              mvpCount: 0,
              bestDisciplineId: null,
              bestDisciplineScore: null,
            },
          ],
          matchdayResults: [buildMatchdayResult({ id: "result-old", matchdayId: "old-md-1", seasonId: "season-1" })],
          playerDisciplinePerformances: [buildPerformance({ playerId: "p1", matchdayResultId: "result-old", teamId: "t1" })],
        },
      ],
    },
    matchdayState: { matchdayId: "md-1" },
    ...overrides,
  } as unknown as GameState;
}

describe("team-history-health-metrics", () => {
  it("counts unique team injuries per season from events and persisted history", () => {
    const gameState = minimalGameState({
      players: [
        {
          id: "p1",
          name: "A",
          gender: "female",
          race: "human",
          rating: 40,
          potential: 50,
          trainingMode: "mittel",
          injuryHistory: [
            {
              eventId: "archived-1",
              seasonId: "season-1",
              teamId: "t1",
              matchdayId: "old-md-1",
              fatigueBefore: 55,
              riskPercent: 10,
              unavailableUntil: null,
              matchdaysMissed: 1,
              injuryRecoveryPct: 50,
              timestamp: "2026-05-01T00:00:00.000Z",
            },
          ],
        },
        { id: "p2", name: "B", gender: "female", race: "human", rating: 38, potential: 48, trainingMode: "mittel" },
      ],
    });

    expect(countTeamSeasonInjuries(gameState, "t1", "season-2")).toBe(1);
    expect(countTeamSeasonInjuries(gameState, "t1", "season-1")).toBe(2);
  });

  it("averages player matchday fatigue for live and archived team seasons", () => {
    const gameState = minimalGameState();
    const snapshot = gameState.seasonState.seasonSnapshots?.[0] ?? null;

    const liveAverage = computeTeamSeasonAverageMatchdayFatigue({
      gameState,
      teamId: "t1",
      seasonId: "season-2",
    });
    const archivedAverage = computeTeamSeasonAverageMatchdayFatigue({
      gameState,
      teamId: "t1",
      seasonId: "season-1",
      snapshot,
    });

    expect(liveAverage).toBe(((50 - MATCHDAY_FATIGUE_LOAD) + (62 - MATCHDAY_FATIGUE_LOAD)) / 2);
    expect(archivedAverage).toBe(40 - MATCHDAY_FATIGUE_LOAD);
  });
});
