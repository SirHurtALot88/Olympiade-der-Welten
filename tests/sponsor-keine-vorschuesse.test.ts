/**
 * ES GIBT KEINEN SPONSOR-VORSCHUSS MEHR — Sponsorgeld flieszt VOLLSTAENDIG am Saisonende.
 *
 * Dieser Test ersetzt `sponsor-v4-vorschuss.test.ts` und `sponsor-drawer-zeigt-den-vorschuss.test.ts`.
 * Beide pruefen eine Zusage, die es nicht mehr gibt: dass eine Karte einen Teil schon bei
 * Unterschrift auszahlt und ihn am Saisonende samt Gebuehr wieder verrechnet.
 *
 * WARUM DIE ZWEITE ZAHLUNGSZEIT WEG IST: sie hat genau die Rechenprobleme erzeugt, gegen die der
 * alte Drawer-Test angeschrieben hat — der Vorschuss wurde von der Auszahlung abgezogen, stand aber
 * im Detailfenster nirgends (Leitersprosse 76,1 gegen ausgewiesene 66,7 am Save `s2`). Dazu kam ein
 * struktureller Doppelabzug: der Mehrjahres-Roll nahm das `advance`-Feld in die Folgesaison mit,
 * ohne dass dort je ein Vorschuss floss. Ein Zahlungszeitpunkt kann gegen nichts driften.
 *
 * Geprueft wird an WERTEN aus dem echten Modell (Slate-Wurf, `buildSponsorOffersForTeam`,
 * `chooseSponsorOffer`, `sponsorV3SettlementParts`), nicht an Quelltext-Zeichenketten.
 */
