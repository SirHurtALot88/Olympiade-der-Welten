import { describe, expect, it } from "vitest";

import {
  buildFeatureAuditMatrix,
  filterFeatureAuditEntries,
  getFeatureAuditFlags,
  type FeatureAuditEntry,
} from "@/lib/foundation/feature-audit-matrix";

describe("feature audit matrix", () => {
  it("builds a central registry with the requested core feature groups", () => {
    const matrix = buildFeatureAuditMatrix({ generatedAt: "2026-06-13T00:00:00.000Z" });

    expect(matrix.entries.length).toBeGreaterThanOrEqual(30);
    expect(matrix.entries.map((entry) => entry.category)).toEqual(
      expect.arrayContaining([
        "Core Save",
        "Multiplayer",
        "Transfermarkt",
        "Training",
        "Facilities",
        "XP / Progression",
        "Contracts",
        "Lineups",
        "Formkarten",
        "Mutatoren",
        "Matchday Resolve",
        "Arena",
        "Standings",
        "Preisgeld",
        "Season Review",
        "Pre-Season",
        "AI Market",
        "Redraft",
        "Home Screen",
        "Flow Controller",
        "Board/Sponsor",
        "Scouting/Potential",
        "Baseline",
      ]),
    );
  });

  it("marks missing tests and missing smoke coverage", () => {
    const matrix = buildFeatureAuditMatrix({ generatedAt: "2026-06-13T00:00:00.000Z" });
    const scouting = matrix.entries.find((entry) => entry.featureId === "scouting-potential");
    const xpAutoSpend = matrix.entries.find((entry) => entry.featureId === "ai-xp-auto-spend");

    expect(scouting).toBeTruthy();
    expect(getFeatureAuditFlags(scouting as FeatureAuditEntry)).toEqual(
      expect.objectContaining({ missingTests: false, missingSmoke: false }),
    );
    expect(xpAutoSpend).toBeTruthy();
    expect(getFeatureAuditFlags(xpAutoSpend as FeatureAuditEntry)).toEqual(
      expect.objectContaining({ missingSmoke: true }),
    );
    expect(matrix.summary.missingSmoke).toBeGreaterThanOrEqual(1);
  });

  it("flags local-write features without write-safety", () => {
    const sample: FeatureAuditEntry = {
      featureId: "sample",
      label: "Sample",
      category: "Transfermarkt",
      status: "local_write",
      views: [],
      writePaths: ["sample.ts"],
      testCoverage: ["sample.test.ts"],
      smokeCoverage: ["app:smoke-gameplay"],
      knownBlockers: [],
      proofFiles: [],
      writeSafety: "missing",
      multiplayerReady: false,
      sandboxOnly: true,
      prodReady: false,
      lastChecked: "test",
    };

    expect(getFeatureAuditFlags(sample).localWriteWithoutWriteSafety).toBe(true);
  });

  it("filters blockers, preview-only, local-write, missing-smoke and multiplayer-missing", () => {
    const matrix = buildFeatureAuditMatrix({ generatedAt: "2026-06-13T00:00:00.000Z" });

    expect(filterFeatureAuditEntries(matrix.entries, "blockers").every((entry) => entry.knownBlockers.length > 0)).toBe(true);
    expect(filterFeatureAuditEntries(matrix.entries, "preview-only").every((entry) => entry.status === "preview" || entry.status === "planned")).toBe(true);
    expect(filterFeatureAuditEntries(matrix.entries, "local-write").every((entry) => entry.status === "local_write")).toBe(true);
    expect(filterFeatureAuditEntries(matrix.entries, "missing-smoke").every((entry) => getFeatureAuditFlags(entry).missingSmoke)).toBe(true);
    expect(filterFeatureAuditEntries(matrix.entries, "multiplayer-missing").every((entry) => !entry.multiplayerReady)).toBe(true);
  });
});
