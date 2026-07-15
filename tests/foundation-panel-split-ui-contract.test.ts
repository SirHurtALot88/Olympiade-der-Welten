import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { readFoundationOrchestratorSource, readFoundationSurfaceSource } from "./foundation-orchestrator-source";

describe("foundation panel split ui contract", () => {
  it("routes heavy views through lazy foundation panels", async () => {
    const foundationText = await readFoundationOrchestratorSource(
      process.cwd(),
    );
    const foundationSurfaceText = await readFoundationSurfaceSource(
      process.cwd(),
    );
    const pageClientText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/FoundationPageClient.tsx"),
      "utf8",
    );

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
      path.join(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx"),
      "utf8",
    );
    expect(bodyText).not.toContain("<MatchdayArenaV2Client");
    expect(bodyText).not.toContain("<TransfermarktV2Client");
  });
});
