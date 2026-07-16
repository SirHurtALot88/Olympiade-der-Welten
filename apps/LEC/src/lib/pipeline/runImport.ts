import type { PrismaClient } from "@prisma/client";
import { parseBillbeeWorkbook, type BillbeeImportResult } from "../importers/billbee";
import { parseEbayReport, type EbayImportResult } from "../importers/ebay";
import { parseBillbeeArtikelWorkbook } from "../importers/billbeeArtikel";
import { buildImportPlan } from "./importPlan";
import { persistImportPlan, persistBillbeeArtikel, type PersistResult } from "./persist";
import { loadAliasMap } from "./aliases";
import { DEFAULT_COST_SETTINGS } from "../pricing/costSettings";
import type { SaleWindowKey } from "../parsing/date";

export interface UploadedFile {
  name: string;
  buffer: Buffer;
}

export interface ImportInput {
  billbeeFiles: UploadedFile[];
  ebayFile?: UploadedFile | null;
  /** Billbee-Artikelstamm-Export (.xlsx) -- separater Slot, siehe billbeeArtikel.ts. */
  billbeeArtikelFile?: UploadedFile | null;
}

export interface ImportWindowInfo {
  fileName: string;
  window: SaleWindowKey;
  windowFrom: string; // ISO-Datum
  windowTo: string;
  rowCount: number;
}

export interface ImportSummary {
  windows: ImportWindowInfo[];
  ebay: { fileName: string; rowCount: number; subscriptionFee: number | null } | null;
  billbeeArtikel: { fileName: string; rowCount: number; activeCount: number } | null;
  articleCount: number;
  cardArticleCount: number;
  matchedArticles: number;
  unmatchedBillbeeArticles: number;
  unmatchedEbayListings: number;
  matchRate: number;
  windowsReplaced: SaleWindowKey[];
  reviewItemsOpen: number;
}

function isXlsx(name: string): boolean {
  return /\.xlsx$/i.test(name);
}
function isCsv(name: string): boolean {
  return /\.csv$/i.test(name);
}

/**
 * Fuehrt einen kompletten Import durch: Billbee-.xlsx-Dateien + optionalen
 * eBay-.csv-Report parsen, gelernte Aliasse laden, Plan bauen (DB I/II neu
 * berechnen, Matching, Review-Liste) und idempotent persistieren.
 *
 * Wiederverwendet dieselbe Logik wie scripts/import-local-fixtures.ts, aber
 * DB-parametrisiert und ohne Dateisystem -- damit sowohl der HTTP-Route-Handler
 * (POST /api/import) als auch die Vitest-Tests denselben Pfad nutzen.
 */
export async function runImport(prisma: PrismaClient, input: ImportInput): Promise<ImportSummary> {
  const billbeeResults: BillbeeImportResult[] = [];
  const windows: ImportWindowInfo[] = [];

  for (const file of input.billbeeFiles) {
    if (!isXlsx(file.name)) {
      throw new Error(`Billbee-Datei "${file.name}" ist keine .xlsx-Datei.`);
    }
    const result = await parseBillbeeWorkbook(file.buffer);
    billbeeResults.push(result);
    windows.push({
      fileName: file.name,
      window: result.window,
      windowFrom: result.windowFrom.toISOString().slice(0, 10),
      windowTo: result.windowTo.toISOString().slice(0, 10),
      rowCount: result.rows.length,
    });
  }

  let ebayResult: EbayImportResult | null = null;
  let ebayInfo: ImportSummary["ebay"] = null;
  if (input.ebayFile) {
    if (!isCsv(input.ebayFile.name)) {
      throw new Error(`eBay-Datei "${input.ebayFile.name}" ist keine .csv-Datei.`);
    }
    ebayResult = parseEbayReport(input.ebayFile.buffer.toString("utf-8"));
    ebayInfo = {
      fileName: input.ebayFile.name,
      rowCount: ebayResult.rows.length,
      subscriptionFee: ebayResult.subscriptionFee,
    };
  }

  const aliases = await loadAliasMap(prisma);
  const plan = buildImportPlan(billbeeResults, ebayResult, DEFAULT_COST_SETTINGS, { aliases });
  const persistResult: PersistResult = await persistImportPlan(prisma, plan);

  // Billbee-Artikelstamm (Bestand + aktiver Katalog, Chris' Ergaenzung) ist
  // unabhaengig vom Fenster-/Matching-Plan oben -- eigener, einfacher
  // Upsert-Pfad (siehe persistBillbeeArtikel).
  let billbeeArtikelInfo: ImportSummary["billbeeArtikel"] = null;
  if (input.billbeeArtikelFile) {
    if (!isXlsx(input.billbeeArtikelFile.name)) {
      throw new Error(`Billbee-Artikelstamm-Datei "${input.billbeeArtikelFile.name}" ist keine .xlsx-Datei.`);
    }
    const artikelResult = await parseBillbeeArtikelWorkbook(input.billbeeArtikelFile.buffer);
    const artikelPersist = await persistBillbeeArtikel(prisma, artikelResult.rows);
    billbeeArtikelInfo = {
      fileName: input.billbeeArtikelFile.name,
      rowCount: artikelResult.rows.length,
      activeCount: artikelPersist.activeCount,
    };
  }

  // Protokoll je Import-Lauf (KONZEPT ImportBatch) -- Basis fuer die
  // Datenstand-Karte auf /einstellungen.
  for (const w of windows) {
    await prisma.importBatch.create({
      data: {
        kind: "billbee",
        window: w.window,
        windowFrom: new Date(w.windowFrom),
        windowTo: new Date(w.windowTo),
        fileName: w.fileName,
        rowCount: w.rowCount,
        matchedCount: plan.stats.matchedArticles,
        unmatchedCount: plan.stats.unmatchedBillbeeArticles,
      },
    });
  }
  if (ebayInfo) {
    await prisma.importBatch.create({
      data: {
        kind: "ebay",
        fileName: ebayInfo.fileName,
        rowCount: ebayInfo.rowCount,
        matchedCount: plan.stats.matchedArticles,
        unmatchedCount: plan.stats.unmatchedEbayListings,
      },
    });
  }
  if (billbeeArtikelInfo) {
    await prisma.importBatch.create({
      data: {
        kind: "billbee_artikel",
        fileName: billbeeArtikelInfo.fileName,
        rowCount: billbeeArtikelInfo.rowCount,
        matchedCount: billbeeArtikelInfo.activeCount,
        unmatchedCount: 0,
      },
    });
  }

  const reviewItemsOpen = await prisma.reviewItem.count({ where: { status: "open" } });
  const cardArticleCount = plan.articles.filter((a) => a.isCard).length;

  return {
    windows,
    ebay: ebayInfo,
    billbeeArtikel: billbeeArtikelInfo,
    articleCount: plan.articles.length,
    cardArticleCount,
    matchedArticles: plan.stats.matchedArticles,
    unmatchedBillbeeArticles: plan.stats.unmatchedBillbeeArticles,
    unmatchedEbayListings: plan.stats.unmatchedEbayListings,
    matchRate: plan.stats.exactMatchRate,
    windowsReplaced: persistResult.windowsReplaced,
    reviewItemsOpen,
  };
}
