import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  advanceScoutIntelTick,
  getEffectiveScoutingLevel,
  refreshScoutPipeline,
} from "@/lib/scouting/facility-scout-pipeline-service";
import { addScoutingWatchlistEntry } from "@/lib/scouting/scouting-watchlist-service";

function createGameState(): GameState {
  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamFacilities: {
        "M-M": {
          facilities: {
            scouting_office: { level: 3, enabled: true },
          },
        },
      },
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "M-M", name: "Mayhem", shortCode: "M-M", budget: 100, cash: 50, identityId: "M-M", humanControlled: true, rosterLimit: 14 }],
    teamIdentities: [],
    players: [
      {
        id: "p-1",
        name: "Scout Target",
        rating: 60,
        marketValue: 20,
        salaryDemand: 2,
        pps: null,
        ovr: null,
        className: "Runner",
        race: "Human",
        alignment: "neutral",
        gender: "n/a",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
        preferredDisciplineIds: [],
        disciplineRatings: {},
        disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 0,
        form: 0,
        potential: 70,
        trainingMode: null,
        currentXP: 0,
      },
    ],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-25T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 1,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
    },
    disciplines: [],
  } as GameState;
}

describe("facility scout pipeline service", () => {
  it("starts watchlist intel and advances certainty on tick", () => {
    let gameState = addScoutingWatchlistEntry({ gameState: createGameState(), teamId: "M-M", playerId: "p-1" });
    gameState = refreshScoutPipeline(gameState, "M-M");
    expect(getEffectiveScoutingLevel(gameState, "M-M", "p-1")).toBeGreaterThanOrEqual(3);
    gameState = advanceScoutIntelTick({ gameState, teamId: "M-M", phase: "matchday" });
    const records = gameState.seasonState.scoutIntelByTeamId?.["M-M"] ?? [];
    expect(records.find((entry) => entry.playerId === "p-1")?.certainty).toBeGreaterThan(0);
  });
});
