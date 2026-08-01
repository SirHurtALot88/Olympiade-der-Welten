import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import {
  buildOfferRankPayoutLadderPreview,
  readLockedRankPayout,
} from "@/lib/sponsor/sponsor-economy-calibration";
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

  it("builds Gewinnstufen rows from the offer's curveShape ladder (== settlement), non-decreasing", () => {
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams.find((team) => team.shortCode === "W-W")?.teamId ?? gameState.teams[0]!.teamId;
    const offer = buildSponsorOffersForTeam({ gameState, teamId })[0]!;
    const rankLadder = buildOfferRankPayoutLadderPreview(gameState, offer);

    const rows = buildSponsorRankTierRows({ baseCash: 32, rankLadder });
    expect(rows).toHaveLength(8);
    expect(rows[0]?.label).toBe("Top 28");
    expect(rows.at(-1)?.label).toBe("Meister");

    // Referenzkurven haben bewusste 4er-Band-Plateaus (z.B. konsolidierung Rang 1–20 flach) →
    // NICHT streng steigend, aber nie fallend zu besseren Rängen.
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index]!.absolutePayout).toBeGreaterThanOrEqual(rows[index - 1]!.absolutePayout);
    }
    // Bester Milestone (Meister) zahlt mindestens die Basis und mindestens so viel wie der schlechteste.
    expect(rows.at(-1)!.absolutePayout).toBeGreaterThanOrEqual(32);
    expect(rows.at(-1)!.absolutePayout).toBeGreaterThanOrEqual(rows[0]!.absolutePayout);
  }, 60000);

  it("each displayed rung equals the settlement formula baseCash + (ladder[rank] − ladder[32])", () => {
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams.find((team) => team.shortCode === "W-W")?.teamId ?? gameState.teams[0]!.teamId;
    const offer = buildSponsorOffersForTeam({ gameState, teamId })[0]!;
    const rankLadder = buildOfferRankPayoutLadderPreview(gameState, offer);
    const baseCash = 40;

    const rows = buildSponsorRankTierRows({ baseCash, rankLadder, includeFloorRung: true });
    // Boden-Stufe (Platz 32) = nur Basis (kein Rang-Aufschlag), genau wie das Settlement am Sockel zahlt.
    expect(rows[0]?.rankAt).toBe(32);
    expect(rows[0]?.absolutePayout).toBeCloseTo(baseCash, 1);

    const floor = readLockedRankPayout(rankLadder, 32);
    for (const row of rows.slice(1)) {
      const expected = baseCash + Math.max(0, readLockedRankPayout(rankLadder, row.rankAt) - floor);
      // Mit DERSELBEN Funktion runden wie die Anzeige (`roundOfferCash`), nicht mit `toFixed`.
      // Beide runden auf eine Stelle, aber bei Werten wie 62,95 liegt der gespeicherte Double
      // knapp darunter: `Math.round(629.5)/10` ergibt 63, `(62.95).toFixed(1)` ergibt "62.9".
      // Der Test kippte damit an einem Rundungsartefakt statt an einer echten Abweichung.
      expect(row.absolutePayout).toBeCloseTo(Math.round(expected * 10) / 10, 2);
    }
    // Non-decreasing über die gesamte Leiter inkl. Boden-Stufe.
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index]!.absolutePayout).toBeGreaterThanOrEqual(rows[index - 1]!.absolutePayout);
    }
  }, 60000);
});
