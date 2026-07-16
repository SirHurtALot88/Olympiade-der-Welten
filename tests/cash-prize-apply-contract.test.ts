import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("cash prize apply contract", () => {
  it("exists as a blocked skeleton route", async () => {
    const route = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/api/season/cash-prize-apply/route.ts",
      "utf8",
    );

    expect(route).toContain("previewCashPrizeApply");
    expect(route).toContain("executeCashPrizeApply");
    expect(route).toContain("status: dryRun ? 200 : result.canApply ? 200 : 409");
  });

  it("documents allowed and forbidden tables for future apply paths", async () => {
    const standingsPlan = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/docs/STANDINGS_APPLY_PLAN.md",
      "utf8",
    );
    const cashPlan = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/docs/CASH_PRIZE_APPLY_PLAN.md",
      "utf8",
    );

    expect(standingsPlan).toContain("TeamSeasonState");
    expect(standingsPlan).toContain("keine Cash-/Preisgeld-Writes");
    expect(standingsPlan).toContain("keine Transfer-Writes");
    expect(cashPlan).toContain("TeamSeasonState");
    expect(cashPlan).toContain("keine Aenderung an Standings-Raengen");
    expect(cashPlan).toContain("keine Transferhistorie-Aenderung");
  });
});
