import { describe, expect, it } from "vitest";

import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { buildPlayerDrawerDataFromGameState } from "@/lib/foundation/player-detail-drawer";
import { buildPlayerAxisStarProfile, revealAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import { buildPlayerStarScoutingSnapshot } from "@/lib/scouting/player-star-scouting-bridge";

function team(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "M-M",
    shortCode: partial?.shortCode ?? "M-M",
    name: partial?.name ?? "Mayhem Mavericks",
    budget: partial?.budget ?? 500,
    cash: partial?.cash ?? 300,
    identityId: partial?.identityId ?? "M-M",
    humanControlled: partial?.humanControlled ?? true,
    rosterLimit: partial?.rosterLimit ?? 12,
    ...partial,
  };
}

function player(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    rating: 72,
    marketValue: 18,
    salaryDemand: 3,
    pps: null,
    ovr: null,
    className: "Runner",
    race: "Human",
    alignment: "neutral",
    gender: "n/a",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 62, spe: 58, men: 55, soc: 52 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    trainingMode: "mittel",
    ...overrides,
  };
}

function gameState(partial?: Partial<GameState>): GameState {
  const teams = partial?.teams ?? [team()];
  const players = partial?.players ?? [player("p-1")];
  return {
    gamePhase: "season_active",
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["season-2-md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamFacilities: {
        "M-M": {
          teamId: "M-M",
          seasonId: "season-2",
          facilities: {
            scouting_office: { facilityId: "scouting_office", level: 3, variant: null, disabledReason: null },
            training_center: { facilityId: "training_center", level: 2, variant: null, disabledReason: null },
          },
        },
      },
      scoutIntelByTeamId: {
        "M-M": [
          {
            id: "intel-1",
            saveId: "save-1",
            seasonId: "season-2",
            teamId: "M-M",
            playerId: "p-1",
            playerName: "p-1",
            certainty: 60,
            source: "watchlist",
            createdAt: "2026-06-12T00:00:00.000Z",
            updatedAt: "2026-06-12T00:00:00.000Z",
          },
        ],
      },
      ...(partial?.seasonState ?? {}),
    },
    matchdayState: {
      matchdayId: "season-2-md-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
      ...(partial?.matchdayState ?? {}),
    },
    teams,
    teamIdentities: [],
    players,
    disciplines: [],
    rosters: partial?.rosters ?? [
      {
        id: "r-1",
        teamId: "M-M",
        playerId: "p-1",
        contractLength: 2,
        salary: 3,
        upkeep: 3,
        purchasePrice: 18,
        currentValue: 18,
        roleTag: "starter",
        joinedSeasonId: "season-2",
      },
    ],
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
      teamCount: teams.length,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
    ...partial,
  };
}

describe("player star scouting integration", () => {
  it("builds snapshot with axis and potential labels", () => {
    const state = gameState();
    const snapshot = buildPlayerStarScoutingSnapshot({
      gameState: state,
      player: state.players[0]!,
      saveId: state.season.id,
      scoutingLevel: 4,
    });

    expect(snapshot.revealedCurrentStars.displayLabel.length).toBeGreaterThan(0);
    expect(snapshot.potentialGap).toBeGreaterThanOrEqual(0);
  });

  it("feeds drawer with effective scouting level and axis displays", () => {
    const state = gameState();
    const drawer = buildPlayerDrawerDataFromGameState({
      gameState: state,
      playerId: "p-1",
      source: "sqlite",
      manageableTeamIds: ["M-M"],
    });

    expect(drawer?.effectiveScoutingLevel).toBeGreaterThan(0);
    expect(drawer?.axisStarsDisplay).toBeTruthy();
    expect(drawer?.potentialStarsDisplay).toBeTruthy();
  });

  it("blurs axis stars at scouting level 3 but not at level 5", () => {
    const state = gameState();
    const profile = buildPlayerAxisStarProfile({
      gameState: state,
      player: state.players[0]!,
      disciplines: state.disciplines,
    });
    const blurred = revealAxisStarProfile({ profile, scoutingLevel: 3 });
    const exact = revealAxisStarProfile({ profile, scoutingLevel: 5 });
    expect(blurred.pow).not.toBeNull();
    expect(exact.pow).toBe(profile.pow);
  });
});
