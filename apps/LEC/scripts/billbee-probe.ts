/**
 * Billbee-API-Probe: zeigt die ECHTE Struktur eines Artikels und einer Bestellung, ohne Namen,
 * Adressen oder Zugangsdaten auszugeben (nur Feldnamen, Typen und Zahlen).
 *
 *   BILLBEE_API_KEY=... BILLBEE_USER=... BILLBEE_PASSWORD=... npx tsx scripts/billbee-probe.ts
 */
import { BillbeeClient, billbeeConfigFromEnv, type BillbeePage } from "../src/lib/billbee/client";

const config = billbeeConfigFromEnv();
if (!config) {
  console.error("BILLBEE_API_KEY, BILLBEE_USER und BILLBEE_PASSWORD muessen gesetzt sein.");
  process.exit(1);
}

function shape(v: unknown, depth = 0): unknown {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.length ? [shape(v[0], depth + 1), `(${v.length} Eintraege)`] : [];
  if (typeof v === "object") {
    if (depth > 3) return "{...}";
    return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, shape(x, depth + 1)]));
  }
  if (typeof v === "number" || typeof v === "boolean") return v;
  return `string(${String(v).length})`;
}

const client = new BillbeeClient(config);
const products = await client.get<BillbeePage<unknown>>("/products", { page: 1, pageSize: 2 });
console.log("Artikel gesamt:", products.Paging?.TotalRows, "Seiten:", products.Paging?.TotalPages);
console.log("Artikel-Struktur:", JSON.stringify(shape(products.Data?.[0]), null, 2));
const orders = await client.get<BillbeePage<unknown>>("/orders", { page: 1, pageSize: 2, minOrderDate: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10) });
console.log("Bestellungen (30 Tage) gesamt:", orders.Paging?.TotalRows);
console.log("Bestellungs-Struktur:", JSON.stringify(shape(orders.Data?.[0]), null, 2));
