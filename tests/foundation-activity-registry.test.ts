import { describe, expect, it } from "vitest";

import { buildFoundationActivities } from "@/lib/foundation/foundation-activity-registry";

describe("foundation activity registry", () => {
  it("returns no activities when nothing is running", () => {
    expect(
      buildFoundationActivities({
        isSaveBusy: false,
        aiPreseasonBusy: false,
        aiPreseasonRun: null,
        aiLineupEnsureBusy: false,
        aiLineupEnsure: null,
        adminSimulationBusy: false,
        adminSimulationRun: null,
        seasonTransitionBusy: false,
        preSeasonWorkflowBusy: false,
        seasonStartResetBusy: false,
        newGameBusy: false,
        rosterFillBusy: false,
        adminBalancingBusy: false,
        cockpitBusyKey: null,
        aiTeamsCount: 12,
      }),
    ).toEqual([]);
  });

  it("maps long-running jobs into activity chips", () => {
    const activities = buildFoundationActivities({
      isSaveBusy: true,
      aiPreseasonBusy: true,
      aiPreseasonRun: {
        status: "running",
        mode: "setup_draft",
        aiTeamsTotal: 12,
        aiTeamsCompleted: 4,
        transferBuysApplied: 2,
        transferSellsApplied: 0,
        managerActionsApplied: 1,
        blockingReasons: [],
      },
      aiLineupEnsureBusy: true,
      aiLineupEnsure: {
        totalTeams: 10,
        readyTeams: 6,
        savedTeams: 0,
        existingLineups: 0,
        blockedTeams: 0,
        totalMs: null,
      },
      adminSimulationBusy: false,
      adminSimulationRun: {
        status: "running",
        currentOperation: "standings_apply",
        progressPct: 42,
        activePhase: "matchday",
      },
      seasonTransitionBusy: false,
      preSeasonWorkflowBusy: false,
      seasonStartResetBusy: false,
      newGameBusy: false,
      rosterFillBusy: false,
      adminBalancingBusy: false,
      cockpitBusyKey: "whole-season-dryrun",
      aiTeamsCount: 12,
    });

    expect(activities.map((entry) => entry.id)).toEqual([
      "save-load",
      "ai-preseason",
      "ai-lineup-ensure",
      "admin-season-sim",
      "cockpit-whole-season-dryrun",
    ]);
    expect(activities.find((entry) => entry.id === "admin-season-sim")?.progressPct).toBe(42);
    expect(activities.find((entry) => entry.id === "ai-preseason")?.progressPct).toBe(33);
  });

  it("shows a running chip while AI teams are re-picking (Ranks Nachpicken)", () => {
    const activities = buildFoundationActivities({
      isSaveBusy: false,
      aiPreseasonBusy: false,
      aiPreseasonRun: null,
      aiLineupEnsureBusy: false,
      aiLineupEnsure: null,
      adminSimulationBusy: false,
      adminSimulationRun: null,
      seasonTransitionBusy: false,
      preSeasonWorkflowBusy: false,
      seasonStartResetBusy: false,
      newGameBusy: false,
      rosterFillBusy: false,
      aiTeamsRefillBusy: true,
      adminBalancingBusy: false,
      cockpitBusyKey: null,
      aiTeamsCount: 12,
      showIdleReady: true,
    });

    const chip = activities.find((entry) => entry.id === "ai-teams-refill");
    expect(chip?.tone).toBe("running");
    // The busy chip suppresses the idle "Bereit" chip while picking runs.
    expect(activities.some((entry) => entry.id === "idle-ready")).toBe(false);
  });
});
