import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("legacy lineup velo ui contract", () => {
  it("shows role lanes and flow validation checklist", async () => {
    const fileText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx",
      "utf8",
    );
    const cssText = await fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css", "utf8");

    expect(fileText).toContain('data-testid="legacy-lineup-flow-checklist"');
    expect(fileText).toContain("legacy-lineup-role-lanes");
    expect(cssText).toContain(".legacy-lineup-flow-checklist");
    expect(cssText).toContain(".legacy-lineup-role-lane");
  });
});
