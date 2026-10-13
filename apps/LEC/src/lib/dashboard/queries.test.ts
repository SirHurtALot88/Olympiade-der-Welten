import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../pipeline/testDb";
import { loadActiveCostSettings, loadArticleAggregates, saveCostSettings } from "./queries";
import { buildSortimentRow } from "./viewModel";
import { DEFAULT_COST_SETTINGS } from "../pricing/costSettings";

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  await db.cleanup();
});

describe("loadActiveCostSettings", () => {
  it("faellt auf die Konzept-Defaults zurueck, wenn noch keine Version gespeichert ist", async () => {
    const settings = await loadActiveCostSettings(db.prisma);
    expect(settings).toEqual(DEFAULT_COST_SETTINGS);
  });
});

describe("CostSettings-Schema", () => {
  it("Spalten-Defaults der DB (Migration) stimmen mit DEFAULT_COST_SETTINGS ueberein", async () => {
    // Regression: Defaults in Schema/Migration und TypeScript duerfen nicht auseinanderlaufen
    // (Fixkosten 1140/840/360/50/1839, Einkaufs-Versand 50 %, Einschreiben 2,35/30/100).
    await db.prisma.costSettings.create({ data: {} });
    const loaded = await loadActiveCostSettings(db.prisma);
    expect(loaded).toEqual(DEFAULT_COST_SETTINGS);
  });

  it("speichert und laedt die neuen Felder (Anteil, Einschreiben, Lizenz, Sonstige)", async () => {
    const custom = {
      ...DEFAULT_COST_SETTINGS,
      buyShippingShareFactor: 0.4,
      registeredCostPerShipment: 2.5,
      registeredThreshold: 25,
      registeredStampsPerYear: 120,
      fixedYearlyPackagingLicense: 60,
      fixedYearlyOther: 2000,
    };
    await saveCostSettings(db.prisma, custom);
    expect(await loadActiveCostSettings(db.prisma)).toEqual(custom);
  });
});

describe("saveCostSettings", () => {
  it("legt eine neue Version an, statt zu ueberschreiben (alte Version wird inaktiv)", async () => {
    const first = await saveCostSettings(db.prisma, { ...DEFAULT_COST_SETTINGS, ebayCommissionRate: 0.12 });
    expect(first.version).toBe(1);
    expect(first.active).toBe(true);

    const second = await saveCostSettings(db.prisma, { ...DEFAULT_COST_SETTINGS, ebayCommissionRate: 0.15 });
    expect(second.version).toBe(2);
    expect(second.active).toBe(true);

    const allVersions = await db.prisma.costSettings.findMany({ orderBy: { version: "asc" } });
    expect(allVersions).toHaveLength(2);
    expect(allVersions[0].active).toBe(false);
    expect(allVersions[1].active).toBe(true);

    const active = await loadActiveCostSettings(db.prisma);
    expect(active.ebayCommissionRate).toBeCloseTo(0.15);
  });
});

describe("Sortiment-Zeile: eBay-Live-VK und Cardmarket-Marktwert kommen an", () => {
  async function seed(extra: { ebayPrice?: number | null; packQty?: number; setCode?: string } = {}) {
    const article = await db.prisma.article.create({
      data: {
        nameNormalized: "yu-gi-oh! tst-de001 testkarte ultra rare nm 1st",
        nameRaw: "Yu-Gi-Oh! TST-DE001 Testkarte Ultra Rare NM 1st",
        setCode: extra.setCode ?? "TST-DE001",
        packQty: extra.packQty ?? 1,
        active: true,
        currentVk: 5.99,
        ebayPrice: extra.ebayPrice ?? 8,
        ebayPriceAt: new Date("2026-10-13T12:00:00Z"),
      },
    });
    await db.prisma.marketPrice.create({
      data: {
        articleId: article.id,
        source: "cardmarket-priceguide",
        matchQuality: "eindeutig",
        priceAvg7: 2,
        priceTrend: 0.02,
        raw: JSON.stringify({ how: "seltenheit" }),
        fetchedAt: new Date("2026-10-12T00:00:00Z"),
      },
    });
    return article;
  }

  it("Aggregat: eBay-Preis ersetzt den Billbee-Preis, Marktwert ist der 7-Tage-Schnitt (nicht der Trend)", async () => {
    const a = await seed();
    const { aggregates } = await loadArticleAggregates(db.prisma);
    const agg = aggregates.find((x) => x.articleId === a.id)!;
    expect(agg.currentVk).toBe(8);
    expect(agg.vkSource).toBe("ebay");
    expect(agg.latestMarketTrend).toBeCloseTo(2);
    expect(agg.marketQuote?.how).toBe("seltenheit");
  });

  it("Zeile: VK-Quelle, Marktwert, Zielspanne (handgerechnet 7,13 € bis 8,68 €), Urteil und Marge bei Nachkauf", async () => {
    const a = await seed();
    const { aggregates, costSettings } = await loadArticleAggregates(db.prisma);
    const row = buildSortimentRow(aggregates.find((x) => x.articleId === a.id)!, "beobachten", costSettings, null);
    expect(row.listingVk).toBe(8);
    expect(row.listingVkSource).toBe("ebay");
    expect(row.listingVkAt).toBe("2026-10-13T12:00:00.000Z");
    expect(row.priceTrend).toBeCloseTo(2);
    expect(row.market).toMatchObject({ value: 2, quality: "eindeutig", how: "seltenheit", status: "im_korridor", rated: true });
    expect(row.market?.targetMin).toBeCloseTo(7.125, 2);
    expect(row.market?.targetOpt).toBeCloseTo(8.684, 2);
    // VK 8,00 bei Nachkauf zum Marktwert: (8 - 2,349 - 3,298) / 8
    expect(row.market?.margin).toBeCloseTo(0.294, 3);
  });

  it("zu guenstig und zu teuer kommen als Urteil an (Grundlage des Filters)", async () => {
    const cheap = await seed({ ebayPrice: 4.99 });
    const { aggregates, costSettings } = await loadArticleAggregates(db.prisma);
    const r1 = buildSortimentRow(aggregates.find((x) => x.articleId === cheap.id)!, "beobachten", costSettings, null);
    expect(r1.market?.status).toBe("zu_guenstig");
    await db.prisma.article.update({ where: { id: cheap.id }, data: { ebayPrice: 14.99 } });
    const again = await loadArticleAggregates(db.prisma);
    const r2 = buildSortimentRow(again.aggregates.find((x) => x.articleId === cheap.id)!, "beobachten", again.costSettings, null);
    expect(r2.market?.status).toBe("zu_teuer");
  });

  it("Pack: Marktwert = Preis je Karte x Pack-Menge", async () => {
    const a = await seed({ packQty: 3 });
    const { aggregates } = await loadArticleAggregates(db.prisma);
    expect(aggregates.find((x) => x.articleId === a.id)?.latestMarketTrend).toBeCloseTo(6);
  });

  it("Artikel ohne Marktwert: market = null, kein erfundenes Urteil", async () => {
    const lone = await db.prisma.article.create({
      data: { nameNormalized: "250 karten sammlung", nameRaw: "250 Karten Sammlung", active: true, currentVk: 9.99 },
    });
    const { aggregates, costSettings } = await loadArticleAggregates(db.prisma);
    const row = buildSortimentRow(aggregates.find((x) => x.articleId === lone.id)!, "beobachten", costSettings, null);
    expect(row.market).toBeNull();
    expect(row.priceTrend).toBeNull();
    expect(row.listingVkSource).toBe("billbee");
  });
});
