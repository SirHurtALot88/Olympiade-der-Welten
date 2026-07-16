import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { evaluateTransferListing } from "@/lib/market/transfer-market";

describe("transfer market evaluation", () => {
  it("scores a listing for an AI team", () => {
    const gameState = createSingleplayerGameState();
    const team = gameState.teams.find((entry) => entry.teamId === "R-C");
    const listing = gameState.transferListings[0];

    expect(team).toBeTruthy();
    const evaluation = evaluateTransferListing(gameState, team!, listing);

    expect(evaluation).toBeTruthy();
    expect(evaluation?.recommendedAction).toBeTruthy();
  });
});
