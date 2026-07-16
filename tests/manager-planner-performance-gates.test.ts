import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

describe("manager planner performance gates", () => {
  it("keeps AI sell preview on the cached sale-factor path", () => {
    const source = readRepoFile("lib/ai/ai-transfermarkt-sell-preview-service.ts");

    expect(source).toContain("buildSellPreviewRunCache");
    expect(source).toContain("buildTransfermarktSaleFactorBreakdown");
    expect(source).toContain("needsEvaluationCount");
    expect(source).not.toContain("previewLocalTransfermarktSell");
  });

  it("shrinks AI buy candidate pools before full preview", () => {
    const source = readRepoFile("lib/ai/ai-transfermarkt-preview-service.ts");

    expect(source).toContain("marketValueSortedAsc");
    expect(source).toContain("candidateTokenCache");
    expect(source).toContain("candidateScans");
    expect(source).toContain("hardFilterCount");
    expect(source).toContain("fullBuyPreviewCount");
    expect(source).toContain("item.marketValue > budget");
    expect(source).toContain("Performance gate: avoid enriching the full market, but never take the first N rows blindly.");
  });

  it("exports the planner performance proof and lineup precompute design", () => {
    const source = readRepoFile("scripts/export-manager-planner-performance.ts");
    const requiredFiles = [
      "manager-planner-performance-summary.md",
      "manager-planner-performance-summary.json",
      "manager-planner-performance-baseline.md",
      "manager-planner-performance-baseline.json",
      "manager-planner-phase-timings.csv",
      "manager-planner-hotspots.csv",
      "manager-planner-before-after.csv",
      "manager-market-board-cache.csv",
      "manager-candidate-pool-stages.csv",
      "manager-preview-counts.csv",
      "manager-pick-performance.csv",
      "lineup-planner-performance-risk.md",
      "lineup-precompute-design.md",
    ];

    for (const fileName of requiredFiles) {
      expect(source).toContain(fileName);
    }
    expect(source).toContain("bestSlotsByPlayer");
    expect(source).toContain("bestPlayersBySlot");
    expect(source).toContain("availabilityByPlayer");
    expect(source).toContain("conflictKeyByPlayer");
  });
});
