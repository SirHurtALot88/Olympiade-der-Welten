import type { PrismaClient } from "@prisma/client";
import { loadAliasMap } from "../pipeline/aliases";
import { buildImportPlan } from "../pipeline/importPlan";
import { persistBillbeeArtikel, persistImportPlan } from "../pipeline/persist";
import { loadActiveCostSettings } from "../dashboard/queries";
import { BillbeeClient, billbeeConfigFromEnv, type BillbeeConfig } from "./client";
import { LOOKBACK_DAYS, mapOrders, mapProduct, type MasterProduct } from "./map";

/**
 * Zieht Artikelstamm (Bestand, VK, EK) und Bestellungen der letzten 365 Tage aus der Billbee-API
 * und schreibt sie ueber dieselbe Pipeline wie der Datei-Import. Der Datei-Import bleibt als Rueckfall.
 *
 * Ersetzt werden die Fenster 30/90/365; ein per Datei importiertes "all"-Fenster bleibt unberuehrt.
 */

export interface BillbeeSyncOptions {
  config?: BillbeeConfig | null;
  fetchFn?: typeof fetch;
  now?: Date;
  minGapMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Bestellstatus-IDs, die nicht zaehlen. Standard: Umgebungsvariable BILLBEE_EXCLUDE_STATES, sonst 8 (storniert). */
  excludeStates?: number[];
}

export interface BillbeeSyncReport {
  products: number;
  /** Artikel, die der Stamm als deaktiviert fuehrt oder die gar nicht mehr darin stehen -> "ausgelaufen". */
  deactivated: number;
  orders: number;
  windows: { window: string; articles: number; units: number }[];
  startedAt: string;
  finishedAt: string;
}

export class BillbeeNotConfigured extends Error {
  constructor() {
    super("Billbee-API nicht eingerichtet (BILLBEE_API_KEY, BILLBEE_USER, BILLBEE_PASSWORD fehlen).");
  }
}

function excludeStatesFromEnv(): number[] {
  const raw = process.env.BILLBEE_EXCLUDE_STATES;
  if (raw === undefined) return [8];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

export async function syncBillbee(prisma: PrismaClient, opts: BillbeeSyncOptions = {}): Promise<BillbeeSyncReport> {
  const config = opts.config === undefined ? billbeeConfigFromEnv() : opts.config;
  if (!config) throw new BillbeeNotConfigured();
  const startedAt = new Date().toISOString();
  const now = opts.now ?? new Date();
  const client = new BillbeeClient(config, { fetchFn: opts.fetchFn, minGapMs: opts.minGapMs, sleep: opts.sleep });

  // 1. Artikelstamm
  const rawProducts = await client.getAll<Record<string, unknown>>("/products");
  const masters = rawProducts.map(mapProduct).filter((m): m is MasterProduct => m !== null);

  // 2. Bestellungen der letzten 365 Tage
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
  const orders = await client.getAll<Record<string, unknown>>("/orders", {
    minOrderDate: since.toISOString().slice(0, 10),
    maxOrderDate: now.toISOString().slice(0, 10),
  });
  const results = mapOrders(orders, masters, { now, excludeStates: opts.excludeStates ?? excludeStatesFromEnv() });

  // 3. Plan + Schreiben ueber die bestehende Pipeline
  const costSettings = await loadActiveCostSettings(prisma);
  const aliases = await loadAliasMap(prisma);
  const plan = buildImportPlan(results, null, costSettings, { aliases, knownFeePerUnit: await knownFeePerUnit(prisma) });
  await persistImportPlan(prisma, plan);
  await persistBillbeeArtikel(
    prisma,
    masters.map((m) => m.row)
  );

  // Alles, was der Stamm nicht (mehr) aktiv fuehrt, ist ausgelaufen.
  let deactivated = 0;
  if (masters.length > 0) {
    const res = await prisma.article.updateMany({
      where: { active: true, nameNormalized: { notIn: masters.map((m) => m.row.nameNormalized) } },
      data: { active: false },
    });
    deactivated = res.count;
  }

  for (const r of results) {
    await prisma.importBatch.create({
      data: { kind: "billbee", window: r.window, windowFrom: r.windowFrom, windowTo: r.windowTo, fileName: "Billbee-API", rowCount: r.rows.length, matchedCount: 0, unmatchedCount: 0 },
    });
  }
  await prisma.importBatch.create({
    data: { kind: "billbee_artikel", fileName: "Billbee-API", rowCount: masters.length, matchedCount: masters.length, unmatchedCount: 0 },
  });

  return {
    products: masters.length,
    deactivated,
    orders: orders.length,
    windows: results.map((r) => ({ window: r.window, articles: r.rows.length, units: r.rows.reduce((s, x) => s + x.qty, 0) })),
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

/** eBay-Gebuehr je Stueck aus den zuletzt gespeicherten Fenstern (Datei-Import mit eBay-Report). */
async function knownFeePerUnit(prisma: PrismaClient): Promise<Map<string, number>> {
  const rows = await prisma.saleWindow.findMany({
    where: { ebayFeeTotal: { gt: 0 }, qty: { gt: 0 } },
    select: { qty: true, ebayFeeTotal: true, article: { select: { nameNormalized: true } } },
  });
  const sums = new Map<string, { fee: number; qty: number }>();
  for (const r of rows) {
    const s = sums.get(r.article.nameNormalized) ?? { fee: 0, qty: 0 };
    s.fee += r.ebayFeeTotal;
    s.qty += r.qty;
    sums.set(r.article.nameNormalized, s);
  }
  return new Map([...sums].map(([k, v]) => [k, v.fee / v.qty]));
}
