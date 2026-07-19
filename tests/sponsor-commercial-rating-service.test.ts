import { describe, expect, it } from "vitest";

import type { GameState, Team } from "@/lib/data/olyDataTypes";
import { buildSponsorCommercialRating } from "@/lib/sponsor/sponsor-commercial-rating-service";

function createGameState(partial?: Partial<GameState>): GameState {
  const team: Team = {
    teamId: "M-M",
    name: "Mayhem",
    shortCode: "M-M",
    budget: 300,
    cash: 80,
    identityId: "M-M",
    humanControlled: true,
    rosterLimit: 14,
  };
  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: { "M-M": { points: 90, rank: 4, startplatz: 8 } },
      seasonSnapshots: [
        {
          seasonId: "season-1",
          seasonName: "Season 1",
          finalStandings: [{ teamId: "M-M", teamCode: "M-M", teamName: "Mayhem", rank: 8, points: 70, disciplinePoints: 70, disciplinePointsByArea: { pow: 0, spe: 0, men: 0, soc: 0 }, cashEnd: 50, rosterEnd: 12, salaryEnd: 10, marketValueEnd: 120, transferCount: 0, transferBuyCount: 0, transferSellCount: 0, transferNet: 0, isGold: false, isSilver: false, isBronze: false, isTop5: false, isTop10: true }],
        },
      ],
      ...(partial?.seasonState ?? {}),
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [team],
    teamIdentities: [{ teamId: "M-M", ambition: 9, finances: 6, pow: 8, spe: 7, men: 7, soc: 6, playerMin: 10, playerOpt: 12 }],
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
    ...partial,
  } as GameState;
}

describe("sponsor commercial rating service", () => {
  it("builds a higher rating for strong recent performance and prestige", () => {
    const rating = buildSponsorCommercialRating({ gameState: createGameState(), teamId: "M-M" });
    expect(rating.score).toBeGreaterThan(40);
    // Rarity-keyed equivalent of the old "tierHint >= 2" check — same score->rarity breakpoints.
    expect(rating.rarityHint).toBe(
      rating.score >= 86 ? "legendär" : rating.score >= 71 ? "selten" : rating.score >= 51 ? "magisch" : "gewöhnlich",
    );
    expect(rating.breakdown.recentPerformance).toBeGreaterThan(0);
  });
});
