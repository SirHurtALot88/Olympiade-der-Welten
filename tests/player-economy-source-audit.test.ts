import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildEconomyAuditSummary, classifyEconomyComparison, isScaleMismatch } from "@/scripts/audit-player-economy-source";
import fs from "node:fs/promises";

describe("player economy source audit helpers", () => {
  it("detects likely scale mismatches", () => {
    expect(isScaleMismatch(100, 100000)).toBe(true);
    expect(isScaleMismatch(10000, 10)).toBe(true);
    expect(isScaleMismatch(8000, 8000)).toBe(false);
  });

  it("classifies exact source/db/service matches", () => {
    expect(
      classifyEconomyComparison({
        playerName: "Umbros",
        playerId: "player-1",
        sourceMarketValue: 85000,
        dbMarketValue: 85000,
        sourceSalaryDemand: 8000,
        dbSalaryDemand: 8000,
        activePlayerSalary: null,
        transfermarktServiceMarketValue: 85000,
        transfermarktServiceSalary: 8000,
      }),
    ).toBe("match");
  });

  it("flags fallback usage when service values differ from db values", () => {
    expect(
      classifyEconomyComparison({
        playerName: "Umbros",
        playerId: "player-1",
        sourceMarketValue: 85000,
        dbMarketValue: 85000,
        sourceSalaryDemand: 8000,
        dbSalaryDemand: 8000,
        activePlayerSalary: null,
        transfermarktServiceMarketValue: 100000,
        transfermarktServiceSalary: 10000,
      }),
    ).toBe("fallback_used");
  });

  it("summarizes mismatches and matches", () => {
    const summary = buildEconomyAuditSummary([
      {
        playerName: "A",
        playerId: "a",
        sourceMarketValue: 100000,
        dbMarketValue: 100000,
        sourceSalaryDemand: 10000,
        dbSalaryDemand: 10000,
        activePlayerSalary: null,
        transfermarktServiceMarketValue: 100000,
        transfermarktServiceSalary: 10000,
        status: "match",
      },
      {
        playerName: "B",
        playerId: "b",
        sourceMarketValue: 100,
        dbMarketValue: 100000,
        sourceSalaryDemand: 10,
        dbSalaryDemand: 10000,
        activePlayerSalary: null,
        transfermarktServiceMarketValue: 100000,
        transfermarktServiceSalary: 10000,
        status: "scale_mismatch",
      },
    ]);

    expect(summary.exactMatches).toBe(1);
    expect(summary.scaleMismatchCandidates).toBe(1);
    expect(summary.sourceHasMarketValue).toBe(2);
    expect(summary.dbHasSalary).toBe(2);
  });

  it("contains distribution outputs for default-value suspicion and locale signals", async () => {
    const fileText = await fs.readFile(
      path.join(process.cwd(), "scripts/audit-player-economy-source.ts"),
      "utf8",
    );

    expect(fileText).toContain("marketValue100000Count");
    expect(fileText).toContain("salaryDemand10000Count");
    expect(fileText).toContain("rawFieldInventory");
    expect(fileText).toContain("localeSuspicion");
    expect(fileText).toContain("defaultValueWarning");
  });
});
