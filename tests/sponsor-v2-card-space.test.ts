/**
 * DER ABNAHMETEST FUER DEN GESAMTEN KARTENRAUM.
 *
 * Er prueft nicht eine Stichprobe und keine Strukturmerkmale, sondern die tatsaechlichen BETRAEGE
 * jeder einzelnen der 160 Karten (32 Teams x 5 Angebote), die der Knopf "Neues Spiel" erzeugt —
 * ueber `buildNewGameStateFromBaseline`, also genau den Weg, den POST /api/new-game nimmt.
 *
 * WARUM ES DIESEN TEST BRAUCHT: die bestehenden Sponsor-Tests pruefen Strukturmerkmale ("traegt
 * V2-Konditionen", "Klausel hat einen Malus") und Modell-Eigenschaften auf einer Handvoll
 * konstruierter Karten. Beides war gruen, waehrend im Browser Karten standen, die auf allen neun
 * Gewinnstufen denselben Betrag zahlten und deren Sonderziel 77 % der Auszahlung ausmachte.
 * Gemessen vor der Behebung, ueber genau diesen Pfad:
 *   21 von 160 Karten mit voellig flacher Rangleiter (Meister == Platz 32)
 *   138 von 160 mit einem Sonderziel ueber 15 % der Karte (Spitze: 77 %)
 *   63 von 160 mit einer Klausel ohne jede Wirkung (0,0 C)
 *   18 von 160 mit einem Sonderziel ohne jede Wirkung (0,0 C)
 * Ursache war in allen Faellen dieselbe: der Ziel-Erwartungswert der Karte lag unter der Summe aus
 * Untergrenze und Sonderziel-Erwartungswert, die Kalibrierung konnte ihr Ziel nicht mehr erreichen
 * und jeder Rang klemmte an der Untergrenze.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SponsorOffer } from "@/lib/data/olyDataTypes";
import { buildNewGameStateFromBaseline } from "@/lib/game/new-game-setup-service";
import {
  SPONSOR_V2_GOAL_MAX_SHARE,
  SPONSOR_V2_MIN_CLAUSE_EFFECT,
  SPONSOR_V2_MIN_GOAL_PAYOUT,
  SPONSOR_V2_MIN_LADDER_SPREAD,
} from "@/lib/sponsor/sponsor-v2-model";
import {
  getSponsorV2Terms,
  sponsorV2CardInvariants,
  sponsorV2ExpectedPayout,
  sponsorV2GuaranteedLadder,
  sponsorV2Settle,
} from "@/lib/sponsor/sponsor-v2-offer-service";

const TIMEOUT = { timeout: 900_000 } as const;

/** EIN erzeugtes Spiel fuer alle Faelle — der Aufbau kostet Sekunden, die Pruefungen nicht. */
let cached: GameState | null = null;
function newGameFromButton(): GameState {
  cached ??= buildNewGameStateFromBaseline({ presetId: "solo_1", chrisTeamIds: ["P-S"] }).gameState;
  return cached;
}
const offersByTeam = (gameState: GameState): Array<[string, SponsorOffer[]]> =>
  Object.entries(gameState.seasonState.sponsorOffersByTeamId ?? {});
const allOffers = (gameState: GameState): SponsorOffer[] => offersByTeam(gameState).flatMap(([, list]) => list);

/** Kurzbeschreibung einer Karte fuer die Fehlermeldung — ohne sie sucht man die Karte von Hand. */
function describeOffer(offer: SponsorOffer): string {
  const terms = getSponsorV2Terms(offer)!;
  return `${offer.name} [${terms.rarity}/${terms.profileName}/${terms.curveName}, Erwartungsrang ${terms.expectedRank}]`;
}

