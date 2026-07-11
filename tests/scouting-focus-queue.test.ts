import { describe, expect, it } from "vitest";

import type { GameState, Player, TransferWishlistEntry } from "@/lib/data/olyDataTypes";
import {
  SCOUT_FOCUS_TICK_GAIN,
  advanceScoutIntelTick,
  getEffectiveScoutingLevel,
  getFocusScoutTarget,
  getFullRevealCertaintyThreshold,
  getScoutFocusSummary,
  refreshScoutPipeline,
} from "@/lib/scouting/facility-scout-pipeline-service";
import {
  getNextWishlistPriorityRank,
  getWishlistEntryPriorityRank,
  reorderTeamTransferWishlist,
} from "@/lib/scouting/scouting-wishlist-slots";

function buildPlayer(id: string): Player {
  return {
    id,
    name: id,
    rating: 60,
    marketValue: 20,
    salaryDemand: 2,
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
  } as Player;
}

function buildWishlistEntry(playerId: string, priorityRank: number, createdAt: string): TransferWishlistEntry {
  return {
    id: `w-${playerId}`,
    saveId: "save",
    seasonId: "season-2",
    playerId,
    playerName: playerId,
    className: "Runner",
    race: "Human",
    marketValue: 20,
    salary: 2,
    bracket: null,
    teamId: "M-M",
    createdAt,
    priorityRank,
  };
}

function createGameState(input: { facilityLevel: number; wishlist: TransferWishlistEntry[] }): GameState {
  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      transferWishlist: input.wishlist,
      teamFacilities: {
        "M-M": {
          facilities: {
            scouting_office: { level: input.facilityLevel, enabled: true },
          },
        },
      },
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "M-M", name: "Mayhem", shortCode: "M-M", budget: 100, cash: 50, identityId: "M-M", humanControlled: true, rosterLimit: 14 }],
    teamIdentities: [{ teamId: "M-M", playerMin: 7, playerOpt: 10, pow: 5, spe: 5, men: 5, soc: 5, ambition: 5, finances: 5, boardConfidence: 5, harmony: 5, manners: 5, popularity: 5, cooperation: 5, playerType: null }],
    players: [buildPlayer("p-1"), buildPlayer("p-2")],
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
      importedPlayerCount: 2,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
    },
    disciplines: [],
  } as GameState;
}

describe("scouting focus queue — priority reorder", () => {
  it("assigns the next priority rank at the end of the queue", () => {
    const gameState = createGameState({
      facilityLevel: 1,
      wishlist: [buildWishlistEntry("p-1", 0, "2026-06-25T00:00:00.000Z"), buildWishlistEntry("p-2", 1, "2026-06-25T01:00:00.000Z")],
    });
    expect(getNextWishlistPriorityRank(gameState, "M-M")).toBe(2);
  });

  it("falls back to createdAt for legacy entries without priorityRank", () => {
    const legacyEntry: TransferWishlistEntry = {
      id: "w-legacy",
      saveId: "save",
      seasonId: "season-2",
      playerId: "p-legacy",
      playerName: "p-legacy",
      className: "Runner",
      race: "Human",
      marketValue: 20,
      salary: 2,
      bracket: null,
      teamId: "M-M",
      createdAt: "2026-06-25T00:00:00.000Z",
    };
    expect(getWishlistEntryPriorityRank(legacyEntry)).toBe(Date.parse("2026-06-25T00:00:00.000Z"));
  });

  it("reorders the team's queue and re-sequences priorityRank 0..N-1", () => {
    const gameState = createGameState({
      facilityLevel: 1,
      wishlist: [
        buildWishlistEntry("p-1", 0, "2026-06-25T00:00:00.000Z"),
        buildWishlistEntry("p-2", 1, "2026-06-25T01:00:00.000Z"),
        buildWishlistEntry("p-3", 2, "2026-06-25T02:00:00.000Z"),
      ],
    });
    const reordered = reorderTeamTransferWishlist(gameState.seasonState.transferWishlist!, "M-M", "p-3", 0);
    const sorted = [...reordered].sort((left, right) => getWishlistEntryPriorityRank(left) - getWishlistEntryPriorityRank(right));
    expect(sorted.map((entry) => entry.playerId)).toEqual(["p-3", "p-1", "p-2"]);
    expect(sorted.map((entry) => entry.priorityRank)).toEqual([0, 1, 2]);
  });

  it("leaves other teams' entries untouched when reordering", () => {
    const gameState = createGameState({
      facilityLevel: 1,
      wishlist: [
        buildWishlistEntry("p-1", 0, "2026-06-25T00:00:00.000Z"),
        buildWishlistEntry("p-2", 1, "2026-06-25T01:00:00.000Z"),
        { ...buildWishlistEntry("p-other", 0, "2026-06-25T00:00:00.000Z"), teamId: "OTHER" },
      ],
    });
    const reordered = reorderTeamTransferWishlist(gameState.seasonState.transferWishlist!, "M-M", "p-2", 0);
    const otherEntry = reordered.find((entry) => entry.playerId === "p-other");
    expect(otherEntry?.priorityRank).toBe(0);
    expect(otherEntry?.teamId).toBe("OTHER");
  });
});

