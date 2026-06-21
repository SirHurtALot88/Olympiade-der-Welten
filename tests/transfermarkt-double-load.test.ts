import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildTransfermarktDoubleLoadWarnings } from "@/lib/market/transfermarkt-double-load";

function createGameState(): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      disciplineSchedule: [
        {
          seasonId: "season-1",
          matchdayId: "matchday-1",
          matchdayIndex: 1,
          matchdayLabel: "Spieltag 1",
          discipline1: { disciplineId: "mini-dm", displayName: "Mini DM", order: 1, playerCount: 4, category: "power" },
          discipline2: { disciplineId: "fechten", displayName: "Fechten", order: 2, playerCount: 3, category: "speed" },
          sourceStatus: "season_seed",
          sourceNote: null,
        },
        {
          seasonId: "season-1",
          matchdayId: "matchday-2",
          matchdayIndex: 2,
          matchdayLabel: "Spieltag 2",
          discipline1: { disciplineId: "schach", displayName: "Schach", order: 3, playerCount: 2, category: "mental" },
          discipline2: null,
          sourceStatus: "season_seed",
          sourceNote: null,
        },
      ],
      standings: {},
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [],
    teamIdentities: [],
    players: [],
    disciplines: [
      { id: "mini-dm", name: "Mini DM", category: "power", playerCount: 4 },
      { id: "fechten", name: "Fechten", category: "speed", playerCount: 3 },
      { id: "schach", name: "Schach", category: "mental", playerCount: 2 },
    ],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-11T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      unmappedPlayers: [],
      warnings: [],
      teamCount: 0,
    },
  };
}

describe("transfermarkt double load warnings", () => {
  it("warns from scouting level 3 when two top disciplines happen on the same matchday", () => {
    const warnings = buildTransfermarktDoubleLoadWarnings({
      gameState: createGameState(),
      scoutingLevel: 3,
      topDisciplines: [
        { disciplineId: "mini-dm", disciplineName: "Mini DM" },
        { disciplineId: "fechten", disciplineName: "Fechten" },
        { disciplineId: "schach", disciplineName: "Schach" },
      ],
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.disciplineNames).toEqual(["Mini DM", "Fechten"]);
    expect(warnings[0]?.tooltip).toContain("Doppelbelastung");
  });

  it("keeps the warning hidden before scouting level 3", () => {
    const warnings = buildTransfermarktDoubleLoadWarnings({
      gameState: createGameState(),
      scoutingLevel: 2,
      topDisciplines: [
        { disciplineId: "mini-dm", disciplineName: "Mini DM" },
        { disciplineId: "fechten", disciplineName: "Fechten" },
      ],
    });

    expect(warnings).toEqual([]);
  });
});
