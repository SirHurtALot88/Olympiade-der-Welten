import type { BillbeeImportResult, BillbeeRow } from "../importers/billbee";
import type { EbayImportResult } from "../importers/ebay";
import { matchBillbeeToEbay, type AliasMap } from "../matching/engine";
import { computeHk, fixedCostPerUnit, type ItemKind } from "../pricing/costEngine";
import type { CostSettingsValues } from "../pricing/costSettings";
import type { SaleWindowKey } from "../parsing/date";

/**
 * Reine Planungslogik fuer einen Import-Lauf: aus geparsten Billbee-Fenstern +
 * eBay-Report + bekannten Artikeln/Aliassen wird ein DB-unabhaengiger Plan
 * gebaut (Artikel-Katalog, Fenster-Snapshots inkl. neu berechnetem DB I/II,
 * Review-Liste fuer Ungematchtes). Die eigentlichen Prisma-Schreibvorgaenge
 * uebernimmt persist.ts — so bleibt diese Kernlogik ohne DB testbar.
 *
 * Bekannte Vereinfachung (v1): Der eBay-Report deckt einen eigenen Zeitraum ab
 * (im Beispiel 1. Jan - 15. Jul 2026), der nicht exakt mit den Billbee-Fenstern
 * (30/90/365/all) uebereinstimmt. Die eBay-Gebuehren werden daher pro Artikel
 * als Gebuehr/Stueck aus dem eBay-Report ermittelt und auf die Billbee-Fenster
 * per Stueckzahl umgelegt (statt eine exakte Fenster-Deckung anzunehmen).
 */

export interface ArticleIdentity {
  nameNormalized: string;
  nameRaw: string;
  setCode: string | null;
  packQty: number;
  isCard: boolean;
}

export interface PlannedSaleWindow {
  nameNormalized: string;
  window: SaleWindowKey;
  windowFrom: Date;
  windowTo: Date;
  qty: number;
  revenue: number;
  ek: number;
  margeBillbee: number;
  ebayFeeTotal: number;
  shippingCost: number;
  fixedCostShare: number;
  dbI: number;
  dbII: number;
  avgPrice: number;
}

export interface PlannedReviewItem {
  source: "billbee" | "ebay";
  nameRaw: string;
  nameNormalized: string;
  setCode: string | null;
  qty: number | null;
  revenue: number | null;
}

export interface ImportPlanStats {
  billbeeWindowsProcessed: number;
  billbeeTotalRows: number;
  ebayTotalRows: number;
  matchedArticles: number;
  unmatchedBillbeeArticles: number;
  unmatchedEbayListings: number;
  exactMatchRate: number;
}

export interface ImportPlan {
  articles: ArticleIdentity[];
  saleWindows: PlannedSaleWindow[];
  reviewItems: PlannedReviewItem[];
  stats: ImportPlanStats;
}

export interface BuildImportPlanOptions {
  /**
   * Shopweite 365-Tage-Gesamtstueckzahl als Fallback fuer die Fixkosten-Umlage,
   * falls weder ein "365"- noch ein "all"-Fenster in diesem Import enthalten
   * ist (z. B. wenn nur ein einzelnes 30d-Fenster nachimportiert wird und die
   * Gesamtzahl aus einem frueheren Import in der DB bekannt ist).
   */
  knownShopUnits365d?: number;
  /** Standardmenge fuer den Cardmarket-Einkauf einer Einzelkarte, wenn unbekannt (Staffel-Schwelle 5 Stk). */
  defaultPurchaseQty?: number;
  aliases?: AliasMap;
}

