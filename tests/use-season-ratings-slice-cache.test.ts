import { describe, expect, it } from "vitest";

import { pickRatingsForPlayerIds } from "@/lib/foundation/get-season-derivations";
import { hydrateSeasonRatingsSliceMap } from "@/lib/foundation/season-ratings-slice";
import { seedSeasonRatingsSliceCache } from "@/lib/foundation/use-season-ratings-slice";

describe("useSeasonRatingsSlice cache seeding", () => {
  it("reuses a full prefetch for a scoped roster request", () => {
    const scope = {
      saveId: "save-training-cache",
      seasonId: "season-1",
      contentSignature: "sig-training-cache",
    };

    seedSeasonRatingsSliceCache(
      { ...scope, source: "sqlite", playerIdsKey: "" },
      {
        scope,
        ratingsByPlayerId: {
          "player-a": {
            playerId: "player-a",
            rawOvrScore: 10,
            ovrNormalized: 55,
            ovrRank: 1,
            ppsSeason: 12,
            ppsSeasonRank: 1,
            ppPow: 3,
            ppPowRank: 1,
            ppSpe: 3,
            ppSpeRank: 1,
            ppMen: 3,
            ppMenRank: 1,
            ppSoc: 3,
            ppSocRank: 1,
            ratingPps: 12,
            mvs: 4,
            mvsRank: 1,
            marketValue: 1000,
            sourceStatus: "ready",
            warnings: [],
          },
          "player-b": {
            playerId: "player-b",
            rawOvrScore: 8,
            ovrNormalized: 50,
            ovrRank: 2,
            ppsSeason: 10,
            ppsSeasonRank: 2,
            ppPow: 2,
            ppPowRank: 2,
            ppSpe: 2,
            ppSpeRank: 2,
            ppMen: 2,
            ppMenRank: 2,
            ppSoc: 2,
            ppSocRank: 2,
            ratingPps: 10,
            mvs: 3,
            mvsRank: 2,
            marketValue: 900,
            sourceStatus: "ready",
            warnings: [],
          },
        },
        count: 2,
        warnings: [],
      },
    );

    const fullKey = `${scope.saveId}:${scope.seasonId}:${scope.contentSignature}:sqlite:`;
    expect(fullKey).toContain("save-training-cache");

    const fullMap = hydrateSeasonRatingsSliceMap({
      "player-a": {
        playerId: "player-a",
        rawOvrScore: 10,
        ovrNormalized: 55,
        ovrRank: 1,
        ppsSeason: 12,
        ppsSeasonRank: 1,
        ppPow: 3,
        ppPowRank: 1,
        ppSpe: 3,
        ppSpeRank: 1,
        ppMen: 3,
        ppMenRank: 1,
        ppSoc: 3,
        ppSocRank: 1,
        ratingPps: 12,
        mvs: 4,
        mvsRank: 1,
        marketValue: 1000,
        sourceStatus: "ready",
        warnings: [],
      },
      "player-b": {
        playerId: "player-b",
        rawOvrScore: 8,
        ovrNormalized: 50,
        ovrRank: 2,
        ppsSeason: 10,
        ppsSeasonRank: 2,
        ppPow: 2,
        ppPowRank: 2,
        ppSpe: 2,
        ppSpeRank: 2,
        ppMen: 2,
        ppMenRank: 2,
        ppSoc: 2,
        ppSocRank: 2,
        ratingPps: 10,
        mvs: 3,
        mvsRank: 2,
        marketValue: 900,
        sourceStatus: "ready",
        warnings: [],
      },
    });

    const scoped = pickRatingsForPlayerIds(fullMap, ["player-a"]);
    expect(scoped.size).toBe(1);
    expect(scoped.get("player-a")?.ovrNormalized).toBe(55);
  });
});
