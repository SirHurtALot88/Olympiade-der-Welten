/**
 * Baut src/lib/market/rarityMap.json: Set-Praefix -> Kartennummer -> Seltenheit -> Cardmarket-idProduct.
 *
 * Warum: Cardmarket fuehrt die Seltenheits-Varianten einer Karte als gleichnamige Produkte
 * ohne Seltenheit (Produktliste und Preisliste kennen nur Name + Expansion). Cardcluster kennt
 * die Seltenheit je Druck und zeigt dazu einen Cardmarket-Preis — und der ist exakt der
 * 7-Tage-Schnitt (avg7) des Produkts (13.10.2026 an 10.797 Varianten: 0 % Abweichung). Also
 * ordnet der gleiche Preis jede Seltenheit genau einem Produkt zu.
 *
 * Ablauf (laeuft in einer Claude-Sitzung, nicht auf dem Server — Cardcluster verlangt einen
 * echten Browser):
 *   1. node scripts/cardcluster-snapshot.mjs <slugs.json> <ordner>   (Playwright, Chromium)
 *   2. npx tsx scripts/build-rarity-map.ts <ordner>
 * Neu bauen, wenn Chris Artikel aus einem Set fuehrt, das in der Datei fehlt.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ccRarities from "../src/lib/market/ccRarities.json";
import { YGO_CARDINFO_URL } from "../src/lib/images/ygoprodeck";
import {
  CM_PRICE_GUIDE_URL,
  CM_PRODUCTS_URL,
  buildCatalogIndex,
  cardValue,
  variantsOf,
  type CmPrice,
  type CmProduct,
  type RarityMap,
} from "../src/lib/market/catalog";
import { rarityKey } from "../src/lib/market/rarity";

interface SnapshotPrint {
  id: number;
  n: string;
  r: number;
  name: string | null;
  cm: number | null;
}
interface Snapshot {
  slug: string;
  setNumber: string | null;
  prints: SnapshotPrint[];
}

const dir = process.argv[2];
if (!dir) throw new Error("Aufruf: npx tsx scripts/build-rarity-map.ts <snapshot-ordner>");
const out = path.join(__dirname, "../src/lib/market/rarityMap.json");
const RARITY = ccRarities as Record<string, { name: string; abbr: string }>;

const getJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
};

async function main() {
  const [guide, products, ygo] = await Promise.all([
    getJson<{ priceGuides: CmPrice[] }>(CM_PRICE_GUIDE_URL),
    getJson<{ products: CmProduct[] }>(CM_PRODUCTS_URL),
    getJson<{ data: { name?: string; card_sets?: { set_code?: string }[] }[] }>(YGO_CARDINFO_URL),
  ]);
  const index = buildCatalogIndex(ygo.data, products.products, guide.priceGuides);

  const map: RarityMap = {};
  const stat = { karten: 0, exakt: 0, gleichpreis: 0, rang: 0, ohneTreffer: 0, artworkPaare: 0 };
  const conflicts = new Set<string>();

  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const snap = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as Snapshot;
    const prefix = (snap.setNumber ?? "").toUpperCase();
    if (!prefix) continue;

    // Druecke je Karte (Nummer + Name) gruppieren
    const groups = new Map<string, SnapshotPrint[]>();
    for (const pr of snap.prints) {
      if (!pr.name || pr.cm === null || !RARITY[pr.r]) continue;
      const k = `${pr.n}|${pr.name}`;
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(pr);
    }

    for (const [k, prints] of groups) {
      const [number, name] = k.split("|");
      const cands = variantsOf(index, name, prefix);
      if (cands.length < 2) continue; // eine Variante: braucht keine Zuordnung
      stat.karten++;

      const value = (id: number) => cardValue(index.prices.get(id));
      const avg7 = (id: number) => index.prices.get(id)?.avg7 ?? null;

      const hits = prints.map((pr) =>
        cands.filter((c) => {
          const v = avg7(c.idProduct);
          return v !== null && Math.abs(v - pr.cm! / 100) < 0.006;
        })
      );
      const taken = new Set<number>();
      hits.forEach((h) => h.length === 1 && taken.add(h[0].idProduct));

      // Rest ohne Treffer: nur wenn genauso viele Produkte uebrig sind wie Druecke, nach Preis-Rang
      const missing = prints.map((_, i) => i).filter((i) => hits[i].length === 0);
      const free = cands.filter((c) => !taken.has(c.idProduct) && !hits.some((h) => h.length > 1 && h.some((x) => x.idProduct === c.idProduct)));
      const ranked = new Map<number, number>();
      if (missing.length > 0 && missing.length === free.length) {
        const byPrice = [...missing].sort((a, b) => prints[a].cm! - prints[b].cm!);
        const prods = [...free].sort((a, b) => (value(a.idProduct) ?? 0) - (value(b.idProduct) ?? 0));
        byPrice.forEach((pi, i) => ranked.set(pi, prods[i].idProduct));
      }

      prints.forEach((pr, i) => {
        const rk = rarityKey(RARITY[pr.r].name);
        const ids = hits[i].length > 0 ? hits[i].map((h) => h.idProduct) : ranked.has(i) ? [ranked.get(i)!] : [];
        if (ids.length === 0) {
          stat.ohneTreffer++;
          return;
        }
        if (hits[i].length === 1) stat.exakt++;
        else if (hits[i].length > 1) stat.gleichpreis++;
        else stat.rang++;

        const slot = ((map[prefix] ??= {})[number] ??= {});
        const value2 = ids.length === 1 ? ids[0] : ids;
        const id = `${prefix}-${number}|${rk}`;
        // Zwei Druecke mit gleicher Nummer + Seltenheit sind verschiedene Artworks derselben Karte
        // (Cardcluster: "-ALT2" im Bild; Cardmarket fuehrt beide als gleichnamige Produkte) oder
        // dieselbe Seltenheit unter zwei Cardcluster-IDs. Beide Kandidaten behalten: zur Laufzeit
        // gilt der Eintrag nur, solange ihre Preise beieinanderliegen, sonst steht die Spanne
        // dieser Kandidaten statt der Spanne ueber alle Varianten.
        const previous = slot[rk];
        if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(value2)) {
          const union = [...new Set([...(Array.isArray(previous) ? previous : [previous]), ...ids])].sort((x, y) => x - y);
          conflicts.add(id);
          slot[rk] = union.length === 1 ? union[0] : union;
        } else {
          slot[rk] = value2;
        }
      });
    }
  }

  stat.artworkPaare = conflicts.size;

  const sorted: RarityMap = {};
  for (const p of Object.keys(map).sort()) {
    sorted[p] = {};
    for (const n of Object.keys(map[p]).sort()) if (Object.keys(map[p][n]).length) sorted[p][n] = map[p][n];
  }
  writeFileSync(out, JSON.stringify(sorted));
  const entries = Object.values(sorted).reduce((a, s) => a + Object.values(s).reduce((b, c) => b + Object.keys(c).length, 0), 0);
  console.log({ ...stat, sets: Object.keys(sorted).length, eintraege: entries, bytes: JSON.stringify(sorted).length });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
