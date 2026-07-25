import { parse } from "csv-parse/sync";
import { parseGermanNumber } from "../parsing/number";
import { normalizeArticleName } from "../parsing/name";
import { extractSetCode } from "../parsing/setCode";
import { isCardArticleName } from "../parsing/cardFilter";
import { parseEbayReportDateRange } from "../parsing/date";

/**
 * eBay "Listings Sales Report" (.csv) — Aufbau nach KONZEPT.md Abschnitt 12.2:
 * Vorspann Zeilen 0-10 (0-indexiert), Header in Zeile 11, Daten ab Zeile 12,
 * 27 Spalten.
 */
const HEADER_ROW_INDEX = 11;

const COL = {
  angebotstitel: 0,
  ebayArtikelnummer: 1,
  shopKategorieL1: 2,
  shopKategorieL2: 3,
  verkaufteStueckzahl: 4,
  gesamtumsatz: 5,
  umsatzOhneVersand: 6,
  versandVomKaeufer: 7,
  verkaufskostenGesamt: 8,
  angebotsgebuehren: 9,
  optionaleGebuehren: 10,
  verkaufsprovisionen: 11,
  adBasic: 12,
  adPremium: 13,
  adExpress: 14,
  adExternal: 15,
  internationaleGebuehren: 16,
  sonstigeGebuehren: 17,
  anzahlungsgebuehren: 18,
  gebuehrengutschriften: 19,
  versandetiketten: 20,
  umsatzNachKosten: 21,
  avgVerkaufspreis: 22,
} as const;

export interface EbayRow {
  titleRaw: string;
  titleNormalized: string;
  setCode: string | null;
  isCard: boolean;
  ebayItemId: string;
  shopCategoryL1: string | null;
  shopCategoryL2: string | null;
  qtySold: number;
  totalRevenueGross: number;
  revenueNetShipping: number;
  shippingPaidByBuyer: number;
  totalSellingCosts: number;
  listingFees: number;
  optionalFees: number;
  salesCommission: number;
  adFeesBasic: number;
  adFeesPremium: number;
  adFeesExpress: number;
  adFeesExternal: number;
  internationalFees: number;
  otherFees: number;
  depositFees: number;
  feeCredits: number;
  shippingLabelCost: number;
  revenueAfterCosts: number;
  avgSellingPrice: number;
}

export interface EbayImportResult {
  reportFrom: Date | null;
  reportTo: Date | null;
  /** Kontobasierte Abonnementgebuehr aus dem Vorspann (Fixkosten, nicht je Artikel). */
  subscriptionFee: number | null;
  rows: EbayRow[];
}

export function parseEbayReport(csvText: string): EbayImportResult {
  const records: string[][] = parse(csvText, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false,
  });

  const preamble = records.slice(0, HEADER_ROW_INDEX).map((r) => r.join(" "));
  const preambleText = preamble.join("\n");

  const dateRange = findReportDateRange(preamble);
  const subscriptionFee = findSubscriptionFee(preambleText);

  const header = records[HEADER_ROW_INDEX];
  if (!header || !header[COL.angebotstitel]?.toLowerCase().includes("angebotstitel")) {
    throw new Error(
      `Unerwartetes eBay-CSV-Format: Header-Zeile ${HEADER_ROW_INDEX} hat kein "Angebotstitel"-Feld`
    );
  }

  const rows: EbayRow[] = [];
  for (let i = HEADER_ROW_INDEX + 1; i < records.length; i++) {
    const record = records[i];
    if (!record || record.length === 0) continue;
    const titleRaw = (record[COL.angebotstitel] ?? "").trim();
    if (!titleRaw) continue;

    const { normalized } = normalizeArticleName(titleRaw);
    const setCode = extractSetCode(titleRaw);

    rows.push({
      titleRaw,
      titleNormalized: normalized,
      setCode,
      isCard: isCardArticleName(titleRaw),
      ebayItemId: (record[COL.ebayArtikelnummer] ?? "").trim(),
      shopCategoryL1: record[COL.shopKategorieL1]?.trim() || null,
      shopCategoryL2: record[COL.shopKategorieL2]?.trim() || null,
      qtySold: parseGermanNumber(record[COL.verkaufteStueckzahl]),
      totalRevenueGross: parseGermanNumber(record[COL.gesamtumsatz]),
      revenueNetShipping: parseGermanNumber(record[COL.umsatzOhneVersand]),
      shippingPaidByBuyer: parseGermanNumber(record[COL.versandVomKaeufer]),
      totalSellingCosts: parseGermanNumber(record[COL.verkaufskostenGesamt]),
      listingFees: parseGermanNumber(record[COL.angebotsgebuehren]),
      optionalFees: parseGermanNumber(record[COL.optionaleGebuehren]),
      salesCommission: parseGermanNumber(record[COL.verkaufsprovisionen]),
      adFeesBasic: parseGermanNumber(record[COL.adBasic]),
      adFeesPremium: parseGermanNumber(record[COL.adPremium]),
      adFeesExpress: parseGermanNumber(record[COL.adExpress]),
      adFeesExternal: parseGermanNumber(record[COL.adExternal]),
      internationalFees: parseGermanNumber(record[COL.internationaleGebuehren]),
      otherFees: parseGermanNumber(record[COL.sonstigeGebuehren]),
      depositFees: parseGermanNumber(record[COL.anzahlungsgebuehren]),
      feeCredits: parseGermanNumber(record[COL.gebuehrengutschriften]),
      shippingLabelCost: parseGermanNumber(record[COL.versandetiketten]),
      revenueAfterCosts: parseGermanNumber(record[COL.umsatzNachKosten]),
      avgSellingPrice: parseGermanNumber(record[COL.avgVerkaufspreis]),
    });
  }

  return {
    reportFrom: dateRange?.from ?? null,
    reportTo: dateRange?.to ?? null,
    subscriptionFee,
    rows,
  };
}

function findReportDateRange(preambleLines: string[]): { from: Date; to: Date } | null {
  for (const line of preambleLines) {
    const range = parseEbayReportDateRange(line);
    if (range) return range;
  }
  return null;
}

function findSubscriptionFee(preambleText: string): number | null {
  const match = preambleText.match(/Abonnementgeb[uü]hren\s*=\s*([0-9.,]+)\s*EUR/i);
  if (!match) return null;
  return parseGermanNumber(match[1]);
}
