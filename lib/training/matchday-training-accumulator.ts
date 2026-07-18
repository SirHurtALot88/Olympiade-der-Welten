import type { GameState, Player } from "@/lib/data/olyDataTypes";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import { FATIGUE_LOAD_BY_MODE } from "@/lib/training/training-mode-presentation";
import { getRecoveryTrainingFatigueReductionPct, getTeamFacilityState } from "@/lib/facilities/facility-effects";

/**
 * Per-matchday training accumulation (anti-cheese Teil B, B.4).
 *
 * Runs once per resolved matchday, AFTER `applyFatigueAndInjuryAfterMatchday` (so the training-fatigue
 * share is layered on top of the pure match fatigue and NEVER enters `fatigueBeforeRoll` / the injury
 * roll / `playerAvailabilityState` — otherwise `player-season-fatigue-stats.ts`' back-calculation
 * `event.fatigueBefore - MATCHDAY_FATIGUE_LOAD` would be wrong; see B.3).
 *
 * For every rostered player (used, benched OR injured — training happens regardless of playing time,
 * "Äquivalenz"), the active `trainingMode` for this matchday is recorded and the accumulated training
 * fatigue is advanced by `FATIGUE_LOAD_BY_MODE[mode] / totalMatchdays`, MINUS the REHA/recovery-center
 * training-fatigue reduction of the player's team (`getRecoveryTrainingFatigueReductionPct`). So a built
 * recovery_center now actually lowers the player's applied per-matchday training fatigue (Fix A) — the
 * reduction was previously only reflected in the forecast/AI-planning and discarded at season-end apply.
 * The same reduction factor is applied to the rollback term on a forced re-apply so it stays consistent.
 *
 * Idempotency / forceReplace (keyed on `matchdayId`):
 *  - Same matchday + same mode already recorded → the accumulator is returned untouched, but the
 *    already-accumulated training-fatigue share is re-layered onto `player.fatigue` (which the
 *    preceding `applyFatigueAndInjuryAfterMatchday` just reset to the pure match fatigue). This keeps
 *    a `forceReplace` with an unchanged mode from silently dropping the training-fatigue layer.
 *  - Same matchday + different mode (a forced re-apply of a corrected result) → the old matchday's
 *    contribution is rolled back via the stored `modeByMatchday` entry and the new one applied;
 *    `matchdaysCounted` stays constant.
 *
 * `player.fatigue` is set to `pureMatchFatigue + accumulatedTrainingFatigue` where `pureMatchFatigue`
 * is whatever `applyFatigueAndInjuryAfterMatchday` just wrote (derived exclusively from the
 * availability state, which carries no training fatigue). Because that value is re-derived every
 * matchday, adding the FULL accumulated training fatigue here is idempotent across matchdays.
 */

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clampFatigue(value: number) {
  return Math.max(0, Math.min(100, roundValue(value)));
}

function normalizeMode(mode: Player["trainingMode"]): PlayerTrainingMode {
  return mode === "leicht" || mode === "mittel" || mode === "hart" ? mode : "mittel";
}

export function resolveSeasonTotalMatchdays(gameState: GameState): number {
  const declared = gameState.season.totalMatchdays;
  if (typeof declared === "number" && Number.isFinite(declared) && declared > 0) return Math.floor(declared);
  const fromIds = gameState.season.matchdayIds?.length ?? 0;
  return fromIds > 0 ? fromIds : 10;
}

