import { describe, expect, it } from "vitest";

import type { Discipline, GameState, Player, TransferWishlistEntry } from "@/lib/data/olyDataTypes";
import { buildScoutingReport } from "@/lib/scouting/scouting-report-service";
import { refreshScoutPipeline } from "@/lib/scouting/facility-scout-pipeline-service";

function buildDiscipline(id: string, name: string): Discipline {
  return {
    id,
    name,
    category: "power",
    slotCount: 1,
    iconRef: null,
    attributeWeights: {},
  } as Discipline;
}

function buildPlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    rating: 72,
    marketValue: 25,
    salaryDemand: 3,
    className: "Runner",
    race: "Human",
    alignment: "neutral",
    gender: "n/a",
    bracketLabel: "B3",
    subclasses: [],
    traitsPositive: ["Fast Learner"],
    traitsNegative: ["Injury Prone"],
    coreStats: { pow: 62, spe: 74, men: 58, soc: 55 },
    preferredDisciplineIds: ["disc-a", "disc-b"],
    disciplineRatings: { "disc-a": 68, "disc-b": 61, "disc-c": 52 },
    disciplineTierCounts: { above20: 3, above40: 3, above60: 2, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 78,
    trainingMode: null,
    ...overrides,
  } as Player;
}

function buildWishlistEntry(playerId: string, priorityRank: number): TransferWishlistEntry {
  return {
    id: `w-${playerId}`,
    saveId: "save",
    seasonId: "season-2",
    playerId,
    playerName: playerId,
    className: "Runner",
    race: "Human",
    marketValue: 25,
    salary: 3,
    bracket: 3,
    teamId: "M-M",
    createdAt: "2026-01-01T00:00:00.000Z",
    priorityRank,
  };
}

function buildGameState(input: {
  player: Player;
  rosterPlayers?: Player[];
  facilityLevel: number;
  wishlist?: TransferWishlistEntry[];
}): GameState {
  const rosterPlayers = input.rosterPlayers ?? [
    buildPlayer("roster-1", { coreStats: { pow: 50, spe: 50, men: 50, soc: 50 } }),
    buildPlayer("roster-2", { coreStats: { pow: 55, spe: 52, men: 48, soc: 47 } }),
  ];

  let gameState = {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      transferWishlist: input.wishlist ?? [buildWishlistEntry(input.player.id, 0)],
      teamFacilities: {
        "M-M": {
          facilities: {
            scouting_office: { level: input.facilityLevel, enabled: true },
          },
        },
      },
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "M-M", name: "My Team", shortCode: "M-M", budget: 100, cash: 50, identityId: "M-M", humanControlled: true, rosterLimit: 14 }],
    teamIdentities: [{ teamId: "M-M", playerMin: 7, playerOpt: 10, pow: 5, spe: 5, men: 5, soc: 5, ambition: 5, finances: 5, boardConfidence: 5, harmony: 5, manners: 5, popularity: 5, cooperation: 5, playerType: null }],
    players: [input.player, ...rosterPlayers],
    rosters: rosterPlayers.map((player, index) => ({
      id: `r-${index}`,
      saveId: "save",
      seasonId: "season-2",
      teamId: "M-M",
      playerId: player.id,
      contractLength: 2,
    })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-01-01T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 3,
      matchedRosterCount: 2,
      teamCount: 1,
      unmappedPlayers: [],
    },
    disciplines: [
      buildDiscipline("disc-a", "Sprint"),
      buildDiscipline("disc-b", "Marathon"),
      buildDiscipline("disc-c", "Relay"),
    ],
  } as unknown as GameState;

  gameState = refreshScoutPipeline(gameState, "M-M");
  return gameState;
}

function setPlayerCertainty(gameState: GameState, playerId: string, certainty: number) {
  const records = [...(gameState.seasonState.scoutIntelByTeamId?.["M-M"] ?? [])];
  const index = records.findIndex((entry) => entry.playerId === playerId);
  if (index >= 0) {
    records[index] = { ...records[index]!, certainty };
  } else {
    records.push({
      saveId: "save",
      seasonId: "season-2",
      teamId: "M-M",
      playerId,
      certainty,
      source: "wishlist_mirror",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  }
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      scoutIntelByTeamId: {
        ...gameState.seasonState.scoutIntelByTeamId,
        "M-M": records,
      },
    },
  } as GameState;
}

describe("buildScoutingReport", () => {
  it("masks exact axis stats and impact deltas at low scouting certainty", () => {
    const player = buildPlayer("target-low");
    let gameState = buildGameState({ player, facilityLevel: 2 });
    gameState = setPlayerCertainty(gameState, player.id, 20);
    const report = buildScoutingReport({
      gameState,
      teamId: "M-M",
      playerId: player.id,
      saveId: "save",
    });

    expect(report).not.toBeNull();
    expect(report?.axisOrbitStats).toBeNull();
    expect(report?.showAxisOrbit).toBe(false);
    expect(report?.showAxisStars).toBe(false);
    expect(report?.impactIsExact).toBe(false);
    expect(report?.disciplineTiers.length).toBeGreaterThan(0);
    expect(report?.disciplineSpecialties).toEqual(["Sprint", "Marathon"]);
    expect(report?.ageLabel).toBe("B3");
  });

  it("reveals exact axis stats and exact impact at full scouting level", () => {
    const player = buildPlayer("target-full");
    let gameState = buildGameState({ player, facilityLevel: 5 });
    gameState = setPlayerCertainty(gameState, player.id, 100);
    const report = buildScoutingReport({
      gameState,
      teamId: "M-M",
      playerId: player.id,
      saveId: "save",
    });

    expect(report).not.toBeNull();
    expect(report?.isFullyScouted).toBe(true);
    expect(report?.showAxisOrbit).toBe(true);
    expect(report?.axisOrbitStats).toEqual(player.coreStats);
    expect(report?.impactIsExact).toBe(true);
    expect(report?.effectiveScoutingLevel).toBeGreaterThanOrEqual(5);
  });

  it("returns per-axis star bands between level 3 and full reveal", () => {
    const player = buildPlayer("target-mid");
    let gameState = buildGameState({ player, facilityLevel: 1 });
    gameState = setPlayerCertainty(gameState, player.id, 50);
    const report = buildScoutingReport({
      gameState,
      teamId: "M-M",
      playerId: player.id,
      saveId: "save",
    });

    expect(report).not.toBeNull();
    expect(report?.showAxisOrbit).toBe(false);
    expect(report?.showAxisStars).toBe(true);
    expect(report?.axisStars.pow).not.toBeNull();
    expect(report?.axisStars.spe).not.toBeNull();
    expect(report?.effectiveScoutingLevel).toBe(3);
  });

  it("returns null when the player does not exist", () => {
    const player = buildPlayer("target-missing");
    const gameState = buildGameState({ player, facilityLevel: 2 });
    expect(
      buildScoutingReport({
        gameState,
        teamId: "M-M",
        playerId: "missing-player",
        saveId: "save",
      }),
    ).toBeNull();
  });
});
