import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const teamsV2Path = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/teams-v2/TeamsV2Client.tsx";
const foundationClientPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx";
const globalsPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css";

describe("teams v2 ui contract", () => {
  it("uses velo rider mini cards in roster grid", async () => {
    const fileText = await fs.readFile(teamsV2Path, "utf8");
    expect(fileText).toContain("VeloStatOrbitRow");
    expect(fileText).toContain("teams-v2-roster-grid");
    expect(fileText).toContain('data-testid="foundation-teams-v2"');
  });

  it("is wired from foundation teams view", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");
    expect(fileText).toContain("<TeamsV2Client");
    expect(fileText).toContain("teamsV2FocusCards");
  });

  it("has roster card styling", async () => {
    const cssText = await fs.readFile(globalsPath, "utf8");
    expect(cssText).toContain(".teams-v2-player-card");
  });

  it("wires sponsor choice panel and contract renewal negotiation", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");
    expect(fileText).toContain('data-testid="team-sponsor-choice"');
    expect(fileText).toContain("/api/sponsor/choose");
    expect(fileText).toContain("chooseTeamSponsor");
    expect(fileText).toContain("Commercial Rating");
    expect(fileText).toContain("openContractRenewalNegotiation");
    expect(fileText).toContain("confirmContractRenewalNegotiation");
    expect(fileText).toContain("contractRenewalNegotiation");
  });
});
