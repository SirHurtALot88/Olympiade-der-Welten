import { describe, expect, it } from "vitest";

import {
  formatAiLineupAuditWarning,
  formatCockpitReason,
  formatHomeWarningLabel,
  formatMatchdayMvpWarning,
  formatObjectiveStatusLabel,
  formatSeasonCompletionStepStatus,
  getAiTransferBudgetLabel,
  getAiTransferRosterLabel,
  getAiTransferStatusLabel,
  getAiTransferStatusPillClass,
  getCockpitStatusLabel,
  getCockpitStatusPillClass,
  getCockpitStepTone,
  getGameFlowStatusClass,
  getGameFlowStatusLabel,
  getSeasonCompletionStepTone,
  mapAutoRunStatusToCockpitStatus,
} from "@/lib/foundation/tabs/cockpit-ui-helpers";

describe("cockpit ui helpers", () => {
  it("maps cockpit step status to tone and labels", () => {
    expect(getCockpitStepTone("applied")).toBe("is-applied");
    expect(getCockpitStepTone("ready")).toBe("is-ready");
    expect(getCockpitStepTone("warning")).toBe("is-warning");
    expect(getCockpitStepTone("blocked")).toBe("is-blocked");
    expect(getCockpitStepTone("open")).toBe("is-open");

    expect(getCockpitStatusLabel("applied")).toBe("angewendet");
    expect(getCockpitStatusLabel("open")).toBe("offen");
    expect(getCockpitStatusPillClass("ready")).toBe("pill cockpit-status-pill cockpit-status-pill-ready");
  });

  it("maps game flow status to labels and classes", () => {
    expect(getGameFlowStatusLabel("ready")).toBe("bereit");
    expect(getGameFlowStatusLabel("applying")).toBe("laeuft");
    expect(getGameFlowStatusClass("completed")).toBe("is-completed");
    expect(getGameFlowStatusClass("warning")).toBe("is-warning");
  });

  it("normalizes auto-run status into cockpit status", () => {
    expect(mapAutoRunStatusToCockpitStatus("planned")).toBe("ready");
    expect(mapAutoRunStatusToCockpitStatus("skipped")).toBe("warning");
    expect(mapAutoRunStatusToCockpitStatus("applied")).toBe("applied");
    expect(mapAutoRunStatusToCockpitStatus(null)).toBe("open");
  });

  it("labels AI transfer status, budget and roster gaps", () => {
    expect(getAiTransferStatusLabel("no_sell_need")).toBe("halten");
    expect(getAiTransferStatusPillClass("ready")).toContain("is-ready");
    expect(getAiTransferStatusPillClass("blocked")).toContain("is-blocked");
    expect(getAiTransferBudgetLabel("critical")).toBe("kritisch");
    expect(getAiTransferRosterLabel("under_min")).toBe("unter Min");
  });

  it("formats reasons and warnings with fallbacks", () => {
    expect(formatCockpitReason("insufficient_cash")).toBe("Nicht genug Cash fuer dieses Upgrade.");
    expect(formatObjectiveStatusLabel("at_risk")).toBe("unter Druck");
    expect(formatSeasonCompletionStepStatus("already_done")).toBe("schon erledigt");
    expect(getSeasonCompletionStepTone("skipped")).toBe("is-warning");
    expect(formatAiLineupAuditWarning("ai_captain_unused")).toBe("Captain wurde nicht genutzt.");
    expect(formatHomeWarningLabel("no_active_team")).toBe("Kein aktives Team");
    expect(formatMatchdayMvpWarning("Sturm: target_roster_size_missing")).toContain("Wunschkader");
  });
});
