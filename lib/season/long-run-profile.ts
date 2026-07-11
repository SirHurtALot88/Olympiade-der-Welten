export type LongRunBalanceProfile = "iterate" | "audit";

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

/** iterate = manager fast paths; audit = full manager + training backfill. */
export function resolveBalanceProfile(): LongRunBalanceProfile {
  const raw = (process.env.OLY_LONG_RUN_BALANCE_PROFILE ?? "iterate").trim().toLowerCase();
  return raw === "audit" ? "audit" : "iterate";
}

/** Fast profile: skip verbose manager paths — long-run/sandbox only (or explicit OLY_LONG_RUN_FAST). */
export function isLongRunFastProfile(): boolean {
  if (envFlag("OLY_LONG_RUN_FAST")) return true;
  if (!isLongRunContext()) return false;
  return resolveBalanceProfile() === "iterate";
}

/**
 * 3 rounds proved insufficient in practice: teams that failed to find a buy in a
 * single cycle were marked exhausted and pushed onto the emergency-"repair" pick
 * path instead of the real market engine (observed emergency-filler rates of
 * 48-76% in S2/S3/S5 of the S1-S5 balancing run, vs. <15% target). 5 rounds gives
 * teams more chances as the candidate pool shifts across rounds, matching what the
 * historical "Run 5" baseline (29/32 teams at Opt) used.
 */
const DEFAULT_PLANNER_LEAGUE_ROUNDS = 5;
const DEFAULT_PLANNER_TEAM_CYCLES = 5;

export function getLongRunPlannerMaxLeagueRounds(): number {
  const raw = process.env.OLY_LONG_RUN_PLANNER_MAX_ROUNDS;
  if (raw != null && raw !== "") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : DEFAULT_PLANNER_LEAGUE_ROUNDS;
  }
  return DEFAULT_PLANNER_LEAGUE_ROUNDS;
}

export function getLongRunPlannerMaxTeamCycles(): number {
  const raw = process.env.OLY_LONG_RUN_PLANNER_MAX_TEAM_CYCLES;
  if (raw != null && raw !== "") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : DEFAULT_PLANNER_TEAM_CYCLES;
  }
  return DEFAULT_PLANNER_TEAM_CYCLES;
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
