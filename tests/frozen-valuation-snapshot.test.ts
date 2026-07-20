import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import {
  buildFrozenValuationSnapshot,
  getFrozenRatingRowsMap,
  isValuationFrozen,
} from "@/lib/season/frozen-valuation-snapshot";

function createTeam(): Team {
  return {
    teamId: "A-A",
    shortCode: "A-A",
    name: "Armageddon Aftermath",
    budget: 175,
    cash: 175,
    identityId: "A-A",
    humanControlled: true,
    rosterLimit: 32,
    logoPath: null,
  } as unknown as Team;
}

function createPlayer(id: string, index: number): Player {
  // Identical core stats / market value → single shared sale bracket; only performance scores differ.
  return {
    id,
    name: `Player ${id}`,
    rating: 70,
    marketValue: 60,
    salaryDemand: 10,
    displayMarketValue: 60,
    displaySalary: 10,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "f",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 55, spe: 55, men: 55, soc: 55 },
    preferredDisciplineIds: [],
    disciplineRatings: { d1: 70, d2: 65 },
    disciplineTierCounts: { above20: 2, above40: 2, above60: 2, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  } as unknown as Player;
}

function createRoster(id: string, playerId: string): RosterEntry {
  return {
    id,
    teamId: "A-A",
    playerId,
    contractLength: 3,
    salary: 10,
    upkeep: 10,
    purchasePrice: 60,
    currentValue: 60,
    roleTag: "starter",
    joinedSeasonId: "season-1",
  } as unknown as RosterEntry;
}

const POOL_SIZE = 16;

function createGameState(input?: { gamePhase?: GameState["gamePhase"]; seasonId?: string }): GameState {
  const seasonId = input?.seasonId ?? "season-1";
  const players = Array.from({ length: POOL_SIZE }, (_, index) => createPlayer(`p${index + 1}`, index));
  const rosters = players.map((player, index) => createRoster(`r${index + 1}`, player.id));
  const performances = players.map((player, index) => ({
    id: `perf-${index + 1}`,
    matchdayResultId: "result-1",
    teamId: "A-A",
    playerId: player.id,
    activePlayerId: rosters[index]!.id,
    disciplineId: "d1",
    disciplineSide: "d1" as const,
    slotIndex: index,
    baseValue: 80,
    finalPlayerScore: 100 - index * 3,
    scoreContribution: 100 - index * 3,
    rankInTeam: index + 1,
    rankInDiscipline: index + 1,
    isTop10: true,
    isMvpCandidate: index === 0,
    storyWeight: 1,
    createdAt: "2026-06-10T12:00:00.000Z",
  }));

  return {
    gamePhase: input?.gamePhase ?? "season_active",
    season: { id: seasonId, name: "Season 1", year: 2026, currentMatchday: 10, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId,
      schedule: [],
      standings: { "A-A": { points: 0 } },
      playerDisciplinePerformances: performances,
      seasonSnapshots: [],
      matchdayResults: [
        {
          id: "result-1",
          saveId: "save-test",
          seasonId,
          matchdayId: "matchday-1",
          status: "preview_applied",
          sourceVersion: "test",
          teamsTotal: 1,
          teamsReady: 1,
          teamsUnderfilled: 0,
          teamsMissingLineup: 0,
          teamsInvalidLineup: 0,
          teamsMissingScoreCoverage: 0,
          warningsCount: 0,
          createdAt: "2026-06-10T12:00:00.000Z",
          updatedAt: "2026-06-10T12:00:00.000Z",
        },
      ],
    },
    teams: [createTeam()],
    players,
    rosters,
    disciplines: [{ id: "d1" }, { id: "d2" }],
    contracts: [],
    transferHistory: [],
    logs: [],
    teamIdentities: [],
    facilities: [],
    facilityUpgrades: [],
    facilityStaff: [],
    scoutingAssignments: [],
    scoutingReports: [],
    watchlistEntries: [],
    sponsorOffers: [],
    sponsorContracts: [],
    boardObjectives: [],
    seasonObjectives: [],
    playerSeasonPerformances: [],
    matchdayResults: [],
    lineups: [],
    aiTransferIntents: [],
    marketListings: [],
    freeAgents: [],
    draftState: null,
    allianceState: null,
    progressionState: null,
    inboxMessages: [],
    newsItems: [],
    managerPlannerState: null,
    localTeamSettings: {},
    matchdayState: { matchdayId: "matchday-1" },
  } as unknown as GameState;
}