export function buildImportPlan(
  billbeeResults: BillbeeImportResult[],
  ebayResult: EbayImportResult | null,
  costSettings: CostSettingsValues,
  options: BuildImportPlanOptions = {}
): ImportPlan {
  const defaultPurchaseQty = options.defaultPurchaseQty ?? 3;
  const aliases = options.aliases ?? new Map<string, string>();

  // Fixkosten (eBay-Shop/Billbee/Lexoffice) sind SHOPWEITE Jahresgebuehren,
  // keine Artikel-Fixkosten -- sie werden EINMAL durch die insgesamt im Shop
  // verkauften Stueck/365T geteilt (nicht je Artikel), sonst wuerden
  // Nischen-Artikel mit wenigen eigenen Verkaeufen faelschlich die komplette
  // Fixkostenlast allein tragen. Quelle: das "365"-Fenster dieses Imports,
  // sonst "all" als Naeherung, sonst options.knownShopUnits365d (z. B. aus
  // einem frueheren Import, wenn nur ein 30d/90d-Fenster neu importiert wird).
  const shopWindow: SaleWindowKey | undefined = billbeeResults.some((r) => r.window === "365")
    ? "365"
    : billbeeResults.some((r) => r.window === "all")
      ? "all"
      : undefined;
  const totalShopUnits365d =
    shopWindow !== undefined
      ? billbeeResults
          .filter((r) => r.window === shopWindow)
          .flatMap((r) => r.rows)
          .filter((r) => r.isCard)
          .reduce((sum, r) => sum + r.qty, 0)
      : (options.knownShopUnits365d ?? 0);
  const shopFixedCostPerUnit = fixedCostPerUnit(totalShopUnits365d, costSettings);

  // 1. Artikel-Katalog: union aller Billbee-Fenster, dedupliziert nach nameNormalized.
  //    "all"/"365" bevorzugt als Quelle der Identitaetsfelder (vollstaendigste Historie).
  const catalogByName = new Map<string, BillbeeRow>();
  const priorityOrder: SaleWindowKey[] = ["all", "365", "90", "30"];
  for (const windowKey of priorityOrder) {
    for (const result of billbeeResults.filter((r) => r.window === windowKey)) {
      for (const row of result.rows) {
        if (!catalogByName.has(row.nameNormalized)) {
          catalogByName.set(row.nameNormalized, row);
        }
      }
    }
  }
  // Falls ein Artikel nur in einem nicht priorisierten Fenster vorkommt (Rand-/Testfall).
  for (const result of billbeeResults) {
    for (const row of result.rows) {
      if (!catalogByName.has(row.nameNormalized)) {
        catalogByName.set(row.nameNormalized, row);
      }
    }
  }
  const catalogRows = Array.from(catalogByName.values());

  const articles: ArticleIdentity[] = catalogRows.map((row) => ({
    nameNormalized: row.nameNormalized,
    nameRaw: row.nameRaw,
    setCode: row.setCode,
    packQty: row.packQty,
    isCard: row.isCard,
  }));

  // 2. Matching Billbee-Katalog <-> eBay (einmalig ueber den gesamten Katalog).
  const ebayRows = ebayResult?.rows ?? [];
  const matchResult = matchBillbeeToEbay(catalogRows, ebayRows, aliases);

  const ebayFeePerUnitByName = new Map<string, number>();
  for (const pair of matchResult.matched) {
    const totalQty = pair.ebayRows.reduce((sum, r) => sum + r.qtySold, 0);
    const totalFees = pair.ebayRows.reduce((sum, r) => sum + r.totalSellingCosts, 0);
    ebayFeePerUnitByName.set(pair.billbee.nameNormalized, totalQty > 0 ? totalFees / totalQty : 0);
  }

  // 3. Fenster-Snapshots inkl. DB I / DB II serverseitig neu berechnen.
  const saleWindows: PlannedSaleWindow[] = [];
  for (const result of billbeeResults) {
    for (const row of result.rows) {
      if (!row.isCard) continue; // Privatverkaeufe fliessen nicht in die Karten-Analytics ein.

      const feePerUnit = ebayFeePerUnitByName.get(row.nameNormalized) ?? 0;
      const ebayFeeTotal = feePerUnit * row.qty;

      const kind: ItemKind = row.packQty > 1 ? "pack" : "single";
      const hk = computeHk(
        {
          ek: 0, // EK ist in dbI bereits aus revenue-ek beruecksichtigt; hier nur variable Nebenkosten/Stueck.
          kind,
          purchaseQty: defaultPurchaseQty,
          packSize: row.packQty,
          fixedCostPerUnit: shopFixedCostPerUnit,
        },
        costSettings
      );
      const variableCostPerUnit = hk.total - hk.ek; // hk.ek ist 0, total = alle Nebenkosten/Stueck.
      const shippingCost = variableCostPerUnit * row.qty;

      const dbI = row.revenue - row.ek;
      const dbII = dbI - ebayFeeTotal - shippingCost;

      saleWindows.push({
        nameNormalized: row.nameNormalized,
        window: result.window,
        windowFrom: result.windowFrom,
        windowTo: result.windowTo,
        qty: row.qty,
        revenue: row.revenue,
        ek: row.ek,
        margeBillbee: row.marge,
        ebayFeeTotal,
        shippingCost,
        fixedCostShare: hk.fixedCostShare * row.qty,
        dbI,
        dbII,
        avgPrice: row.qty > 0 ? row.revenue / row.qty : 0,
      });
    }
  }

  // 4. Review-Liste + Match-Rate-Statistik: NUR im engsten verfuegbaren Fenster
  //    (bevorzugt "30", sonst "90"/"365"/"all") bewerten. Der eBay-Report deckt
  //    typischerweise nur einen aktuellen Zeitraum ab (siehe Vereinfachung oben);
  //    Artikel, die nur in aelteren "all"/"365"-Fenstern ohne aktuelle Verkaeufe
  //    stehen, koennen im eBay-Report schlicht nicht vorkommen — das ist keine
  //    Matching-Luecke, sondern erwartete Nicht-Ueberdeckung und soll die
  //    Review-Liste nicht mit historischem Ladenhueter-Rauschen fluten.
  const scopeWindow = (["30", "90", "365", "all"] as SaleWindowKey[]).find((w) =>
    billbeeResults.some((r) => r.window === w)
  );
  const scopeNames = new Set<string>();
  if (scopeWindow) {
    for (const result of billbeeResults.filter((r) => r.window === scopeWindow)) {
      for (const row of result.rows) {
        if (row.isCard) scopeNames.add(row.nameNormalized);
      }
    }
  }

  const reviewItems: PlannedReviewItem[] = [];
  if (ebayResult) {
    for (const row of matchResult.unmatchedBillbee) {
      if (!row.isCard) continue;
      if (!scopeNames.has(row.nameNormalized)) continue;
      reviewItems.push({
        source: "billbee",
        nameRaw: row.nameRaw,
        nameNormalized: row.nameNormalized,
        setCode: row.setCode,
        qty: row.qty,
        revenue: row.revenue,
      });
    }
    for (const row of matchResult.unmatchedEbay) {
      if (!row.isCard) continue;
      reviewItems.push({
        source: "ebay",
        nameRaw: row.titleRaw,
        nameNormalized: row.titleNormalized,
        setCode: row.setCode,
        qty: row.qtySold,
        revenue: row.totalRevenueGross,
      });
    }
  }

  const scopedMatchedCount = matchResult.matched.filter((pair) =>
    scopeNames.has(pair.billbee.nameNormalized)
  ).length;
  const scopedUnmatchedCount = matchResult.unmatchedBillbee.filter(
    (row) => row.isCard && scopeNames.has(row.nameNormalized)
  ).length;

  return {
    articles,
    saleWindows,
    reviewItems,
    stats: {
      billbeeWindowsProcessed: billbeeResults.length,
      billbeeTotalRows: billbeeResults.reduce((sum, r) => sum + r.rows.length, 0),
      ebayTotalRows: ebayRows.length,
      matchedArticles: scopedMatchedCount,
      unmatchedBillbeeArticles: scopedUnmatchedCount,
      unmatchedEbayListings: matchResult.unmatchedEbay.filter((r) => r.isCard).length,
      exactMatchRate:
        scopeNames.size === 0 ? 0 : scopedMatchedCount / scopeNames.size,
    },
  };
}
