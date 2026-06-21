import type { Team, TeamIdentity } from "@/lib/data/olyDataTypes";

export const DEFAULT_ROSTER_MAX = 14;
export const DEFAULT_ROSTER_MIN_FLOOR = 7;

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
  fallbackMin = DEFAULT_ROSTER_MIN_FLOOR,
  fallbackOpt = 10,
) {
  const playerMax = getTeamPlayerMax(team, identity);
  const rawMin = finiteRounded(identity?.playerMin) ?? fallbackMin;
  const playerMin = Math.min(Math.max(0, rawMin), playerMax);
  const rawOpt = finiteRounded(identity?.playerOpt) ?? Math.max(fallbackOpt, playerMin);
  const playerOpt = Math.min(Math.max(rawOpt, playerMin), playerMax);
  return { playerMin, playerOpt, playerMax };
}
