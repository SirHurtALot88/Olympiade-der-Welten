import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildFoundationNavAttention } from "@/lib/foundation/foundation-nav-attention";

function gameState(partial?: Partial<GameState>): GameState {
  return {
    season: { id: "season-2", name: "Season 2", currentMatchday: 1, isCompleted: false },
    teams: [{ teamId: "team-a", name: "Team A", shortCode: "TA", humanControlled: true }],
    players: [],
    rosters: [],
    gamePhase: "preseason",
    seasonState: {
      sponsorOffersByTeamId: {},
      sponsorContractsByTeamId: {},
      ...(partial?.seasonState ?? {}),
    },
    ...partial,
  } as GameState;
}

describe("buildFoundationNavAttention", () => {
  it("marks the sponsors nav when the active team has offers but no contract", () => {
    const state = gameState({
      seasonState: {
        sponsorOffersByTeamId: {
          "team-a": [
            {
              offerId: "offer-1",
              teamId: "team-a",
              seasonId: "season-2",
              archetype: "tech",
              name: "Tech Sponsor",
              flavor: "Test",
              starTier: 2,
              demandProfile: "balanced",
              components: [],
            },
          ],
        },
      } as GameState["seasonState"],
    });

    expect(
      buildFoundationNavAttention({
        gameState: state,
        activeManagerTeamId: "team-a",
        canManageActiveTeam: true,
      }).prize,
    ).toBe(true);
  });

  it("clears sponsor attention after a contract is chosen", () => {
    const state = gameState({
      seasonState: {
        sponsorContractsByTeamId: {
          "team-a": {
            contractId: "contract-1",
            teamId: "team-a",
            seasonId: "season-2",
            name: "Active Sponsor",
            archetype: "tech",
            components: [],
          },
        },
      } as GameState["seasonState"],
    });

    expect(
      buildFoundationNavAttention({
        gameState: state,
        activeManagerTeamId: "team-a",
        canManageActiveTeam: true,
      }).prize,
    ).toBeUndefined();
  });
});