describe("scouting focus queue — focus tick mechanic", () => {
  it("resolves the highest-priority unfinished wishlist entry as the focus target", () => {
    const gameState = createGameState({
      facilityLevel: 1,
      wishlist: [buildWishlistEntry("p-1", 0, "2026-06-25T00:00:00.000Z"), buildWishlistEntry("p-2", 1, "2026-06-25T01:00:00.000Z")],
    });
    expect(getFocusScoutTarget(gameState, "M-M")?.playerId).toBe("p-1");
  });

  it("grants the flat focus tick gain to the focus target only, not to background wishlist entries", () => {
    let gameState = createGameState({
      facilityLevel: 1,
      wishlist: [buildWishlistEntry("p-1", 0, "2026-06-25T00:00:00.000Z"), buildWishlistEntry("p-2", 1, "2026-06-25T01:00:00.000Z")],
    });
    gameState = refreshScoutPipeline(gameState, "M-M");
    gameState = advanceScoutIntelTick({ gameState, teamId: "M-M", phase: "matchday" });
    const records = gameState.seasonState.scoutIntelByTeamId?.["M-M"] ?? [];
    const focusRecord = records.find((entry) => entry.playerId === "p-1");
    const backgroundRecord = records.find((entry) => entry.playerId === "p-2");
    expect(focusRecord?.certainty).toBe(SCOUT_FOCUS_TICK_GAIN);
    expect(backgroundRecord?.certainty).toBeGreaterThan(0);
    expect(backgroundRecord?.certainty).toBeLessThan(SCOUT_FOCUS_TICK_GAIN);
  });

  it("reaches full reveal (level 5) for the focus target within the documented matchday budget at L1", () => {
    let gameState = createGameState({
      facilityLevel: 1,
      wishlist: [buildWishlistEntry("p-1", 0, "2026-06-25T00:00:00.000Z")],
    });
    gameState = refreshScoutPipeline(gameState, "M-M");
    const threshold = getFullRevealCertaintyThreshold(1);
    expect(threshold).toBe(100);
    const expectedTicks = Math.ceil(threshold / SCOUT_FOCUS_TICK_GAIN);
    expect(expectedTicks).toBe(5);
    for (let tick = 0; tick < expectedTicks; tick += 1) {
      gameState = advanceScoutIntelTick({ gameState, teamId: "M-M", phase: "matchday" });
    }
    expect(getEffectiveScoutingLevel(gameState, "M-M", "p-1")).toBe(5);
  });

  it("auto-promotes the next wishlist rank to focus once the current focus target is fully scouted", () => {
    let gameState = createGameState({
      facilityLevel: 1,
      wishlist: [buildWishlistEntry("p-1", 0, "2026-06-25T00:00:00.000Z"), buildWishlistEntry("p-2", 1, "2026-06-25T01:00:00.000Z")],
    });
    gameState = refreshScoutPipeline(gameState, "M-M");
    for (let tick = 0; tick < 5; tick += 1) {
      gameState = advanceScoutIntelTick({ gameState, teamId: "M-M", phase: "matchday" });
    }
    expect(getEffectiveScoutingLevel(gameState, "M-M", "p-1")).toBe(5);
    expect(getFocusScoutTarget(gameState, "M-M")?.playerId).toBe("p-2");

    const beforeP2 = gameState.seasonState.scoutIntelByTeamId?.["M-M"]?.find((entry) => entry.playerId === "p-2")?.certainty ?? 0;
    gameState = advanceScoutIntelTick({ gameState, teamId: "M-M", phase: "matchday" });
    const afterP2 = gameState.seasonState.scoutIntelByTeamId?.["M-M"]?.find((entry) => entry.playerId === "p-2")?.certainty ?? 0;
    expect(afterP2 - beforeP2).toBe(SCOUT_FOCUS_TICK_GAIN);
  });

  it("returns null focus summary once the entire queue is fully scouted", () => {
    let gameState = createGameState({
      facilityLevel: 5,
      wishlist: [buildWishlistEntry("p-1", 0, "2026-06-25T00:00:00.000Z")],
    });
    gameState = refreshScoutPipeline(gameState, "M-M");
    expect(getScoutFocusSummary(gameState, "M-M")).toBeNull();
    expect(getEffectiveScoutingLevel(gameState, "M-M", "p-1")).toBe(5);
  });
});
