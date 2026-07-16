import { describe, expect, it } from "vitest";

import {
  createGameStateFromSeed,
  createSaveGameState,
  loadFreshSeasonOneSeedData,
  loadSeedData,
  loadSourceTeams,
  loadSourceTeamIdentities,
  summarizeTeamRosterCoverage,
} from "@/lib/data/dataAdapter";

describe("data adapter", () => {
  it("loads seed data and creates a game state", () => {
    const seed = loadSeedData();
    const gameState = createGameStateFromSeed(seed);

    expect(gameState.teams.length).toBeGreaterThan(1);
    expect(gameState.players.length).toBeGreaterThan(1);
    expect(gameState.seasonState.schedule.length).toBeGreaterThan(0);
    expect(gameState.mappingReport.matchedRosterCount).toBeGreaterThan(1);
    expect(gameState.transferHistory.length).toBeGreaterThan(1);
  });

  it("wraps game state into save game state", () => {
    const save = createSaveGameState();

    expect(save.saveId).toBeTruthy();
    expect(save.gameState.season.id).toBe("season-1");
  });

  it("parses team identities for every team with valid player bounds", () => {
    const identities = loadSourceTeamIdentities();

    expect(identities.length).toBeGreaterThan(10);
    expect(identities.every((identity) => identity.playerMin <= identity.playerOpt)).toBe(true);
  });

  it("warns when a player has no team or a team has no players", () => {
    const seed = loadSeedData();
    const syntheticTeams = [
      ...seed.teams,
      { teamId: "TEST", shortCode: "TEST", name: "Test Team", budget: 1, cash: 1, identityId: "TEST", humanControlled: false, rosterLimit: 10 },
    ];
    const syntheticPlayers = seed.players.slice(0, 2);
    const syntheticRosters = [
      {
        id: "roster-test-1",
        teamId: seed.teams[0].teamId,
        playerId: syntheticPlayers[0].id,
        contractLength: 2,
        salary: syntheticPlayers[0].salaryDemand,
        upkeep: syntheticPlayers[0].salaryDemand,
        purchasePrice: syntheticPlayers[0].marketValue,
        currentValue: syntheticPlayers[0].marketValue,
        roleTag: "starter" as const,
        joinedSeasonId: "season-1",
      },
    ];

    const summary = summarizeTeamRosterCoverage(syntheticTeams, syntheticPlayers, syntheticRosters);

    expect(summary.unmappedPlayers).toContain(syntheticPlayers[1].name);
    expect(summary.teamsWithoutPlayers).toContain("TEST");
  });

  it("overlays team budgets from the season management startbudget reference", () => {
    const teams = loadSourceTeams();

    expect(teams).toHaveLength(32);
    expect(teams.find((team) => team.teamId === "A-A")?.budget).toBe(225);
    expect(teams.find((team) => team.teamId === "B-P")?.budget).toBe(325);
    expect(teams.find((team) => team.teamId === "C-C")?.budget).toBe(265);
    expect(teams.find((team) => team.teamId === "C-S")?.budget).toBe(365);
  });

  it("carries startbudget values into the seeded game state", () => {
    const seed = loadSeedData();
    const gameState = createGameStateFromSeed(seed);

    expect(seed.teams.find((team) => team.teamId === "A-A")?.budget).toBe(225);
    expect(gameState.teams.find((team) => team.teamId === "A-A")?.budget).toBe(225);
    expect(gameState.teams.find((team) => team.teamId === "B-P")?.budget).toBe(325);
  });

  it("builds a fresh season one seed without inherited transfer history", () => {
    const seed = loadFreshSeasonOneSeedData();
    const gameState = createGameStateFromSeed(seed);

    expect(seed.teams).toHaveLength(32);
    expect(seed.transferHistory).toHaveLength(0);
    expect(gameState.transferHistory).toHaveLength(0);
    expect(gameState.teams.every((team) => team.cash === team.budget)).toBe(true);
    expect(
      Object.values(gameState.seasonState.standings).every((standing) => (standing.points ?? 0) === 0),
    ).toBe(true);
  });
});
