import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildScoutingHubTargetSections } from "@/lib/scouting/scouting-hub-targets-service";

function createGameState(input?: {
  scoutingLevel?: number;
  wishlist?: Array<{ playerId: string; createdAt: string }>;
  rosterCount?: number;
  seasonId?: string;
}): GameState {
  const scoutingLevel = input?.scoutingLevel ?? 1;
  const wishlist =
    input?.wishlist?.map((entry, index) => ({
      id: `w-${index}`,
      saveId: "save",
      seasonId: input?.seasonId ?? "season-1",
      teamId: "M-M",
      playerId: entry.playerId,
      playerName: entry.playerId,
      className: "Hero",
      race: "Human",
      marketValue: 10,
      salary: 2,
      createdAt: entry.createdAt,
    })) ?? [];

  return {
    gamePhase: "season_active",
    season: { id: input?.seasonId ?? "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: input?.seasonId ?? "season-1",
      schedule: [],
      standings: {},
      transferWishlist: wishlist,
      teamFacilities: {
        "M-M": {
          facilities: {
            scouting_office: { level: scoutingLevel, enabled: true },
          },
        },
      },
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "M-M", name: "Mayhem", shortCode: "M-M", budget: 100, cash: 50, identityId: "M-M", humanControlled: true, rosterLimit: 14 }],
    teamIdentities: [{ teamId: "M-M", playerMin: 7, playerOpt: 10, pow: 5, spe: 5, men: 5, soc: 5, ambition: 5, finances: 5, boardConfidence: 5, harmony: 5, manners: 5, popularity: 5, cooperation: 5, playerType: null }],
    players: wishlist.map((entry) => ({
      id: entry.playerId,
      name: entry.playerName,
      rating: 60,
      marketValue: 10,
      salaryDemand: 2,
      className: "Hero",
      race: "Human",
      alignment: "N",
      gender: "x",
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
    })),
    rosters: Array.from({ length: input?.rosterCount ?? 10 }, (_, index) => ({
      id: `roster-${index}`,
      teamId: "M-M",
      playerId: `roster-${index}`,
      contractLength: 1,
      salary: 2,
      upkeep: 2,
      purchasePrice: 10,
      currentValue: 10,
      roleTag: "starter",
      joinedSeasonId: "season-1",
    })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-25T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
    },
    disciplines: [],
  } as GameState;
}

describe("scouting hub targets service", () => {
  it("splits active pipeline targets from bookmark-only wishlist entries", () => {
    const gameState = createGameState({
      scoutingLevel: 0,
      rosterCount: 10,
      wishlist: [
        { playerId: "p-1", createdAt: "2026-06-25T00:00:00.000Z" },
        { playerId: "p-2", createdAt: "2026-06-25T01:00:00.000Z" },
        { playerId: "p-3", createdAt: "2026-06-25T02:00:00.000Z" },
        { playerId: "p-4", createdAt: "2026-06-25T03:00:00.000Z" },
        { playerId: "p-5", createdAt: "2026-06-25T04:00:00.000Z" },
      ],
    });

    const sections = buildScoutingHubTargetSections({
      gameState,
      teamId: "M-M",
      resolveMarketEntry: (playerId) => ({
        playerName: playerId,
        className: "Hero",
        marketValue: "10M",
      }),
    });

    expect(sections.activeTargets.map((entry) => entry.playerId)).toEqual(["p-1", "p-2", "p-3", "p-4"]);
    expect(sections.activeTargets.every((entry) => entry.scoutStatus === "active")).toBe(true);
    expect(sections.bookmarkedTargets.map((entry) => entry.playerId)).toEqual(["p-5"]);
    expect(sections.bookmarkedTargets[0]?.scoutStatus).toBe("bookmarked");
  });
});
