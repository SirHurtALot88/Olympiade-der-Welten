import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { rollSponsorOfferSlate } from "@/lib/sponsor/sponsor-tier-pool";
import type { SponsorTeamQualityRank } from "@/lib/sponsor/sponsor-team-quality-rank";
import { buildSponsorOffersForTeam, chooseSponsorOffer } from "@/lib/sponsor/sponsor-offer-service";
import {
  SPONSOR_V4_ADVANCE_FEE_RATE,
  SPONSOR_V4_ADVANCE_SHARE,
  sponsorV3Settle,
} from "@/lib/sponsor/sponsor-v3-model";
import { getSponsorV3Terms, sponsorV3SettlementParts } from "@/lib/sponsor/sponsor-v3-offer-service";
import { getSeasonSponsorCashTotal, previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";

function qualityRank(teamId: string, position: number): SponsorTeamQualityRank {
  return {
    teamId,
    qualityRank: position,
    components: [],
    maxRarity: "legendär",
    targetRarity: "magisch",
    leaguePosition: position,
    leaguePercentile: (position / 32) * 100,
  };
}

/**
 * DIE ZWEITE WAHLDIMENSION. Die Achse macht die Wahl inhaltlich, aber ohne einen zweiten Unterschied
 * zahlen alle Angebote zum selben Zeitpunkt. Liquiditaet ist fuer ein klammes Team real wertvoll —
 * die Alternative ist ein Kredit zu 7 bis 20 Prozent — und fuer ein reiches wertlos. Damit haengt
 * die richtige Wahl an der eigenen Lage statt an einer Rangfolge, die fuer alle gleich waere.
 */
describe("Sponsor-Vorschuss: vorgezogenes eigenes Geld, kein Zuschuss", () => {
  it("zahlt bei Unterschrift aus und verrechnet am Saisonende samt Gebuehr", () => {
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams[0]!.teamId;
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    const withAdvance = offers.find((offer) => getSponsorV3Terms(offer)?.advance != null);
    expect(withAdvance, "kein Vorschuss-Angebot im Slate").toBeDefined();

    const terms = getSponsorV3Terms(withAdvance!)!;
    const cashBefore = gameState.teams.find((team) => team.teamId === teamId)!.cash;

    const stateWithOffers = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        sponsorOffersByTeamId: { ...(gameState.seasonState.sponsorOffersByTeamId ?? {}), [teamId]: offers },
      },
    };
    const signed = chooseSponsorOffer({ gameState: stateWithOffers, teamId, offerId: withAdvance!.offerId });
    const cashAfter = signed.gameState.teams.find((team) => team.teamId === teamId)!.cash;

    // Bei Unterschrift kommt genau der Vorschuss — nicht mehr.
    expect(cashAfter - cashBefore).toBeCloseTo(terms.advance!.amount, 1);

    // Am Saisonende wird er samt Gebuehr zurueckgerechnet. Ueber beide Zeitpunkte bleibt exakt die
    // normale Auszahlung minus Gebuehr — sonst waere der Vorschuss ein verstecktes Geschenk.
    const parts = sponsorV3SettlementParts({ terms, finalRank: 10, goalFraction: 0.5 });
    const seasonEnd = parts.reduce((sum, part) => sum + part.cashDelta, 0);
    const ueberBeide = terms.advance!.amount + seasonEnd;
    expect(ueberBeide).toBeCloseTo(sponsorV3Settle(terms, 10, 0.5) - terms.advance!.fee, 1);
  });

  it("laeuft auf den LEITERBODEN, nicht auf den Erwartungswert", () => {
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams[0]!.teamId;
    const terms = buildSponsorOffersForTeam({ gameState, teamId })
      .map((offer) => getSponsorV3Terms(offer))
      .find((entry) => entry?.advance != null)!;

    // Der Boden ist der Betrag, der auf JEDEM Endrang sicher kommt. Auf mehr darf kein Vorschuss
    // laufen — sonst koennte ein Absturz den Vertrag ins Minus drehen.
    const boden = Math.min(...terms.rankLadder.map((value) => Math.max(terms.floor, value)));
    expect(terms.advance!.amount).toBeCloseTo(Math.round(boden * SPONSOR_V4_ADVANCE_SHARE * 10) / 10, 1);
    expect(terms.advance!.fee).toBeCloseTo(
      Math.round(terms.advance!.amount * SPONSOR_V4_ADVANCE_FEE_RATE * 10) / 10, 1,
    );
    // Selbst der schlechteste Endrang deckt den Vorschuss — der Vertrag kann nie ins Minus kippen.
    expect(sponsorV3Settle(terms, 32, 0)).toBeGreaterThan(terms.advance!.amount + terms.advance!.fee);
  });

  it("ist billiger als ein Kredit — sonst waere die Option sinnlos", () => {
    // Der guenstigste Bankkredit kostet 7 Prozent je Saison (lib/finance/loan-service.ts).
    expect(SPONSOR_V4_ADVANCE_FEE_RATE).toBeLessThan(0.07);
  });
});

