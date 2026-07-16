import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./testDb";
import { ignoreReviewItem, resolveReviewToArticle, searchArticles } from "./review";
import { normalizedNameKey } from "../parsing/name";

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  await db.cleanup();
});

async function seedArticle(nameRaw: string, setCode: string | null) {
  return db.prisma.article.create({
    data: { nameNormalized: normalizedNameKey(nameRaw), nameRaw, setCode },
  });
}

async function seedReview(nameRaw: string, source: string) {
  return db.prisma.reviewItem.create({
    data: { source, nameRaw, nameNormalized: normalizedNameKey(nameRaw) },
  });
}

describe("resolveReviewToArticle", () => {
  it("erzeugt einen ArticleAlias und markiert das Review-Item als resolved", async () => {
    const article = await seedArticle("Yu-Gi-Oh! TEST-DE001 Zielkarte", "TEST-DE001");
    const review = await seedReview("YuGiOh Zielkarte anderer Titel", "ebay");

    const result = await resolveReviewToArticle(db.prisma, review.id, article.id);
    expect(result.aliasCreated).toBe(true);

    const alias = await db.prisma.articleAlias.findUnique({
      where: { nameVariant: normalizedNameKey("YuGiOh Zielkarte anderer Titel") },
    });
    expect(alias?.articleId).toBe(article.id);

    const updated = await db.prisma.reviewItem.findUnique({ where: { id: review.id } });
    expect(updated?.status).toBe("resolved");
    expect(updated?.resolvedArticleId).toBe(article.id);
  });

  it("legt keinen Alias an, wenn Variante und Ziel-Name identisch sind", async () => {
    const article = await seedArticle("Yu-Gi-Oh! TEST-DE002 Gleichnamig", "TEST-DE002");
    const review = await seedReview("Yu-Gi-Oh! TEST-DE002 Gleichnamig", "billbee");

    const result = await resolveReviewToArticle(db.prisma, review.id, article.id);
    expect(result.aliasCreated).toBe(false);
    const aliasCount = await db.prisma.articleAlias.count();
    expect(aliasCount).toBe(0);
  });
});

describe("ignoreReviewItem", () => {
  it("markiert ein Review-Item als ignored (Privatverkauf)", async () => {
    const review = await seedReview("Schmuck Konvolut 925 Silber", "billbee");
    const result = await ignoreReviewItem(db.prisma, review.id);
    expect(result.status).toBe("ignored");

    const updated = await db.prisma.reviewItem.findUnique({ where: { id: review.id } });
    expect(updated?.status).toBe("ignored");
  });
});

describe("searchArticles", () => {
  it("findet Artikel per Namensteil und Set-Code", async () => {
    await seedArticle("Yu-Gi-Oh! BROL-DE067 Rotaeugige Fusion", "BROL-DE067");
    await seedArticle("Yu-Gi-Oh! RA04-DE050 Mulreizendes Fuwalos", "RA04-DE050");

    const byName = await searchArticles(db.prisma, "fusion");
    expect(byName.some((a) => a.setCode === "BROL-DE067")).toBe(true);

    const bySet = await searchArticles(db.prisma, "RA04-DE050");
    expect(bySet.some((a) => a.setCode === "RA04-DE050")).toBe(true);
  });

  it("gibt bei leerer Suche nichts zurueck", async () => {
    expect(await searchArticles(db.prisma, "   ")).toHaveLength(0);
  });
});
