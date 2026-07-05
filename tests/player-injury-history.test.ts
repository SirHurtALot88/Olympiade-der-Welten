import { describe, expect, it } from "vitest";

import type { GameState, InjuryEventRecord, LineupDraft, Player } from "@/lib/data/olyDataTypes";
import { applyFatigueAndInjuryAfterMatchday, rollInjuryRisk } from "@/lib/fatigue/fatigue-injury-service";
import {
  appendPlayerInjuryHistory,
  backfillPlayerInjuryHistoryFromSeasonEvents,
  buildPlayerInjuryHistoryFromEvents,
  buildPlayerInjurySummary,
  ensurePlayerInjuryHistoryForGameState,
  injuryEventToPlayerHistoryRecord,
} from "@/lib/foundation/player-injury-history";

function buildPlayer(id: string): Player {
  return {
    id,
    name: id,
    rating: 60,
    marketValue: 20,
    salaryDemand: 5,
    displayMarketValue: 20,
    displaySalary: 5,
    className: "Hero",
    race: "Human",
    alignment: "neutral",
    gender: "m",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 60, spe: 60, men: 60, soc: 60 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 80,
    form: 50,
    potential: 50,
  };
}

function findInjuredPlayerId(input: { saveId: string; seasonId: string; matchdayId: string }) {
  for (let index = 0; index < 1_000; index += 1) {
    const playerId = `injury-candidate-${index}`;
    const roll = rollInjuryRisk({ ...input, playerId, fatigueBefore: 95 });
    if (roll.result === "injured") {
      return playerId;
    }
  }
  throw new Error("No deterministic injury candidate found for test seed.");
}

