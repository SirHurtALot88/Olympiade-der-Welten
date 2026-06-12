import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("legacy resolve lab ui contract", () => {
  it("renders selected team preview as separate d1 and d2 blocks", async () => {
    const [fileText, cssText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/legacy-resolve-lab/LegacyResolveLabClient.tsx",
        "utf8",
      ),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css",
        "utf8",
      ),
    ]);

    expect(fileText).toContain("selectedTeamD1Preview");
    expect(fileText).toContain("selectedTeamD2Preview");
    expect(fileText).toContain('label: "D1"');
    expect(fileText).toContain('label: "D2"');
    expect(fileText).toContain("legacy-resolve-side-grid");
    expect(fileText).toContain("legacy-resolve-side-panel-d1");
    expect(fileText).toContain("legacy-resolve-side-panel-d2");
    expect(fileText).toContain("Status {getResolveStatusLabel");
    expect(fileText).toContain("Base:");
    expect(fileText).toContain("Fatigue:");
    expect(fileText).toContain("Captain:");
    expect(fileText).toContain("Total:");
    expect(fileText).toContain("Keine eingesetzten Spieler auf dieser Seite vorhanden.");
    expect(cssText).toContain(".legacy-resolve-side-grid");
    expect(cssText).toContain(".legacy-resolve-side-panel-d1");
    expect(cssText).toContain(".legacy-resolve-side-panel-d2");
    expect(cssText).toContain(".legacy-resolve-side-kpis");
    expect(cssText).toContain(".legacy-resolve-player-row");
  });
});