export function accumulateMatchdayTrainingProgress(input: {
  gameState: GameState;
  seasonId: string;
  matchdayId: string;
}): GameState {
  const { gameState, seasonId, matchdayId } = input;
  const rosteredPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  if (rosteredPlayerIds.size === 0) return gameState;
  const totalMatchdays = resolveSeasonTotalMatchdays(gameState);
  const now = new Date().toISOString();

  // Fix A: pro Spieler das Team (Roster) auflösen und den REHA/recovery-center-Trainingsfatigue-Rabatt
  // des Teams anwenden. Reduktions-Faktor pro Team memoisiert (ein getTeamFacilityState-Aufruf je Team),
  // Faktor = 1 - reductionPct/100 (auf [0,1] geklemmt). Ohne Team/Recovery-Center = 1.0 (kein Rabatt).
  const teamIdByPlayerId = new Map<string, string>();
  for (const entry of gameState.rosters) teamIdByPlayerId.set(entry.playerId, entry.teamId);
  const reductionFactorByTeamId = new Map<string, number>();
  const resolveTrainingFatigueFactor = (playerId: string): number => {
    const teamId = teamIdByPlayerId.get(playerId);
    if (!teamId || !gameState.seasonState) return 1;
    const cached = reductionFactorByTeamId.get(teamId);
    if (cached != null) return cached;
    const reductionPct = getRecoveryTrainingFatigueReductionPct(getTeamFacilityState(gameState, teamId));
    const factor = Math.max(0, Math.min(1, 1 - reductionPct / 100));
    reductionFactorByTeamId.set(teamId, factor);
    return factor;
  };

  let mutated = false;
  const nextPlayers = gameState.players.map((player) => {
    if (!rosteredPlayerIds.has(player.id)) return player;

    const previousAccumulator =
      player.seasonTrainingAccumulator && player.seasonTrainingAccumulator.seasonId === seasonId
        ? player.seasonTrainingAccumulator
        : null;
    const priorMode = previousAccumulator?.modeByMatchday[matchdayId] ?? null;
    const mode = normalizeMode(player.trainingMode);

    // Exact idempotency: replaying the same matchday with the same mode does not change the
    // accumulator itself, BUT `player.fatigue` was just re-derived to the pure match fatigue by
    // `applyFatigueAndInjuryAfterMatchday` (which carries no training fatigue). We must therefore
    // re-layer the already-accumulated training-fatigue share on top — exactly as the main path
    // below does — so a `forceReplace` with an unchanged mode does not silently drop it.
    // This stays idempotent because `player.fatigue` is the fresh pure match fatigue on every apply.
    if (priorMode === mode && previousAccumulator) {
      const relayered = clampFatigue((player.fatigue ?? 0) + previousAccumulator.accumulatedTrainingFatigue);
      if (relayered === (player.fatigue ?? 0)) return player;
      mutated = true;
      return { ...player, fatigue: relayered };
    }

    const modeByMatchday = { ...(previousAccumulator?.modeByMatchday ?? {}) };
    let matchdaysCounted = previousAccumulator?.matchdaysCounted ?? 0;
    let accumulatedTrainingFatigue = previousAccumulator?.accumulatedTrainingFatigue ?? 0;
    // Fix A: der REHA/recovery-center-Rabatt des Teams senkt die REAL angewandte Trainingsfatigue.
    const trainingFatigueFactor = resolveTrainingFatigueFactor(player.id);
    const fatigueShare = (FATIGUE_LOAD_BY_MODE[mode] / totalMatchdays) * trainingFatigueFactor;

    if (priorMode == null) {
      matchdaysCounted += 1;
      accumulatedTrainingFatigue += fatigueShare;
    } else {
      // forceReplace of a previously-counted matchday: roll back the stored mode's contribution
      // (same reduction factor so add and rollback stay consistent).
      accumulatedTrainingFatigue +=
        fatigueShare - (FATIGUE_LOAD_BY_MODE[priorMode] / totalMatchdays) * trainingFatigueFactor;
    }
    modeByMatchday[matchdayId] = mode;
    accumulatedTrainingFatigue = Math.max(0, roundValue(accumulatedTrainingFatigue));

    mutated = true;
    return {
      ...player,
      seasonTrainingAccumulator: {
        seasonId,
        matchdaysCounted,
        modeByMatchday,
        accumulatedTrainingFatigue,
        updatedAt: now,
      },
      fatigue: clampFatigue((player.fatigue ?? 0) + accumulatedTrainingFatigue),
    };
  });

  if (!mutated) return gameState;
  return { ...gameState, players: nextPlayers };
}
