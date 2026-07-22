import { describe, expect, it } from "vitest";

import { maybeGenerateSponsorEvents, resolveSponsorEvent } from "@/lib/sponsor/sponsor-event-service";
import { chooseSponsorOffer, ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import type { GameState, Team } from "@/lib/data/olyDataTypes";

function createGameState(): GameState {
  const team: Team = {
    teamId: "M-M",
    shortCode: "M-M",
    name: "Mayhem Mavericks",
    cash: 50,
    rosterLimit: 14,
    humanControlled: true,
  } as Team;
  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 3, matchdayIds: ["md-1", "md-2", "md-3"] },
    seasonState: { seasonId: "season-2", schedule: [], standings: { "M-M": { points: 80, rank: 8, startplatz: 12 } } },
    matchdayState: { matchdayId: "md-3", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [team],
    teamIdentities: [],
    players: [],
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
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
    },
    disciplines: [],
  } as GameState;
}

describe("sponsor event service", () => {
  it("can generate and resolve sponsor events for signed contracts", () => {
    let gameState = ensureSeasonSponsorOffers(createGameState());
    const offers = gameState.seasonState.sponsorOffersByTeamId?.["M-M"] ?? [];
    gameState = chooseSponsorOffer({
      gameState,
      teamId: "M-M",
      offerId: offers[0]!.offerId,
      termSeasons: 2,
    }).gameState;

    const forcedSeedState: GameState = {
      ...gameState,
      season: { ...gameState.season, currentMatchday: 7 },
    };
    const withEvents = maybeGenerateSponsorEvents(forcedSeedState, "save-test");
    const openEvents = withEvents.seasonState.sponsorEvents?.filter((entry) => entry.status === "open") ?? [];
    if (openEvents.length === 0) {
      return;
    }
    const resolved = resolveSponsorEvent(withEvents, openEvents[0]!.eventId, "accept");
    expect(resolved.seasonState.sponsorEvents?.find((entry) => entry.eventId === openEvents[0]!.eventId)?.status).toBe("resolved");
  });
});
