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
  /** eBay-Artikelnummer (Billbee: Product.Sources[].SourceId der eBay-Anbindung), falls hinterlegt. */
  ebayItemId: string | null;
  /** Mindest-/Meldebestand und Soll-Bestand laut Artikelstamm; null, wenn nicht gepflegt (0 gilt als nicht gepflegt). */
  minStock: number | null;
  desiredStock: number | null;
}

/** Mindest- und Soll-Bestand aus dem Artikelstamm (Feldnamen tolerant gelesen: StockWarning / StockMinimum, StockDesired). */
export function stockLimitsOf(p: Json): { minStock: number | null; desiredStock: number | null } {
  const pos = (v: unknown) => {
    const n = num(v);
    return n !== null && n > 0 ? Math.round(n) : null;
  };
  return { minStock: pos(p.StockWarning ?? p.StockMinimum ?? p.MinStock), desiredStock: pos(p.StockDesired) };
}

/** eBay-Artikelnummer aus den Marktplatz-Quellen eines Billbee-Artikels (tolerant gelesen). */
export function ebayItemIdOf(p: Json): string | null {
  const sources = Array.isArray(p.Sources) ? (p.Sources as Json[]) : [];
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    const label = `${src.Source ?? ""} ${src.ApiAccountName ?? ""}`;
    const id = String(src.SourceId ?? src.ExternalId ?? "").trim();
    if (/ebay/i.test(label) && /^\d{9,14}$/.test(id)) return id;
  }
  return null;
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
    ebayItemId: ebayItemIdOf(p),
    ...stockLimitsOf(p),
  };
}

/** So weit zurueck werden Bestellungen geholt (Basis fuer das Fenster "Gesamt"). */
export const LOOKBACK_DAYS = 3650;

const WINDOW_DAYS: { key: SaleWindowKey; days: number }[] = [
  { key: "30", days: 30 },
  { key: "90", days: 90 },
  { key: "365", days: 365 },
  // "Gesamt": ebenfalls aus den Bestellungen, damit es keine zweite Quelle mit abweichenden Zahlen gibt.
  { key: "all", days: LOOKBACK_DAYS },
];

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

/** Bestellungen der letzten Tage je Datum und Status plus der juengste Bestellzeitpunkt: zeigt, ob Billbee ueberhaupt Bestellungen von heute liefert. */
export function recentOrderDays(orders: Json[], now: Date, days = 4): { newestOrderAt: string | null; days: { day: string; orders: number; states: Record<string, number> }[] } {
  const byDay = new Map<string, { orders: number; states: Record<string, number> }>();
  let newest = -Infinity;
  for (const o of orders) {
    const t = Date.parse(String(o.CreatedAt ?? o.OrderDate ?? ""));
    if (Number.isNaN(t)) continue;
    if (t > newest) newest = t;
    const day = new Date(t).toISOString().slice(0, 10);
    const cur = byDay.get(day) ?? { orders: 0, states: {} };
    cur.orders++;
    const st = String(num(o.State ?? o.OrderStateId) ?? "?");
    cur.states[st] = (cur.states[st] ?? 0) + 1;
    byDay.set(day, cur);
  }
  const from = new Date(now.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  return {
    newestOrderAt: Number.isFinite(newest) ? new Date(newest).toISOString() : null,
    days: [...byDay].filter(([d]) => d >= from).sort(([a], [b]) => (a < b ? 1 : -1)).map(([day, v]) => ({ day, ...v })),
  };
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
  /** Ordnet Positionen mit abweichendem Namen dem Stammartikel zu (siehe makeCanonicalizer). */
  canonical?: (nameRaw: string, normalized: string) => MasterProduct | null;
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
      let { normalized, packQty } = normalizeArticleName(nameRaw);
      let displayName = nameRaw;
      const master = opts.canonical?.(nameRaw, normalized) ?? null;
      if (master) {
        normalized = master.row.nameNormalized;
        packQty = master.row.packQty;
        displayName = master.row.nameRaw;
      }
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
              nameRaw: displayName,
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
  /** Name der Bestellposition, wie Billbee ihn liefert (fuer die Zuordnung ueber den Set-Code). */
  nameRaw: string;
  soldAt: Date;
  qty: number;
  /** Preis je Stueck, brutto (Positionssumme / Menge). */
  unitPrice: number;
  orderRef: string | null;
}

/** Einzelverkaeufe (eine Zeile je Bestellposition) der Bestellungen; Stornos ausgenommen. */
export function extractSales(orders: Json[], opts: { excludeStates?: number[]; canonical?: (nameRaw: string, normalized: string) => MasterProduct | null } = {}): SaleRow[] {
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
      const normalizedName = normalizeArticleName(nameRaw).normalized;
      const master = opts.canonical?.(nameRaw, normalizedName) ?? null;
      out.push({
        nameNormalized: master ? master.row.nameNormalized : normalizedName,
        nameRaw: master ? master.row.nameRaw : nameRaw,
        soldAt,
        qty,
        unitPrice: lineTotal / qty,
        orderRef: ref !== undefined && ref !== null ? String(ref) : null,
      });
    }
  }
  return out;
}

