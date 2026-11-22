/**
 * Baut src/lib/market/cardmarketDirekt.json: Direktlinks auf die Cardmarket-Produktseite je Seltenheit (Chris, 22.11.2026).
 *
 * Warum: Cardmarket fuehrt jede Seltenheit einer Karte als eigenes Produkt mit gleichem Namen; die Suche nach dem Set-Code landet
 * auf der Trefferliste oder der falschen Version. Die Produktseite einer Version heisst
 *   /de/YuGiOh/Products/Singles/<Expansion>/<Name>-V<n>-<Seltenheit>
 * (Chris' Beispiele aus RA02: Ghost-Ogre-Snow-Rabbit-V1-Super-Rare, -V2-Ultra-Rare). Die Versionsnummer zaehlt die gleichnamigen
 * Produkte einer Expansion nach idProduct aufsteigend (Super Rare 769686 = V1, Ultra Rare 769767 = V2).
 *
 * Nur die Rarity-Collection-Sets RA01-RA05 (dort liegt das Problem). Ein Eintrag entsteht nur, wenn die Zuordnung eindeutig ist:
 * Produktname nur aus Buchstaben, Ziffern, Leerzeichen, Bindestrich, Apostroph, &; je Karte genau so viele gleichnamige Produkte
 * wie Seltenheiten, keine Mehrdeutigkeit in der rarityMap. Alles andere bleibt bei der Suche mit Warnhinweis.
 *
 * Aufruf: npx tsx scripts/build-cardmarket-direktlinks.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import rarityMap from "../src/lib/market/rarityMap.json";
import { CM_PRODUCTS_URL, type CmProduct, type RarityMap } from "../src/lib/market/catalog";
import { cardmarketNameSlug, cardmarketRaritySlug } from "../src/lib/market/cardmarketDirekt";

/** Expansionsnamen laut YGOPRODeck (RA02 von Chris' Beispieladresse bestaetigt, die anderen noch nicht auf Cardmarket nachgesehen). */
const EXPANSIONEN: Record<string, string> = {
  RA01: "25th-Anniversary-Rarity-Collection",
  RA02: "25th-Anniversary-Rarity-Collection-II",
  RA03: "Quarter-Century-Bonanza",
  RA04: "Quarter-Century-Stampede",
  RA05: "Rarity-Collection-5",
};

async function main() {
  const res = await fetch(CM_PRODUCTS_URL);
  if (!res.ok) throw new Error(`Produktliste: HTTP ${res.status}`);
  const products: CmProduct[] = (await res.json()).products;
  const byId = new Map(products.map((p) => [p.idProduct, p]));
  const links: Record<string, Record<string, string>> = {};
  let skipped = 0;
  let written = 0;

  for (const prefix of Object.keys(EXPANSIONEN)) {
    const cards = (rarityMap as unknown as RarityMap)[prefix] ?? {};
    // Haupt-Expansion = die, in der die meisten Produkte der Zuordnung liegen
    const counts = new Map<number, number>();
    for (const entry of Object.values(cards)) for (const ids of Object.values(entry)) for (const id of [ids].flat()) {
      const e = byId.get(id)?.idExpansion;
      if (e !== undefined) counts.set(e, (counts.get(e) ?? 0) + 1);
    }
    const mainExp = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (mainExp === undefined) continue;
    const byName = new Map<string, number[]>();
    for (const p of products) if (p.idExpansion === mainExp) (byName.get(p.name.toLowerCase()) ?? byName.set(p.name.toLowerCase(), []).get(p.name.toLowerCase())!).push(p.idProduct);

    for (const [number, entry] of Object.entries(cards)) {
      const rarities = Object.entries(entry);
      const out: Record<string, string> = {};
      for (const [rarity, ids] of rarities) {
        if (Array.isArray(ids)) { skipped++; continue; }
        const p = byId.get(ids);
        if (!p || p.idExpansion !== mainExp) { skipped++; continue; }
        const slug = cardmarketNameSlug(p.name);
        const group = (byName.get(p.name.toLowerCase()) ?? []).slice().sort((a, b) => a - b);
        // je Karte genau so viele gleichnamige Produkte wie Seltenheiten, sonst ist die Versionsnummer nicht sicher
        if (!slug || group.length < 2 || group.length !== rarities.length) { skipped++; continue; }
        const v = group.indexOf(ids) + 1;
        if (v < 1) { skipped++; continue; }
        out[rarity] = `${slug}-V${v}-${cardmarketRaritySlug(rarity)}`;
        written++;
      }
      if (Object.keys(out).length > 0) links[`${prefix}-${number}`] = out;
    }
  }
  const file = path.join(__dirname, "../src/lib/market/cardmarketDirekt.json");
  writeFileSync(file, JSON.stringify({ expansionen: EXPANSIONEN, links }));
  console.log(`${written} Direktlinks, ${skipped} Eintraege uebersprungen (mehrdeutig oder Sonderzeichen), ${Object.keys(links).length} Karten`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
