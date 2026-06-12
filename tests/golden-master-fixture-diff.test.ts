import { describe, expect, it } from "vitest";

import { diffGoldenMaster } from "@/lib/golden-master/fixture-diff";

describe("golden master fixture diff", () => {
  it("detects exact equality", () => {
    const result = diffGoldenMaster(
      { outputs: { points: 10, teams: ["A", "B"] } },
      { outputs: { points: 10, teams: ["A", "B"] } },
    );

    expect(result.exactMatch).toBe(true);
    expect(result.diffs).toEqual([]);
  });

  it("detects missing fields", () => {
    const result = diffGoldenMaster(
      { outputs: { points: 10, rank: 5 } },
      { outputs: { points: 10 } },
    );

    expect(result.exactMatch).toBe(false);
    expect(result.diffs.some((entry) => entry.kind === "missing_field" && entry.path === "root.outputs.rank")).toBe(true);
  });

  it("detects numeric deltas", () => {
    const result = diffGoldenMaster(
      { outputs: { points: 10 } },
      { outputs: { points: 10.5 } },
      { toleratedFloatDelta: 0.1 },
    );

    expect(result.exactMatch).toBe(false);
    expect(result.diffs[0]?.kind).toBe("numeric_delta");
  });

  it("can ignore volatile fields", () => {
    const result = diffGoldenMaster(
      { capturedAt: "2026-06-04T10:00:00.000Z", outputs: { points: 10 } },
      { capturedAt: "2026-06-04T10:10:00.000Z", outputs: { points: 10 } },
      { ignoredPaths: ["root.capturedAt"] },
    );

    expect(result.exactMatch).toBe(true);
  });
});
