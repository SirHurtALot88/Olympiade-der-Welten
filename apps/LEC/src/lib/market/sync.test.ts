import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../pipeline/testDb";
import { syncMarketPrices } from "./sync";

const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });

const EN = [
  { id: 1, name: "Mitsurugi Test", card_sets: [{ set_code: "ALIN-EN094", set_rarity: "Super Rare" }] },
  { id: 2, name: "Lightning Storm", card_sets: [{ set_code: "RA04-EN094", set_rarity: "Super Rare" }] },
];
const DE = [
  { id: 1, name: "Mitsurugi Test" },
  { id: 2, name: "Blitzsturm" },
];
const PRODUCTS = [
  { idProduct: 11, name: "Mitsurugi Test", idExpansion: 100 },
  { idProduct: 12, name: "Lightning Storm", idExpansion: 200 },
];
const PRICES = [
  { idProduct: 11, avg: 0.3, low: 0.1, trend: 0.3, avg1: 0.3, avg7: 0.32, avg30: 0.3 },
  { idProduct: 12, avg: 27, low: 20, trend: 27, avg1: 27, avg7: 27.67, avg30: 27 },
];

const fetchFn = (async (url: URL | string) => {
  const u = String(url);
  if (u.includes("price_guide")) return json({ createdAt: "2026-10-14T00:00:00Z", priceGuides: PRICES });
  if (u.includes("products_singles")) return json({ products: PRODUCTS });
  if (u.includes("language=de")) return json({ data: DE });
  return json({ data: EN });
}) as unknown as typeof fetch;

describe("syncMarketPrices: Name gegen Code", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.cleanup();
  });

  const art = (nameRaw: string, nameNormalized: string) =>
    db.prisma.article.create({ data: { nameRaw, nameNormalized, setCode: "RA04-DE094", packQty: 1, isCard: true } });

  it("nimmt bei falschem Code den Code zum Namen, laesst Richtiges stehen, schweigt ohne eindeutigen Code", async () => {
    const wrong = await art("Yu-Gi-Oh! RA04-DE094 Mitsurugi Test Super Rare NM", "ra04-de094 mitsurugi test super rare");
    const right = await art("Yu-Gi-Oh! RA04-DE094 Blitzsturm Super Rare NM", "ra04-de094 blitzsturm super rare");
    const unknown = await art("Yu-Gi-Oh! RA04-DE094 Unbekannte Karte Super Rare NM", "ra04-de094 unbekannte karte super rare");

    const report = await syncMarketPrices(db.prisma, fetchFn);
    expect(report.nameCodeKonflikt).toEqual({ korrigiert: 1, ohneMarktwert: 1 });

    const mp = async (id: string) => db.prisma.marketPrice.findFirst({ where: { articleId: id } });
    // falscher Code: Marktwert der Karte, die der NAME bezeichnet (ALIN), nicht der des Codes (RA04)
    const w = await mp(wrong.id);
    expect(w!.priceAvg7).toBe(0.32);
    expect(JSON.parse(w!.raw!).code).toBe("ALIN-DE094");
    expect((await db.prisma.article.findUnique({ where: { id: wrong.id } }))!.codeHint).toBe("ALIN-DE094");
    // richtiger Titel: unveraendert nach dem Code
    expect((await mp(right.id))!.priceAvg7).toBe(27.67);
    expect((await db.prisma.article.findUnique({ where: { id: right.id } }))!.codeHint).toBeNull();
    // kein eindeutiger Code zum Namen: kein Marktwert
    expect(await mp(unknown.id)).toBeNull();
    expect((await db.prisma.article.findUnique({ where: { id: unknown.id } }))!.codeNameDe).toBe("Blitzsturm");
  });
});
