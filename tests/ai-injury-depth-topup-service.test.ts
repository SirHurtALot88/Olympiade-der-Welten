import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, Player, PlayerInjuryHistoryRecord, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { makePlayer, makeRosterEntry, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

const persistenceState = {
  save: null as { saveId: string; gameState: GameState } | null,
};

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById: (saveId: string) => (persistenceState.save?.saveId === saveId ? persistenceState.save : null),
    saveSingleplayerState: (saveId: string, nextState: GameState) => {
      if (persistenceState.save && persistenceState.save.saveId === saveId) {
        persistenceState.save = { ...persistenceState.save, gameState: nextState };
      }
      return persistenceState.save;
    },
    getActiveSave: () => persistenceState.save,
    bootstrapSingleplayerSave: () => ({ save: persistenceState.save, createdFromSeed: false }),
  }),
}));

const SAVE_ID = "save-injury-depth-topup";

function buildInjuryHistory(count: number, teamId: string, seasonId: string): PlayerInjuryHistoryRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    eventId: `inj-${teamId}-${index}`,
    seasonId,
    matchdayId: `matchday-${(index % 10) + 1}`,
    teamId,
    fatigueBefore: 70,
    riskPercent: 15,
    unavailableUntil: null,
    matchdaysMissed: 1,
    injuryRecoveryPct: 50,
    timestamp: new Date().toISOString(),
  }));
}

function buildGameState(input: {
  teams: Team[];
  teamIdentities: TeamIdentity[];
  players: Player[];
  rosters: RosterEntry[];
  teamControlSettings?: GameState["seasonState"]["teamControlSettings"];
}): GameState {
  return {
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    gamePhase: "season_end_management",
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: Object.fromEntries(input.teams.map((team) => [team.teamId, { points: 0 }])),
      seasonSnapshots: [{ seasonId: "season-1", finalStandings: [] }],
      teamControlSettings: input.teamControlSettings,
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: input.teams,
    teamIdentities: input.teamIdentities,
    players: input.players,
    disciplines: [],
    rosters: input.rosters,
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
      teamCount: input.teams.length,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  } as unknown as GameState;
}

/** A stressed roster of 8 players for team T-1, with a configurable previous-season injury count spread across the first two players. */
function buildStressedRoster(teamId: string, prevSeasonInjuryCount: number) {
  const players: Player[] = Array.from({ length: 8 }, (_, index) =>
    makePlayer({
      id: `${teamId}-roster-${index}`,
      name: `${teamId} Roster ${index}`,
      marketValue: 40,
      displayMarketValue: 40,
      salaryDemand: 12,
      displaySalary: 12,
      injuryHistory:
        index === 0
          ? buildInjuryHistory(Math.ceil(prevSeasonInjuryCount / 2), teamId, "season-1")
          : index === 1
            ? buildInjuryHistory(Math.floor(prevSeasonInjuryCount / 2), teamId, "season-1")
            : [],
    }),
  );
  const rosters: RosterEntry[] = players.map((player, index) =>
    makeRosterEntry({
      id: `${teamId}-roster-entry-${index}`,
      teamId,
      playerId: player.id,
      salary: 12,
      upkeep: 12,
      contractLength: 3,
    }),
  );
  return { players, rosters };
}

function buildFreeAgents(prefix: string, values: number[]): Player[] {
  return values.map((marketValue, index) =>
    makePlayer({
      id: `${prefix}-fa-${index}`,
      name: `${prefix} Free Agent ${index}`,
      marketValue,
      displayMarketValue: marketValue,
      salaryDemand: Math.max(1, Math.round(marketValue * 0.3)),
      displaySalary: Math.max(1, Math.round(marketValue * 0.3)),
    }),
  );
}

