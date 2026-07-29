import { describe, expect, it } from "vitest";

import { buildSeasonFormCardBonusByTeamId } from "@/lib/foundation/season-form-card-bonus";

type CardInput = { id: string; seasonId: string; teamId: string; cardValue: number };
type DraftInput = {
  seasonId: string;
  modifiers?: {
    d1?: { primaryFormCardId?: string | null; secondaryFormCardId?: string | null };
    d2?: { primaryFormCardId?: string | null; secondaryFormCardId?: string | null };
  };
};

function makeGameState(input: { formCards: CardInput[]; lineupDrafts: DraftInput[] }) {
  return {
    seasonState: {
      formCards: input.formCards,
      lineupDrafts: input.lineupDrafts,
    },
  } as unknown as Parameters<typeof buildSeasonFormCardBonusByTeamId>[0];
}

describe("buildSeasonFormCardBonusByTeamId", () => {
  it("sums the face value of played cards (+8 counts 8, -4 counts -4)", () => {
    const gameState = makeGameState({
      formCards: [
        { id: "c1", seasonId: "S1", teamId: "A-A", cardValue: 8 },
        { id: "c2", seasonId: "S1", teamId: "A-A", cardValue: -4 },
        { id: "c3", seasonId: "S1", teamId: "A-A", cardValue: 6 },
        { id: "c4", seasonId: "S1", teamId: "B-B", cardValue: 5 },
      ],
      lineupDrafts: [
        { seasonId: "S1", modifiers: { d1: { primaryFormCardId: "c1", secondaryFormCardId: "c2" } } },
        { seasonId: "S1", modifiers: { d2: { primaryFormCardId: "c4" } } },
      ],
    });

    const byTeam = buildSeasonFormCardBonusByTeamId(gameState, "S1");

    // c3 lag nur auf der Hand → zählt nicht mit.
    expect(byTeam.get("A-A")).toEqual({ total: 4, cards: 2, positive: 8, negative: -4 });
    expect(byTeam.get("B-B")).toEqual({ total: 5, cards: 1, positive: 5, negative: 0 });
  });

  it("ignores drafts and cards of other seasons", () => {
    const gameState = makeGameState({
      formCards: [
        { id: "c1", seasonId: "S1", teamId: "A-A", cardValue: 8 },
        { id: "c2", seasonId: "S2", teamId: "A-A", cardValue: 9 },
      ],
      lineupDrafts: [
        { seasonId: "S2", modifiers: { d1: { primaryFormCardId: "c1" } } },
        { seasonId: "S2", modifiers: { d1: { primaryFormCardId: "c2" } } },
      ],
    });

    const byTeam = buildSeasonFormCardBonusByTeamId(gameState, "S1");
    expect(byTeam.size).toBe(0);
  });

  it("returns an empty map when nothing was played", () => {
    const gameState = makeGameState({
      formCards: [{ id: "c1", seasonId: "S1", teamId: "A-A", cardValue: 8 }],
      lineupDrafts: [{ seasonId: "S1", modifiers: { d1: {} } }],
    });

    expect(buildSeasonFormCardBonusByTeamId(gameState, "S1").size).toBe(0);
  });

  it("skips zero-value cards (the empty slot of a player's card pair)", () => {
    const gameState = makeGameState({
      formCards: [
        { id: "c1", seasonId: "S1", teamId: "A-A", cardValue: 0 },
        { id: "c2", seasonId: "S1", teamId: "A-A", cardValue: 7 },
      ],
      lineupDrafts: [
        { seasonId: "S1", modifiers: { d1: { primaryFormCardId: "c1", secondaryFormCardId: "c2" } } },
      ],
    });

    expect(buildSeasonFormCardBonusByTeamId(gameState, "S1").get("A-A")).toEqual({
      total: 7,
      cards: 1,
      positive: 7,
      negative: 0,
    });
  });
});
