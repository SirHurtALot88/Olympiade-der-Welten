import { describe, expect, it } from "vitest";

import {
  buildGameStateContentSignature,
  getSeasonDerivations,
  pickRatingsForPlayerIds,
} from "@/lib/foundation/get-season-derivations";
import {
  buildSeasonDerivationsCacheKey,
  invalidateSeasonDerivationsCache,
  readSeasonDerivationsCache,
  writeSeasonDerivationsCache,
  type SeasonDerivations,
} from "@/lib/foundation/season-derivations-cache";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";

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

describe("season derivations cache", () => {
  it("reuses cached derivations for the same content signature", () => {
    const gameState = createSingleplayerGameState();
    const saveId = "save-derivations-test";
    const signature = buildGameStateContentSignature(gameState);
    const cacheKey = buildSeasonDerivationsCacheKey(saveId, gameState.season.id);

    invalidateSeasonDerivationsCache(saveId);

    const first = getSeasonDerivations({ gameState, saveId, contentSignature: signature });
    const cached = readSeasonDerivationsCache(cacheKey, signature);

    expect(cached).not.toBeNull();
    expect(cached?.ledger.pointEntries.length).toBe(first.ledger.pointEntries.length);
    expect(cached?.ratingsById.size).toBe(first.ratingsById.size);
    expect(cached?.performanceByPlayerId.size).toBe(first.performanceByPlayerId.size);

    const second = getSeasonDerivations({ gameState, saveId, contentSignature: signature });
    expect(second).toBe(first);
  });

  it("does not reuse payload when the signature changes", () => {
    invalidateSeasonDerivationsCache("save-signature-test");

    const cacheKey = buildSeasonDerivationsCacheKey("save-signature-test", "season-1");
    writeSeasonDerivationsCache(cacheKey, "sig-a", emptyDerivations());

    expect(readSeasonDerivationsCache(cacheKey, "sig-b")).toBeNull();
  });

  it("invalidates only the targeted save cache entries", () => {
    invalidateSeasonDerivationsCache();

    writeSeasonDerivationsCache("save-a:season-1", "sig-a", emptyDerivations());
    writeSeasonDerivationsCache("save-b:season-1", "sig-b", emptyDerivations());

    invalidateSeasonDerivationsCache("save-a");

    expect(readSeasonDerivationsCache("save-a:season-1", "sig-a")).toBeNull();
    expect(readSeasonDerivationsCache("save-b:season-1", "sig-b")).not.toBeNull();
  });

  it("picks only requested player ratings", () => {
    const ratings = new Map([
      ["p1", { playerId: "p1", ovrNormalized: 80 } as never],
      ["p2", { playerId: "p2", ovrNormalized: 70 } as never],
      ["p3", { playerId: "p3", ovrNormalized: 60 } as never],
    ]);

    const picked = pickRatingsForPlayerIds(ratings, ["p1", "p3", "missing"]);
    expect(Array.from(picked.keys())).toEqual(["p1", "p3"]);
    expect(picked.get("p1")?.ovrNormalized).toBe(80);
  });
});
