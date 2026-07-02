import { describe, expect, it } from "vitest";

import {
  filterHardOpenTechnicalBugs,
  isSoftLongRunBlocker,
  isSoftOpenTechnicalBug,
  isSoftPhaseAuditRed,
} from "@/lib/season/long-run-soft-blockers";

describe("long-run-soft-blockers", () => {
  it("treats S1 roster repair forbidden as soft when policy blocks repair", () => {
    const blocker = "roster_hard_gate_repair_forbidden:season-1:B-P";
    expect(isSoftLongRunBlocker("season-1", blocker)).toBe(true);
    expect(isSoftOpenTechnicalBug(`season-1:${blocker}`)).toBe(true);
  });

  it("keeps S2 roster repair forbidden as hard when repair is allowed", () => {
    const blocker = "roster_hard_gate_repair_forbidden:season-2:B-P";
    expect(isSoftLongRunBlocker("season-2", blocker)).toBe(false);
  });

  it("filters soft bugs from openTechnicalBugs list", () => {
    const bugs = [
      "season-1:roster_hard_gate_repair_forbidden:season-1:B-P",
      "season-2:roster_hard_gate_below_min:T-G",
    ];
    expect(filterHardOpenTechnicalBugs(bugs)).toEqual(["season-2:roster_hard_gate_below_min:T-G"]);
  });

  it("treats organic-only xp phase blocks as soft", () => {
    const bug = "season-5:ai_xp:A-A:xp_spend_apply_phase_blocked:season_active";
    expect(isSoftOpenTechnicalBug(bug)).toBe(true);
    expect(filterHardOpenTechnicalBugs([bug])).toEqual([]);
  });

  it("treats building insufficient_cash manager skips as soft", () => {
    const bug = "season-6:manager_plan_preseason_season-6:A-A:maintain_building:insufficient_cash";
    expect(isSoftOpenTechnicalBug(bug)).toBe(true);
    expect(filterHardOpenTechnicalBugs([bug])).toEqual([]);
  });

  it("treats S2 preseason facilities_active audit RED as soft", () => {
    expect(isSoftPhaseAuditRed("facilities_active", "season-2", "preseason")).toBe(true);
    expect(isSoftPhaseAuditRed("facilities_active", "season-3", "preseason")).toBe(false);
    expect(isSoftPhaseAuditRed("facilities_active", "season-2", "season_end")).toBe(false);
  });
});
