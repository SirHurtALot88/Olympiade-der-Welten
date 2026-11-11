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
    // 16er-Liga: alle 2 Plaetze eine Stufe (Top 14 / 12 / 10 / 8 / 6 / 4 / 2 / Meister).
    expect(rows.map((row) => row.label)).toEqual([
      "Top 14", "Top 12", "Top 10", "Top 8", "Top 6", "Top 4", "Top 2", "Meister",
    ]);
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

  it("each displayed rung equals the settlement formula baseCash + (ladder[rank] − ladder[last])", () => {
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams.find((team) => team.shortCode === "W-W")?.teamId ?? gameState.teams[0]!.teamId;
    const offer = buildSponsorOffersForTeam({ gameState, teamId })[0]!;
    const rankLadder = buildOfferRankPayoutLadderPreview(gameState, offer);
    const baseCash = 40;

    const rows = buildSponsorRankTierRows({ baseCash, rankLadder, includeFloorRung: true });
    // Boden-Stufe = letzter Platz der 16er-Liga. `baseCash` ist der Wert an der letzten Sprosse der
    // eingefrorenen Leiter; Platz 16 zeigt den Rang-Aufschlag darueber — wie das Settlement zahlt.
    expect(rows[0]?.rankAt).toBe(16);
    expect(rows[0]?.label).toBe("Platz 16");

    const floor = readLockedRankPayout(rankLadder, rankLadder.length);
    for (const row of rows) {
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

  it("zeigt mit der echten Basis des Angebots auf JEDER Stufe exakt den Leiterwert (Anzeige == Settlement)", () => {
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams.find((team) => team.shortCode === "W-W")?.teamId ?? gameState.teams[0]!.teamId;
    const offer = buildSponsorOffersForTeam({ gameState, teamId })[0]!;
    const rankLadder = buildOfferRankPayoutLadderPreview(gameState, offer);
    const baseCash = offer.components.find((component) => component.kind === "base")?.rewardCash ?? 0;

    const rows = buildSponsorRankTierRows({ baseCash, rankLadder, includeFloorRung: true });
    for (const row of rows) {
      expect(row.absolutePayout, row.label).toBeCloseTo(Math.round(readLockedRankPayout(rankLadder, row.rankAt) * 10) / 10, 1);
    }
  }, 60000);

  it("Legacy-Spielstand ohne Liga-Split (32 Teams) behaelt die alte Leiter Top 28 … Platz 32", () => {
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams.find((team) => team.shortCode === "W-W")?.teamId ?? gameState.teams[0]!.teamId;
    const offer = buildSponsorOffersForTeam({ gameState, teamId })[0]!;
    const rankLadder = buildOfferRankPayoutLadderPreview(gameState, offer);
    const baseCash = 40;

    const rows = buildSponsorRankTierRows({ baseCash, rankLadder, includeFloorRung: true, leagueSize: 32 });
    expect(rows.map((row) => row.rankAt)).toEqual([32, 28, 24, 20, 16, 12, 8, 4, 1]);
    expect(rows[0]?.label).toBe("Platz 32");
    // Bei 32 Teams ist der Boden die letzte Sprosse selbst: nur Basis, wie vor der Umstellung.
    expect(rows[0]?.absolutePayout).toBeCloseTo(baseCash, 1);
  }, 60000);
});
