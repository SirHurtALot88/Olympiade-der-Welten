import type { PrismaClient } from "@prisma/client";
import { loadAliasMap } from "../pipeline/aliases";
import { buildImportPlan } from "../pipeline/importPlan";
import { persistBillbeeArtikel, persistImportPlan } from "../pipeline/persist";
import { loadActiveCostSettings } from "../dashboard/queries";
import { BillbeeClient, type BillbeeConfig } from "./client";
import { loadBillbeeConfig } from "./credentials";
import { rarityFromTitle } from "../market/rarity";
import { isPokemonArticleName } from "../parsing/cardFilter";
import { LOOKBACK_DAYS, makeCanonicalizer, matchSaleBySetCode, summarizeRecentOrders, type OrderCheck, dedupeOrders, diagnoseOrders, recentOrderDays, extractSales, mapOrders, mapProduct, type MasterProduct, type OrderDiagnostics } from "./map";

/**
 * Zieht Artikelstamm (Bestand, VK, EK) und Bestellungen der gesamten Historie aus der Billbee-API
 * und schreibt sie ueber dieselbe Pipeline wie der Datei-Import. Der Datei-Import bleibt als Rueckfall.
 *
 * Ersetzt werden alle Fenster 30/90/365/Gesamt -- alles kommt aus denselben Bestellungen.
 */

export interface BillbeeSyncOptions {
  config?: BillbeeConfig | null;
  fetchFn?: typeof fetch;
  now?: Date;
  minGapMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Bestellstatus-IDs, die nicht zaehlen. Standard: Umgebungsvariable BILLBEE_EXCLUDE_STATES, sonst 8 (storniert). */
  excludeStates?: number[];
  /** Fortschritt fuer die Anzeige (Seitenleiste): Prozent 0..100 und was gerade passiert. */
  onProgress?: (percent: number, label: string) => void;
}

export interface BillbeeSyncReport {
  products: number;
  /** Artikel, die der Stamm als deaktiviert fuehrt oder die gar nicht mehr darin stehen -> "ausgelaufen". */
  deactivated: number;
  orders: number;
  /** Einzelverkaeufe (Bestellpositionen), die gespeichert wurden. */
  sales: number;
  /** Artikel, bei denen Billbee eine eBay-Artikelnummer geliefert hat. */
  ebayItemIds: number;
  /** Stammartikel, die nach der Namens-Normalisierung denselben Artikel ergeben (z. B. Einzelkarte und Playset). */
  duplicateMasters: number;
  /** Artikel, bei denen Billbee einen Mindest-/Meldebestand liefert (0 = Feld nicht gepflegt oder nicht geliefert). */
  minStockCount: number;
  windows: { window: string; articles: number; units: number }[];
  /** Auffaelligkeiten in den gelieferten Bestellungen (Doppelte, gebrochene Mengen, Spitzenreiter). */
  diagnostics: OrderDiagnostics;
  /** Bestellungen der letzten Tage je Datum/Status und juengster Bestellzeitpunkt (Pruefung auf fehlende Bestellungen von heute). */
  recent: ReturnType<typeof recentOrderDays>;
  /** Bestellungen der letzten 60 Tage in Kurzform: fuer die Suche "Bestellung pruefen" (wurde sie geliefert, zaehlt sie, fehlt ein Artikel?). */
  recentOrders: OrderCheck[];
  /** Verkaeufe, deren Name keinem Artikel entsprach und die ueber den Set-Code im Namen zugeordnet wurden. */
  salesMatchedBySetCode: number;
  /** Pokemon-Artikel, die bei diesem Abgleich neu ausgeblendet wurden. */
  pokemonHidden: number;
  startedAt: string;
  finishedAt: string;
}

