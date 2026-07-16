import { describe, expect, it } from "vitest";

import { seedPlayerDirectorySliceCache } from "@/lib/foundation/use-player-directory-slice";

describe("usePlayerDirectorySlice cache seeding", () => {
  it("stores prefetched payload for reuse", () => {
    const scope = {
      saveId: "save-players-cache",
      seasonId: "season-1",
      contentSignature: "sig-players-cache",
    };

    seedPlayerDirectorySliceCache(scope, {
      scope,
      ratingsByPlayerId: {},
      performanceByPlayerId: { "player-a": { appearances: 3, totalPps: 12, sourceLabel: "Active Player" } },
      careerStatsByPlayerId: {},
      count: 1,
      warnings: [],
    });

    expect(scope.saveId).toBe("save-players-cache");
  });
});
