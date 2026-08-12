/**
 * DIE KI-SPONSORWAHL MUSS DIE KURVENFORM LESEN, NICHT NUR ACHSE/ARCHETYP.
 *
 * Seit PR #360 entscheidet die Kurvenform (`offer.curveShape` / `terms.baseLadder`), WO auf der
 * Sponsor-Ligaleiter das Geld eines Vertrags liegt (sponsor-liga-leiter.ts). Alle 11 Formen sind auf
 * denselben Erwartungswert beim STARTRANG normiert — eine Bewertung, die nur Achse und
 * Markenpassung liest (wie vor diesem Umbau), kann sie nicht unterscheiden und waehlt de facto
 * zufaellig unter ihnen. Beobachtet wurde das als grobe Fehlgriffe: ein Titelfavorit signiert eine
 * Mittelfeldkurve, ein Schlusslicht eine Titelkurve.
 *
 * Dieser Test isoliert genau das Kriterium: fuenf synthetische Angebote mit IDENTISCHEM Archetyp,
 * OHNE Achse — die einzige Achse, auf der sie sich unterscheiden koennen, ist die
 * Kurvenform. Ohne den Passungsterm aus `scoreOfferForAi` waeren Achsen- und
 * Archetyp-Term fuer alle fuenf exakt 0 bzw. gleich, und der deterministische Tiebreak
 * (`offerId.length % 7`) entschiede — bei den hier gleich langen `offerId`s ein Patt, das der Sortierung
 * die ERSTE Kurve im Array zufallen liesse (hier bewusst "titeljaeger"). Das ist exakt die Fehlwahl,
 * die dieser Test fuer beide Enden der Tabelle ausschliesst.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SponsorCurveShape, SponsorOffer } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { chooseSponsorOfferForAiTeams } from "@/lib/sponsor/sponsor-offer-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { applySponsorV3ToOffers } from "@/lib/sponsor/sponsor-v3-offer-service";
import { getSponsorCurveFamily } from "@/lib/sponsor/sponsor-curve-shapes";

/** Fuenf Formen quer durch die Familien, inklusive beider Extreme (reine Titel- vs. reine Bodenform). */
const ISOLATED_SHAPES: SponsorCurveShape[] = ["titeljaeger", "koenigsklasse", "mittelfeld", "aufsteiger", "klassenerhalt"];

function buildBareOffer(input: { teamId: string; seasonId: string; curveShape: SponsorCurveShape; index: number }): SponsorOffer {
  return {
    offerId: `${input.seasonId}:${input.teamId}:isolated:${input.index}`,
    seasonId: input.seasonId,
    teamId: input.teamId,
    // Identischer Archetyp fuer alle fuenf Angebote: der Markenpassungs-Term aus
    // `resolveAiSponsorArchetypePreference` trifft dann entweder auf alle oder auf keins zu und kann
    // die Kurve nicht mehr entscheiden.
    archetype: "identity",
    curveShape: input.curveShape,
    rarity: "magisch",
    name: "Test-Sponsor",
    flavor: "Test",
    components: [
      { componentId: "base-cash", kind: "base", label: "Basis-Saisonzahlung", targetValue: 0, rewardCash: 0 },
      { componentId: "rank-target", kind: "rank", label: "Gewinnstufen nach Endrang", targetValue: 1, rewardCash: 0 },
    ],
    totalUpsideEstimate: 0,
  };
}

/**
 * Ersetzt die Angebote EINES Teams durch die fuenf isolierten Kurvenformen, mit einem fest
 * vorgegebenen `startRank` (unabhaengig vom tatsaechlichen Tabellenplatz im Spielstand — die Kurve
 * liest ausschliesslich `terms.startRank`, siehe `sponsor-offer-service.ts`). `basis`-Karten ohne
 * Achse (`goal: false`, siehe `SPONSOR_V3_CARDS`) sorgen zusaetzlich dafuer, dass der Achsenterm auf
 * allen fuenf Angeboten 0 bleibt.
 */
function withIsolatedCurveOffers(base: GameState, teamId: string, startRank: number): GameState {
  const bareOffers = ISOLATED_SHAPES.map((shape, index) =>
    buildBareOffer({ teamId, seasonId: base.season.id, curveShape: shape, index }),
  );
  const offers = applySponsorV3ToOffers({
    gameState: base,
    offers: bareOffers,
    cardKeys: ISOLATED_SHAPES.map(() => "basis"),
    axisKeys: ISOLATED_SHAPES.map(() => null),
    curveShapes: ISOLATED_SHAPES,
    teamId,
    startRank,
  });
  return {
    ...base,
    seasonState: {
      ...base.seasonState,
      sponsorOffersByTeamId: {
        ...(base.seasonState.sponsorOffersByTeamId ?? {}),
        [teamId]: offers,
      },
      // Ambition auf die neutrale Mitte fixieren: der Test soll das reine Kurvenform-Kriterium
      // pruefen, nicht dessen Zusammenspiel mit einer Ambitions-Verschiebung.
      teamStrategyProfiles: {
        ...(base.seasonState.teamStrategyProfiles ?? {}),
        [teamId]: {
          ...(base.seasonState.teamStrategyProfiles?.[teamId] ?? { teamId }),
          bias: {
            ...(base.seasonState.teamStrategyProfiles?.[teamId]?.bias ?? {}),
            starPriority: 5,
          },
        },
      },
    },
  };
}

describe("KI-Sponsorwahl: die Kurvenform muss zum Zielrang passen", () => {
  it("Titelfavorit (Startrang 1) waehlt keine reine Bodenform", () => {
    const base = createSingleplayerGameState();
    const aiTeam = base.teams.find((team) => !team.humanControlled);
    expect(aiTeam, "kein KI-Team im Spielstand gefunden").toBeDefined();
    const gameState = withIsolatedCurveOffers(base, aiTeam!.teamId, 1);
    const after = chooseSponsorOfferForAiTeams(gameState);
    const contract = getTeamSponsorContract(after, aiTeam!.teamId);
    expect(contract, "Titelfavorit ohne Vertrag").not.toBeNull();
    expect(
      getSponsorCurveFamily(contract!.curveShape),
      `Startrang 1 hat "${contract!.curveShape}" gewaehlt — eine reine Bodenform ("sicherheit") waere` +
        " der Fehlgriff, den dieses Kriterium beheben soll.",
    ).not.toBe("sicherheit");
  });

  it("Schlusslicht (Startrang 32) waehlt keine reine Titelform", () => {
    const base = createSingleplayerGameState();
    const aiTeam = base.teams.find((team) => !team.humanControlled);
    expect(aiTeam, "kein KI-Team im Spielstand gefunden").toBeDefined();
    const gameState = withIsolatedCurveOffers(base, aiTeam!.teamId, 32);
    const after = chooseSponsorOfferForAiTeams(gameState);
    const contract = getTeamSponsorContract(after, aiTeam!.teamId);
    expect(contract, "Schlusslicht ohne Vertrag").not.toBeNull();
    expect(
      getSponsorCurveFamily(contract!.curveShape),
      `Startrang 32 hat "${contract!.curveShape}" gewaehlt — eine reine Titelform ("titel") waere der` +
        " Fehlgriff, den dieses Kriterium beheben soll.",
    ).not.toBe("titel");
  });
});
