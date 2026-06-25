import { describe, expect, it } from "vitest";

import type { GameState, LineupDraft } from "@/lib/data/olyDataTypes";
import {
  getTeamMatchdayLineupOpenSlots,
  isTeamMatchdayLineupComplete,
} from "@/lib/foundation/matchday-lineup-readiness";

function gameStateWithDraft(entries: LineupDraft["entries"]): GameState {
  return {
    gamePhase: "season_active",
    season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["season-1-md-1"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      disciplineSchedule: [
        {
          seasonId: "season-1",
          matchdayId: "season-1-md-1",
          discipline1: { disciplineId: "football", playerCount: 4 },
          discipline2: { disciplineId: "cycling", playerCount: 2 },
        },
      ],
      lineupDrafts: [
        {
          lineupId: "lineup-1",
          saveId: "save-1",
          seasonId: "season-1",
          matchdayId: "season-1-md-1",
          teamId: "H-R",
          status: "submitted",
          entries,
          createdAt: "2026-06-20T00:00:00.000Z",
          updatedAt: "2026-06-20T00:00:00.000Z",
        },
      ],
    },
    matchdayState: { matchdayId: "season-1-md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "H-R", shortCode: "H-R", name: "Hell Raisers", budget: 100, cash: 100, identityId: "H-R", humanControlled: true, rosterLimit: 12, logoPath: null }],
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
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
  };
}

describe("matchday-lineup-readiness", () => {
  it("requires both discipline sides to be filled", () => {
    const complete = gameStateWithDraft([
      { disciplineId: "football", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "p1" },
      { disciplineId: "football", disciplineSide: "d1", slotIndex: 1, playerId: "p2", activePlayerId: "p2" },
      { disciplineId: "football", disciplineSide: "d1", slotIndex: 2, playerId: "p3", activePlayerId: "p3" },
      { disciplineId: "football", disciplineSide: "d1", slotIndex: 3, playerId: "p4", activePlayerId: "p4" },
      { disciplineId: "cycling", disciplineSide: "d2", slotIndex: 0, playerId: "p5", activePlayerId: "p5" },
      { disciplineId: "cycling", disciplineSide: "d2", slotIndex: 1, playerId: "p6", activePlayerId: "p6" },
    ]);
    expect(isTeamMatchdayLineupComplete(complete, "H-R")).toBe(true);
    expect(getTeamMatchdayLineupOpenSlots(complete, "H-R")).toBe(0);

    const onlyD1Filled = gameStateWithDraft([
      { disciplineId: "football", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "p1" },
      { disciplineId: "football", disciplineSide: "d1", slotIndex: 1, playerId: "p2", activePlayerId: "p2" },
      { disciplineId: "football", disciplineSide: "d1", slotIndex: 2, playerId: "p3", activePlayerId: "p3" },
      { disciplineId: "football", disciplineSide: "d1", slotIndex: 3, playerId: "p4", activePlayerId: "p4" },
    ]);
    expect(isTeamMatchdayLineupComplete(onlyD1Filled, "H-R")).toBe(false);
    expect(getTeamMatchdayLineupOpenSlots(onlyD1Filled, "H-R")).toBe(2);
  });

  it("does not treat total entry count alone as complete when sides are unbalanced", () => {
    const misleadingCount = gameStateWithDraft([
      { disciplineId: "football", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "p1" },
      { disciplineId: "football", disciplineSide: "d1", slotIndex: 1, playerId: "p2", activePlayerId: "p2" },
      { disciplineId: "football", disciplineSide: "d1", slotIndex: 2, playerId: "p3", activePlayerId: "p3" },
      { disciplineId: "football", disciplineSide: "d1", slotIndex: 3, playerId: "p4", activePlayerId: "p4" },
      { disciplineId: "football", disciplineSide: "d1", slotIndex: 4, playerId: "p5", activePlayerId: "p5" },
      { disciplineId: "football", disciplineSide: "d1", slotIndex: 5, playerId: "p6", activePlayerId: "p6" },
    ]);
    expect(isTeamMatchdayLineupComplete(misleadingCount, "H-R")).toBe(false);
  });
});
