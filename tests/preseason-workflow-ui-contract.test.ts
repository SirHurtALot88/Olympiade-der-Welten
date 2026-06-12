import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const foundationClientPath = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx";

describe("pre-season workflow ui contract", () => {
  it("renders the pre-season wizard with explicit human ai split and confirm-only next season apply", async () => {
    const fileText = await fs.readFile(foundationClientPath, "utf8");

    expect(fileText).toContain("Pre-Season Workflow");
    expect(fileText).toContain("/api/season/preseason-workflow");
    expect(fileText).toContain("Pre-Season Preview laden");
    expect(fileText).toContain("Saisonwechsel-Assistent prüfen");
    expect(fileText).toContain("Manual Teams: warten auf deine Entscheidung");
    expect(fileText).toContain("AI Teams: Auto-Sell/Buy bereit");
    expect(fileText).toContain("Passive Teams: uebersprungen");
    expect(fileText).toContain("Preisgeld & Finanzen");
    expect(fileText).toContain("Facilities");
    expect(fileText).toContain("Verlängern");
    expect(fileText).toContain("Season-End Review:");
    expect(fileText).toContain("RankChange: Season 1 nutzt Startbudget als StartRank");
    expect(fileText).toContain("already_applied");
    expect(fileText).not.toContain("confirmToken: setupStep.confirmToken");
  });
});