/** Remove a rostered player (simulate a completed sale: leaves both roster and player pool). */
function removePlayer(gameState: GameState, playerId: string): GameState {
  return {
    ...gameState,
    players: gameState.players.filter((player) => player.id !== playerId),
    rosters: gameState.rosters.filter((entry) => entry.playerId !== playerId),
    // Signature bump analogous to a real sale.
    transferHistory: [...(gameState.transferHistory ?? []), { id: "sold-1", playerId } as never],
  };
}

function freeze(gameState: GameState): GameState {
  const snapshot = buildFrozenValuationSnapshot(gameState);
  return {
    ...gameState,
    gamePhase: "season_completed",
    seasonState: { ...gameState.seasonState, frozenValuationSnapshot: snapshot },
  };
}

describe("frozen valuation snapshot", () => {
  it("builds a row for every rostered player and aggregates per team", () => {
    const gameState = createGameState();
    const snapshot = buildFrozenValuationSnapshot(gameState);

    expect(Object.keys(snapshot.playersById)).toHaveLength(POOL_SIZE);
    expect(snapshot.seasonId).toBe("season-1");
    for (const player of gameState.players) {
      const row = snapshot.playersById[player.id];
      expect(row).toBeDefined();
      expect(row?.frozenMw).toBeGreaterThan(0);
      expect(row?.frozenOvr).not.toBeNull();
      expect(row?.frozenMvs).not.toBeNull();
    }
    expect(snapshot.teamAggregatesByTeamId?.["A-A"]?.frozenTeamOvr).not.toBeNull();
  });

  it("isValuationFrozen tracks phase and seasonId", () => {
    const active = createGameState({ gamePhase: "season_active" });
    expect(isValuationFrozen(active)).toBe(false);

    const frozen = freeze(active);
    expect(isValuationFrozen(frozen)).toBe(true);

    // season_active always live even if a stale snapshot is present.
    const staleActive = { ...frozen, gamePhase: "season_active" as const };
    expect(isValuationFrozen(staleActive)).toBe(false);

    // Snapshot for a different season does not freeze the current one.
    const mismatched = {
      ...frozen,
      season: { ...frozen.season, id: "season-2" },
    } as GameState;
    expect(isValuationFrozen(mismatched)).toBe(false);
  });

  it("freezes OVR/MVS so roster changes do not shift the remaining players", () => {
    const base = createGameState({ gamePhase: "season_active" });
    const survivorId = "p8";

    const liveBefore = buildPlayerRatingContractMap(base).get(survivorId)!;

    // LIVE contrast: removing the top scorer shifts the survivor's pool-relative OVR/MVS.
    const liveAfter = buildPlayerRatingContractMap(removePlayer(base, "p1")).get(survivorId)!;
    const ovrShifted = liveAfter.ovrNormalized !== liveBefore.ovrNormalized;
    const mvsShifted = liveAfter.mvs !== liveBefore.mvs;
    expect(ovrShifted || mvsShifted).toBe(true);

    // FROZEN: same removal, values stay pinned to the MD10 snapshot.
    const frozen = freeze(base);
    const frozenSurvivorBefore = getFrozenRatingRowsMap(frozen)!.get(survivorId)!;
    expect(frozenSurvivorBefore.ovrNormalized).toBe(liveBefore.ovrNormalized);
    expect(frozenSurvivorBefore.mvs).toBe(liveBefore.mvs);

    const frozenAfter = removePlayer(frozen, "p1");
    const frozenSurvivorAfter = buildPlayerRatingContractMap(frozenAfter).get(survivorId)!;
    expect(frozenSurvivorAfter.ovrNormalized).toBe(liveBefore.ovrNormalized);
    expect(frozenSurvivorAfter.mvs).toBe(liveBefore.mvs);
    expect(frozenSurvivorAfter.mvsRank).toBe(frozenSurvivorBefore.mvsRank);
  });

  it("keeps the sale price stable when a bracket neighbour is sold in the freeze window", () => {
    const base = createGameState({ gamePhase: "season_active" });
    const survivorId = "p8";
    const neighbourId = "p3";

    const survivor = base.players.find((player) => player.id === survivorId)!;
    const survivorRoster = base.rosters.find((entry) => entry.playerId === survivorId)!;

    // LIVE contrast: selling a higher-ranked bracket neighbour changes the survivor's live sale price.
    const liveBreakdownBefore = buildTransfermarktSaleFactorBreakdown(base, survivor, survivorRoster);
    const liveAfterState = removePlayer(base, neighbourId);
    const liveBreakdownAfter = buildTransfermarktSaleFactorBreakdown(liveAfterState, survivor, survivorRoster);
    expect(liveBreakdownBefore.salePrice).not.toBeNull();
    expect(liveBreakdownAfter.salePrice).not.toBe(liveBreakdownBefore.salePrice);

    // FROZEN: the survivor keeps the frozen MW and bracket rank → identical sale price after the sale.
    const frozen = freeze(base);
    const frozenBreakdownBefore = buildTransfermarktSaleFactorBreakdown(frozen, survivor, survivorRoster);
    const frozenAfterState = removePlayer(frozen, neighbourId);
    const frozenBreakdownAfter = buildTransfermarktSaleFactorBreakdown(frozenAfterState, survivor, survivorRoster);

    expect(frozenBreakdownBefore.salePrice).toBe(liveBreakdownBefore.salePrice);
    expect(frozenBreakdownAfter.salePrice).toBe(frozenBreakdownBefore.salePrice);
    expect(frozenBreakdownAfter.baseMarketValue).toBe(frozenBreakdownBefore.baseMarketValue);
    expect(frozenBreakdownAfter.rankInBracket).toBe(frozenBreakdownBefore.rankInBracket);
  });

  it("falls back to live pricing for a player without a freeze row (bought inside the window)", () => {
    const base = createGameState({ gamePhase: "season_active" });
    const frozen = freeze(base);

    const newcomer = createPlayer("newcomer", 99);
    const newcomerRoster = createRoster("r-new", "newcomer");
    const withNewcomer = {
      ...frozen,
      players: [...frozen.players, newcomer],
      rosters: [...frozen.rosters, newcomerRoster],
    } as GameState;

    const breakdown = buildTransfermarktSaleFactorBreakdown(withNewcomer, newcomer, newcomerRoster);
    // No frozen row → live path still returns a usable market value / sale price.
    expect(breakdown.baseMarketValue).not.toBeNull();
    expect(breakdown.salePrice).not.toBeNull();
  });

  it("releases the freeze when a new season becomes active", () => {
    const frozen = freeze(createGameState({ gamePhase: "season_active" }));
    expect(isValuationFrozen(frozen)).toBe(true);

    // New season: preseason clears the snapshot and phase returns to live.
    const nextSeason = {
      ...frozen,
      gamePhase: "season_active" as const,
      season: { ...frozen.season, id: "season-2" },
      seasonState: { ...frozen.seasonState, seasonId: "season-2", frozenValuationSnapshot: undefined },
    } as GameState;

    expect(isValuationFrozen(nextSeason)).toBe(false);
    expect(getFrozenRatingRowsMap(nextSeason)).toBeNull();
  });

  it("ignoreFreeze recomputes live so season-end development yields a non-zero before/after OVR delta while sales stay frozen", () => {
    const base = createGameState({ gamePhase: "season_active" });
    // Freeze window during the season-end player-development step (post-MD10, pre next-season transition).
    const dev = { ...freeze(base), gamePhase: "player_development" as const } as GameState;
    expect(isValuationFrozen(dev)).toBe(true);

    const grownId = "p8";
    // A season-end progression that actually grew the player's core stats.
    const grownState = {
      ...dev,
      players: dev.players.map((player) =>
        player.id === grownId
          ? { ...player, coreStats: { pow: 95, spe: 95, men: 95, soc: 95 } }
          : player,
      ),
    } as GameState;

    // FIX — the progression audit's freeze-BYPASS: before/after are computed LIVE from the actual
    // (swapped) players, so a grown player produces a real, non-zero development delta.
    const baselineLiveOvr = buildPlayerRatingContractMap(dev, undefined, { ignoreFreeze: true }).get(grownId)!
      .ovrNormalized;
    const grownLiveOvr = buildPlayerRatingContractMap(grownState, undefined, { ignoreFreeze: true }).get(grownId)!
      .ovrNormalized;
    expect(baselineLiveOvr).not.toBeNull();
    expect(grownLiveOvr).not.toBeNull();
    expect(grownLiveOvr).not.toBe(baselineLiveOvr);
    expect(grownLiveOvr! - baselineLiveOvr!).toBeGreaterThan(0);

    // REGRESSION GUARD — without the bypass the sales window stays frozen: both reads collapse to the
    // MD10 snapshot row (keyed by playerId) → delta ≡ 0. This is the correct locked-stat sales behaviour.
    const frozenBaseline = buildPlayerRatingContractMap(dev).get(grownId)!.ovrNormalized;
    const frozenGrown = buildPlayerRatingContractMap(grownState).get(grownId)!.ovrNormalized;
    expect(frozenGrown).toBe(frozenBaseline);
  });
});
