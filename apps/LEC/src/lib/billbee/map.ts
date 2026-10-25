import type { BillbeeArtikelRow } from "../importers/billbeeArtikel";
import type { BillbeeImportResult, BillbeeRow } from "../importers/billbee";
import type { SaleWindowKey } from "../parsing/date";
import { normalizeArticleName } from "../parsing/name";
import { extractSetCode } from "../parsing/setCode";
import { isCardArticleName } from "../parsing/cardFilter";

/**
 * Billbee-API-Antworten -> dieselben Zeilen, die der Datei-Import liefert
 * (BillbeeArtikelRow / BillbeeImportResult). Danach laeuft alles ueber die bestehende
 * Import-Pipeline, es gibt keine zweite Rechenlogik.
 *
 * Die Feldnamen folgen der oeffentlichen Billbee-API (Products: Title, SKU, Price, CostPrice,
 * StockCurrent; Orders: CreatedAt, OrderItems[Quantity, TotalPrice, Product]). Sie sind hier
 * bewusst tolerant gelesen (Titel als Text oder als Sprachliste, Zahlen als Zahl oder Text),
 * weil sie ohne Konto-Zugriff nicht live geprueft werden konnten: `scripts/billbee-probe.ts`
 * zeigt die echte Struktur.
 */

type Json = Record<string, unknown>;

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Titel: "Text", [{LanguageCode, Text}] oder {Text}; Deutsch bevorzugt. */
export function titleOf(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) {
    const list = v.filter((x): x is Json => !!x && typeof x === "object");
    const de = list.find((x) => String(x.LanguageCode ?? "").toUpperCase() === "DE") ?? list[0];
    return de ? String(de.Text ?? "").trim() : "";
  }
  if (v && typeof v === "object") return String((v as Json).Text ?? "").trim();
  return "";
}

export interface MasterProduct {
  row: BillbeeArtikelRow;
  sku: string | null;
  id: string | null;
  /** Netto-Einkaufspreis je Stueck laut Artikelstamm. */
  cost: number | null;
}

/** Ein Artikel aus /products; null bei Titelloser oder deaktivierter Zeile. */
export function mapProduct(p: Json): MasterProduct | null {
  const nameRaw = titleOf(p.Title ?? p.Name);
  if (!nameRaw) return null;
  if (p.IsDeactivated === true) return null;
  const { normalized, packQty } = normalizeArticleName(nameRaw);
  const price = num(p.Price ?? p.PriceGross);
  const cost = num(p.CostPrice ?? p.CostPriceNet);
  const stock = num(p.StockCurrent ?? p.Stock) ?? 0;
  return {
    row: {
      nameRaw,
      nameNormalized: normalized,
      packQty,
      setCode: extractSetCode(nameRaw),
      isCard: isCardArticleName(nameRaw),
      stock: Math.round(stock),
      currentVk: price,
      currentEk: cost,
      statusRaw: null,
    },
    sku: p.SKU ? String(p.SKU) : null,
    id: p.Id !== undefined && p.Id !== null ? String(p.Id) : null,
    cost,
  };
}

const WINDOW_DAYS: { key: SaleWindowKey; days: number }[] = [
  { key: "30", days: 30 },
  { key: "90", days: 90 },
  { key: "365", days: 365 },
];

export const LOOKBACK_DAYS = 365;

/** Billbee-Bestellnummer/-Id; Grundlage, um doppelt gelieferte Bestellungen zu erkennen. */
function orderKey(o: Json): string | null {
  const k = o.BillBeeOrderId ?? o.Id ?? o.OrderNumber;
  return k !== undefined && k !== null ? String(k) : null;
}

/**
 * Billbee blaettert nach Datum; kommt zwischen zwei Seiten eine Bestellung dazu, rutscht eine
 * Bestellung auf die naechste Seite und wird doppelt geliefert. Jede Bestellung zaehlt nur einmal.
 */
