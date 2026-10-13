import type { PrismaClient } from "@prisma/client";
import type { SaleWindowKey } from "../parsing/date";
import { listRecentImportBatches, loadArticleAggregates } from "../dashboard/queries";
import type { LatestQuote } from "../dashboard/marketComparison";
import type { PurchaseFacts } from "./guardrails";
import type { ArticleImageRef, ImageMap } from "./movers";
import { PLANWERTE } from "./planwerte";
import { buildCockpitViewModel, type CockpitViewModel, type ImportStatus } from "./viewModel";

/**
 * Kartenbilder (PR #1183: `Article.imageFile`/`imageGuid`, Route `/api/article-image/[id]`).
 * Die Felder fehlen in aelteren Schema-Staenden -- deshalb DEFENSIV: schlaegt die Abfrage fehl
 * (Prisma kennt die Spalten nicht), gibt es schlicht keine Bilder und die Listen zeigen den
 * Platzhalter. Kein Fehler auf der Seite.
 */
export async function loadArticleImages(prisma: PrismaClient): Promise<ImageMap> {
  const map = new Map<string, ArticleImageRef>();
  try {
    const rows = (await prisma.article.findMany({
      where: { isCard: true },
      // Bewusst untypisiert: in diesem Schema-Stand existieren die Felder evtl. noch nicht.
      select: { id: true, imageFile: true, imageGuid: true } as unknown as { id: true },
    })) as unknown as Array<{ id: string; imageFile?: string | null; imageGuid?: string | null }>;
    for (const r of rows) {
      if (r.imageFile) map.set(r.id, { imageFile: r.imageFile, imageGuid: r.imageGuid ?? null });
    }
  } catch {
    // Felder (noch) nicht im Schema -> keine Bilder.
  }
  return map;
}

/** Einkaufsfakten aus der Purchase-Tabelle (derzeit von keinem Importer befuellt -> null-Werte). */
export async function loadPurchaseFacts(prisma: PrismaClient, now = new Date()): Promise<PurchaseFacts> {
  const rows = await prisma.purchase.findMany({ select: { date: true, qty: true, unitEk: true, buyShipping: true } });
  if (rows.length === 0) return { spentInBudgetMonths: null, spentLast90d: null, recordCount: 0 };
  const since90 = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  let spentInBudgetMonths = 0;
  let spentLast90d = 0;
  for (const r of rows) {
    const amount = r.qty * r.unitEk + r.buyShipping;
    if (r.date.getUTCFullYear() === PLANWERTE.planjahr && PLANWERTE.warenbudgetMonate.includes(r.date.getUTCMonth() + 1)) {
      spentInBudgetMonths += amount;
    }
    if (r.date >= since90 && r.date <= now) spentLast90d += amount;
  }
  return { spentInBudgetMonths, spentLast90d, recordCount: rows.length };
}

const IMPORT_KIND_LABELS: Record<string, string> = {
  billbee: "Billbee-Verkäufe",
  ebay: "eBay-Report",
  billbee_artikel: "Billbee-Artikelstamm",
};

/** Juengster Import-Lauf je Art (Billbee-Fenster zusaetzlich je Fenster-Key). */
export async function loadImportStatus(prisma: PrismaClient): Promise<ImportStatus[]> {
  const batches = await listRecentImportBatches(prisma, 60);
  const seen = new Set<string>();
  const out: ImportStatus[] = [];
  for (const b of batches) {
    const key = b.kind === "billbee" && b.window ? `billbee:${b.window}` : b.kind;
    if (seen.has(key)) continue;
    seen.add(key);
    const base = IMPORT_KIND_LABELS[b.kind] ?? b.kind;
    out.push({
      kind: key,
      label: b.kind === "billbee" && b.window ? `${base} ${b.window === "all" ? "Lebenszeit" : `${b.window} T`}` : base,
      createdAt: b.createdAt,
      windowFrom: b.windowFrom,
      windowTo: b.windowTo,
      fileName: b.fileName,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "de"));
}

/** Juengster Cardmarket-Marktwert je Artikel (dieselbe Auswahl wie /marktpreise). */
export async function loadLatestQuotes(prisma: PrismaClient): Promise<Map<string, LatestQuote>> {
  const quotes = await prisma.marketPrice.findMany({ orderBy: { fetchedAt: "desc" } });
  const latest = new Map<string, LatestQuote>();
  for (const q of quotes) {
    if (!latest.has(q.articleId)) latest.set(q.articleId, q);
  }
  return latest;
}

export async function loadCockpitViewModel(prisma: PrismaClient, window: SaleWindowKey): Promise<CockpitViewModel> {
  const [{ aggregates, costSettings }, images, purchases, imports, quotes] = await Promise.all([
    loadArticleAggregates(prisma),
    loadArticleImages(prisma),
    loadPurchaseFacts(prisma),
    loadImportStatus(prisma),
    loadLatestQuotes(prisma),
  ]);
  return buildCockpitViewModel({ aggregates, costSettings, window, images, purchases, imports, quotes });
}
