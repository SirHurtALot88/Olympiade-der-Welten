import { afterEach, describe, expect, it } from "vitest";

import {
  getLongRunPlannerMaxLeagueRounds,
  getLongRunPlannerMaxTeamCycles,
  isLongRunAllowDevServer,
  isLongRunContext,
  isLongRunFastProfile,
  isLongRunRequireNoDevServer,
  resolveBalanceProfile,
} from "@/lib/season/long-run-profile";

const ENV_KEYS = [
  "OLY_LONG_RUN_OUTPUT_DIR",
  "OLY_LONG_RUN_SAVE_ID",
  "OLY_LONG_RUN_LABEL",
  "OLY_LONG_RUN",
  "OLY_LONG_RUN_FAST",
  "OLY_LONG_RUN_BALANCE_PROFILE",
  "OLY_LONG_RUN_PLANNER_MAX_ROUNDS",
  "OLY_LONG_RUN_PLANNER_MAX_TEAM_CYCLES",
  "OLY_LONG_RUN_REQUIRE_NO_DEV_SERVER",
  "OLY_LONG_RUN_ALLOW_DEV_SERVER",
] as const;

describe("long-run-profile", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("detects long-run context from output dir env", () => {
    process.env.OLY_LONG_RUN_OUTPUT_DIR = "/tmp/out";
    expect(isLongRunContext()).toBe(true);
    expect(getLongRunPlannerMaxLeagueRounds()).toBe(5);
    expect(getLongRunPlannerMaxTeamCycles()).toBe(5);
    expect(isLongRunRequireNoDevServer()).toBe(true);
    expect(isLongRunAllowDevServer()).toBe(false);
  });

  it("honours explicit planner caps", () => {
    process.env.OLY_LONG_RUN_PLANNER_MAX_ROUNDS = "4";
    process.env.OLY_LONG_RUN_PLANNER_MAX_TEAM_CYCLES = "2";
    expect(getLongRunPlannerMaxLeagueRounds()).toBe(4);
    expect(getLongRunPlannerMaxTeamCycles()).toBe(2);
  });

  it("uses legacy defaults outside long-run context", () => {
    expect(isLongRunContext()).toBe(false);
    expect(getLongRunPlannerMaxLeagueRounds()).toBe(5);
    expect(getLongRunPlannerMaxTeamCycles()).toBe(5);
    expect(isLongRunRequireNoDevServer()).toBe(false);
  });

  it("defaults to iterate balance profile outside long-run context without fast paths", () => {
    expect(resolveBalanceProfile()).toBe("iterate");
    expect(isLongRunFastProfile()).toBe(false);
  });

  it("enables fast manager paths in long-run iterate profile", () => {
    process.env.OLY_LONG_RUN_OUTPUT_DIR = "/tmp/out";
    expect(resolveBalanceProfile()).toBe("iterate");
    expect(isLongRunFastProfile()).toBe(true);
  });

  it("audit profile disables fast manager paths unless OLY_LONG_RUN_FAST=1", () => {
    process.env.OLY_LONG_RUN_BALANCE_PROFILE = "audit";
    expect(resolveBalanceProfile()).toBe("audit");
    expect(isLongRunFastProfile()).toBe(false);
    process.env.OLY_LONG_RUN_FAST = "1";
    expect(isLongRunFastProfile()).toBe(true);
  });

  it("does not enable fast profile merely from long-run context", () => {
    process.env.OLY_LONG_RUN_SAVE_ID = "save-1";
    process.env.OLY_LONG_RUN_BALANCE_PROFILE = "audit";
    expect(isLongRunFastProfile()).toBe(false);
  });
});
