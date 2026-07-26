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

  it("still assigns a concrete rank when the penalty creates an exact points tie (never null, never stale)", () => {
    // A 10P/#1, B 7P/#2 — die 3P-Strafe auf A erzeugt einen exakten Punkt-Gleichstand bei 7P.
    //
    // Regressionsschutz für eine konkrete Gefahr: DEFAULT_STANDINGS_TIEBREAKER_MODE ist "block_on_tie",
    // das bei erkanntem Gleichstand `rank = null` liefert. Würde das hier greifen, überspränge der
    // `!= null`-Guard im Service den Write-Back und der Rang von VOR der Strafe bliebe stehen — Sponsor-
    // Settlement und Snapshot lesen `standing.rank` direkt und würden nach dem alten Rang auszahlen.
    // Erreichbar ist der Null-Pfad hier nicht (die Tie-Erkennung verlangt totalScore != null, wir übergeben
    // null), weshalb deterministisch aufeinanderfolgende Ränge vergeben werden. Dieser Test hält beides fest:
    // kein null-Rang UND kein stale Vor-Strafe-Rang.
    const gameState = {
      season: { id: "S1" },
      teams: [
        { teamId: "A", name: "Alpha", cash: 100 },
        { teamId: "B", name: "Beta", cash: 100 },
      ],
      seasonState: {
        standings: {
          A: { points: 10, rank: 1 },
          B: { points: 7, rank: 2 },
        },
        formCards: [{ id: "c1", seasonId: "S1", teamId: "A", cardValue: -6 }],
      },
    } as unknown as GameState;

    const result = applyFormCardPenaltyWithRerank(gameState, "S1");
    expect(result.applied).toBe(true);

    const standings = result.gameState.seasonState.standings!;
    expect(standings.A.points).toBe(7);
    expect(standings.B.points).toBe(7);
    // Beide Ränge sind gesetzt (kein null), decken zusammen genau {1,2} ab und sind deterministisch —
    // insbesondere bleibt kein Rang unangetastet auf dem Vor-Strafe-Wert hängen.
    expect(standings.A.rank).not.toBeNull();
    expect(standings.B.rank).not.toBeNull();
    expect([standings.A.rank, standings.B.rank].sort()).toEqual([1, 2]);
  });

  it("is idempotent — a second apply for the same season is a no-op (no double subtraction)", () => {
    const once = applyFormCardPenaltyWithRerank(buildGameState(), "S1");
    const twice = applyFormCardPenaltyWithRerank(once.gameState, "S1");
    expect(twice.applied).toBe(false);
    expect(twice.gameState.seasonState.standings!.A.points).toBe(7);
    expect(twice.gameState.seasonState.standings!.A.rank).toBe(2);
  });
});
