import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

// FoundationPageClient.tsx is now a 25-line wrapper; the Pre-Season Workflow
// UI lives in FoundationCockpitPanel.tsx, with request wiring in cockpit-handlers.ts.
const cockpitPanelPath = path.join(process.cwd(), "app/foundation/cockpit-v2/FoundationCockpitPanel.tsx");
const cockpitHandlersPath = path.join(process.cwd(), "lib/foundation/tabs/cockpit-handlers.ts");

describe("pre-season workflow ui contract", () => {
  it("renders the pre-season wizard with explicit human ai split and confirm-only next season apply", async () => {
    const [panelText, handlersText] = await Promise.all([
      fs.readFile(cockpitPanelPath, "utf8"),
      fs.readFile(cockpitHandlersPath, "utf8"),
    ]);
    const fileText = `${panelText}\n${handlersText}`;

    expect(fileText).toContain("Pre-Season Workflow");
    expect(fileText).toContain("/api/season/preseason-workflow");
    expect(fileText).toContain("Pre-Season Preview laden");
    expect(fileText).toContain("Saisonwechsel-Assistent prüfen");
    expect(fileText).toContain("Geführte Teams: warten auf deine Entscheidung");
    expect(fileText).toContain("Auto-Teams: Verkauf/Kauf bereit");
    expect(fileText).toContain("Beobachtete Teams: übersprungen");
    // "Preisgeld & Finanzen" -> "Sponsor & Finanzen": prize money is now only a
    // background benchmark (see "Preisgeld ist nur noch Hintergrund-Benchmark"
    // / "Preisgeld ist nur Benchmark" comments nearby), sponsor payouts are the
    // real cash flow now, so the section was relabeled to match.
    expect(fileText).toContain("Sponsor & Finanzen");
    expect(fileText).toContain("Sponsor");
    expect(fileText).toContain("Facilities");
    expect(fileText).toContain("Verlängern");
    // NOTE: "Season-End Review" no longer exists as a standalone label — the
    // closest surviving text is "Season Review" inside the
    // "Season-End Reihenfolge: Season Review, Sponsor & Finanzen, ..." hint
    // string, not the same exact heading. Left red rather than guessed at
    // (see final report).
    expect(fileText).toContain("Season-End Review");
    // NOTE: this exact inline comment is gone from preseason-workflow-service.ts
    // and everywhere else searched; the rankChangePrize computation itself
    // still exists there, but the explanatory comment does not. Left red
    // (see final report) rather than guessed at.
    expect(fileText).toContain("RankChange: Season 1 nutzt Startbudget als StartRank");
    expect(fileText).toContain("already_applied");
    expect(fileText).not.toContain("confirmToken: setupStep.confirmToken");
  });
});
