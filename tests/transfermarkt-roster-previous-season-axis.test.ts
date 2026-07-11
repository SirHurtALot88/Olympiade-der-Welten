import { describe, expect, it } from "vitest";

import type { GameState, Player, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { buildMarketRosterPreviousSeasonAxisByPlayerId } from "@/lib/market/transfermarkt-roster-previous-season-axis";

function createPlayer(partial: Partial<Player> & Pick<Player, "id" | "name">): Player {
  return {
    id: partial.id,
    name: partial.name,
    className: partial.className ?? "Hero",
    race: partial.race ?? "Human",
    alignment: partial.alignment ?? "Good",
    ovr: partial.ovr ?? 80,
    coreStats: partial.coreStats ?? { pow: 80, spe: 80, men: 80, soc: 80 },
    disciplineRatings: partial.disciplineRatings ?? {},
    attributeStats: partial.attributeStats ?? {},
    traits: partial.traits ?? [],
    marketValue: partial.marketValue ?? 100,
    salary: partial.salary ?? 10,
  } as Player;
}

function createSnapshot(seasonId: string, playerPerformances: SeasonSnapshotRecord["playerPerformances"]): SeasonSnapshotRecord {
  return {
    seasonId,
    seasonName: seasonId,
    status: "completed",
    sourceStatus: "mapped",
    archivedAt: "2026-06-01T10:00:00.000Z",
    finalStandings: [],
    playerPerformances,
  } as SeasonSnapshotRecord;
}

describe("buildMarketRosterPreviousSeasonAxisByPlayerId", () => {
  it("maps previous-season axis PPs and ranks for rostered players only", () => {
    const player = createPlayer({ id: "player-1", name: "Tyrael" });
    const rival = createPlayer({ id: "player-2", name: "Rival" });
    const gameState = {
      season: { id: "season-2", name: "Season 2" },
      seasonState: {
        seasonSnapshots: [
          createSnapshot("season-2", []),
          createSnapshot("season-1", [
            {
              playerId: player.id,
              playerName: player.name,
              teamId: "team-1",
              teamCode: "T1",
              teamName: "Team One",
              appearances: 4,
              totalContribution: 30,
              totalPoints: 30,
              averageContribution: 7.5,
              averageFinalScore: 50,
              powPoints: 12,
              spePoints: 8,
              menPoints: 5,
              socPoints: 5,
              top10Count: 0,
              mvpCount: 0,
              bestDisciplineId: "pow-d",
              bestDisciplineLabel: "Power",
              bestDisciplineScore: 60,
            },
            {
              playerId: rival.id,
              playerName: rival.name,
              teamId: "team-2",
              teamCode: "T2",
              teamName: "Team Two",
              appearances: 4,
              totalContribution: 20,
              totalPoints: 20,
              averageContribution: 5,
              averageFinalScore: 45,
              powPoints: 20,
              spePoints: 0,
              menPoints: 0,
              socPoints: 0,
              top10Count: 0,
              mvpCount: 0,
              bestDisciplineId: "pow-d",
              bestDisciplineLabel: "Power",
              bestDisciplineScore: 55,
            },
          ]),
        ],
      },
      disciplines: [
        { id: "pow-d", name: "Power", category: "power", playerCount: 10 },
        { id: "spe-d", name: "Speed", category: "speed", playerCount: 10 },
      ],
      players: [player, rival],
      rosters: [],
      teams: [],
    } as unknown as GameState;

    const map = buildMarketRosterPreviousSeasonAxisByPlayerId(gameState);
    const stats = map.get(player.id);

    expect(stats?.seasonId).toBe("season-1");
    expect(stats?.ppPow).toBe(12);
    expect(stats?.ppSpe).toBe(8);
    expect(stats?.ppPowRank).toBe(2);
    expect(stats?.ppSpeRank).toBe(1);
  });

  it("ignores snapshot rows without a team assignment", () => {
    const freeAgent = createPlayer({ id: "fa-1", name: "Free Agent" });
    const gameState = {
      season: { id: "season-2", name: "Season 2" },
      seasonState: {
        seasonSnapshots: [
          createSnapshot("season-1", [
            {
              playerId: freeAgent.id,
              playerName: freeAgent.name,
              teamId: null,
              appearances: 0,
              totalContribution: 0,
              totalPoints: 0,
              powPoints: 0,
              spePoints: 0,
              menPoints: 0,
              socPoints: 0,
            },
          ]),
        ],
      },
      disciplines: [],
      players: [freeAgent],
      rosters: [],
      teams: [],
    } as unknown as GameState;

    expect(buildMarketRosterPreviousSeasonAxisByPlayerId(gameState).has(freeAgent.id)).toBe(false);
  });
});
