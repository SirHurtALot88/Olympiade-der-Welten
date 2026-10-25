import { afterEach, beforeEach, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { createTestDb, type TestDb } from "../pipeline/testDb";
import { loadArticleAggregates } from "../dashboard/queries";
import { normalizedNameKey } from "../parsing/name";
import { syncArticleImages } from "./sync";

let db: TestDb;
let dir: string;
beforeEach(async () => {
  db = await createTestDb();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "lec-img-"));
});
afterEach(async () => {
  await db.cleanup();
  fs.rmSync(dir, { recursive: true, force: true });
});

const tile = (itemId: string, title: string, guid: string, price: string) =>
  `<article data-testid=ig-${itemId}><a href=https://www.ebay.de/itm/${itemId}?x=1 aria-label="${title}" class=l>` +
  `<img imageId=${guid} src=x><span>EUR ${price}</span><span>EUR 99,99</span></a></article>`;

/** Fake-eBay: Shopseite 1 mit den Kacheln, danach leer; Bilder als JPEG-Bytes. */
function fakeFetch(tiles: string[], failImages = false): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("ebay.de/str/")) {
      const page = Number(new URL(url).searchParams.get("_pgn") ?? "1");
      return new Response(page === 1 ? `<html>${tiles.length} Angebote ${tiles.join("")}</html>` : "<html></html>", { status: 200 });
    }
    if (url.includes("ebayimg.com")) {
      if (failImages) return new Response("nope", { status: 503 });
      return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { status: 200, headers: { "content-type": "image/jpeg" } });
    }
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
}

async function article(name: string, extra: { currentVk?: number } = {}) {
  return db.prisma.article.create({
    data: { nameNormalized: normalizedNameKey(name), nameRaw: name, setCode: null, ...extra },
  });
}

const opts = (f: typeof fetch) => ({ imageDir: dir, fetchFn: f, pageDelayMs: 0, skipFallback: true });

describe("syncArticleImages: aktueller VK live aus dem eBay-Shop", () => {
  it("setzt den Angebotspreis, und er hat Vorrang vor dem Billbee-Artikelstamm-Preis", async () => {
    const a = await article("Yu-Gi-Oh! TST-DE001 Testkarte Ultra Rare NM 1st", { currentVk: 5.99 });
    const f = fakeFetch([tile("111111111", "Yu-Gi-Oh! TST-DE001 Testkarte Ultra Rare NM 1st", "AAAAAAAAAA", "7,49")]);
    const report = await syncArticleImages(db.prisma, opts(f));
    expect(report.priced).toBe(1);
    const row = await db.prisma.article.findUnique({ where: { id: a.id } });
    expect(row?.ebayPrice).toBeCloseTo(7.49);
    const { aggregates } = await loadArticleAggregates(db.prisma);
    expect(aggregates.find((x) => x.articleId === a.id)?.currentVk).toBeCloseTo(7.49);
  });

  it("der Preis wird auch gesetzt, wenn der Bilder-Abruf scheitert", async () => {
    const a = await article("Yu-Gi-Oh! TST-DE002 Zweitkarte NM");
    const report = await syncArticleImages(db.prisma, opts(fakeFetch([tile("222222222", "Yu-Gi-Oh! TST-DE002 Zweitkarte NM", "BBBBBBBBBB", "3,19")], true)));
    expect(report.failed).toHaveLength(1);
    expect((await db.prisma.article.findUnique({ where: { id: a.id } }))?.ebayPrice).toBeCloseTo(3.19);
  });

  it("ein Artikel, der nicht mehr im Shop steht, verliert den eBay-Preis (Billbee-Preis gilt wieder)", async () => {
    const stays = await article("Yu-Gi-Oh! TST-DE003 Bleibt NM");
    const gone = await article("Yu-Gi-Oh! TST-DE004 Weg NM", { currentVk: 4.99 });
    await db.prisma.article.update({ where: { id: gone.id }, data: { ebayPrice: 6.5, ebayPriceAt: new Date() } });
    const report = await syncArticleImages(db.prisma, opts(fakeFetch([tile("333333333", "Yu-Gi-Oh! TST-DE003 Bleibt NM", "CCCCCCCCCC", "2,99")])));
    expect(report.delisted).toBe(1);
    expect((await db.prisma.article.findUnique({ where: { id: gone.id } }))?.ebayPrice).toBeNull();
    expect((await db.prisma.article.findUnique({ where: { id: stays.id } }))?.ebayPrice).toBeCloseTo(2.99);
    const { aggregates } = await loadArticleAggregates(db.prisma);
    expect(aggregates.find((x) => x.articleId === gone.id)?.currentVk).toBeCloseTo(4.99);
  });
});
