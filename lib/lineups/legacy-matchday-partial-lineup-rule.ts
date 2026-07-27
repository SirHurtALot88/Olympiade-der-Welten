/**
 * Owner decision (2026-07, replaces the old `LEGACY_MATCHDAY_MINIMUM_PLAYERS = 7` hard floor):
 * "wenn ein team nur 5 spieler hat kann es diese ja auch einsetzen und wenn alle Spieler
 * eingesetzt sind die das team zur Verfügung hat ist es auch grün" — a team must be allowed to
 * field however many available (uninjured, on-roster) players it has. A lineup that uses ALL of
 * a team's available players counts as complete/ready, even if that is fewer than the discipline
 * slots require — 5, 3, whatever is left.
 *
 * There is NO hard floor below which a matchday is blocked anymore. The previous floor made the
 * season stall permanently (`resolve_status:incomplete_lineups`) once a team's roster oscillated
 * near it, and — combined with `FIXED_ROSTER_MIN = 8` — meant only ONE injury per team per
 * matchday could ever be tolerated before the gate slammed shut. Do not reintroduce a floor here.
 *
 * Empty slots that genuinely cannot be filled must degrade the team's score naturally (fewer
 * scoring players => a worse result) — that is the intended sporting penalty. This helper only
 * decides whether a SHORT lineup (fewer selected players than the discipline slots require)
 * should be treated as "complete" for readiness/apply purposes. It never invents players, slots,
 * or score compensation.
 *
 * Single source of truth: shared by `lib/resolve/legacy-matchday-readiness.ts`,
 * `lib/resolve/legacy-matchday-resolve-engine.ts`, and `lib/lineups/legacy-matchday-readiness.ts`
 * so the readiness/preview path and the result-apply path can never diverge on this rule again
 * (a prior divergence here once caused every team to be written as `invalid_lineup`).
 */
export function isPartialLineupComplete(input: {
  activePlayersCount: number;
  requiredTotalUniquePlayers: number;
  selectedPlayerCount: number;
}): boolean {
  return (
    input.activePlayersCount < input.requiredTotalUniquePlayers &&
    input.selectedPlayerCount === input.activePlayersCount
  );
}
