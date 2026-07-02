function envFlag(name: string): boolean {
  const value = process.env[name];
  return value === "1" || value === "true";
}

/** True when a long-run sandbox / pipeline env is active. */
export function isLongRunContext(): boolean {
  return Boolean(
    process.env.OLY_LONG_RUN_OUTPUT_DIR ||
      process.env.OLY_LONG_RUN_SAVE_ID ||
      process.env.OLY_LONG_RUN_LABEL ||
      envFlag("OLY_LONG_RUN"),
  );
}

/** Fast profile: skip verbose manager paths and filter redundant actions. */
export function isLongRunFastProfile(): boolean {
  return envFlag("OLY_LONG_RUN_FAST") || isLongRunContext();
}

export function getLongRunPlannerMaxLeagueRounds(): number {
  const raw = process.env.OLY_LONG_RUN_PLANNER_MAX_ROUNDS;
  if (raw != null && raw !== "") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 2;
  }
  return isLongRunContext() ? 2 : 3;
}

export function getLongRunPlannerMaxTeamCycles(): number {
  const raw = process.env.OLY_LONG_RUN_PLANNER_MAX_TEAM_CYCLES;
  if (raw != null && raw !== "") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 3;
  }
  return isLongRunContext() ? 3 : 5;
}

/** Default true in long-run context unless explicitly disabled. */
export function isLongRunRequireNoDevServer(): boolean {
  if (process.env.OLY_LONG_RUN_REQUIRE_NO_DEV_SERVER === "0") return false;
  if (process.env.OLY_LONG_RUN_REQUIRE_NO_DEV_SERVER === "1") return true;
  return isLongRunContext();
}

/** Default false — set OLY_LONG_RUN_ALLOW_DEV_SERVER=1 to bypass the dev-server guard. */
export function isLongRunAllowDevServer(): boolean {
  return envFlag("OLY_LONG_RUN_ALLOW_DEV_SERVER");
}
