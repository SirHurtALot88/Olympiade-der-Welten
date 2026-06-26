import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { withNextSaveVersion } from "@/lib/persistence/persistence-service";

function createMinimalGameState(saveVersion?: number): GameState {
  return {
    saveVersion,
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: { seasonId: "season-1", schedule: [], standings: {} },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [],
    teamIdentities: [],
    players: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-26T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 0,
      unmappedPlayers: [],
    },
    disciplines: [],
  } as GameState;
}

describe("persistence save version", () => {
  it("bumps from stored version and ignores stale client payload", () => {
    const staleClientState = createMinimalGameState(3);
    const next = withNextSaveVersion(staleClientState, 7);
    expect(next.saveVersion).toBe(8);
  });

  it("starts at 1 when no stored version exists", () => {
    const next = withNextSaveVersion(createMinimalGameState(), undefined);
    expect(next.saveVersion).toBe(1);
  });
});
