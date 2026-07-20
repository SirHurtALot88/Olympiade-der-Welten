import { describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { FATIGUE_LOAD_BY_MODE } from "@/lib/training/training-mode-presentation";
import { accumulateMatchdayTrainingProgress } from "@/lib/training/matchday-training-accumulator";

const SEASON_ID = "season-1";
const TOTAL_MATCHDAYS = 10;

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-1",
    trainingMode: "mittel",
    fatigue: 0,
    ...overrides,
  } as unknown as Player;
}

function makeState(player: Player): GameState {
  return {
    season: { id: SEASON_ID, totalMatchdays: TOTAL_MATCHDAYS },
    players: [player],
    rosters: [{ playerId: player.id, teamId: "team-1" }],
  } as unknown as GameState;
}

function run(state: GameState, matchdayId: string): GameState {
  return accumulateMatchdayTrainingProgress({ gameState: state, seasonId: SEASON_ID, matchdayId });
}

const share = (mode: "leicht" | "mittel" | "hart") => FATIGUE_LOAD_BY_MODE[mode] / TOTAL_MATCHDAYS;

describe("accumulateMatchdayTrainingProgress", () => {
  it("layers the accumulated training fatigue on top of the freshly-derived pure match fatigue each matchday (no double counting)", () => {
    // Matchday 1, mode "mittel": pure match fatigue 30 was written by the injury step.
    let state = makeState(makePlayer({ fatigue: 30, trainingMode: "mittel" }));
    state = run(state, "md-1");
    let player = state.players[0];
    expect(player.seasonTrainingAccumulator?.accumulatedTrainingFatigue).toBeCloseTo(share("mittel"), 5);
    expect(player.fatigue).toBeCloseTo(30 + share("mittel"), 5);

    // Matchday 2, mode "hart". The apply pipeline re-derives pure match fatigue first (say 20),
    // so we simulate that by resetting fatigue to the pure value before the accumulator runs.
    state = {
      ...state,
      players: [{ ...player, fatigue: 20, trainingMode: "hart" }],
    } as unknown as GameState;
    state = run(state, "md-2");
    player = state.players[0];
    const expectedAcc = share("mittel") + share("hart");
    expect(player.seasonTrainingAccumulator?.accumulatedTrainingFatigue).toBeCloseTo(expectedAcc, 5);
    // Full accumulated training fatigue layered on the fresh pure match fatigue — NOT stacked twice.
    expect(player.fatigue).toBeCloseTo(20 + expectedAcc, 5);
    expect(player.seasonTrainingAccumulator?.matchdaysCounted).toBe(2);
  });

  it("preserves the training-fatigue layer on a same-mode forceReplace (Fix 1)", () => {
    let state = makeState(makePlayer({ fatigue: 30, trainingMode: "mittel" }));
    state = run(state, "md-1");
    const afterFirst = state.players[0];
    const acc = afterFirst.seasonTrainingAccumulator?.accumulatedTrainingFatigue ?? 0;
    expect(acc).toBeCloseTo(share("mittel"), 5);

    // Simulate a forceReplace / replay of md-1 with the SAME mode: the injury step already reset
    // player.fatigue to the pure match fatigue (25) that carries no training fatigue.
    state = {
      ...state,
      players: [{ ...afterFirst, fatigue: 25 }],
    } as unknown as GameState;
    state = run(state, "md-1");
    const afterReplay = state.players[0];

    // Accumulator itself is unchanged (same matchday + same mode)…
    expect(afterReplay.seasonTrainingAccumulator?.accumulatedTrainingFatigue).toBeCloseTo(acc, 5);
    expect(afterReplay.seasonTrainingAccumulator?.matchdaysCounted).toBe(1);
    // …but the training-fatigue layer is re-applied instead of being lost.
    expect(afterReplay.fatigue).toBeCloseTo(25 + acc, 5);
  });

  it("rolls back the old mode's contribution on a different-mode forceReplace", () => {
    let state = makeState(makePlayer({ fatigue: 30, trainingMode: "mittel" }));
    state = run(state, "md-1");
    let player = state.players[0];

    // forceReplace md-1 with a heavier mode; pipeline reset fatigue to pure 30 again.
    state = {
      ...state,
      players: [{ ...player, fatigue: 30, trainingMode: "hart" }],
    } as unknown as GameState;
    state = run(state, "md-1");
    player = state.players[0];

    // Only the corrected mode's share is counted — not mittel + hart.
    expect(player.seasonTrainingAccumulator?.accumulatedTrainingFatigue).toBeCloseTo(share("hart"), 5);
    expect(player.seasonTrainingAccumulator?.matchdaysCounted).toBe(1);
    expect(player.fatigue).toBeCloseTo(30 + share("hart"), 5);
  });
});