describe("ai injury depth topup service", { timeout: 20000 }, () => {
  beforeEach(() => {
    persistenceState.save = null;
  });

  it("resolves 0/1/2 extra buy targets from the previous-season injury count thresholds", async () => {
    const { resolveInjuryDepthTopupTargetCount } = await import("@/lib/ai/ai-injury-depth-topup-service");
    expect(resolveInjuryDepthTopupTargetCount(0)).toBe(0);
    expect(resolveInjuryDepthTopupTargetCount(7)).toBe(0);
    expect(resolveInjuryDepthTopupTargetCount(8)).toBe(1);
    expect(resolveInjuryDepthTopupTargetCount(11)).toBe(1);
    expect(resolveInjuryDepthTopupTargetCount(12)).toBe(2);
    expect(resolveInjuryDepthTopupTargetCount(20)).toBe(2);
  });

  it("(a) buys cheap depth players and pays real money for a team with a high previous-season injury count", async () => {
    const { players, rosters } = buildStressedRoster("T-1", 12);
    const freeAgents = buildFreeAgents("cheap", [8, 12, 90]);
    const team = makeTeam({ teamId: "T-1", cash: 400, rosterLimit: 14, humanControlled: false });
    const identity = makeTeamIdentity({ teamId: "T-1", playerMin: 8, playerOpt: 8 });

    persistenceState.save = {
      saveId: SAVE_ID,
      gameState: buildGameState({
        teams: [team],
        teamIdentities: [identity],
        players: [...players, ...freeAgents],
        rosters,
      }),
    };

    const { applyAiInjuryDepthTopup } = await import("@/lib/ai/ai-injury-depth-topup-service");
    const summary = applyAiInjuryDepthTopup({ saveId: SAVE_ID, seasonId: "season-2", aiTeamIds: ["T-1"] });

    expect(summary.playersBoughtTotal).toBe(2);
    const teamResult = summary.teams.find((entry) => entry.teamId === "T-1");
    expect(teamResult?.prevSeasonInjuryCount).toBe(12);
    expect(teamResult?.targetedExtraPlayers).toBe(2);
    // Cheapest two free agents bought, not the expensive one.
    expect(teamResult?.boughtPlayerIds.sort()).toEqual(["cheap-fa-0", "cheap-fa-1"].sort());
    expect(teamResult?.totalSpend).toBe(20);

    const afterState = persistenceState.save!.gameState;
    expect(afterState.rosters.filter((entry) => entry.teamId === "T-1")).toHaveLength(10);
    expect(afterState.teams.find((entry) => entry.teamId === "T-1")?.cash).toBe(400 - 20);
    expect(afterState.rosters.some((entry) => entry.playerId === "cheap-fa-2")).toBe(false);
  });

  it("(b) does not buy anything extra for a team with a normal previous-season injury count", async () => {
    const { players, rosters } = buildStressedRoster("T-2", 3);
    const freeAgents = buildFreeAgents("normal", [8, 12]);
    const team = makeTeam({ teamId: "T-2", cash: 400, rosterLimit: 14, humanControlled: false });
    const identity = makeTeamIdentity({ teamId: "T-2", playerMin: 8, playerOpt: 8 });

    persistenceState.save = {
      saveId: SAVE_ID,
      gameState: buildGameState({
        teams: [team],
        teamIdentities: [identity],
        players: [...players, ...freeAgents],
        rosters,
      }),
    };

    const { applyAiInjuryDepthTopup } = await import("@/lib/ai/ai-injury-depth-topup-service");
    const summary = applyAiInjuryDepthTopup({ saveId: SAVE_ID, seasonId: "season-2", aiTeamIds: ["T-2"] });

    expect(summary.playersBoughtTotal).toBe(0);
    const teamResult = summary.teams.find((entry) => entry.teamId === "T-2");
    expect(teamResult?.skipReason).toBe("prev_season_injury_count_below_threshold");

    const afterState = persistenceState.save!.gameState;
    expect(afterState.rosters.filter((entry) => entry.teamId === "T-2")).toHaveLength(8);
    expect(afterState.teams.find((entry) => entry.teamId === "T-2")?.cash).toBe(400);
  });

  it("(c) skips the buy (without corrupting state) when a stressed team cannot afford even the cheapest candidate", async () => {
    const { players, rosters } = buildStressedRoster("T-3", 12);
    const freeAgents = buildFreeAgents("pricey", [30, 35]);
    const team = makeTeam({ teamId: "T-3", cash: 2, rosterLimit: 14, humanControlled: false });
    const identity = makeTeamIdentity({ teamId: "T-3", playerMin: 8, playerOpt: 8 });

    persistenceState.save = {
      saveId: SAVE_ID,
      gameState: buildGameState({
        teams: [team],
        teamIdentities: [identity],
        players: [...players, ...freeAgents],
        rosters,
      }),
    };

    const { applyAiInjuryDepthTopup } = await import("@/lib/ai/ai-injury-depth-topup-service");
    const summary = applyAiInjuryDepthTopup({ saveId: SAVE_ID, seasonId: "season-2", aiTeamIds: ["T-3"] });

    expect(summary.playersBoughtTotal).toBe(0);
    const teamResult = summary.teams.find((entry) => entry.teamId === "T-3");
    expect(teamResult?.targetedExtraPlayers).toBe(2);
    expect(teamResult?.boughtPlayerIds).toEqual([]);
    expect(teamResult?.skipReason).toBe("no_affordable_cheap_candidate");

    const afterState = persistenceState.save!.gameState;
    expect(afterState.rosters.filter((entry) => entry.teamId === "T-3")).toHaveLength(8);
    expect(afterState.teams.find((entry) => entry.teamId === "T-3")?.cash).toBe(2);
  });

  it("(d) never buys for a human/manual team, even with a high injury count and ample cash", async () => {
    const { players, rosters } = buildStressedRoster("T-4", 12);
    const freeAgents = buildFreeAgents("human-cheap", [8, 12]);
    const team = makeTeam({ teamId: "T-4", cash: 400, rosterLimit: 14, humanControlled: true });
    const identity = makeTeamIdentity({ teamId: "T-4", playerMin: 8, playerOpt: 8 });

    persistenceState.save = {
      saveId: SAVE_ID,
      gameState: buildGameState({
        teams: [team],
        teamIdentities: [identity],
        players: [...players, ...freeAgents],
        rosters,
        teamControlSettings: {
          "T-4": {
            teamId: "T-4",
            controlMode: "manual",
            ownerId: "user_local",
            ownerSlot: "user",
            displayLabel: "T-4",
            aiLineupPreviewEnabled: false,
            aiLineupApplyEnabled: false,
            aiLineupAutoApplyEnabled: false,
            aiTransferPreviewEnabled: false,
            aiTransferAutoApplyEnabled: false,
            aiSellPreviewEnabled: false,
            aiSellAutoApplyEnabled: false,
            notes: null,
            strategyLock: null,
          },
        },
      }),
    };

    const { applyAiInjuryDepthTopup } = await import("@/lib/ai/ai-injury-depth-topup-service");
    // Even if a caller mistakenly includes the human team in aiTeamIds, the service must still
    // refuse to buy for it (defense in depth on top of the caller's own AI-only scoping).
    const summary = applyAiInjuryDepthTopup({ saveId: SAVE_ID, seasonId: "season-2", aiTeamIds: ["T-4"] });

    expect(summary.playersBoughtTotal).toBe(0);
    const teamResult = summary.teams.find((entry) => entry.teamId === "T-4");
    expect(teamResult?.skipReason).toBe("not_ai_controlled");

    const afterState = persistenceState.save!.gameState;
    expect(afterState.rosters.filter((entry) => entry.teamId === "T-4")).toHaveLength(8);
    expect(afterState.teams.find((entry) => entry.teamId === "T-4")?.cash).toBe(400);
  });

  it("(e) respects the roster maximum and does not buy once the team is already full", async () => {
    const { players: baseRosterPlayers, rosters: baseRosterEntries } = buildStressedRoster("T-5", 12);
    // Fill the roster up to rosterLimit (14) so there is no room left for extra depth buys.
    const fillerPlayers: Player[] = Array.from({ length: 6 }, (_, index) =>
      makePlayer({ id: `T-5-filler-${index}`, name: `T-5 Filler ${index}`, marketValue: 20, displayMarketValue: 20, salaryDemand: 6, displaySalary: 6 }),
    );
    const fillerRosterEntries: RosterEntry[] = fillerPlayers.map((player, index) =>
      makeRosterEntry({ id: `T-5-filler-entry-${index}`, teamId: "T-5", playerId: player.id, salary: 6, upkeep: 6 }),
    );
    const freeAgents = buildFreeAgents("full-team-cheap", [8, 12]);
    const team = makeTeam({ teamId: "T-5", cash: 400, rosterLimit: 14, humanControlled: false });
    const identity = makeTeamIdentity({ teamId: "T-5", playerMin: 8, playerOpt: 8 });

    persistenceState.save = {
      saveId: SAVE_ID,
      gameState: buildGameState({
        teams: [team],
        teamIdentities: [identity],
        players: [...baseRosterPlayers, ...fillerPlayers, ...freeAgents],
        rosters: [...baseRosterEntries, ...fillerRosterEntries],
      }),
    };

    const rosterCountBefore = persistenceState.save.gameState.rosters.filter((entry) => entry.teamId === "T-5").length;
    expect(rosterCountBefore).toBe(14);

    const { applyAiInjuryDepthTopup } = await import("@/lib/ai/ai-injury-depth-topup-service");
    const summary = applyAiInjuryDepthTopup({ saveId: SAVE_ID, seasonId: "season-2", aiTeamIds: ["T-5"] });

    expect(summary.playersBoughtTotal).toBe(0);
    const teamResult = summary.teams.find((entry) => entry.teamId === "T-5");
    expect(teamResult?.skipReason).toBe("roster_limit_reached");

    const afterState = persistenceState.save!.gameState;
    expect(afterState.rosters.filter((entry) => entry.teamId === "T-5")).toHaveLength(14);
    expect(afterState.teams.find((entry) => entry.teamId === "T-5")?.cash).toBe(400);
  });
});
