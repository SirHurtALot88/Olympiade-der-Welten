import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";

/**
 * Route-Test für `/api/singleplayer-state/player-discipline-ranks`
 * (bug-2026-08-04T13-23-39-256Z-uzetn6). Prüft die zwei Dinge, die die
 * lib-Tests (`tests/player-detail-drawer-discipline-rank-override.test.ts`)
 * nicht abdecken: die HTTP-Verdrahtung (Query-Parameter, Persistenz-Lookup)
 * und die Fog-of-War-Maskierung ("scouted" -> leere Ränge statt echter Zahlen).
 */

const getSaveById = vi.fn();

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({ getSaveById }),
}));

function createPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    rating: 70,
    marketValue: 30,
    salaryDemand: 8,
    displayMarketValue: 30,
    displaySalary: 8,
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
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: { basketball: 43 },
    disciplineTierCounts: { above20: 1, above40: 1, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  } as unknown as Player;
}

function createGameState(player: Player, rival: Player): GameState {
  return {
    season: { id: "season-1", name: "Season 1", currentMatchday: 5, totalMatchdays: 10, isCompleted: false },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      matchdayResults: [{ id: "result-1", seasonId: "season-1", matchdayId: "matchday-1", status: "preview_applied" }],
      disciplineResults: [
        {
          id: "discipline-result-low",
          matchdayResultId: "result-1",
          teamId: "team-1",
          disciplineId: "basketball",
          disciplineSide: "d1",
          rank: 20,
          baseScore: 100,
          totalScore: 100,
          readinessStatus: "ready",
          warnings: [],
          createdAt: "2026-06-06T10:00:00.000Z",
        },
        {
          id: "discipline-result-high",
          matchdayResultId: "result-1",
          teamId: "team-2",
          disciplineId: "basketball",
          disciplineSide: "d1",
          rank: 1,
          baseScore: 200,
          totalScore: 200,
          readinessStatus: "ready",
          warnings: [],
          createdAt: "2026-06-06T10:00:00.000Z",
        },
      ],
      playerDisciplinePerformances: [
        {
          id: "perf-player",
          matchdayResultId: "result-1",
          teamId: "team-1",
          playerId: player.id,
          activePlayerId: "roster-1",
          disciplineId: "basketball",
          disciplineSide: "d1",
          slotIndex: 0,
          baseValue: 43,
          finalPlayerScore: 43,
          scoreContribution: 0.9,
          rankInTeam: 1,
          rankInDiscipline: 60,
          isTop10: false,
          isMvpCandidate: false,
          storyWeight: 0.9,
          createdAt: "2026-06-06T10:00:00.000Z",
        },
        {
          id: "perf-rival",
          matchdayResultId: "result-1",
          teamId: "team-2",
          playerId: rival.id,
          activePlayerId: "roster-2",
          disciplineId: "basketball",
          disciplineSide: "d1",
          slotIndex: 0,
          baseValue: 44,
          finalPlayerScore: 44,
          scoreContribution: 0.1,
          rankInTeam: 1,
          rankInDiscipline: 1,
          isTop10: true,
          isMvpCandidate: true,
          storyWeight: 0.1,
          createdAt: "2026-06-06T10:00:00.000Z",
        },
      ],
      seasonSnapshots: [],
    },
    matchdayState: { matchdayId: "md-5", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      { teamId: "team-1", id: "team-1", name: "Team One", shortCode: "T-1", cash: 100, budget: 100, humanControlled: true },
      { teamId: "team-2", id: "team-2", name: "Team Two", shortCode: "T-2", cash: 100, budget: 100, humanControlled: true },
    ],
    teamIdentities: [],
    players: [player, rival],
    disciplines: [{ id: "basketball", name: "Basketball", category: "social", displayOrder: 1, playerCount: 6 }],
    rosters: [
      { id: "roster-1", playerId: player.id, teamId: "team-1", salary: 8, contractLength: 2 },
      { id: "roster-2", playerId: rival.id, teamId: "team-2", salary: 8, contractLength: 2 },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-06T10:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 2,
      matchedRosterCount: 2,
      warnings: [],
    },
  } as unknown as GameState;
}

// Der Route-Import zieht den grossen Foundation-Abhaengigkeitsgraphen mit rein
// (season/scouting/market-Services) — im ersten Test kostet das mehr als das
// 5s-Default-Budget von vitest. Grosszuegiger Timeout NUR fuer den ersten Test,
// alle folgenden treffen den warmen Modul-Cache.
describe("player discipline ranks api (bug-2026-08-04T13-23-39-256Z-uzetn6)", () => {
  beforeEach(() => {
    getSaveById.mockReset();
  });

  it(
    "400s when saveId or playerId is missing",
    async () => {
      const { GET } = await import("@/app/api/singleplayer-state/player-discipline-ranks/route");
      const response = await GET(new Request("http://localhost/api/singleplayer-state/player-discipline-ranks?saveId=save-1"));
      expect(response.status).toBe(400);
    },
    30_000,
  );

  it("404s for an unknown save", async () => {
    getSaveById.mockReturnValue(null);
    const { GET } = await import("@/app/api/singleplayer-state/player-discipline-ranks/route");
    const response = await GET(
      new Request("http://localhost/api/singleplayer-state/player-discipline-ranks?saveId=missing&playerId=player-x"),
    );
    expect(response.status).toBe(404);
  });

  it("returns the season-/all-time rank for the requested player, computed on the FULL (uncompacted) save.gameState", async () => {
    const player = createPlayer("player-gronn", "Gronn");
    const rival = createPlayer("player-rival", "Rival");
    getSaveById.mockReturnValue({ gameState: createGameState(player, rival) });

    const { GET } = await import("@/app/api/singleplayer-state/player-discipline-ranks/route");
    const response = await GET(
      new Request(
        `http://localhost/api/singleplayer-state/player-discipline-ranks?saveId=save-1&playerId=${player.id}`,
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.seasonPointsRankByDisciplineId.basketball).toBe(2);
  });

  it(
    'masks the ranks for a non-"exact" visibility (fremdes/gescoutetes Team) — leer statt echter Zahlen',
    async () => {
      // Der Fog-of-War-Bypass (`DEBUG_FORCE_PLAYER_VISIBILITY`, Default AN
      // während der Bauphase) zwingt sonst jeden Lese-Pfad auf "exact" — siehe
      // `tests/player-detail-drawer.test.ts` (`buildDrawerWithFogOfWar`).
      // Gezielt aus, Modul-Cache frisch laden, danach wieder aufräumen.
      vi.resetModules();
      vi.stubEnv("NEXT_PUBLIC_DEBUG_PLAYER_ATTRIBUTES", "0");
      try {
        const player = createPlayer("player-gronn", "Gronn");
        const rival = createPlayer("player-rival", "Rival");
        getSaveById.mockReturnValue({ gameState: createGameState(player, rival) });

        const { GET } = await import("@/app/api/singleplayer-state/player-discipline-ranks/route");
        // teamId=team-3: weder Kader- noch manageable Team des Spielers -> "scouted".
        const response = await GET(
          new Request(
            `http://localhost/api/singleplayer-state/player-discipline-ranks?saveId=save-1&playerId=${player.id}&teamId=team-3`,
          ),
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.ok).toBe(true);
        expect(payload.seasonPointsRankByDisciplineId).toEqual({});
        expect(payload.allTimePointsRankByDisciplineId).toEqual({});
      } finally {
        vi.unstubAllEnvs();
        vi.resetModules();
      }
    },
    30_000,
  );
});
