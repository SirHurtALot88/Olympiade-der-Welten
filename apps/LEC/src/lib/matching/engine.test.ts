import { describe, expect, it } from "vitest";
import { matchBillbeeToEbay, type AliasMap } from "./engine";
import type { BillbeeRow } from "../importers/billbee";
import type { EbayRow } from "../importers/ebay";
import { normalizeArticleName } from "../parsing/name";
import { extractSetCode } from "../parsing/setCode";

function billbee(nameRaw: string, overrides: Partial<BillbeeRow> = {}): BillbeeRow {
  const { normalized, packQty } = normalizeArticleName(nameRaw);
  return {
    sku: null,
    nameRaw,
    nameNormalized: normalized,
    packQty,
    setCode: extractSetCode(nameRaw),
    isCard: true,
    qty: 1,
    revenue: 10,
    ek: 3,
    marge: 7,
    ...overrides,
  };
}

function ebay(titleRaw: string, overrides: Partial<EbayRow> = {}): EbayRow {
  const { normalized } = normalizeArticleName(titleRaw);
  return {
    titleRaw,
    titleNormalized: normalized,
    setCode: extractSetCode(titleRaw),
    isCard: true,
    ebayItemId: "1",
    shopCategoryL1: "Sonstiges",
    shopCategoryL2: null,
    qtySold: 1,
    totalRevenueGross: 10,
    revenueNetShipping: 9,
    shippingPaidByBuyer: 1,
    totalSellingCosts: 2,
    listingFees: 0,
    optionalFees: 0,
    salesCommission: 1,
    adFeesBasic: 1,
    adFeesPremium: 0,
    adFeesExpress: 0,
    adFeesExternal: 0,
    internationalFees: 0,
    otherFees: 0,
    depositFees: 0,
    feeCredits: 0,
    shippingLabelCost: 0,
    revenueAfterCosts: 8,
    avgSellingPrice: 10,
    ...overrides,
  };
}

describe("matchBillbeeToEbay", () => {
  it("matcht exakte Namen (Billbee-Artikel == eBay-Angebotstitel)", () => {
    const b = [billbee("Yu-Gi-Oh! RA04-DE050 Mulreizendes Fuwalos Ultra Rare NM 1st")];
    const e = [ebay("Yu-Gi-Oh! RA04-DE050 Mulreizendes Fuwalos Ultra Rare NM 1st")];
    const result = matchBillbeeToEbay(b, e);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].matchedBy).toBe("name");
    expect(result.stats.exactMatchRate).toBe(1);
    expect(result.unmatchedBillbee).toHaveLength(0);
    expect(result.unmatchedEbay).toHaveLength(0);
  });

  it("matcht trotz Gross-/Kleinschreibungs- und Leerzeichen-Unterschieden", () => {
    const b = [billbee("Yu-Gi-Oh!   BROL-DE067  Rotaeugige Fusion Ultra Rare")];
    const e = [ebay("yu-gi-oh! brol-de067 rotaeugige fusion ultra rare")];
    const result = matchBillbeeToEbay(b, e);
    expect(result.matched).toHaveLength(1);
  });

  it("faellt auf den Set-Code als Tiebreaker zurueck, wenn der Name abweicht", () => {
    const b = [billbee("Yu-Gi-Oh! GFTP-DE011 Galaxieaugen Cipher X Drache")];
    const e = [ebay("YuGiOh GFTP-DE011 Galaxy-Eyes Cipher X Dragon (leicht abweichender Titel)")];
    const result = matchBillbeeToEbay(b, e);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].matchedBy).toBe("set_code");
  });

  it("nutzt gelernte Aliasse fuer zukuenftige automatische Treffer", () => {
    const b = [billbee("Mystery Pack Sammlung")];
    const e = [ebay("Ueberraschungspaket XYZ")];
    const aliases: AliasMap = new Map([["mystery pack sammlung", "ueberraschungspaket xyz"]]);
    const result = matchBillbeeToEbay(b, e, aliases);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].matchedBy).toBe("alias");
  });

  it("legt ungematchte Zeilen in die Review-Liste (kein falscher Treffer erzwungen)", () => {
    const b = [billbee("Voellig unbekannter Artikel ohne Set-Code")];
    const e = [ebay("Komplett anderer Titel ohne Set-Code")];
    const result = matchBillbeeToEbay(b, e);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatchedBillbee).toHaveLength(1);
    expect(result.unmatchedEbay).toHaveLength(1);
  });

  it("erreicht ~98% exakte Namens-Treffer bei ueberwiegend identischen Titeln", () => {
    const names = Array.from({ length: 50 }, (_, i) => `Yu-Gi-Oh! TST-DE${String(i).padStart(3, "0")} Karte ${i}`);
    const b = names.map((n) => billbee(n));
    const e = names.slice(0, 49).map((n) => ebay(n));
    // Eine Zeile bleibt absichtlich unterschiedlich (z. B. "Mystery Pack").
    e.push(ebay("Mystery Pack ganz anders"));

    const result = matchBillbeeToEbay(b, e);
    expect(result.stats.exactMatchRate).toBeGreaterThanOrEqual(0.98);
  });
});
