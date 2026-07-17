import { describe, expect, it } from "vitest";

import type { GameState, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import {
  buildSponsorOffersForTeam,
  chooseSponsorOffer,
  chooseSponsorOfferForAiTeams,
  ensureSeasonSponsorOffers,
  getTeamSponsorContract,
} from "@/lib/sponsor/sponsor-offer-service";
import { applySponsorSettlement, previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { buildTeamObjectiveOverview } from "@/lib/board/team-season-objectives-service";

function createTeam(partial: Partial<Team> = {}): Team {
  return {
    teamId: partial.teamId ?? "M-M",
    name: partial.name ?? "Mayhem Mavericks",
    shortCode: partial.shortCode ?? "M-M",
    cash: partial.cash ?? 50,
    rosterLimit: partial.rosterLimit ?? 14,
    humanControlled: partial.humanControlled ?? true,
  } as Team;
}

function createIdentity(teamId: string, partial: Partial<TeamIdentity> = {}): TeamIdentity {
  return {
    teamId,
    ambition: partial.ambition ?? 8,
    finances: partial.finances ?? 5,
    pow: partial.pow ?? 5,
    spe: partial.spe ?? 5,
    men: partial.men ?? 5,
    soc: partial.soc ?? 5,
    playerMin: partial.playerMin ?? 7,
    playerOpt: partial.playerOpt ?? 10,
  } as TeamIdentity;
}

function createGameState(partial?: Partial<GameState>): GameState {
  const teams = Array.from({ length: 12 }, (_, index) =>
    createTeam({
      teamId: index === 0 ? "M-M" : `T-${index + 1}`,
      name: index === 0 ? "Mayhem Mavericks" : `Team ${index + 1}`,
      shortCode: index === 0 ? "M-M" : `T${index + 1}`,
      cash: index === 0 ? 50 : 20 + index * 4,
    }),
  );
  const teamIdentities = teams.map((team, index) =>
    createIdentity(team.teamId, {
      ambition: index === 0 ? 8 : 5,
      finances: index === 0 ? 5 : 4,
    }),
  );
  const standings = Object.fromEntries(
    teams.map((team, index) => [
      team.teamId,
      {
        points: index === 0 ? 80 : 120 - index * 5,
        rank: index === 0 ? 8 : index + 1,
        startplatz: index === 0 ? 12 : index + 1,
      },
    ]),
  );

  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings,
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    teamIdentities,
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
      teamCount: teams.length,
      unmappedPlayers: [],
    },
    disciplines: [],
    ...partial,
  } as GameState;
}

describe("sponsor offer service", () => {
  it("generates three distinct sponsor archetypes per team", () => {
    const gameState = ensureSeasonSponsorOffers(createGameState());
    const offers = buildSponsorOffersForTeam({ gameState, teamId: "M-M" });
    expect(offers).toHaveLength(5);
    // 5 Angebote aus 3 Typen (2× security, 1× identity, 2× performance) → weiterhin genau 3 distinkte Archetypen.
    expect(new Set(offers.map((offer) => offer.archetype)).size).toBe(3);
    expect(offers.every((offer) => offer.starTier != null && offer.starTier >= 1 && offer.starTier <= 5)).toBe(true);
    expect(offers.find((offer) => offer.archetype === "security")?.components.find((c) => c.kind === "base")?.rewardCash).toBeGreaterThan(
      offers.find((offer) => offer.archetype === "performance")?.components.find((c) => c.kind === "base")?.rewardCash ?? 0,
    );
  });

  it("persists sponsor choice and pays first base installment", () => {
    const gameState = ensureSeasonSponsorOffers(createGameState());
    const offers = buildSponsorOffersForTeam({ gameState, teamId: "M-M" });
    const security = offers.find((offer) => offer.archetype === "security");
    expect(security).toBeTruthy();
    const result = chooseSponsorOffer({ gameState, teamId: "M-M", offerId: security!.offerId });
    const contract = getTeamSponsorContract(result.gameState, "M-M");
    expect(contract?.name).toBe(security!.name);
    expect(contract?.archetype).toBe("security");
    expect(contract?.payouts.baseFirstPaid).toBe(true);
    expect(result.gameState.teams[0]?.cash).toBeGreaterThan(50);
  });

  it("auto-selects sponsor contracts for ai teams", () => {
    const gameState = createGameState({
      teams: [createTeam({ humanControlled: false, teamId: "A-A", shortCode: "A-A", name: "AI Team" })],
      teamIdentities: [createIdentity("A-A", { ambition: 9 })],
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: { "A-A": { points: 40, rank: 20, startplatz: 22 } },
        teamControlSettings: {
          "A-A": {
            teamId: "A-A",
            controlMode: "ai",
            ownerId: "ai",
            ownerSlot: "ai",
            aiLineupPreviewEnabled: true,
          },
        },
      },
    });
    const next = chooseSponsorOfferForAiTeams(ensureSeasonSponsorOffers(gameState));
    expect(getTeamSponsorContract(next, "A-A")).not.toBeNull();
  });
});

describe("sponsor settlement service", () => {
  it("settles rank and improvement components at season end", () => {
    let gameState = ensureSeasonSponsorOffers(createGameState());
    const offer = buildSponsorOffersForTeam({ gameState, teamId: "M-M" }).find((entry) => entry.archetype === "performance");
    gameState = chooseSponsorOffer({ gameState, teamId: "M-M", offerId: offer!.offerId }).gameState;
    const preview = previewSponsorSettlement(gameState, "season_end");
    expect(preview.rows.some((row) => row.kind === "rank")).toBe(true);
    const applied = applySponsorSettlement({ gameState, saveId: "save-1", execute: true });
    expect(applied.applied).toBe(true);
    expect(applied.gameState.seasonState.sponsorPayoutLogs?.some((log) => log.phase === "season_end")).toBe(true);
  });
});

describe("sponsor board objectives", () => {
  it("adds sponsor objectives after contract selection", () => {
    let gameState = ensureSeasonSponsorOffers(createGameState());
    const offer = buildSponsorOffersForTeam({ gameState, teamId: "M-M" })[0]!;
    gameState = chooseSponsorOffer({ gameState, teamId: "M-M", offerId: offer.offerId }).gameState;
    const overview = buildTeamObjectiveOverview(gameState);
    const sponsorObjectives = overview.objectives.filter((objective) => objective.teamId === "M-M" && objective.category === "sponsor");
    expect(sponsorObjectives.length).toBeGreaterThanOrEqual(4);
  });

  it("shows sponsor choice pending objective without contract", () => {
    const overview = buildTeamObjectiveOverview(ensureSeasonSponsorOffers(createGameState()));
    expect(
      overview.objectives.some(
        (objective) => objective.teamId === "M-M" && objective.objectiveId === "sponsor-choice-pending",
      ),
    ).toBe(true);
  });
});
