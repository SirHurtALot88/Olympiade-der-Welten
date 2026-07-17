import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildSponsorOffersForTeam } from "@/lib/sponsor/sponsor-offer-service";
import {
  buildSponsorOfferPresentation,
  buildSponsorRankTierRows,
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

  it("builds absolute Gewinnstufen rows that increase with better ranks", () => {
    const rows = buildSponsorRankTierRows({ baseCash: 32, rankCash: 20.5 });
    expect(rows).toHaveLength(8);
    expect(rows[0]?.label).toBe("Top 28");
    expect(rows.at(-1)?.label).toBe("Meister");

    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index]!.absolutePayout).toBeGreaterThan(rows[index - 1]!.absolutePayout);
    }

    const top16 = rows.find((row) => row.label === "Top 16");
    const top24 = rows.find((row) => row.label === "Top 24");
    expect(top16?.absolutePayout).toBeGreaterThan(top24?.absolutePayout ?? 0);
    expect(top16?.absolutePayout).toBeGreaterThan(32);
  });

  it("prepends a guaranteed floor rung (last place, base only) when opted in", () => {
    const rows = buildSponsorRankTierRows({ baseCash: 32, rankCash: 20.5, includeFloorRung: true });
    // Boden-Stufe zusätzlich zu den 8 Meilensteinen, ganz unten (schwierigster zuerst).
    expect(rows).toHaveLength(9);
    expect(rows[0]?.label).toBe("Platz 32");
    expect(rows[0]?.rankAt).toBe(32);
    // Nur Basis — keine Gewinnstufe freigeschaltet.
    expect(rows[0]?.absolutePayout).toBe(32);
    expect(rows[1]?.label).toBe("Top 28");
    // weiterhin streng monoton steigend über die gesamte Leiter.
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index]!.absolutePayout).toBeGreaterThan(rows[index - 1]!.absolutePayout);
    }
  });
});