import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { readLockedRankPayout } from "@/lib/sponsor/sponsor-economy-calibration";
import { sponsorKurvenLeiter } from "@/lib/sponsor/sponsor-liga-leiter";
import { buildSponsorPayoutBreakdown } from "@/lib/sponsor/sponsor-offer-presenter";
import { buildSponsorOffersForTeam, chooseSponsorOffer } from "@/lib/sponsor/sponsor-offer-service";
import { getSeasonSponsorCashTotal, previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { rollSponsorOfferSlate } from "@/lib/sponsor/sponsor-tier-pool";
import type { SponsorTeamQualityRank } from "@/lib/sponsor/sponsor-team-quality-rank";
import {
  buildSponsorV3TermsCore,
  sponsorV3CardByKey,
  sponsorV3GuaranteedLadder,
  sponsorV3Settle,
  type SponsorV3ContractTerms,
} from "@/lib/sponsor/sponsor-v3-model";
import { getSponsorV3Terms, sponsorV3SettlementParts } from "@/lib/sponsor/sponsor-v3-offer-service";

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

/** Dieselbe Leiter, aus der die laufende Liga ihre Angebote baut — keine erfundene Fixture-Kurve. */
const BENCHMARK = sponsorKurvenLeiter({ shape: "stetig", startRank: 5, salaryFactor: 1 });

function konditionen(goalKey: string | null = null): SponsorV3ContractTerms {
  return buildSponsorV3TermsCore({
    baseLadder: BENCHMARK,
    startRank: 5,
    rarity: "selten",
    card: sponsorV3CardByKey(goalKey ? "sonderziel" : "basis"),
    goalKey,
    salaryFactor: 1,
    floor: 32,
  });
}

/** Die Zahl, die im Fenster GROSS auf der aktuellen Sprosse steht: der absolute Leiterwert am Rang. */
function sprosseAmRang(terms: SponsorV3ContractTerms, rang: number): number {
  return readLockedRankPayout(sponsorV3GuaranteedLadder(terms), rang);
}

/** Traegt dieses Objekt noch irgendwo ein Vorschuss-Feld? Bewusst strukturell, nicht ueber den Typ. */
function hatVorschussFeld(wert: unknown): boolean {
  return typeof wert === "object" && wert !== null && "advance" in (wert as Record<string, unknown>);
}

describe("Der Sponsor-Vorschuss ist ersatzlos entfernt", () => {
  it("kein Slate-Platz und kein erzeugtes Angebot traegt noch einen Vorschuss", () => {
    // Ueber viele Teams und Saisonen, nicht an einem Beispiel: der alte Wurf verteilte den
    // Vorschuss zufaellig ueber die Achsen-Slots, ein Einzelfall koennte ihn also verfehlen.
    for (let season = 0; season < 40; season += 1) {
      for (let team = 0; team < 8; team += 1) {
        const slate = rollSponsorOfferSlate({
          seasonId: `season-${season}`,
          teamId: `T-${team}`,
          qualityRank: qualityRank(`T-${team}`, 1 + (team % 32)),
        });
        for (const entry of slate.entries) {
          expect(hatVorschussFeld(entry), `S${season}/T${team}: Slate-Platz traegt noch advance`).toBe(false);
        }
      }
    }

    const gameState = createSingleplayerGameState();
    for (const team of gameState.teams.slice(0, 6)) {
      for (const offer of buildSponsorOffersForTeam({ gameState, teamId: team.teamId })) {
        const terms = getSponsorV3Terms(offer);
        expect(terms).not.toBeNull();
        expect(hatVorschussFeld(terms), `${team.teamId}: Konditionen tragen noch advance`).toBe(false);
      }
    }
  });

  it("das Unterschreiben bewegt KEIN Geld und bucht keine Zeile", () => {
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams[0]!.teamId;
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    const cashBefore = gameState.teams.find((team) => team.teamId === teamId)!.cash;
    const logsBefore = (gameState.seasonState.sponsorPayoutLogs ?? []).length;

    const stateWithOffers = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        sponsorOffersByTeamId: { ...(gameState.seasonState.sponsorOffersByTeamId ?? {}), [teamId]: offers },
      },
    };

    // JEDES der fuenf Angebote, nicht nur eines: frueher war der Vorschuss eine Eigenschaft
    // EINZELNER Karten — ein Test auf nur eine Karte koennte die zahlende gerade verfehlen.
    for (const offer of offers) {
      const signed = chooseSponsorOffer({ gameState: stateWithOffers, teamId, offerId: offer.offerId }).gameState;
      const cashAfter = signed.teams.find((team) => team.teamId === teamId)!.cash;
      expect(cashAfter, `${offer.offerId}: Unterschrift hat Geld bewegt`).toBeCloseTo(cashBefore, 9);
      expect((signed.seasonState.sponsorPayoutLogs ?? []).length).toBe(logsBefore);
    }
  });

  it("die Settlement-Zeilen summieren sich exakt auf die volle Auszahlung — ohne Verrechnungszeile", () => {
    for (const goalKey of [null, "momentum_series"]) {
      const terms = konditionen(goalKey);
      for (const rang of [1, 6, 16, 32]) {
        const zeilen = sponsorV3SettlementParts({ terms, finalRank: rang, goalFraction: 0 });
        // Es gibt genau EINE Basiszeile. Die zweite war die Vorschuss-Verrechnung.
        expect(zeilen.filter((zeile) => zeile.key === "base")).toHaveLength(1);
        expect(zeilen.some((zeile) => zeile.label.includes("Vorschuss"))).toBe(false);

        const summe = zeilen.reduce((wert, zeile) => wert + zeile.cashDelta, 0);
        // Toleranz 0,1: die Zeilen sind EINZELN auf 0,1 gerundet, `sponsorV3Settle` ist es nicht.
        expect(Math.abs(summe - sponsorV3Settle(terms, rang, 0))).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it("Leitersprosse + gezeigte Zeilen ergeben die tatsaechliche Auszahlung", () => {
    // Das ist der reparierte Widerspruch aus dem alten Drawer-Test — die Zusage bleibt, nur ist sie
    // jetzt ohne Sonderfall erfuellt: was die Leiter zeigt, kommt auch, abzueglich der Zielzeilen.
    const terms = konditionen();
    const rang = 6;
    const zeilen = sponsorV3SettlementParts({ terms, finalRank: rang, goalFraction: 0 });
    const { baseRow, otherRows } = buildSponsorPayoutBreakdown({
      settlementRows: zeilen.map((zeile) => ({ ...zeile, kind: zeile.key })),
      showsRankLadder: true,
    });
    expect(baseRow?.label).toBe("Saisonbasis (garantiert)");
    const sichtbar = sprosseAmRang(terms, rang) + otherRows.reduce((summe, zeile) => summe + zeile.cashDelta, 0);
    expect(sichtbar).toBeCloseTo(sponsorV3Settle(terms, rang, 0), 1);
  });

  it("die Saisonsumme ist genau die Saisonende-Abrechnung — es gibt keine zweite Buchung", () => {
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams[0]!.teamId;
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    const stateWithOffers = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        sponsorOffersByTeamId: { ...(gameState.seasonState.sponsorOffersByTeamId ?? {}), [teamId]: offers },
      },
    };
    const signed = chooseSponsorOffer({ gameState: stateWithOffers, teamId, offerId: offers[0]!.offerId }).gameState;

    // Nur dieses eine Team hat einen Vertrag — die Liga-Summe ist damit seine Summe.
    const angezeigt = getSeasonSponsorCashTotal(signed);
    const saisonende = previewSponsorSettlement(signed)
      .rows.filter((row) => row.teamId === teamId)
      .reduce((sum, row) => sum + row.cashDelta, 0);
    expect(angezeigt).toBeCloseTo(saisonende, 1);
  });

  it("ein BESTANDSVERTRAG mit altem advance-Feld wird nicht mehr belastet", () => {
    // Laufende Spiele tragen Vertraege mit `advance` (gemessen: Save `s2` 9 von 32). Der Betrag
    // wurde bei Unterschrift ausgezahlt und liegt real in der Kasse; er wird NICHT nachtraeglich
    // eingezogen. Die Begruendung steht bei `getSponsorV3Terms` in sponsor-v3-offer-service.ts.
    const sauber = konditionen();
    const altvertrag = { ...sauber, advance: { amount: 14.7, fee: 0.7 } } as SponsorV3ContractTerms;

    for (const rang of [1, 6, 32]) {
      const zeilen = sponsorV3SettlementParts({ terms: altvertrag, finalRank: rang, goalFraction: 0 });
      expect(zeilen.some((zeile) => zeile.label.includes("Vorschuss"))).toBe(false);
      const summe = zeilen.reduce((wert, zeile) => wert + zeile.cashDelta, 0);
      const ohneFeld = sponsorV3SettlementParts({ terms: sauber, finalRank: rang, goalFraction: 0 })
        .reduce((wert, zeile) => wert + zeile.cashDelta, 0);
      // Derselbe Vertrag mit und ohne Altfeld zahlt exakt gleich — das Feld ist wirkungslos.
      expect(summe).toBeCloseTo(ohneFeld, 9);
    }
  });

  it("GEGENPROBE: der Sockelabzug −p·G steht weiterhin als eigene Zeile da", () => {
    // Diese Zeile ist NICHT der Vorschuss und darf mit ihm nicht verschwunden sein: ein verfehltes
    // Sonderziel zieht nach wie vor ab, und der Abzug muss sichtbar bleiben statt in der Basis zu
    // verschwinden.
    const terms = konditionen("momentum_series");
    expect(terms.goalP).toBeGreaterThan(0);
    expect(terms.goalSize).toBeGreaterThan(0);

    const zeilen = sponsorV3SettlementParts({ terms, finalRank: 6, goalFraction: 0 });
    const ziel = zeilen.find((zeile) => zeile.key === "special");
    expect(ziel).toBeDefined();
    expect(ziel!.cashDelta).toBeLessThan(0);
    expect(Math.abs(ziel!.cashDelta + terms.goalP * terms.goalSize)).toBeLessThan(0.051);

    const kurve = zeilen
      .filter((zeile) => zeile.key !== "special")
      .reduce((summe, zeile) => summe + zeile.cashDelta, 0);
    expect(Math.abs(kurve - sprosseAmRang(terms, 6))).toBeLessThanOrEqual(0.1);
  });
});
