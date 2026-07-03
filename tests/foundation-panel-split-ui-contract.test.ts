import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { readFoundationOrchestratorSource } from "./foundation-orchestrator-source";

describe("foundation panel split ui contract", () => {
  it("routes heavy views through lazy foundation panels", async () => {
    const foundationText = await readFoundationOrchestratorSource(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten",
    );
    const pageClientText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx",
      "utf8",
    );
    const foundationSurfaceText = foundationText + pageClientText;

    expect(foundationSurfaceText).toContain("FoundationShellRouterHomeV2");
    expect(foundationSurfaceText).toContain("FoundationShellRouterSeasonV2");
    expect(foundationSurfaceText).toContain("FoundationShellRouterLineup");
    expect(foundationSurfaceText).toContain("FoundationShellRouterMarketV2");
    expect(foundationSurfaceText).toContain("FoundationShellRouterMatchdayArena");
    expect(foundationSurfaceText).toContain("FoundationShellRouterMatchdayArena");
    expect(pageClientText).not.toContain("FoundationMatchdayArenaPanel");
    expect(foundationSurfaceText).toContain("FoundationShellRouterTeams");
    expect(foundationText).toContain("shouldBuildHomeV2Overview");
    expect(foundationText).toContain("shouldBuildPlayerRatings");
    const bodyText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationShellRouterBody.tsx",
      "utf8",
    );
    expect(bodyText).not.toContain("<MatchdayArenaV2Client");
    expect(bodyText).not.toContain("<TransfermarktV2Client");
  });
});
