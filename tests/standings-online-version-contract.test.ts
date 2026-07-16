import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("standings online-version contract", () => {
  const projectRoot = path.resolve(__dirname, "..");

  it("keeps ask-mode questions focused on the current online app version", () => {
    const text = fs.readFileSync(
      path.join(projectRoot, "docs", "RETOOL_ASK_MODE_QUESTIONS_STANDINGS_ECONOMY.md"),
      "utf8",
    );

    expect(text).not.toContain("Wie wird Fame berechnet?");
    expect(text).not.toContain("Gibt es Draws?");
    expect(text).not.toContain("Wie funktionieren Allianzen?");
    expect(text).not.toContain("Wie funktionieren Paarungen?");
  });

  it("keeps current standings fixtures free of active fame or pairing fields", () => {
    const files = [
      "matchday-1-global-score.example.json",
      "matchday-1-standings-before.example.json",
      "matchday-1-standings-after.example.json",
      "rank-to-points-table.example.json",
    ];

    for (const file of files) {
      const text = fs.readFileSync(
        path.join(projectRoot, "references", "golden-master-fixtures", "standings", file),
        "utf8",
      );

      expect(text).not.toContain("\"fame\"");
      expect(text).not.toContain("\"draws\"");
      expect(text).not.toContain("\"alliance\"");
      expect(text).not.toContain("\"points_for\"");
      expect(text).not.toContain("\"points_against\"");
    }
  });
});
