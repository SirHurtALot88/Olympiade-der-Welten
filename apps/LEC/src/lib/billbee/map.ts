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