function buildMatchdayGameState(playerId: string): GameState {
  const draft: LineupDraft = {
    lineupId: "lineup-1",
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "md-1",
    teamId: "T-1",
    status: "submitted",
    entries: [
      {
        disciplineId: "tdm",
        disciplineSide: "d1",
        slotIndex: 0,
        playerId,
        activePlayerId: `active-${playerId}`,
      },
    ],
    createdAt: "2026-06-26T00:00:00.000Z",
    updatedAt: "2026-06-26T00:00:00.000Z",
  };
  return {
    gamePhase: "matchday",
    season: {
      id: "season-1",
      name: "Season 1",
      year: 1,
      currentMatchday: 1,
      matchdayIds: ["md-1", "md-2"],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      disciplineSchedule: [],
      lineupDrafts: [draft],
      injuryEvents: [],
      playerAvailabilityState: [],
    },
    matchdayState: {
      matchdayId: "md-1",
      status: "resolved",
      pendingTeamIds: [],
      resolvedFixtureIds: ["fixture-1"],
    },
    teams: [
      {
        teamId: "T-1",
        shortCode: "T1",
        name: "Test Team",
        budget: 50,
        cash: 50,
        identityId: "I-1",
        humanControlled: true,
        rosterLimit: 14,
        rosterMinTarget: 4,
        rosterOptTarget: 6,
      },
    ],
    teamIdentities: [],
    players: [buildPlayer(playerId)],
    disciplines: [{ id: "tdm", name: "TDM", category: "power", weight: 1 }],
    rosters: [
      {
        id: "r1",
        teamId: "T-1",
        playerId,
        contractLength: 2,
        salary: 5,
        upkeep: 5,
        roleTag: "starter",
        joinedSeasonId: "season-1",
      },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerMoraleState: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  } as unknown as GameState;
}

describe("player injury history", () => {
  it("persists injury events on player history when matchday fatigue resolves to injury", () => {
    const playerId = findInjuredPlayerId({ saveId: "save-1", seasonId: "season-1", matchdayId: "md-1" });
    const gameState = buildMatchdayGameState(playerId);
    const result = applyFatigueAndInjuryAfterMatchday({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      matchdayResultId: "result-1",
      timestamp: "2026-06-26T00:00:00.000Z",
    });

    const injuredPlayer = result.gameState.players.find((entry) => entry.id === playerId);
    expect(injuredPlayer?.injuryHistory?.length).toBeGreaterThan(0);
    expect(result.gameState.seasonState.injuryEvents?.some((event) => event.result === "injured")).toBe(true);
  });

  it("backfills player injury history from season events on save load", () => {
    const event: InjuryEventRecord = {
      eventId: "evt-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: "T-1",
      playerId: "p1",
      fatigueBefore: 82,
      riskPercent: 25,
      roll: 10,
      result: "injured",
      unavailableForMatchdays: 1,
      unavailableUntil: "matchday-2",
      normalRecovery: 20,
      injuryRecovery: 10,
      source: "fatigue_injury_risk_v1",
      timestamp: "2026-06-26T00:00:00.000Z",
    };
    const gameState = {
      ...buildMatchdayGameState("p1"),
      seasonState: {
        ...buildMatchdayGameState("p1").seasonState,
        injuryEvents: [event],
      },
    };

    const hydrated = ensurePlayerInjuryHistoryForGameState(gameState);
    const history = buildPlayerInjuryHistoryFromEvents({
      playerId: "p1",
      gameState: hydrated,
      persistedHistory: hydrated.players[0]?.injuryHistory,
    });

    expect(history).toHaveLength(1);
    expect(buildPlayerInjurySummary(history)).toMatchObject({
      totalInjuries: 1,
      totalMatchdaysMissed: 1,
      seasonsAffected: 1,
    });
  });

  it("dedupes injury history records by event id", () => {
    const record = injuryEventToPlayerHistoryRecord(
      {
        eventId: "evt-1",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        teamId: "T-1",
        playerId: "p1",
        fatigueBefore: 80,
        riskPercent: 20,
        roll: 10,
        result: "injured",
        unavailableForMatchdays: 1,
        unavailableUntil: "matchday-2",
        normalRecovery: 20,
        injuryRecovery: 10,
        source: "fatigue_injury_risk_v1",
        timestamp: "2026-06-26T00:00:00.000Z",
      },
      buildMatchdayGameState("p1"),
    );
    expect(record).not.toBeNull();
    const once = appendPlayerInjuryHistory(buildPlayer("p1"), record!);
    const twice = appendPlayerInjuryHistory(once, record!);
    expect(twice.injuryHistory).toHaveLength(1);

    const gameStateWithEvent = {
      ...buildMatchdayGameState("p1"),
      seasonState: {
        ...buildMatchdayGameState("p1").seasonState,
        injuryEvents: [
          {
            eventId: "evt-1",
            seasonId: "season-1",
            matchdayId: "matchday-1",
            teamId: "T-1",
            playerId: "p1",
            fatigueBefore: 80,
            riskPercent: 20,
            roll: 10,
            result: "injured" as const,
            unavailableForMatchdays: 1,
            unavailableUntil: "matchday-2",
            normalRecovery: 20,
            injuryRecovery: 10,
            source: "fatigue_injury_risk_v1",
            timestamp: "2026-06-26T00:00:00.000Z",
          },
        ],
      },
    };
    expect(backfillPlayerInjuryHistoryFromSeasonEvents(gameStateWithEvent).players[0]?.injuryHistory).toHaveLength(1);
  });

  it("backfills missing season events even when player already has later injury history", () => {
    const s1Event: InjuryEventRecord = {
      eventId: "evt-s1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: "T-1",
      playerId: "p1",
      fatigueBefore: 82,
      riskPercent: 25,
      roll: 10,
      result: "injured",
      unavailableForMatchdays: 1,
      unavailableUntil: "matchday-2",
      normalRecovery: 20,
      injuryRecovery: 10,
      source: "fatigue_injury_risk_v1",
      timestamp: "2026-06-20T00:00:00.000Z",
    };
    const s2Event: InjuryEventRecord = {
      ...s1Event,
      eventId: "evt-s2",
      seasonId: "season-2",
      matchdayId: "matchday-3",
      timestamp: "2026-07-20T00:00:00.000Z",
    };
    const gameState = {
      ...buildMatchdayGameState("p1"),
      players: [
        {
          ...buildPlayer("p1"),
          injuryHistory: [
            {
              eventId: "evt-s2",
              seasonId: "season-2",
              seasonName: "Season 2",
              matchdayId: "matchday-3",
              matchdayLabel: "Spieltag 3",
              teamId: "T-1",
              fatigueBefore: 80,
              riskPercent: 20,
              unavailableUntil: "matchday-4",
              matchdaysMissed: 1,
              injuryRecoveryPct: 50,
              timestamp: "2026-07-20T00:00:00.000Z",
            },
          ],
        },
      ],
      seasonState: {
        ...buildMatchdayGameState("p1").seasonState,
        injuryEvents: [s1Event, s2Event],
      },
    };

    const hydrated = ensurePlayerInjuryHistoryForGameState(gameState);
    const history = buildPlayerInjuryHistoryFromEvents({
      playerId: "p1",
      gameState: hydrated,
      persistedHistory: hydrated.players[0]?.injuryHistory,
    });

    expect(history).toHaveLength(2);
    expect(history.map((entry) => entry.seasonId).sort()).toEqual(["season-1", "season-2"]);
  });
});
