/**
 * WAS ABGEZOGEN WIRD, MUSS AUCH DASTEHEN — der Widerspruch im Sponsoren-Detailfenster.
 *
 * BEFUND (gemessen am Save `s2`, Team L-R): die Gewinnstufen-Leiter markierte die aktuelle Sprosse
 * mit 76,1, unten stand "Auszahlung beim aktuellen Platz 66,7" — 15,4 Unterschied im SELBEN Panel.
 * Die 15,4 waren die VORSCHUSS-VERRECHNUNG (Vorschuss 14,7 + Gebuehr 0,7): eine echte Zeile aus
 * `sponsorV3SettlementParts`, die in `projectedCash` steckt, aber im Fenster nirgends stand.
 *
 * URSACHE: die Vorschuss-Zeile traegt mangels eigenem Kind ebenfalls `kind: "base"`. Die alte
 * Auswahl im Fenster nahm mit `find(kind === "base")` nur die ERSTE Basiszeile und warf mit
 * `filter(kind !== "base" && kind !== "rank")` die zweite weg.
 *
 * NICHT die Ursache war der Sockelabzug −p·G des Sonderziels: er steht seit jeher als eigene Zeile
 * da (dritter Test unten belegt das an Werten).
 *
 * Geprueft werden WERTE aus dem echten Modell (`buildSponsorV3TermsCore` →
 * `sponsorV3SettlementParts`), keine Quelltext-Zeichenketten.
 */
import { describe, expect, it } from "vitest";

import { readLockedRankPayout } from "@/lib/sponsor/sponsor-economy-calibration";
import { buildSponsorPayoutBreakdown } from "@/lib/sponsor/sponsor-offer-presenter";
import { sponsorKurvenLeiter } from "@/lib/sponsor/sponsor-liga-leiter";
import {
  buildSponsorV3TermsCore,
  sponsorV3CardByKey,
  sponsorV3GuaranteedLadder,
  sponsorV3Settle,
  type SponsorV3ContractTerms,
} from "@/lib/sponsor/sponsor-v3-model";
import { sponsorV3SettlementParts } from "@/lib/sponsor/sponsor-v3-offer-service";

/** Dieselbe Leiter, aus der die laufende Liga ihre Angebote baut — keine erfundene Fixture-Kurve. */
const BENCHMARK = sponsorKurvenLeiter({ shape: "stetig", startRank: 5, salaryFactor: 1 });

function konditionen(input: { withAdvance: boolean; goalKey?: string | null }): SponsorV3ContractTerms {
  return buildSponsorV3TermsCore({
    baseLadder: BENCHMARK,
    startRank: 5,
    rarity: "selten",
    card: sponsorV3CardByKey(input.goalKey ? "sonderziel" : "basis"),
    goalKey: input.goalKey ?? null,
    salaryFactor: 1,
    floor: 32,
    withAdvance: input.withAdvance,
  });
}

/**
 * Die Zahl, die im Fenster GROSS auf der aktuellen Sprosse steht: der absolute Leiterwert am Rang.
 * Genau diese Zahl liest `SponsorRankLadder` ueber `readLockedRankPayout` aus der eingefrorenen
 * Leiter des Vertrags.
 */
function sprosseAmRang(terms: SponsorV3ContractTerms, rang: number): number {
  return readLockedRankPayout(sponsorV3GuaranteedLadder(terms), rang);
}

