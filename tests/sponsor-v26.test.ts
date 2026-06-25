import { describe, expect, it } from "vitest";

import { buildSponsorOffersForTeam } from "@/lib/sponsor/sponsor-offer-service";
import { rollSponsorStarTiers } from "@/lib/sponsor/sponsor-tier-pool";
import type { GameState, Team } from "@/lib/data/olyDataTypes";

function team(): Team {
  return {
    teamId: "M-M",
    shortCode: "M-M",
    name: "Mayhem Mavericks",
    budget: 500,
    cash: 300,
    identityId: "M-M",
    humanControlled: true,
    rosterLimit: 12,
  };
}

function baseGameState(): GameState {
  return {
    gamePhase: "season_active",
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["season-2-md-1"] },
    seasonState: { seasonId: "season-2", schedule: [], standings: {} },
    matchdayState: { matchdayId: "season-2-md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [team()],
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

describe("sponsor tier pool v2.6", () => {
  it("allows five-star offers for elite commercial ratings via luck roll", () => {
    const samples = Array.from({ length: 24 }, (_, index) =>
      rollSponsorStarTiers({ seasonId: `season-luck-${index}`, teamId: "M-M", commercialRating: 95 }),
    );
    expect(samples.some((tiers) => tiers.includes(5))).toBe(true);
  });

  it("deduplicates sponsor brands across the three offer slots", () => {
    const offers = buildSponsorOffersForTeam({ gameState: baseGameState(), teamId: "M-M" });
    const brandIds = offers.map((offer) => offer.sponsorBrandId).filter(Boolean);
    expect(new Set(brandIds).size).toBe(brandIds.length);
  });
});