export class BillbeeNotConfigured extends Error {
  constructor() {
    super("Billbee ist noch nicht verbunden: Zugangsdaten in den Einstellungen eintragen.");
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
  const config = opts.config === undefined ? (await loadBillbeeConfig(prisma)).config : opts.config;
  if (!config) throw new BillbeeNotConfigured();
  const startedAt = new Date().toISOString();
  const now = opts.now ?? new Date();
  const client = new BillbeeClient(config, { fetchFn: opts.fetchFn, minGapMs: opts.minGapMs, sleep: opts.sleep });

  const progress = (pct: number, label: string) => opts.onProgress?.(Math.max(0, Math.min(100, Math.round(pct))), label);
  progress(1, "Verbinde mit Billbee …");

  // 1. Artikelstamm (0 bis 20 %)
  const rawProducts = await client.getAll<Record<string, unknown>>("/products", {}, 250, 400, (p, t) => progress(1 + (19 * p) / Math.max(1, t), `Artikelstamm laden (Seite ${p} von ${t})`));
  const masters = rawProducts.map(mapProduct).filter((m): m is MasterProduct => m !== null);

  // 2. Bestellungen (gesamte Historie)
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
  progress(20, "Bestellungen laden …");
  const fetched = await client.getAll<Record<string, unknown>>("/orders", {
    minOrderDate: since.toISOString().slice(0, 10),
    // Billbee liest ein reines Datum als 00:00 Uhr: mit "heute" fehlten alle Bestellungen des heutigen Tages bis zum naechsten Tag
    // (sichtbar als Bestandsabgang ohne Verkauf). Darum bis einschliesslich morgen.
    maxOrderDate: new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10),
  }, 250, 400, (p, t) => progress(20 + (50 * p) / Math.max(1, t), `Bestellungen laden (Seite ${p} von ${t})`));
  progress(72, "Bestellungen auswerten …");
  const { orders, duplicates } = dedupeOrders(fetched);
  const canonical = makeCanonicalizer(masters, rarityFromTitle);
  const results = mapOrders(orders, masters, { now, excludeStates: opts.excludeStates ?? excludeStatesFromEnv(), canonical });

  // 3. Plan + Schreiben ueber die bestehende Pipeline
  const costSettings = await loadActiveCostSettings(prisma);
  const aliases = await loadAliasMap(prisma);
  const plan = buildImportPlan(results, null, costSettings, { aliases, knownFeePerUnit: await knownFeePerUnit(prisma) });
  progress(78, "Verkaufszahlen speichern …");
  await persistImportPlan(prisma, plan);
  progress(86, "Artikel und Bestand speichern …");
  await persistBillbeeArtikel(
    prisma,
    masters.map((m) => m.row)
  );

  // eBay-Artikelnummern aus Billbee. Eine vom Shop-Abruf bestaetigte Nummer (ebayPrice gesetzt) bleibt: der Shop zeigt, was gerade gelistet ist.
  let ebayIds = 0;
  let minStockCount = 0;
  const seenMasters = new Set<string>();
  let duplicateMasters = 0;
  for (const m of masters) {
    if (seenMasters.has(m.row.nameNormalized)) {
      duplicateMasters++;
      continue;
    }
    seenMasters.add(m.row.nameNormalized);
    // Mindest-/Soll-Bestand aus Billbee (auch zuruecksetzen, wenn dort nicht mehr gepflegt)
    await prisma.article.updateMany({ where: { nameNormalized: m.row.nameNormalized }, data: { minStock: m.minStock, desiredStock: m.desiredStock } });
    if (m.minStock !== null) minStockCount++;
    if (!m.ebayItemId) continue;
    const res = await prisma.article.updateMany({ where: { nameNormalized: m.row.nameNormalized, ebayPrice: null }, data: { ebayItemId: m.ebayItemId } });
    ebayIds += res.count;
  }

