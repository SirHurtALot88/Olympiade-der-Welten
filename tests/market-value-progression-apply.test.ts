import { describe, expect, it } from "vitest";

import type { GameState, Player, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import {
  buildPlayerEconomyCompareReport,
  resolveRankTableMarketValueFromCompareRow,
} from "@/lib/foundation/player-economy-compare-service";
import {
  applyRankTableMarketValuesToGameState,
  buildRankTableMarketValueMap,
  patchSeasonProgressionEventMarketValues,
} from "@/lib/player-formulas/market-value-apply";

const BASE_ATTRIBUTES: PlayerGeneratorAttributes = {
  power: 40,
  health: 40,
  stamina: 40,
  intelligence: 40,
  awareness: 40,
  determination: 40,
  speed: 40,
  dexterity: 40,
  charisma: 40,
  will: 40,
  spirit: 40,
  torment: 40,
};

function createPlayer(
  id: string,
  disciplineRatings: Record<string, number>,
  marketValue: number,
  attributeOverrides: Partial<PlayerGeneratorAttributes> = {},
): Player {
  return {
    id,
    name: id,
    rating: 60,
    marketValue,
    displayMarketValue: marketValue,
    salaryDemand: 1,
    className: "Runner",
    race: "Human",
    alignment: "N",
    gender: "x",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
    attributeSheetStats: {
      ...BASE_ATTRIBUTES,
      ...attributeOverrides,
    },
    preferredDisciplineIds: [],
    disciplineRatings,
    disciplineTierCounts: { above20: 3, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
  };
}

function createGameState(players: Player[]): GameState {
  return {
    gamePhase: "player_development",
    season: { id: "season-1", name: "Season 1", currentMatchday: 10, totalMatchdays: 10, isCompleted: true },
    seasonState: { seasonId: "season-1", schedule: [], standings: {}, matchdayResults: [], playerDisciplinePerformances: [], disciplineHighlights: [] },
    matchdayState: { matchdayId: "matchday-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "team-1", name: "Team One", shortCode: "T-O", budget: 100, cash: 100, salaryTotal: 0, rosterValue: 0, humanControlled: true }],
    teamIdentities: [],
    players,
    disciplines: [
      { id: "tdm", name: "TDM", category: "power", weight: 1 },
      { id: "fechten", name: "Fechten", category: "speed", weight: 1 },
      { id: "hockey", name: "Hockey", category: "power", weight: 1 },
    ],
    rosters: players.map((player, index) => ({
      id: `active-${index + 1}`,
      teamId: "team-1",
      playerId: player.id,
      salary: 1,
      marketValue: player.marketValue ?? 10,
      currentValue: player.marketValue ?? 10,
      contractLength: 1,
      roleTag: "core" as const,
    })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-11T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: players.length,
      matchedRosterCount: players.length,
      warnings: [],
    },
  };
}

describe("market value progression apply", () => {
  it("updates stored market values from league-wide rank table after discipline improvements", () => {
    const baseline = createGameState([
      createPlayer("player-a", { tdm: 55, fechten: 50, hockey: 52 }, 12, { power: 55, speed: 55, dexterity: 55 }),
      createPlayer("player-b", { tdm: 54, fechten: 49, hockey: 51 }, 11.5, { power: 54, speed: 54, dexterity: 54 }),
      createPlayer("player-c", { tdm: 40, fechten: 38, hockey: 39 }, 8, { power: 38, speed: 38, dexterity: 38 }),
    ]);
    const beforeMap = buildRankTableMarketValueMap(baseline);
    const improvedPlayer = baseline.players.find((player) => player.id === "player-b")!;
    const boosted = {
      ...improvedPlayer,
      disciplineRatings: {
        ...improvedPlayer.disciplineRatings,
        tdm: 72,
        fechten: 70,
        hockey: 71,
      },
    };
    const improvedState = applyRankTableMarketValuesToGameState({
      ...baseline,
      players: baseline.players.map((player) => (player.id === boosted.id ? boosted : player)),
    });

    const afterPlayer = improvedState.players.find((player) => player.id === "player-b")!;
    const afterRoster = improvedState.rosters.find((entry) => entry.playerId === "player-b")!;
    const afterMap = buildRankTableMarketValueMap(improvedState);

    expect(afterMap.get("player-b")).toBeGreaterThan(beforeMap.get("player-b") ?? 0);
    expect(afterPlayer.marketValue).toBe(afterMap.get("player-b"));
    expect(afterPlayer.displayMarketValue).toBe(afterMap.get("player-b"));
    expect(afterRoster?.currentValue).toBe(afterMap.get("player-b"));
    expect(afterPlayer.marketValue).not.toBe(improvedPlayer.marketValue);
  });

  it("ranks market value by discipline display stats", () => {
    const gameState = createGameState([
      createPlayer("player-strong", { tdm: 80 }, 10, { power: 45, speed: 45, dexterity: 45 }),
      createPlayer("player-weak-display", { tdm: 30 }, 10, { power: 80, speed: 80, dexterity: 80 }),
    ]);
    const marketValues = buildRankTableMarketValueMap(gameState);
    expect(marketValues.get("player-strong")).toBeGreaterThan(marketValues.get("player-weak-display") ?? 0);
  });

  it("prefers rank-table market value over legacy stored value in compare rows", () => {
    const player = createPlayer("player-a", { tdm: 55, fechten: 50, hockey: 52 }, 99, { power: 54, speed: 54, dexterity: 54 });
    const boosted = {
      ...player,
      disciplineRatings: {
        ...player.disciplineRatings,
        tdm: 72,
        fechten: 70,
        hockey: 71,
      },
    };
    const gameState = createGameState([
      player,
      createPlayer("player-b", { tdm: 54, fechten: 49, hockey: 51 }, 11.5, { power: 53, speed: 53, dexterity: 53 }),
    ]);

    const afterReport = buildPlayerEconomyCompareReport({
      gameState,
      playerIds: [player.id],
      playerOverridesById: new Map([[player.id, boosted]]),
    });
    const afterRow = afterReport.players[0];

    expect(afterRow?.calculatedMarketValue).toBe(99);
    expect(resolveRankTableMarketValueFromCompareRow(afterRow)).not.toBe(99);
    expect(resolveRankTableMarketValueFromCompareRow(afterRow)).toBeGreaterThan(0);
  });

  it("patches progression snapshot market values after rank-table recalc", () => {
    const gameState = createGameState([
      createPlayer("player-a", { tdm: 55, fechten: 50, hockey: 52 }, 12, { power: 55, speed: 55, dexterity: 55 }),
      createPlayer("player-b", { tdm: 40, fechten: 38, hockey: 39 }, 8, { power: 38, speed: 38, dexterity: 38 }),
    ]);
    const recalculated = applyRankTableMarketValuesToGameState({
      ...gameState,
      players: gameState.players.map((player) =>
        player.id === "player-a"
          ? {
              ...player,
              disciplineRatings: {
                ...player.disciplineRatings,
                tdm: 72,
                fechten: 70,
                hockey: 71,
              },
            }
          : player,
      ),
    });
    const patched = patchSeasonProgressionEventMarketValues({
      gameState: {
        ...recalculated,
        playerProgressionEvents: [
          {
            eventId: "event-1",
            seasonId: "season-1",
            teamId: "team-1",
            playerId: "player-a",
            upgrades: [],
            xpSpent: 0,
            xpEarned: 10,
            timestamp: "2026-06-11T00:00:00.000Z",
            source: "organic_season_progression",
            progressionSnapshotBefore: {
              attributes: {},
              disciplineRatings: { tdm: 55 },
              ovr: 60,
              mvs: null,
              marketValue: 12,
              salary: 1,
              bracket: "C",
            },
            progressionSnapshotAfter: {
              attributes: {},
              disciplineRatings: { tdm: 62 },
              ovr: 61,
              mvs: null,
              marketValue: 12,
              salary: 1,
              bracket: "C",
            },
          },
        ],
      },
      seasonId: "season-1",
      playerIds: ["player-a"],
    });

    const event = patched.playerProgressionEvents?.[0];
    expect(event?.progressionSnapshotAfter?.marketValue).toBe(
      patched.players.find((player) => player.id === "player-a")?.marketValue,
    );
    expect(event?.progressionSnapshotAfter?.marketValue).toBeGreaterThan(12);
  });
});
