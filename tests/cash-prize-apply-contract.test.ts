import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("cash prize apply contract", () => {
  it("exists as a blocked skeleton route", async () => {
    const route = await fs.readFile(
      path.join(process.cwd(), "app/api/season/cash-prize-apply/route.ts"),
      "utf8",
    );

    expect(route).toContain("previewCashPrizeApply");
    expect(route).toContain("executeCashPrizeApply");
    // The route grew beyond the original flat `dryRun ? 200 : result.canApply ? 200 : 409`
    // ternary into a write-authorized route (authorizeServerRoomWrite gate, per-source
    // 409/422 split) while keeping the same "blocked skeleton" contract: it still only
    // reports canApply/blockingReasons from previewCashPrizeApply/executeCashPrizeApply
    // and never silently applies. See docs/CASH_PRIZE_APPLY_PLAN.md ("Aktuell weiterhin
    // hart blockiert bei: ...") and lib/season/cash-prize-apply-service.ts, which still
    // requires an explicit confirm token before execute and returns ok:false with
    // blockingReasons whenever a gate fails. Assert the current blocking-status logic
    // instead of the retired literal ternary.
    expect(route).toContain('status: source === "prisma" ? 409 : 422');
  });

  it("documents allowed and forbidden tables for future apply paths", async () => {
    const standingsPlan = await fs.readFile(
      path.join(process.cwd(), "docs/STANDINGS_APPLY_PLAN.md"),
      "utf8",
    );
    const cashPlan = await fs.readFile(
      path.join(process.cwd(), "docs/CASH_PRIZE_APPLY_PLAN.md"),
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
