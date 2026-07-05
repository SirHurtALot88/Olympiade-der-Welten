import type { Team, TeamIdentity } from "@/lib/data/olyDataTypes";

export const DEFAULT_ROSTER_MAX = 14;
/** Fixes Kader-Minimum für jedes Team (unabhängig von Sheet-/Identity-Daten). */
export const FIXED_ROSTER_MIN = 7;
/** Hartes Gameplay-Minimum bleibt 7, auch wenn Identity-Sheets höher planen. */
export const GAMEPLAY_HARD_ROSTER_MIN = FIXED_ROSTER_MIN;
export const DEFAULT_ROSTER_MIN_FLOOR = FIXED_ROSTER_MIN;

export type TeamRosterLimitInput = Pick<Team, "rosterLimit"> | null | undefined;
export type TeamRosterIdentityInput = Pick<TeamIdentity, "playerMin" | "playerOpt"> | null | undefined;

function finiteRounded(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

export function getTeamPlayerMax(team?: TeamRosterLimitInput, identity?: TeamRosterIdentityInput) {
  const teamLimit = finiteRounded(team?.rosterLimit);
  const playerMin = finiteRounded(identity?.playerMin);
  const playerOpt = finiteRounded(identity?.playerOpt);
  const requestedLimit = Math.max(teamLimit ?? 0, playerOpt ?? 0, playerMin ?? 0, DEFAULT_ROSTER_MAX);
  return Math.min(Math.max(requestedLimit, DEFAULT_ROSTER_MIN_FLOOR), DEFAULT_ROSTER_MAX);
}

export function clampRosterTargetToPlayerMax(target: number, team?: TeamRosterLimitInput, identity?: TeamRosterIdentityInput) {
  return Math.min(Math.max(0, Math.round(target)), getTeamPlayerMax(team, identity));
}

export function deriveRosterTargets(
  team?: TeamRosterLimitInput,
  identity?: TeamRosterIdentityInput,
  _fallbackMin = FIXED_ROSTER_MIN,
  fallbackOpt = 10,
) {
  const playerMax = getTeamPlayerMax(team, identity);
  // Kader-Minimum ist fix 8 für alle Teams (Sheet-/Identity-playerMin wird ignoriert).
  const playerMin = Math.min(FIXED_ROSTER_MIN, playerMax);
  const rawOpt = finiteRounded(identity?.playerOpt) ?? Math.max(fallbackOpt, playerMin);
  const playerOpt = Math.min(Math.max(rawOpt, playerMin), playerMax);
  return { playerMin, playerOpt, playerMax };
}

/**
 * Season-1 draft only: `playerOpt` alone leaves squads without depth for in-season fatigue
 * rotation and injury replacements, causing the draft to stop too early relative to available
 * cash. Scales a small additive buffer with squad size (bigger target squads run more fixtures'
 * worth of rotation risk) and clamps it to a modest 1-3 range so it never balloons the draft.
 */
export function resolveSeason1FatigueInjuryRosterBuffer(playerOpt: number) {
  return Math.max(1, Math.min(3, Math.round(playerOpt * 0.18)));
}

/** `playerOpt` + Season-1 fatigue/injury buffer, capped at `playerMax`. */
export function deriveSeason1TargetRosterSize(playerOpt: number, playerMax: number) {
  return Math.min(playerOpt + resolveSeason1FatigueInjuryRosterBuffer(playerOpt), playerMax);
}