  progress(93, "Einzelverkäufe speichern …");
  // Einzelverkaeufe (Datum, Menge, Preis): ersetzt bei jedem Abruf alle.
  const excludeStates = opts.excludeStates ?? excludeStatesFromEnv();
  const articleRows = await prisma.article.findMany({ select: { id: true, nameNormalized: true, nameRaw: true, setCode: true, active: true } });
  const idByName = new Map(articleRows.map((a) => [a.nameNormalized, a.id]));
  const activeById = new Map(articleRows.map((a) => [a.id, a.active]));
  const activeRows = articleRows.filter((a) => a.active);
  let matchedBySetCode = 0;
  const saleRows = extractSales(orders, { excludeStates, canonical }).flatMap((r) => {
    let articleId = idByName.get(r.nameNormalized);
    // Der Name der Bestellposition ergibt einen eigenen (ausgelaufenen) Artikel, obwohl es zur selben Karte einen aktiven Artikel gibt
    // (Titel nachtraeglich geaendert, anderer Zustand im Namen): der Verkauf gehoert zum aktiven Artikel. Eindeutigkeit ueber Set-Code
    // und Seltenheit, sonst bleibt es beim Namen. Hat gar kein Artikel den Namen, gilt derselbe Weg.
    if (!articleId || activeById.get(articleId) === false) {
      const viaCode = matchSaleBySetCode(r.nameRaw, activeRows, rarityFromTitle);
      if (viaCode && viaCode !== articleId) {
        articleId = viaCode;
        matchedBySetCode++;
      }
    }
    return articleId ? [{ articleId, soldAt: r.soldAt, qty: r.qty, unitPrice: r.unitPrice, orderRef: r.orderRef, source: "billbee-api" }] : [];
  });
  await prisma.sale.deleteMany({ where: { source: "billbee-api" } });
  for (let i = 0; i < saleRows.length; i += 500) await prisma.sale.createMany({ data: saleRows.slice(i, i + 500) });

  // Pokemon-Karten gehoeren nicht ins Sortiment (Chris, 13.11.): ausblenden, die Verkaeufe bleiben in den Shop-Summen erhalten.
  const pokemon = articleRows.filter((a) => isPokemonArticleName(a.nameRaw)).map((a) => a.id);
  let pokemonHidden = 0;
  if (pokemon.length > 0) {
    const res = await prisma.article.updateMany({ where: { id: { in: pokemon }, hidden: false }, data: { hidden: true } });
    pokemonHidden = res.count;
  }

  progress(98, "Abschließen …");
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
    sales: saleRows.length,
    ebayItemIds: ebayIds,
    duplicateMasters,
    minStockCount,
    diagnostics: diagnoseOrders(orders, duplicates, { excludeStates }),
    recent: recentOrderDays(orders, now),
    salesMatchedBySetCode: matchedBySetCode,
    pokemonHidden,
    recentOrders: summarizeRecentOrders(orders, now, (n) => idByName.has(n), { excludeStates }),
    windows: results.map((r) => ({ window: r.window, articles: r.rows.length, units: r.rows.reduce((s, x) => s + x.qty, 0) })),
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

/**
 * ECHTE eBay-Gebuehr je Stueck aus den eBay-Verkaufsberichten (EbayListingFact). Bewusst NICHT aus den
 * gespeicherten Fenstern: dort stehen inzwischen auch geschaetzte Gebuehren, die sich sonst beim naechsten
 * Lauf als "echt" festschreiben wuerden.
 */
async function knownFeePerUnit(prisma: PrismaClient): Promise<Map<string, number>> {
  const rows = await prisma.ebayListingFact.findMany({
    where: { articleId: { not: null }, qtySold: { gt: 0 }, totalSellingCosts: { gt: 0 } },
    select: { qtySold: true, totalSellingCosts: true, article: { select: { nameNormalized: true } } },
  });
  const sums = new Map<string, { fee: number; qty: number }>();
  for (const r of rows) {
    if (!r.article) continue;
    const s = sums.get(r.article.nameNormalized) ?? { fee: 0, qty: 0 };
    s.fee += r.totalSellingCosts;
    s.qty += r.qtySold;
    sums.set(r.article.nameNormalized, s);
  }
  return new Map([...sums].map(([k, v]) => [k, v.fee / v.qty]));
}
