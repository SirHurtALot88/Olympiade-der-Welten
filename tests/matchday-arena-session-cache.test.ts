import { describe, expect, it } from "vitest";

import {
  buildMatchdayArenaBaseSessionKey,
  buildMatchdayArenaResolveSessionKey,
  getMatchdayArenaBaseBundle,
  getMatchdayArenaResolvePreview,
  invalidateMatchdayArenaSessionCache,
  setMatchdayArenaBaseBundle,
  setMatchdayArenaResolvePreview,
} from "@/lib/foundation/matchday-arena-session-cache";

describe("matchday-arena-session-cache", () => {
  it("stores and retrieves arena base bundles by session key", () => {
    const key = buildMatchdayArenaBaseSessionKey({
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      teamId: "A-A",
      source: "sqlite",
    });
    setMatchdayArenaBaseBundle(key, { context: { ok: true }, scoreSummary: { warnings: [] } });
    expect(getMatchdayArenaBaseBundle<{ context: { ok: boolean } }>(key)?.context.ok).toBe(true);
  });

  it("stores resolve previews separately from base bundles", () => {
    const key = buildMatchdayArenaResolveSessionKey({
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      source: "sqlite",
    });
    setMatchdayArenaResolvePreview(key, { warnings: ["cached"] });
    expect(getMatchdayArenaResolvePreview<{ warnings: string[] }>(key)?.warnings).toEqual(["cached"]);
  });

  it("invalidates cache entries for a save", () => {
    const baseKey = buildMatchdayArenaBaseSessionKey({
      saveId: "save-2",
      seasonId: "season-1",
      matchdayId: "md-1",
      teamId: "A-A",
      source: "sqlite",
    });
    setMatchdayArenaBaseBundle(baseKey, { cached: true });
    invalidateMatchdayArenaSessionCache({ saveId: "save-2" });
    expect(getMatchdayArenaBaseBundle(baseKey)).toBeNull();
  });
});