describe("Sponsor V2 — jede einzelne erzeugte Karte", () => {
  it("erzeugt ueberhaupt die erwarteten 160 Karten mit V2-Konditionen", TIMEOUT, () => {
    const offers = allOffers(newGameFromButton());
    expect(offers.length).toBe(160);
    expect(offers.filter((offer) => getSponsorV2Terms(offer) === null)).toHaveLength(0);
  });

  it("A — keine Karte hat eine flache Rangleiter", TIMEOUT, () => {
    const failed = allOffers(newGameFromButton())
      .map((offer) => ({ offer, inv: sponsorV2CardInvariants(getSponsorV2Terms(offer)!) }))
      .filter((row) => row.inv.ladderSpread < SPONSOR_V2_MIN_LADDER_SPREAD);
    expect(
      failed.map((row) => `${describeOffer(row.offer)}: nur ${row.inv.ladderSpread.toFixed(1)} C zwischen Meister und Platz 32`),
      `${failed.length} Karten machen den Endrang wirtschaftlich bedeutungslos`,
    ).toEqual([]);
  });

  it("B — kein Sonderziel ueberschreitet 15 % des Kartenwerts", TIMEOUT, () => {
    const failed = allOffers(newGameFromButton())
      .map((offer) => ({ offer, inv: sponsorV2CardInvariants(getSponsorV2Terms(offer)!) }))
      .filter((row) => row.inv.goalShare > SPONSOR_V2_GOAL_MAX_SHARE + 1e-6);
    expect(
      failed.map((row) => `${describeOffer(row.offer)}: Sonderziel ${(row.inv.goalShare * 100).toFixed(0)} % der Auszahlung`),
      `${failed.length} Karten verletzen die 15-%-Obergrenze`,
    ).toEqual([]);
  });

  it("C — weder Klausel noch Sonderziel sind auf einer Karte wirkungslos", TIMEOUT, () => {
    const failed: string[] = [];
    for (const offer of allOffers(newGameFromButton())) {
      const inv = sponsorV2CardInvariants(getSponsorV2Terms(offer)!);
      if (inv.clauseEffect < SPONSOR_V2_MIN_CLAUSE_EFFECT) {
        failed.push(`${describeOffer(offer)}: Klausel bewegt nur ${inv.clauseEffect.toFixed(1)} C`);
      }
      if (inv.goalPayout < SPONSOR_V2_MIN_GOAL_PAYOUT) {
        failed.push(`${describeOffer(offer)}: Sonderziel bringt nur ${inv.goalPayout.toFixed(1)} C`);
      }
    }
    expect(failed, `${failed.length} tote Module ueber 160 Karten`).toEqual([]);
  });

  it("D — innerhalb eines Angebots-Slates ist keine Karte ein Vielfaches einer anderen", TIMEOUT, () => {
    // Die EV-Paritaet gilt laut Entwurf INNERHALB der Auswahl, die EIN Team vor sich hat — und genau
    // dort trifft der Spieler seine Entscheidung. Ueber Teams hinweg darf ein Titelanwaerter mehr
    // bekommen als ein Kellerkind; das ist die Rangleiter und kein Fehler.
    const failed: string[] = [];
    for (const [teamId, list] of offersByTeam(newGameFromButton())) {
      const values = list.map((offer) => ({
        offer,
        // Der Erwartungswert der Karte, nicht ihr Bestwert: eine risikoreiche Karte darf oben mehr
        // zahlen, sie darf nur nicht IM MITTEL ein Vielfaches der anderen sein.
        ev: sponsorV2ExpectedPayout(getSponsorV2Terms(offer)!),
      }));
      const lo = Math.min(...values.map((v) => v.ev));
      const hi = Math.max(...values.map((v) => v.ev));
      if (lo > 0 && hi / lo > 2) {
        failed.push(`${teamId}: bestes Angebot ${hi.toFixed(1)} C gegen schwaechstes ${lo.toFixed(1)} C (Faktor ${(hi / lo).toFixed(2)})`);
      }
    }
    expect(failed, `${failed.length} Teams bekommen eine Auswahl, in der eine Karte die anderen erschlaegt`).toEqual([]);
  });

  it("E — die Auszahlung faellt ueber die Raenge nirgends nach oben aus", TIMEOUT, () => {
    const failed: string[] = [];
    for (const offer of allOffers(newGameFromButton())) {
      const terms = getSponsorV2Terms(offer)!;
      // Nicht nur die garantierte Leiter: auch mit erfuellter Klausel und erreichtem Ziel muss ein
      // besserer Endrang mindestens so viel zahlen wie ein schlechterer.
      for (const [clauseMet, goalFraction] of [[false, 0], [true, 0], [true, 1]] as const) {
        const ladder = Array.from({ length: 32 }, (_, i) => sponsorV2Settle(terms, i + 1, clauseMet, goalFraction));
        for (let rank = 2; rank <= 32; rank += 1) {
          if (ladder[rank - 1]! > ladder[rank - 2]! + 1e-6) {
            failed.push(`${describeOffer(offer)}: Platz ${rank} zahlt mehr als Platz ${rank - 1}`);
          }
        }
      }
    }
    expect(failed.slice(0, 5), `${failed.length} Monotonie-Bruecke`).toEqual([]);
  });

  it("die Untergrenze bleibt ein echter Schutz und wird mit dem Vertrag eingefroren", TIMEOUT, () => {
    const failed: string[] = [];
    for (const offer of allOffers(newGameFromButton())) {
      const terms = getSponsorV2Terms(offer)!;
      // Ohne eingefrorene Untergrenze rechnete das Settlement sie neu aus der Rarity — dann kann die
      // Anzeige von der Abrechnung abweichen, sobald die Regel sich je aendert.
      if (typeof terms.floor !== "number" || !Number.isFinite(terms.floor)) {
        failed.push(`${describeOffer(offer)}: keine eingefrorene Untergrenze`);
        continue;
      }
      const guaranteed = sponsorV2GuaranteedLadder(terms)[31]!;
      // 10 C ist kein Designziel, sondern eine Reissleine: darunter waere die Karte fuer ein
      // Kellerteam wirtschaftlich wertlos, egal wie gross ihre Spitze ist.
      if (guaranteed < 10) {
        failed.push(`${describeOffer(offer)}: garantiert nur ${guaranteed.toFixed(1)} C`);
      }
    }
    expect(failed, `${failed.length} Karten ohne belastbare Untergrenze`).toEqual([]);
  });

  /**
   * F — JEDES ZIEL MUSS ERFUELLBAR SEIN UND SEINE SCHWELLE NENNEN.
   *
   * Die Angebote entstehen VOR dem Draft. Zu diesem Zeitpunkt hat kein Team Spieler, also ist jede
   * gemessene Gehaltssumme und jeder Kaderwert 0 — und ein Ziel, das sich an einem Liga-Median
   * orientiert, bekam die Schwelle 0. Im Browser stand dann "Gehalt <= 0 C" und "bei Kaderwert <= 0":
   * Ziele, die niemand jemals erfuellen kann, mit ausgewiesenem Bonus daneben. Die anderen
   * Kartenschranken haben das nicht bemerkt, weil Betrag und Struktur der Karte voellig in Ordnung
   * waren — kaputt war allein die Zielmarke.
   */
  it("F — kein Sonderziel nennt eine unerfuellbare Schwelle von 0", TIMEOUT, () => {
    const failed: string[] = [];
    for (const [teamId, offers] of offersByTeam(newGameFromButton())) {
      for (const offer of offers) {
        for (const component of offer.components ?? []) {
          if (component.kind !== "special") continue;
          // Deckt "Gehalt <= 0 C", "bei Kaderwert <= 0" und jede kuenftige Variante ab: eine
          // Schwelle, die als "<= 0" oder "0 C" im Text steht, ist keine Aufgabe, sondern ein Fehler.
          if (/[≤<]=?\s*0(\s|$|\s*C\b)/.test(component.label) || /\b0\s*C\b/.test(component.label)) {
            failed.push(`${teamId} — ${offer.name}: "${component.label}"`);
          }
          const numericTarget = typeof component.targetValue === "number" ? component.targetValue : null;
          if (numericTarget !== null && numericTarget <= 0) {
            failed.push(`${teamId} — ${offer.name}: Zielwert ${numericTarget} bei "${component.label}"`);
          }
        }
      }
    }
    expect(failed, `${failed.length} Ziele sind nicht erfuellbar`).toEqual([]);
  });
});
