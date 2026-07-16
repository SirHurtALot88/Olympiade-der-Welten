import { describe, expect, it } from "vitest";

import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import {
  buildPlayerProfileSessionKey,
  getCachedPlayerProfileData,
  invalidatePlayerProfileSessionCache,
  setCachedPlayerProfileData,
} from "@/lib/foundation/player-profile-session-cache";

describe("player-profile-session-cache", () => {
  it("returns cached profile data for matching content signature", () => {
    const key = buildPlayerProfileSessionKey("save-1", "season-1", "player-1");
    const data = { playerId: "player-1", name: "Test" } as PlayerDetailDrawerData;
    setCachedPlayerProfileData(key, "sig-a", data);
    expect(getCachedPlayerProfileData(key, "sig-a")).toEqual(data);
    expect(getCachedPlayerProfileData(key, "sig-b")).toBeNull();
  });

  it("invalidates cached profiles for a season", () => {
    const key = buildPlayerProfileSessionKey("save-1", "season-2", "player-1");
    setCachedPlayerProfileData(key, "sig-a", { playerId: "player-1" } as PlayerDetailDrawerData);
    invalidatePlayerProfileSessionCache({ saveId: "save-1", seasonId: "season-2" });
    expect(getCachedPlayerProfileData(key, "sig-a")).toBeNull();
  });
});
