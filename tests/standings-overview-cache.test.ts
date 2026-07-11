import { describe, expect, it } from "vitest";

import {
  invalidateStandingsOverviewCache,
  readStandingsOverviewCache,
  writeStandingsOverviewCache,
} from "@/lib/season/standings-overview-cache";

describe("standings overview cache", () => {
  it("does not reuse live-season payload signatures for archived season keys", () => {
    invalidateStandingsOverviewCache("save-test");

    const livePayload = {
      items: [{ teamId: "A-A", rank: 1 }],
      scope: { saveId: "save-test", seasonId: "season-2" },
      source: { kind: "local_save" },
    };
    writeStandingsOverviewCache("save-test:season-2", "sig-live|season-2|live", livePayload);

    const cached = readStandingsOverviewCache("save-test:season-2", "sig-live|season-2|season_snapshot");
    expect(cached).toBeNull();
  });
});
