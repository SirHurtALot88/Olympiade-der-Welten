import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { applyFormCardPenaltyWithRerank } from "@/lib/season/form-card-penalty-service";

function buildGameState(): GameState {
  return {
    season: { id: "S1" },
    teams: [
      { teamId: "A", name: "Alpha", cash: 100 },
      { teamId: "B", name: "Beta", cash: 100 },
    ],
    seasonState: {
      standings: {
        A: { points: 10, rank: 1 },
        B: { points: 8, rank: 2 },
      },
      // Eine UNBENUTZTE negative Formkarte für Team A → Strafe = round(|-6| * 0.5) = 3.
      formCards: [{ id: "c1", seasonId: "S1", teamId: "A", cardValue: -6 }],
    },
  } as unknown as GameState;
}

describe("applyFormCardPenaltyWithRerank (audit R2/V4)", () => {
  it("subtracts penalty points AND re-ranks so the penalty flips the final table", () => {
    const result = applyFormCardPenaltyWithRerank(buildGameState(), "S1");
    expect(result.applied).toBe(true);

    const standings = result.gameState.seasonState.standings!;
    // A: 10 − round(6*0.5)=3 → 7; B unverändert 8.
    expect(standings.A.points).toBe(7);
    expect(standings.B.points).toBe(8);
    // Re-Rank: B führt jetzt (der bestrafte Rang, den Sponsor-Settlement + Snapshot lesen).
    expect(standings.B.rank).toBe(1);
    expect(standings.A.rank).toBe(2);
    expect(result.gameState.seasonState.formCardPenaltyAppliedSeasonIds).toContain("S1");
    expect(result.warnings).toContain("formcard_penalty_applied:A:3pts");
  });

  it("is idempotent — a second apply for the same season is a no-op (no double subtraction)", () => {
    const once = applyFormCardPenaltyWithRerank(buildGameState(), "S1");
    const twice = applyFormCardPenaltyWithRerank(once.gameState, "S1");
    expect(twice.applied).toBe(false);
    expect(twice.gameState.seasonState.standings!.A.points).toBe(7);
    expect(twice.gameState.seasonState.standings!.A.rank).toBe(2);
  });
});
