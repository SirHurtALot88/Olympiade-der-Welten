import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildSponsorOffersForTeam } from "@/lib/sponsor/sponsor-offer-service";
import {
  buildSponsorOfferPresentation,
  isChallengeSponsorOffer,
} from "@/lib/sponsor/sponsor-offer-presenter";

describe("sponsor offer presenter", () => {
  it("marks exactly one challenge offer with axis chip and difficulty", () => {
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams.find((team) => team.shortCode === "W-W")?.teamId ?? gameState.teams[0]!.teamId;
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    const challengeOffers = offers.filter((offer) => isChallengeSponsorOffer(offer));

    expect(challengeOffers).toHaveLength(1);
    const presentation = buildSponsorOfferPresentation({
      offer: challengeOffers[0]!,
      gameState,
      teamId,
    });
    expect(presentation.isChallenge).toBe(true);
    expect(presentation.special?.difficultyLabel).toMatch(/Leicht|Mittel|Hart/);
    if (presentation.special?.axisKey) {
      expect(presentation.special.axisLabel).toBe(presentation.special.axisKey.toUpperCase());
    }
  }, 60000);
});