export function dedupeOrders(orders: Json[]): { orders: Json[]; duplicates: number } {
  const seen = new Set<string>();
  const out: Json[] = [];
  for (const o of orders) {
    const k = orderKey(o);
    if (k !== null) {
      if (seen.has(k)) continue;
      seen.add(k);
    }
    out.push(o);
  }
  return { orders: out, duplicates: orders.length - out.length };
}

/** Versandkosten- und Gutschein-Positionen sind keine verkauften Artikel. */
function isSaleItem(item: Json, product: Json): boolean {
  if (item.IsCoupon === true) return false;
  const type = num(product.Type);
  return type === null || type !== 3;
}

export interface OrderDiagnostics {
  duplicates: number;
  /** Positionen mit gebrochener Menge (z. B. 2,5) -- sollte es bei Karten nicht geben. */
  fractionalItems: number;
  fractionalSamples: { name: string; qty: number; order: string | null }[];
  /** Artikel mit den meisten Stueck in 365 Tagen, mit Bestellungen und groesster Menge je Position. */
  top: { name: string; units: number; orders: number; maxLine: number }[];
}

export function diagnoseOrders(orders: Json[], duplicates: number, opts: { excludeStates?: number[] } = {}): OrderDiagnostics {
  const exclude = new Set(opts.excludeStates ?? []);
  const byName = new Map<string, { name: string; units: number; orders: Set<string>; maxLine: number }>();
  const samples: OrderDiagnostics["fractionalSamples"] = [];
  let fractionalItems = 0;
  orders.forEach((order, idx) => {
    const state = num(order.State ?? order.OrderStateId);
    if (state !== null && exclude.has(state)) return;
    const ref = String(order.OrderNumber ?? order.BillBeeOrderId ?? idx);
    for (const item of Array.isArray(order.OrderItems) ? (order.OrderItems as Json[]) : []) {
      const product = (item.Product && typeof item.Product === "object" ? item.Product : {}) as Json;
      if (!isSaleItem(item, product)) continue;
      const name = titleOf(product.Title) || titleOf(item.Title ?? item.Name);
      const qty = num(item.Quantity) ?? 0;
      if (!name || qty <= 0) continue;
      if (!Number.isInteger(qty)) {
        fractionalItems++;
        if (samples.length < 5) samples.push({ name: name.slice(0, 60), qty, order: ref });
      }
      const key = normalizeArticleName(name).normalized;
      const e = byName.get(key) ?? { name: name.slice(0, 60), units: 0, orders: new Set<string>(), maxLine: 0 };
      e.units += qty;
      e.orders.add(ref);
      e.maxLine = Math.max(e.maxLine, qty);
      byName.set(key, e);
    }
  });
  const top = [...byName.values()]
    .sort((a, b) => b.units - a.units)
    .slice(0, 8)
    .map((e) => ({ name: e.name, units: e.units, orders: e.orders.size, maxLine: e.maxLine }));
  return { duplicates, fractionalItems, fractionalSamples: samples, top };
}

export interface OrderMapOptions {
  now: Date;
  /** Bestellstatus-IDs, die nicht zaehlen (storniert u. a.). */
  excludeStates?: number[];
}

