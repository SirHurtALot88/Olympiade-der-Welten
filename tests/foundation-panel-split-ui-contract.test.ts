import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("foundation panel split ui contract", () => {
  it("routes heavy views through lazy foundation panels", async () => {
    const foundationText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );

    expect(foundationText).toContain("FoundationShellRouterHomeV2");
    expect(foundationText).toContain("FoundationShellRouterSeasonV2");
    expect(foundationText).toContain("FoundationShellRouterLineup");
    expect(foundationText).toContain("FoundationShellRouterMarketV2");
    expect(foundationText).toContain("FoundationShellRouterMatchdayArena");
    expect(foundationText).toContain("FoundationShellRouterMatchdayArena");
    expect(foundationText).not.toContain("FoundationMatchdayArenaPanel");
    expect(foundationText).toContain("FoundationShellRouterTeams");
    expect(foundationText).toContain("shouldBuildHomeV2Overview");
    expect(foundationText).toContain("shouldBuildPlayerRatings");
    expect(foundationText).not.toContain("<MatchdayArenaV2Client");
    expect(foundationText).not.toContain("<TransfermarktV2Client");
  });
});
