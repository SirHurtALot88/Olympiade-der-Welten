import { describe, expect, it, beforeEach } from "vitest";

import {
  invalidateSeasonDerivationsCache,
  readSeasonDerivationsCache,
  seasonDerivationsCacheSizeForTests,
  setSeasonDerivationsCacheMaxEntries,
  writeSeasonDerivationsCache,
  type SeasonDerivations,
} from "@/lib/foundation/season-derivations-cache";

function emptyDerivations(): SeasonDerivations {
  return {
    ledger: {
      hasResultSource: false,
      pointEntries: [],
      pointEntriesByPerformanceId: new Map(),
      playerSummariesByPlayerId: new Map(),
      teamSummariesByTeamId: new Map(),
      warnings: [],
    },
    ratingsById: new Map(),
    performanceByPlayerId: new Map(),
  };
}

describe("season derivations cache LRU", () => {
  beforeEach(() => {
    invalidateSeasonDerivationsCache();
    setSeasonDerivationsCacheMaxEntries(4);
  });

  it("evicts oldest entries when max size is exceeded", () => {
    writeSeasonDerivationsCache("save-a:season-1", "sig-a", emptyDerivations());
    writeSeasonDerivationsCache("save-b:season-1", "sig-b", emptyDerivations());
    writeSeasonDerivationsCache("save-c:season-1", "sig-c", emptyDerivations());
    writeSeasonDerivationsCache("save-d:season-1", "sig-d", emptyDerivations());
    writeSeasonDerivationsCache("save-e:season-1", "sig-e", emptyDerivations());

    expect(seasonDerivationsCacheSizeForTests()).toBe(4);
    expect(readSeasonDerivationsCache("save-a:season-1", "sig-a")).toBeNull();
    expect(readSeasonDerivationsCache("save-e:season-1", "sig-e")).not.toBeNull();
  });
});
