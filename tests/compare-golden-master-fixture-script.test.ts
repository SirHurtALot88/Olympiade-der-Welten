import { describe, expect, it } from "vitest";

import { parseArgs } from "@/scripts/compare-golden-master-fixture";

describe("golden compare script", () => {
  it("parses help mode", () => {
    const args = parseArgs(["--help"]);
    expect(args.help).toBe(true);
  });

  it("parses fixture and actual paths plus ignore rules", () => {
    const args = parseArgs([
      "--fixture",
      "references/golden-master-fixtures/standings/standings-before.json",
      "--actual",
      "tmp/standings-before.actual.json",
      "--ignore",
      "root.capturedAt",
      "--delta",
      "0.5",
    ]);

    expect(args.fixturePath).toContain("standings-before.json");
    expect(args.actualPath).toContain("standings-before.actual.json");
    expect(args.ignoredPaths).toEqual(["root.capturedAt"]);
    expect(args.toleratedFloatDelta).toBe(0.5);
  });

  it("stays read-only and does not write fixtures", async () => {
    const moduleText = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/scripts/compare-golden-master-fixture.ts",
        "utf8",
      ),
    );

    expect(moduleText).toContain("readFile");
    expect(moduleText).not.toContain("writeFile");
    expect(moduleText).not.toContain("appendFile");
  });
});