describe("Das Sponsoren-Detailfenster zeigt jede Zeile, die abgerechnet wird", () => {
  it("ein Vertrag MIT Vorschuss erzeugt eine Abzugszeile, die im selben Kind wie die Basis steckt", () => {
    const terms = konditionen({ withAdvance: true });
    expect(terms.advance?.amount).toBeGreaterThan(0);

    const zeilen = sponsorV3SettlementParts({ terms, finalRank: 6, goalFraction: 0 });
    const basiszeilen = zeilen.filter((zeile) => zeile.key === "base");
    // Zwei Zeilen mit demselben Kind — das ist die Falle, in die die alte Auswahl lief.
    expect(basiszeilen).toHaveLength(2);
    const vorschuss = basiszeilen[1]!;
    expect(vorschuss.cashDelta).toBeLessThan(0);
    expect(vorschuss.cashDelta).toBeCloseTo(-(terms.advance!.amount + terms.advance!.fee), 9);
  });

  it("Leitersprosse + gezeigte Zeilen ergeben die Auszahlung — mit Vorschuss wie ohne", () => {
    for (const withAdvance of [true, false]) {
      const terms = konditionen({ withAdvance });
      const rang = 6;
      const zeilen = sponsorV3SettlementParts({ terms, finalRank: rang, goalFraction: 0 });
      const { baseRow, otherRows } = buildSponsorPayoutBreakdown({
        settlementRows: zeilen.map((zeile) => ({ ...zeile, kind: zeile.key })),
        showsRankLadder: true,
      });
      expect(baseRow?.label).toBe("Saisonbasis (garantiert)");

      // So liest der Spieler das Fenster: die markierte Sprosse ist der Betrag bis einschliesslich
      // Tabellenplatz, darunter stehen die weiteren Posten, unten die Summe.
      const sichtbar = sprosseAmRang(terms, rang) + otherRows.reduce((summe, zeile) => summe + zeile.cashDelta, 0);
      const tatsaechlich = sponsorV3Settle(terms, rang, 0) - (terms.advance ? terms.advance.amount + terms.advance.fee : 0);
      expect(sichtbar).toBeCloseTo(tatsaechlich, 1);
    }
  });

  it("die Vorschusszeile steht wirklich in der angezeigten Liste — und die Ueberschrift luegt nicht", () => {
    const terms = konditionen({ withAdvance: true });
    const zeilen = sponsorV3SettlementParts({ terms, finalRank: 6, goalFraction: 0 });
    const { otherRows, otherRowsLabel } = buildSponsorPayoutBreakdown({
      settlementRows: zeilen.map((zeile) => ({ ...zeile, kind: zeile.key })),
      showsRankLadder: true,
    });
    const abzug = otherRows.find((zeile) => zeile.label === "Vorschuss-Verrechnung") ?? null;
    expect(abzug).not.toBeNull();
    expect(abzug!.cashDelta).toBeCloseTo(-(terms.advance!.amount + terms.advance!.fee), 9);
    // Ohne Sonderziel darf die Liste nicht "Sonderziele" heissen.
    expect(otherRowsLabel).toBe("Verrechnungen");
  });

  it("ohne Leiter bleibt auch die Rang-Zeile sichtbar, statt ersatzlos zu verschwinden", () => {
    const terms = konditionen({ withAdvance: true });
    const zeilen = sponsorV3SettlementParts({ terms, finalRank: 6, goalFraction: 0 });
    const { baseRow, otherRows } = buildSponsorPayoutBreakdown({
      settlementRows: zeilen.map((zeile) => ({ ...zeile, kind: zeile.key })),
      showsRankLadder: false,
    });
    const summe = (baseRow?.cashDelta ?? 0) + otherRows.reduce((wert, zeile) => wert + zeile.cashDelta, 0);
    expect(summe).toBeCloseTo(zeilen.reduce((wert, zeile) => wert + zeile.cashDelta, 0), 9);
  });

  it("GEGENPROBE ZUM VERDACHT: der Sockelabzug −p·G steht seit jeher in der Sonderziel-Zeile", () => {
    // Ein Vertrag MIT Sonderziel (p > 0) und verfehltem Ziel: der Abzug muss als eigene, negative
    // Zeile dastehen — er verschwindet NICHT in der Basis und wird NICHT als 0,0 ausgewiesen.
    const terms = konditionen({ withAdvance: false, goalKey: "momentum_series" });
    expect(terms.goalP).toBeGreaterThan(0);
    expect(terms.goalSize).toBeGreaterThan(0);

    const zeilen = sponsorV3SettlementParts({ terms, finalRank: 6, goalFraction: 0 });
    const ziel = zeilen.find((zeile) => zeile.key === "special");
    expect(ziel).toBeDefined();
    expect(ziel!.cashDelta).toBeLessThan(0);
    // Der Betrag IST der Sockelabzug — bis auf die Rundung auf 0,1, die das Settlement anwendet.
    // (0,051 statt 0,05: eine halbe Rundungsstufe plus Fliesskomma-Rauschen, mehr nicht.)
    expect(Math.abs(ziel!.cashDelta + terms.goalP * terms.goalSize)).toBeLessThan(0.051);
    // Und die Basis-/Rangzeilen sind davon unberuehrt: sie summieren sich exakt auf den Leiterwert.
    const kurve = zeilen
      .filter((zeile) => zeile.key !== "special")
      .reduce((summe, zeile) => summe + zeile.cashDelta, 0);
    // Toleranz 0,1: Basis- und Rangzeile sind EINZELN auf 0,1 gerundet, der Leiterwert ist es nicht.
    // Dieser Rundungsrest ist bekannt und ein anderes Thema als die hier untersuchten 15,4.
    expect(Math.abs(kurve - sprosseAmRang(terms, 6))).toBeLessThanOrEqual(0.1);
  });
});