describe("Sponsor-Vorschuss: das Slate garantiert beide Seiten", () => {
  it("bietet immer mindestens einen Vorschuss und mindestens zwei Karten ohne", () => {
    // Ohne diese Garantie legt der Wurf in rund einem Sechstel aller Slates alle Achsen auf
    // dieselbe Seite: ein klammes Team faende dann keine Liquiditaetsoption, ein reiches nur
    // Gebuehrenkarten. Ueber viele Teams und Saisonen geprueft, nicht an einem Beispiel.
    for (let season = 0; season < 40; season += 1) {
      for (let team = 0; team < 8; team += 1) {
        const slate = rollSponsorOfferSlate({
          seasonId: `season-${season}`,
          teamId: `T-${team}`,
          qualityRank: qualityRank(`T-${team}`, 1 + (team % 32)),
        });
        const achsen = slate.entries.slice(1);
        const mitVorschuss = achsen.filter((entry) => entry.advance === true).length;
        expect(mitVorschuss, `S${season}/T${team}: kein Vorschuss im Slate`).toBeGreaterThanOrEqual(1);
        expect(achsen.length - mitVorschuss, `S${season}/T${team}: zu wenige Karten ohne`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("traegt die Basis-Karte nie einen Vorschuss", () => {
    const slate = rollSponsorOfferSlate({
      seasonId: "season-basis",
      teamId: "M-M",
      qualityRank: qualityRank("M-M", 1),
    });
    expect(slate.entries[0]!.advance).toBeUndefined();
  });
});

describe("Sponsor-Vorschuss: die Saisonsumme zaehlt ihn nicht doppelt", () => {
  it("weist ueber beide Zeitpunkte genau `settle − Gebuehr` aus", () => {
    // DER FEHLER, DEN DIESER TEST ABDECKT: die Saisonsumme addierte das Vorschuss-Log als Einnahme
    // UND klammerte gleichzeitig die negative Verrechnungszeile auf 0. Derselbe Betrag wurde damit
    // zweimal gutgeschrieben; gemessen waren es 24,4 C zu viel bei einem einzigen Vertrag. Solange
    // jede Settlement-Zeile positiv war, fiel das Klammern nicht auf — Achsen und Vorschuss haben
    // erstmals negative Zeilen, und damit wurde aus einer Unsauberkeit ein echter Anzeigefehler.
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams[0]!.teamId;
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    const withAdvance = offers.find((offer) => getSponsorV3Terms(offer)?.advance != null)!;
    const terms = getSponsorV3Terms(withAdvance)!;

    const stateWithOffers = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        sponsorOffersByTeamId: { ...(gameState.seasonState.sponsorOffersByTeamId ?? {}), [teamId]: offers },
      },
    };
    const signed = chooseSponsorOffer({ gameState: stateWithOffers, teamId, offerId: withAdvance.offerId }).gameState;

    // Nur dieses eine Team hat einen Vertrag — die Liga-Summe ist damit seine Summe.
    const angezeigt = getSeasonSponsorCashTotal(signed);
    const rows = previewSponsorSettlement(signed).rows.filter((row) => row.teamId === teamId);
    const echteSaisonende = rows.reduce((sum, row) => sum + row.cashDelta, 0);
    const echt = terms.advance!.amount + echteSaisonende;

    expect(angezeigt).toBeCloseTo(echt, 1);
    // Und der Vorschuss selbst darf die Summe nicht heben: er ist vorgezogenes eigenes Geld.
    expect(angezeigt).toBeLessThan(terms.advance!.amount + Math.max(...terms.rankLadder) + terms.goalSize);
  });
});
