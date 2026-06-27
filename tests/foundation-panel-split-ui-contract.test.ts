import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("foundation panel split ui contract", () => {
  it("routes heavy views through lazy foundation panels", async () => {
    const foundationText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );

    expect(foundationText).toContain("FoundationHomeV2Panel");
    expect(foundationText).toContain("FoundationSeasonV2Panel");
    expect(foundationText).toContain("FoundationLineupPanel");
    expect(foundationText).toContain("FoundationMatchdayArenaPanel");
    expect(foundationText).toContain("FoundationTransfermarktV2Panel");
    expect(foundationText).toContain("FoundationTeamsDetailPanel");
    expect(foundationText).toContain("shouldBuildHomeV2Overview");
    expect(foundationText).toContain("shouldBuildPlayerRatings");
    expect(foundationText).not.toContain("<MatchdayArenaV2Client");
    expect(foundationText).not.toContain("<TransfermarktV2Client");
  });
});
