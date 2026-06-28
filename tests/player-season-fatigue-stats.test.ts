import { describe, expect, it } from "vitest";

import type { GameState, InjuryEventRecord, MatchdayResultRecord, PlayerDisciplinePerformanceRecord } from "@/lib/data/olyDataTypes";
import { MATCHDAY_FATIGUE_LOAD } from "@/lib/fatigue/fatigue-injury-service";
import {
  buildPlayerAverageMatchdayFatigueBySeason,
  computePlayerSeasonAverageMatchdayFatigue,
} from "@/lib/foundation/player-season-fatigue-stats";

function buildPerformance(
  partial: Partial<PlayerDisciplinePerformanceRecord> & Pick<PlayerDisciplinePerformanceRecord, "playerId" | "matchdayResultId">,
): PlayerDisciplinePerformanceRecord {
  return {
    id: partial.id ?? `${partial.playerId}-${partial.matchdayResultId}`,
    matchdayResultId: partial.matchdayResultId,
    teamId: partial.teamId ?? "A-A",
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
    teamId: partial.teamId ?? "A-A",
    riskPercent: partial.riskPercent ?? 0,
    roll: partial.roll ?? 0,
    result: partial.result ?? "healthy",
    unavailableForMatchdays: 1,
    source: partial.source ?? "fatigue_injury_risk_v1",
    timestamp: partial.timestamp ?? "2026-06-01T00:00:00.000Z",
    ...partial,
  };
}

describe("player-season-fatigue-stats", () => {
  it("averages pre-match fatigue across unique appearance matchdays", () => {
    const average = computePlayerSeasonAverageMatchdayFatigue({
      playerId: "player-1",
      seasonId: "season-1",
      performances: [
        buildPerformance({ playerId: "player-1", matchdayResultId: "result-md-1", disciplineSide: "d1" }),
        buildPerformance({ playerId: "player-1", matchdayResultId: "result-md-1", disciplineSide: "d2" }),
        buildPerformance({ playerId: "player-1", matchdayResultId: "result-md-2" }),
      ],
      matchdayResults: [
        buildMatchdayResult({ id: "result-md-1", matchdayId: "md-1" }),
        buildMatchdayResult({ id: "result-md-2", matchdayId: "md-2" }),
      ],
      injuryEvents: [
        buildInjuryEvent({ playerId: "player-1", matchdayId: "md-1", fatigueBefore: 52 }),
        buildInjuryEvent({ playerId: "player-1", matchdayId: "md-2", fatigueBefore: 64 }),
      ],
    });

    expect(average).toBe((52 - MATCHDAY_FATIGUE_LOAD + (64 - MATCHDAY_FATIGUE_LOAD)) / 2);
  });

  it("builds per-season averages from live state and snapshots", () => {
    const gameState = {
      season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
      seasonState: {
        matchdayResults: [buildMatchdayResult({ id: "result-md-1", matchdayId: "md-1", seasonId: "season-2" })],
        playerDisciplinePerformances: [buildPerformance({ playerId: "player-1", matchdayResultId: "result-md-1" })],
        injuryEvents: [buildInjuryEvent({ playerId: "player-1", matchdayId: "md-1", seasonId: "season-2", fatigueBefore: 40 })],
        seasonSnapshots: [
          {
            seasonId: "season-1",
            seasonName: "Season 1",
            archivedAt: "2026-06-01T00:00:00.000Z",
            finalStandings: [],
            playerPerformances: [],
            matchdayResults: [buildMatchdayResult({ id: "result-old", matchdayId: "old-md-1", seasonId: "season-1" })],
            playerDisciplinePerformances: [buildPerformance({ playerId: "player-1", matchdayResultId: "result-old" })],
          },
        ],
      },
    } as GameState;

    gameState.seasonState.injuryEvents?.push(
      buildInjuryEvent({ playerId: "player-1", matchdayId: "old-md-1", seasonId: "season-1", fatigueBefore: 28 }),
    );

    const bySeason = buildPlayerAverageMatchdayFatigueBySeason(gameState, "player-1");

    expect(bySeason.get("season-2")).toBe(40 - MATCHDAY_FATIGUE_LOAD);
    expect(bySeason.get("season-1")).toBe(28 - MATCHDAY_FATIGUE_LOAD);
  });
});