/** Bestellungen -> je Fenster (30/90/365) die Verkaeufe je Artikel. */
export function mapOrders(orders: Json[], masters: MasterProduct[], opts: OrderMapOptions): BillbeeImportResult[] {
  const exclude = new Set(opts.excludeStates ?? []);
  const to = new Date(Date.UTC(opts.now.getUTCFullYear(), opts.now.getUTCMonth(), opts.now.getUTCDate()));

  const costBySku = new Map<string, number>();
  const costById = new Map<string, number>();
  const costByName = new Map<string, number>();
  for (const m of masters) {
    if (m.cost === null) continue;
    if (m.sku) costBySku.set(m.sku, m.cost);
    if (m.id) costById.set(m.id, m.cost);
    costByName.set(m.row.nameNormalized, m.cost);
  }

  const windows = WINDOW_DAYS.map(({ key, days }) => ({
    key,
    from: new Date(to.getTime() - days * 86_400_000),
    byName: new Map<string, BillbeeRow>(),
  }));

  for (const order of orders) {
    const state = num(order.State ?? order.OrderStateId);
    if (state !== null && exclude.has(state)) continue;
    const created = new Date(String(order.CreatedAt ?? order.OrderDate ?? ""));
    if (Number.isNaN(created.getTime())) continue;
    const items = Array.isArray(order.OrderItems) ? (order.OrderItems as Json[]) : [];

    for (const item of items) {
      const product = (item.Product && typeof item.Product === "object" ? item.Product : {}) as Json;
      if (!isSaleItem(item, product)) continue;
      const nameRaw = titleOf(product.Title) || titleOf(item.Title ?? item.Name);
      if (!nameRaw) continue;
      const qty = num(item.Quantity) ?? 0;
      if (qty <= 0) continue;
      const lineTotal = num(item.TotalPrice) ?? (num(item.UnitPrice) ?? 0) * qty;
      const { normalized, packQty } = normalizeArticleName(nameRaw);
      const unitCost =
        num(product.CostPrice) ??
        (product.SKU ? costBySku.get(String(product.SKU)) : undefined) ??
        (product.Id !== undefined && product.Id !== null ? costById.get(String(product.Id)) : undefined) ??
        costByName.get(normalized) ??
        0;

      for (const w of windows) {
        if (created < w.from) continue;
        const row =
          w.byName.get(normalized) ??
          ((): BillbeeRow => {
            const fresh: BillbeeRow = {
              sku: product.SKU ? String(product.SKU) : null,
              nameRaw,
              nameNormalized: normalized,
              packQty,
              setCode: extractSetCode(nameRaw),
              isCard: isCardArticleName(nameRaw),
              qty: 0,
              revenue: 0,
              ek: 0,
              marge: 0,
            };
            w.byName.set(normalized, fresh);
            return fresh;
          })();
        row.qty += qty;
        row.revenue += lineTotal;
        row.ek += unitCost * qty;
        row.marge = row.revenue - row.ek;
      }
    }
  }

  return windows.map((w) => ({ window: w.key, windowFrom: w.from, windowTo: to, rows: [...w.byName.values()] }));
}

export interface SaleRow {
  nameNormalized: string;
  soldAt: Date;
  qty: number;
  /** Preis je Stueck, brutto (Positionssumme / Menge). */
  unitPrice: number;
  orderRef: string | null;
}

/** Einzelverkaeufe (eine Zeile je Bestellposition) der Bestellungen; Stornos ausgenommen. */
export function extractSales(orders: Json[], opts: { excludeStates?: number[] } = {}): SaleRow[] {
  const exclude = new Set(opts.excludeStates ?? []);
  const out: SaleRow[] = [];
  for (const order of orders) {
    const state = num(order.State ?? order.OrderStateId);
    if (state !== null && exclude.has(state)) continue;
    const soldAt = new Date(String(order.CreatedAt ?? order.OrderDate ?? ""));
    if (Number.isNaN(soldAt.getTime())) continue;
    const ref = order.OrderNumber ?? order.BillBeeOrderId;
    const items = Array.isArray(order.OrderItems) ? (order.OrderItems as Json[]) : [];
    for (const item of items) {
      const product = (item.Product && typeof item.Product === "object" ? item.Product : {}) as Json;
      if (!isSaleItem(item, product)) continue;
      const nameRaw = titleOf(product.Title) || titleOf(item.Title ?? item.Name);
      const qty = num(item.Quantity) ?? 0;
      if (!nameRaw || qty <= 0) continue;
      const lineTotal = num(item.TotalPrice) ?? (num(item.UnitPrice) ?? 0) * qty;
      out.push({
        nameNormalized: normalizeArticleName(nameRaw).normalized,
        soldAt,
        qty,
        unitPrice: lineTotal / qty,
        orderRef: ref !== undefined && ref !== null ? String(ref) : null,
      });
    }
  }
  return out;
}
