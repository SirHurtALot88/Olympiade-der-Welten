import { describe, expect, it } from "vitest";

import type { GameState, LineupDraft } from "@/lib/data/olyDataTypes";
import {
  applyFatigueAndInjuryAfterMatchday,
  BASE_MATCHDAY_RECOVERY,
  calculateTeamRecovery,
  getInjuryRiskBand,
  getInjuryRiskPercent,
  getPlayerAvailabilityView,
  injuryRiskBands,
  rollInjuryRisk,
} from "@/lib/fatigue/fatigue-injury-service";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";
import type { LegacyLineupContext } from "@/lib/lineups/legacy-lineup-types";

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

function createGameState(playerId = "player-1", fatigue = 83): GameState {
  const draft: LineupDraft = {
    lineupId: "lineup-1",
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "md-1",
    teamId: "A-A",
    status: "submitted",
    entries: [
      {
        disciplineId: "tdm",
        disciplineSide: "d1",
        slotIndex: 1,
        playerId,
        activePlayerId: `active-${playerId}`,
      },
    ],
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt: "2026-06-13T00:00:00.000Z",
  };

  return {
    season: {
      id: "season-1",
      name: "Season 1",
      year: 1,
      currentMatchday: 1,
      matchdayIds: ["md-1", "md-2", "md-3"],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      lineupDrafts: [draft],
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
      resultAuditLogs: [],
      teamFacilities: {
        "A-A": {
          facilities: {
            recovery_center: {
              level: 2,
              enabled: true,
            },
          },
        },
      },
    },
    matchdayState: {
      matchdayId: "md-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [
      {
        teamId: "A-A",
        shortCode: "A-A",
        name: "Alpha",
        budget: 100,
        cash: 100,
        identityId: "identity-A",
        humanControlled: true,
        rosterLimit: 12,
      },
    ],
    teamIdentities: [],
    players: [
      {
        id: playerId,
        name: "Risk Runner",
        className: "Runner",
        race: "Human",
        marketValue: 10,
        salary: 2,
        fatigue,
        attributes: {},
        disciplineRatings: {},
      },
    ],
    disciplines: [],
    rosters: [
      {
        teamId: "A-A",
        playerId,
        role: "core",
        joinedSeasonId: "season-1",
      },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-13T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 1,
      matchedRosterCount: 1,
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

describe("fatigue injury service", () => {
  it("uses the requested fatigue risk curve", () => {
    expect(injuryRiskBands).toEqual([
      { min: 0, max: 29, label: "none", riskPercent: 0, uiLabel: "kein Risiko" },
      { min: 30, max: 49, label: "minimal", riskPercent: 2, uiLabel: "minimales Verletzungsrisiko" },
      { min: 50, max: 69, label: "mittel", riskPercent: 6, uiLabel: "mittleres Verletzungsrisiko" },
      { min: 70, max: 84, label: "stark", riskPercent: 12, uiLabel: "starkes Verletzungsrisiko" },
      { min: 85, max: 100, label: "sehr_stark", riskPercent: 22, uiLabel: "sehr starkes Verletzungsrisiko" },
    ]);
    expect(getInjuryRiskPercent(29)).toBe(0);
    expect(getInjuryRiskBand(29).label).toBe("none");
    expect(getInjuryRiskPercent(30)).toBe(2);
    expect(getInjuryRiskBand(30).label).toBe("minimal");
    expect(getInjuryRiskPercent(50)).toBe(6);
    expect(getInjuryRiskBand(50).label).toBe("mittel");
    expect(getInjuryRiskPercent(70)).toBe(12);
    expect(getInjuryRiskBand(70).label).toBe("stark");
    expect(getInjuryRiskPercent(85)).toBe(22);
    expect(getInjuryRiskBand(85).label).toBe("sehr_stark");
    expect(getInjuryRiskPercent(100)).toBe(22);
  });

  it("rolls injury risk deterministically from save, season, matchday and player", () => {
    const input = {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      playerId: "player-1",
      fatigueBefore: 82,
    };

    expect(rollInjuryRisk(input)).toEqual(rollInjuryRisk(input));
    expect(rollInjuryRisk({ ...input, playerId: "player-2" }).roll).not.toBe(rollInjuryRisk(input).roll);
  });

  it("creates an injury event after real matchday apply, keeps the player rostered and blocks the next matchday", () => {
    const playerId = findInjuredPlayerId({ saveId: "save-1", seasonId: "season-1", matchdayId: "md-1" });
    const gameState = createGameState(playerId, 83);
    const result = applyFatigueAndInjuryAfterMatchday({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      matchdayResultId: "result-1",
      timestamp: "2026-06-13T00:00:00.000Z",
    });

    expect(result.injuryEvents).toHaveLength(1);
    expect(result.injuryEvents[0]?.result).toBe("injured");
    expect(result.injuryEvents[0]?.unavailableUntil).toBe("md-2");
    expect(result.gameState.rosters.some((entry) => entry.playerId === playerId && entry.teamId === "A-A")).toBe(true);

    const nextMatchdayAvailability = getPlayerAvailabilityView(result.gameState, playerId, "A-A", "md-2");
    expect(nextMatchdayAvailability.isUnavailable).toBe(true);
    expect(nextMatchdayAvailability.blocker).toBe("player_injured_unavailable");

    const laterAvailability = getPlayerAvailabilityView(result.gameState, playerId, "A-A", "md-3");
    expect(laterAvailability.isUnavailable).toBe(false);
    expect(laterAvailability.injuryStatus).toBe("recovering");
  });

  it("treats sold and transfer-market players as healthy with zero fatigue", () => {
    const gameState = createGameState("player-1", 88);
    gameState.rosters = [];
    gameState.seasonState.playerAvailabilityState = [
      {
        playerId: "player-1",
        teamId: "A-A",
        fatigue: 95,
        injuryStatus: "injured",
        injuryUntilMatchday: "md-2",
        injuredAtSeasonId: "season-1",
        injuredAtMatchdayId: "md-1",
        injuryReason: "stale_after_sale",
      },
    ];

    const availability = getPlayerAvailabilityView(gameState, "player-1", "A-A", "md-2");

    expect(availability.fatigue).toBe(0);
    expect(availability.injuryStatus).toBe("healthy");
    expect(availability.isUnavailable).toBe(false);
    expect(availability.blocker).toBeNull();
  });

  it("drops stale availability entries once a player is no longer rostered", () => {
    const gameState = createGameState("player-1", 88);
    gameState.rosters = [];
    gameState.seasonState.playerAvailabilityState = [
      {
        playerId: "player-1",
        teamId: "A-A",
        fatigue: 95,
        injuryStatus: "injured",
        injuryUntilMatchday: "md-2",
        injuredAtSeasonId: "season-1",
        injuredAtMatchdayId: "md-1",
        injuryReason: "stale_after_sale",
      },
    ];

    const result = applyFatigueAndInjuryAfterMatchday({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      matchdayResultId: "result-1",
      timestamp: "2026-06-13T00:00:00.000Z",
    });

    expect(result.injuryEvents).toHaveLength(0);
    expect(result.gameState.seasonState.playerAvailabilityState).toEqual([]);
  });

  it("uses recovery facilities but halves the final recovery while injured", () => {
    const gameState = createGameState("player-1", 80);
    const recovery = calculateTeamRecovery(gameState, "A-A");

    expect(recovery.normalRecovery).toBeGreaterThan(BASE_MATCHDAY_RECOVERY);
    expect(recovery.injuryRecovery).toBe(recovery.normalRecovery * 0.5);
  });

  it("blocks human lineups that still reference an injured player", () => {
    const context: LegacyLineupContext = {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-2",
      teamId: "A-A",
      entries: [
        {
          disciplineId: "tdm",
          disciplineSide: "d1",
          slotIndex: 1,
          playerId: "player-1",
          activePlayerId: "active-player-1",
        },
      ],
      disciplinePlayerCounts: { tdm: 1 },
      disciplineSidePlayerCounts: { "tdm::d1": 1 },
      activePlayers: [],
      rosterPlayers: [
        {
          id: "player-1",
          name: "Risk Runner",
          coreStats: { pow: 10, spe: 10, men: 10, soc: 10 },
          injuryStatus: "injured",
          injuryUntilMatchday: "md-2",
          availabilityBlocker: "player_injured_unavailable",
        },
      ],
      disciplineScores: [],
    };

    const validation = validateLegacyLineupContext(context);

    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((error) => error.includes("player_injured_unavailable"))).toBe(true);
  });

  it("blocks injured players even if a stale activePlayerId is still present", () => {
    const context: LegacyLineupContext = {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-2",
      teamId: "A-A",
      entries: [
        {
          disciplineId: "tdm",
          disciplineSide: "d1",
          slotIndex: 1,
          playerId: "player-1",
          activePlayerId: "active-player-1",
          isCaptain: true,
        },
      ],
      disciplinePlayerCounts: { tdm: 1 },
      disciplineSidePlayerCounts: { "tdm::d1": 1 },
      disciplineSideCaptainCounts: { "tdm::d1": 1 },
      activePlayers: [
        {
          id: "active-player-1",
          saveId: "save-1",
          seasonId: "season-1",
          teamId: "A-A",
          playerId: "player-1",
        },
      ],
      rosterPlayers: [
        {
          id: "player-1",
          name: "Risk Runner",
          coreStats: { pow: 10, spe: 10, men: 10, soc: 10 },
          injuryStatus: "injured",
          injuryUntilMatchday: "md-2",
          availabilityBlocker: "player_injured_unavailable",
        },
      ],
      disciplineScores: [{ playerId: "player-1", disciplineId: "tdm", score: 88 }],
    };

    const validation = validateLegacyLineupContext(context);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain("player_injured_unavailable: Player player-1 is injured and unavailable until md-2.");
  });
});
