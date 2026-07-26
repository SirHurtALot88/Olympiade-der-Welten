import { describe, expect, it } from "vitest";

import {
  filterHardOpenTechnicalBugs,
  isSoftLongRunBlocker,
  isSoftOpenTechnicalBug,
  isSoftPhaseAuditRed,
} from "@/lib/season/long-run-soft-blockers";

describe("long-run-soft-blockers", () => {
  it("treats roster repair forbidden as hard now that policy always allows repair", () => {
    // `isTransferActionAllowed` in transfer-season-policy.ts always returns `true` now (2026-07-04
    // "course correction", siehe Kommentar dort: "All transfer actions are allowed in every season,
    // including season 1" / "No S1 buy source is forbidden anymore"). Der
    // `!isTransferActionAllowed(...)`-Soft-Zweig in isSoftLongRunBlocker kann dadurch nie mehr
    // greifen — roster_hard_gate_repair_forbidden ist jetzt in JEDER Saison ein echter (harter)
    // Blocker, nicht mehr ein erwarteter S1-Policy-Artefakt.
    const blocker = "roster_hard_gate_repair_forbidden:season-1:B-P";
    expect(isSoftLongRunBlocker("season-1", blocker)).toBe(false);
    expect(isSoftOpenTechnicalBug(`season-1:${blocker}`)).toBe(false);
  });

  it("keeps S2 roster repair forbidden as hard when repair is allowed", () => {
    const blocker = "roster_hard_gate_repair_forbidden:season-2:B-P";
    expect(isSoftLongRunBlocker("season-2", blocker)).toBe(false);
  });

  it("keeps roster_hard_gate_repair_forbidden as a hard bug in openTechnicalBugs list", () => {
    // Siehe Kommentar im ersten Test: seit der Transfer-Policy-Korrektur ist repair_forbidden in
    // keiner Saison mehr ein Soft-Blocker, also filtert filterHardOpenTechnicalBugs hier nichts mehr.
    const bugs = [
      "season-1:roster_hard_gate_repair_forbidden:season-1:B-P",
      "season-2:roster_hard_gate_below_min:T-G",
    ];
    expect(filterHardOpenTechnicalBugs(bugs)).toEqual(bugs);
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
