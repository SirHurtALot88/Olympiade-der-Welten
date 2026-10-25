import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { makePlayer, makeRosterEntry, makeTeam } from "./_fixtures/game-entity-fixtures";

/**
 * Finding #178: `localMarketContextCache` war ein VOELLIG unbegrenztes `Map` -- kein
 * Eintrags-Deckel, kein Byte-Deckel. Jeder angefasste Save (der Schluessel enthaelt u. a.
 * `getPlayerPotentialCacheSignature()`, einen sortierten String-Dump ueber ALLE Spieler) erzeugte
 * einen neuen, nie verworfenen Eintrag. Diese Tests pruefen: (a) der Cache bleibt unter vielen
 * verschiedenen Saves beschraenkt -- sowohl in Eintragsanzahl als auch in der Byte-Schaetzung --
 * und (b) ein wiederverwendeter Save bleibt weiterhin ein Cache-Treffer (gleicher `cacheKey`),
 * das normale Verhalten aendert sich fuer den Normalfall nicht.
 */

const persistenceState = {
  save: null as
    | {
        saveId: string;
        gameState: GameState;
      }
    | null,
  saveSingleplayerState: vi.fn(),
};

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    bootstrapSingleplayerSave: () => ({
      save: persistenceState.save,
      createdFromSeed: false,
    }),
    getActiveSave: () => persistenceState.save,
    getSaveById: (saveId: string) => (persistenceState.save?.saveId === saveId ? persistenceState.save : null),
    saveSingleplayerState: (saveId: string, nextState: GameState) => {
      persistenceState.saveSingleplayerState(saveId, nextState);
      if (persistenceState.save && persistenceState.save.saveId === saveId) {
        persistenceState.save = {
          ...persistenceState.save,
          gameState: nextState,
        };
      }
      return persistenceState.save;
    },
  }),
}));

function createGameState(input: { teams: Team[]; players: Player[]; rosters: RosterEntry[] }): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    gamePhase: "transfer_sell_phase",
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: Object.fromEntries(input.teams.map((team) => [team.teamId, { points: 0 }])),
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: input.teams,
    teamIdentities: [],
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
  };
}

function buildSaveForId(saveId: string) {
  const team = makeTeam({ teamId: "A-A", cash: 175 });
  const players = [
    makePlayer({ id: `${saveId}-p1`, name: "Spieler Eins", marketValue: 40, displayMarketValue: 40 }),
    makePlayer({ id: `${saveId}-fa-1`, name: "Free Agent", marketValue: 25, displayMarketValue: 25 }),
  ];
  const rosters = [makeRosterEntry({ id: `${saveId}-r1`, teamId: "A-A", playerId: `${saveId}-p1` })];
  return {
    saveId,
    gameState: createGameState({ teams: [team], players, rosters }),
  };
}

describe("local market context cache bound", () => {
  beforeEach(() => {
    vi.resetModules();
    persistenceState.saveSingleplayerState.mockReset();
    persistenceState.save = buildSaveForId("save-singleplayer-dev");
  });

  it("stays bounded in entry count and byte estimate across many distinct saves", async () => {
    const {
      listLocalTransfermarktFreeAgents,
      localMarketContextCacheSizeForTests,
      localMarketContextCacheApproxBytesForTests,
      getLocalMarketContextCacheMaxEntries,
      getLocalMarketContextCacheMaxBytes,
    } = await import("@/lib/market/transfermarkt-local-service");

    for (let index = 0; index < 40; index += 1) {
      const saveId = `cache-bound-save-${index}`;
      persistenceState.save = buildSaveForId(saveId);
      listLocalTransfermarktFreeAgents({
        saveId,
        seasonId: "season-1",
        teamId: "A-A",
        limit: 10,
      });
    }

    expect(localMarketContextCacheSizeForTests()).toBeLessThanOrEqual(getLocalMarketContextCacheMaxEntries());
    expect(localMarketContextCacheApproxBytesForTests()).toBeLessThanOrEqual(getLocalMarketContextCacheMaxBytes());
  });

  it("keeps a reused save's context as a cache hit (unchanged normal-case behavior)", async () => {
    const { listLocalTransfermarktFreeAgents, localMarketContextCacheSizeForTests } = await import(
      "@/lib/market/transfermarkt-local-service"
    );

    const saveId = "reused-save";
    persistenceState.save = buildSaveForId(saveId);

    const first = listLocalTransfermarktFreeAgents({ saveId, seasonId: "season-1", teamId: "A-A", limit: 10 });
    const sizeAfterFirst = localMarketContextCacheSizeForTests();

    // Same save, same content -- a second call must not grow the cache (same `cacheKey`, a hit,
    // not a fresh `buildLocalMarketContext` entry).
    const second = listLocalTransfermarktFreeAgents({ saveId, seasonId: "season-1", teamId: "A-A", limit: 10 });
    const sizeAfterSecond = localMarketContextCacheSizeForTests();

    expect(sizeAfterSecond).toBe(sizeAfterFirst);
    expect(second.items.map((item) => item.playerId)).toEqual(first.items.map((item) => item.playerId));
  });

  it("evicts the oldest entry once the entry-count cap is lowered below the touched save count", async () => {
    const {
      listLocalTransfermarktFreeAgents,
      setLocalMarketContextCacheMaxEntries,
      getLocalMarketContextCacheMaxEntries,
      localMarketContextCacheSizeForTests,
    } = await import("@/lib/market/transfermarkt-local-service");

    const originalMaxEntries = getLocalMarketContextCacheMaxEntries();
    setLocalMarketContextCacheMaxEntries(3);

    for (let index = 0; index < 6; index += 1) {
      const saveId = `lru-save-${index}`;
      persistenceState.save = buildSaveForId(saveId);
      listLocalTransfermarktFreeAgents({ saveId, seasonId: "season-1", teamId: "A-A", limit: 10 });
    }

    expect(localMarketContextCacheSizeForTests()).toBe(3);

    setLocalMarketContextCacheMaxEntries(originalMaxEntries);
  });
});
