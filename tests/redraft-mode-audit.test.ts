import { describe, expect, it } from "vitest";

import { buildRedraftRunAudit, buildRedraftTeamSpendAudit } from "@/lib/ai/redraft-mode-audit";

describe("redraft mode audit", () => {
  it("classifies a top-up redraft when players existed before the run", () => {
    const audit = buildRedraftRunAudit({
      rosterBefore: 261,
      rosterAfter: 346,
      boughtPlayers: 85,
    });

    expect(audit.redraftMode).toBe("target_topup_redraft");
    expect(audit.preservedPlayers).toBe(261);
    expect(audit.boughtPlayers).toBe(85);
    expect(audit.warnings).toEqual([]);
  });

  it("classifies a full clean redraft when the run starts empty", () => {
    const audit = buildRedraftRunAudit({
      rosterBefore: 0,
      rosterAfter: 320,
      boughtPlayers: 320,
    });

    expect(audit.redraftMode).toBe("full_clean_redraft_from_empty");
    expect(audit.preservedPlayers).toBe(0);
  });

  it("explains spendRatio zero when a team was already at target", () => {
    const audit = buildRedraftTeamSpendAudit({
      teamCode: "P-C",
      actualRoster: 11,
      targetRoster: 10,
      boughtPlayers: 0,
      plannedSpend: 0,
      spendRatio: 0,
      laneDistributionCount: 0,
    });

    expect(audit.spendAuditReason).toBe("already_at_target_before_redraft_cash_untouched");
    expect(audit.warnings).toEqual([]);
  });

  it("flags zero spend as missing audit data when buys happened", () => {
    const audit = buildRedraftTeamSpendAudit({
      teamCode: "X-X",
      actualRoster: 10,
      targetRoster: 10,
      boughtPlayers: 2,
      plannedSpend: 0,
      spendRatio: 0,
      laneDistributionCount: 2,
    });

    expect(audit.spendAuditReason).toBe("redraft_audit_missing_preserved_roster_spend");
    expect(audit.warnings).toContain("redraft_audit_missing_preserved_roster_spend");
  });
});
