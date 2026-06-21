import { describe, expect, it } from "vitest";

import type { GameState, Team } from "@/lib/data/olyDataTypes";
import {
  buildDerivedTeamRelationshipEvents,
  buildTeamRelationshipCards,
  upsertTeamRelationshipEvents,
} from "@/lib/rivalries/team-relationship-dynamics";

function team(teamId: string, name: string): Team {
  return {
    teamId,
    shortCode: teamId,
    name,
    budget: 100,
    cash: 50,
    identityId: teamId,
    humanControlled: false,
    rosterLimit: 12,
  };
}

function gameState(): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      matchdayResults: [
        {
          id: "result-1",
          saveId: "save-1",
          seasonId: "season-1",
          matchdayId: "md-1",
          status: "preview_applied",
          sourceVersion: "test",
          teamsTotal: 3,
          teamsReady: 3,
          teamsUnderfilled: 0,
          teamsMissingLineup: 0,
          teamsInvalidLineup: 0,
          teamsMissingScoreCoverage: 0,
          warningsCount: 0,
          createdAt: "2026-06-20T10:00:00.000Z",
          updatedAt: "2026-06-20T10:00:00.000Z",
        },
      ],
      disciplineResults: [
        {
          id: "dr-r-r",
          matchdayResultId: "result-1",
          teamId: "R-R",
          disciplineId: "basketball",
          disciplineSide: "d1",
          rank: 2,
          baseScore: 80,
          totalScore: 80,
          readinessStatus: "ready",
          warnings: [],
          createdAt: "2026-06-20T10:00:00.000Z",
        },
        {
          id: "dr-n-w",
          matchdayResultId: "result-1",
          teamId: "N-W",
          disciplineId: "basketball",
          disciplineSide: "d1",
          rank: 3,
          baseScore: 75,
          totalScore: 75,
          readinessStatus: "ready",
          warnings: [],
          createdAt: "2026-06-20T10:00:00.000Z",
        },
        {
          id: "dr-p-c",
          matchdayResultId: "result-1",
          teamId: "P-C",
          disciplineId: "basketball",
          disciplineSide: "d1",
          rank: 1,
          baseScore: 100,
          totalScore: 100,
          readinessStatus: "ready",
          warnings: [],
          createdAt: "2026-06-20T10:00:00.000Z",
        },
      ],
    },
    matchdayState: { matchdayId: "md-1", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      team("R-R", "Riptide Rivers"),
      team("N-W", "Natures Wrath"),
      team("P-C", "Pirate Crew"),
    ],
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-20T10:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 3,
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

describe("team relationship dynamics", () => {
  it("marks allies and rivals at the 4/-4 thresholds and flags matchday changes", () => {
    const state = gameState();
    const events = buildDerivedTeamRelationshipEvents(state);
    const cards = buildTeamRelationshipCards(state, "R-R");

    expect(events.some((event) => event.fromTeamId === "R-R" && event.toTeamId === "N-W" && event.reason === "ally_shared_success")).toBe(true);
    expect(events.some((event) => event.fromTeamId === "R-R" && event.toTeamId === "P-C" && event.reason === "rivalry_loss")).toBe(true);
    expect(cards.allies[0]).toMatchObject({ teamId: "N-W", type: "ally", changed: true, changeLabel: "+0.3" });
    expect(cards.rivals[0]).toMatchObject({ teamId: "P-C", type: "rival", changed: true, changeLabel: "-0.6" });
  });

  it("persists derived matchday relationship events idempotently", () => {
    const state = gameState();
    const firstApply = upsertTeamRelationshipEvents(state);
    const secondApply = upsertTeamRelationshipEvents(firstApply.gameState);

    expect(firstApply.generatedEvents.length).toBeGreaterThan(0);
    expect(firstApply.generatedEvents.every((event) => event.source === "matchday_result")).toBe(true);
    expect(firstApply.insertedEvents).toBe(firstApply.generatedEvents.length);
    expect(secondApply.gameState.seasonState.teamRelationshipEvents).toHaveLength(firstApply.generatedEvents.length);
    expect(secondApply.insertedEvents).toBe(0);
  });
});