export interface OrderCheckLine {
  name: string;
  qty: number;
  unitPrice: number;
  /** Gibt es einen Artikel mit diesem Namen? Ohne Artikel wird die Position nicht als Verkauf gespeichert. */
  article: boolean;
}

export interface OrderCheck {
  nr: string;
  id: string | null;
  at: string;
  state: number | null;
  /** Der Bestellstatus zaehlt nicht (zum Beispiel storniert). */
  excluded: boolean;
  lines: OrderCheckLine[];
}

/** Bestellungen der letzten Tage in Kurzform fuer die Suche "Bestellung pruefen" (Einstellungen): neueste zuerst, hoechstens `cap`. */
export function summarizeRecentOrders(
  orders: Json[],
  now: Date,
  hasArticle: (nameNormalized: string) => boolean,
  opts: { excludeStates?: number[]; days?: number; cap?: number } = {}
): OrderCheck[] {
  const exclude = new Set(opts.excludeStates ?? []);
  const from = now.getTime() - (opts.days ?? 60) * 86_400_000;
  const out: OrderCheck[] = [];
  for (const order of orders) {
    const at = new Date(String(order.CreatedAt ?? order.OrderDate ?? ""));
    if (Number.isNaN(at.getTime()) || at.getTime() < from) continue;
    const state = num(order.State ?? order.OrderStateId);
    const items = Array.isArray(order.OrderItems) ? (order.OrderItems as Json[]) : [];
    const lines: OrderCheckLine[] = [];
    for (const item of items) {
      const product = (item.Product && typeof item.Product === "object" ? item.Product : {}) as Json;
      if (!isSaleItem(item, product)) continue;
      const name = titleOf(product.Title) || titleOf(item.Title ?? item.Name);
      const qty = num(item.Quantity) ?? 0;
      if (!name) continue;
      const total = num(item.TotalPrice) ?? (num(item.UnitPrice) ?? 0) * qty;
      lines.push({ name, qty, unitPrice: qty > 0 ? total / qty : 0, article: hasArticle(normalizeArticleName(name).normalized) });
    }
    const nr = order.OrderNumber ?? order.BillBeeOrderId ?? order.Id;
    out.push({
      nr: nr !== undefined && nr !== null ? String(nr) : "",
      id: order.BillBeeOrderId !== undefined && order.BillBeeOrderId !== null ? String(order.BillBeeOrderId) : order.Id !== undefined && order.Id !== null ? String(order.Id) : null,
      at: at.toISOString(),
      state,
      excluded: state !== null && exclude.has(state),
      lines,
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, opts.cap ?? 800);
}

const SET_CODE_RE = /\b([A-Z0-9]{2,5}-(?:DE|EN)[A-Z]?\d{2,3})\b/i;

/**
 * Rueckfall, wenn der Name einer Bestellposition zu keinem Artikel passt (Titel in Billbee nachtraeglich geaendert, anderer Zustand,
 * andere Schreibweise): der Set-Code im Namen (DUPO-DE002) ordnet den Verkauf zu, wenn genau ein Artikel diesen Code hat oder die
 * Seltenheit im Namen genau einen von mehreren trifft. Sonst null (lieber keinen Verkauf zuordnen als einen falschen).
 */
export function matchSaleBySetCode(
  nameRaw: string,
  articles: { id: string; setCode: string | null; nameRaw: string }[],
  rarityOf: (name: string) => string | null
): string | null {
  const m = nameRaw.match(SET_CODE_RE);
  if (!m) return null;
  const code = m[1].toUpperCase();
  const same = articles.filter((a) => a.setCode && a.setCode.toUpperCase() === code);
  if (same.length === 1) return same[0].id;
  if (same.length === 0) return null;
  const rarity = rarityOf(nameRaw);
  if (!rarity) return null;
  const byRarity = same.filter((a) => rarityOf(a.nameRaw) === rarity);
  return byRarity.length === 1 ? byRarity[0].id : null;
}

/**
 * Bestellpositionen, deren Name zu keinem Artikel des Stamms passt (Titel nachtraeglich geaendert, anderer Zustand im Namen), werden dem
 * Stammartikel zugeordnet, der denselben Set-Code (und bei mehreren dieselbe Seltenheit) traegt: sonst entsteht ein ausgelaufener
 * Zwilling und der Verkauf fehlt beim echten Artikel (Chris, 13.11.: Dunkle Kavallerie). Eindeutigkeit ist Pflicht, sonst bleibt der Name.
 */
export function makeCanonicalizer(masters: MasterProduct[], rarityOf: (name: string) => string | null): (nameRaw: string, normalized: string) => MasterProduct | null {
  const byNormalized = new Map(masters.map((m) => [m.row.nameNormalized, m]));
  const cands = masters.map((m) => ({ id: m.row.nameNormalized, setCode: m.row.setCode, nameRaw: m.row.nameRaw }));
  return (nameRaw, normalized) => {
    if (byNormalized.has(normalized)) return null;
    const id = matchSaleBySetCode(nameRaw, cands, rarityOf);
    return id ? (byNormalized.get(id) ?? null) : null;
  };
}
