/**
 * Synthetische Demodaten fuer das LEC-Cockpit (Screenshots, Entwicklung) -- KEINE echten
 * Geschaeftsdaten. Erzeugt ~300 erfundene Artikel mit verschachtelten Verkaufsfenstern
 * (30 ⊂ 90 ⊂ 365 ⊂ all), Bestand, Listen-VK/EK (bei ~50 % der aktiven Artikel bewusst OHNE EK,
 * wie in Chris' echtem Sortiment), Import-Laeufen und einigen Einkaeufen.
 *
 * Die Fenster laufen durch DIESELBE Pipeline wie ein echter Import (`buildImportPlan` +
 * `persistImportPlan`), damit DB I/II/III, Fixkostenanteil und Einschreiben-Satz genau so
 * berechnet sind wie in Produktion -- keine zweite Rechenlogik.
 *
 *   cd apps/LEC
 *   LEC_SQLITE_PATH="$PWD/data/lec.sqlite" npm run db:push
 *   LEC_SQLITE_PATH="$PWD/data/lec.sqlite" npx tsx scripts/seed-demo.ts
 *
 * Die Ziel-DB (data/*.sqlite) ist gitignored. Das Skript leert die Tabellen vorher.
 */
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { loadDotEnv } from "./_env";
import type { BillbeeImportResult, BillbeeRow } from "../src/lib/importers/billbee";
import type { BillbeeArtikelRow } from "../src/lib/importers/billbeeArtikel";
import type { EbayImportResult } from "../src/lib/importers/ebay";
import { buildImportPlan } from "../src/lib/pipeline/importPlan";
import { persistBillbeeArtikel, persistImportPlan } from "../src/lib/pipeline/persist";
import { normalizeArticleName } from "../src/lib/parsing/name";
import { DEFAULT_COST_SETTINGS } from "../src/lib/pricing/costSettings";

loadDotEnv();

// Deterministischer Zufall (Mulberry32), damit Screenshots reproduzierbar sind.
function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261013);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => a + rand() * (b - a);
const round2 = (n: number) => Math.round(n * 100) / 100;

const PREFIXES = ["Nebel", "Sturm", "Schatten", "Kristall", "Drachen", "Eisen", "Licht", "Flammen", "Donner", "Abgrund", "Himmels", "Ruinen"];
const NOUNS = ["ritter", "kaiser", "wächter", "magier", "golem", "phönix", "hydra", "sphinx", "seher", "jäger", "falke", "titan"];
const SUFFIX = ["", " der Tiefe", " des Nordens", " – Erwacht", " Ultima", " von Arkadia", " des Zwielichts"];
const SETS = ["RA02", "DUNE", "AGOV", "PHNI", "LEDE", "MZMI", "RA03", "SUDA", "INFO", "VASM", "TAMA", "BLMR"];
const RARITIES = ["Common NM", "Rare NM", "Super Rare NM", "Ultra Rare NM 1st", "Secret Rare NM", "Quarter Century NM"];

interface DemoArticle {
  nameRaw: string;
  nameNormalized: string;
  packQty: number;
  setCode: string;
  /** Lebenszeit-Stueck und Anteile der inneren Fenster. */
  qtyAll: number;
  qty365: number;
  qty90: number;
  qty30: number;
  vk: number;
  ekPerUnit: number; // 0 = unbekannt
  active: boolean;
  stock: number;
  currentVk: number | null;
  currentEk: number | null;
}

function makeArticles(count: number): DemoArticle[] {
  const out: DemoArticle[] = [];
  const seen = new Set<string>();
  while (out.length < count) {
    const set = pick(SETS);
    const num = String(Math.floor(rand() * 99) + 1).padStart(3, "0");
    const setCode = `${set}-DE${num}`;
    if (seen.has(setCode)) continue;
    seen.add(setCode);
    const pack = rand() < 0.12 ? 3 : 1;
    const name = `${pick(PREFIXES)}${pick(NOUNS)}${pick(SUFFIX)}`;
    const nameRaw = `${pack > 1 ? `${pack}x ` : ""}Yu-Gi-Oh! ${setCode} ${name} ${pick(RARITIES)}`;

    // Archetypen: Renner, Solide, Faellt ab, Ladenhueter, Verlust, Neu.
    const kind = rand();
    let qtyAll: number, qty365: number, qty90: number, qty30: number;
    if (kind < 0.12) {
      // Renner
      qtyAll = Math.floor(between(14, 60));
      qty365 = Math.floor(qtyAll * between(0.5, 0.9));
      qty90 = Math.floor(qty365 * between(0.3, 0.5));
      qty30 = Math.max(2, Math.floor(qty90 * between(0.3, 0.5)));
    } else if (kind < 0.45) {
      // Solide
      qtyAll = Math.floor(between(3, 16));
      qty365 = Math.floor(qtyAll * between(0.4, 0.9));
      qty90 = Math.floor(qty365 * between(0.2, 0.45));
      qty30 = Math.floor(qty90 * between(0, 0.6));
    } else if (kind < 0.55) {
      // Faellt ab: frueher stark, 90 T schwach, 30 T null
      qtyAll = Math.floor(between(10, 36));
      qty365 = Math.floor(qtyAll * between(0.4, 0.7));
      qty90 = Math.floor(qty365 * between(0.02, 0.1));
      qty30 = 0;
    } else if (kind < 0.78) {
      // Ladenhueter: Historie, 0 in 365 T
      qtyAll = Math.floor(between(1, 12));
      qty365 = 0;
      qty90 = 0;
      qty30 = 0;
    } else if (kind < 0.9) {
      // Wenig Daten
      qtyAll = Math.floor(between(1, 3));
      qty365 = qtyAll;
      qty90 = rand() < 0.5 ? 1 : 0;
      qty30 = 0;
    } else {
      // Neu: nur juengere Fenster
      qty30 = Math.floor(between(1, 4));
      qty90 = qty30 + Math.floor(between(0, 3));
      qty365 = qty90;
      qtyAll = qty90;
    }
    const vkBase = pack > 1 ? between(6, 18) : between(0.99, 24);
    const vk = round2(Math.max(0.99, vkBase));
    // Verlustbringer: EK ueber VK*0.7; sonst Warenquote um die 43 % (Chris' Betriebszahl), gestreut.
    const loss = rand() < 0.07;
    const ekRaw = loss ? vk * between(0.75, 1.1) : Math.max(0.1, vk * between(0.3, 0.58));
    const active = rand() < 0.72;
    const ekMissing = active ? rand() < 0.5 : rand() < 0.3;
    const ekPerUnit = ekMissing ? 0 : round2(ekRaw);
    out.push({
      nameRaw,
      nameNormalized: normalizeArticleName(nameRaw).normalized,
      packQty: pack,
      setCode,
      qtyAll,
      qty365,
      qty90,
      qty30,
      vk,
      ekPerUnit,
      active,
      stock: active ? Math.floor(between(0, 14)) : 0,
      currentVk: active ? round2(vk * between(0.95, 1.1)) : null,
      currentEk: active && !ekMissing ? round2(ekRaw) : null,
    });
  }
  return out;
}

function windowResult(articles: DemoArticle[], window: BillbeeImportResult["window"], days: number | null, today: Date): BillbeeImportResult {
  const to = today;
  const from = days === null ? new Date(Date.UTC(2020, 8, 1)) : new Date(to.getTime() - days * 86400000);
  const rows: BillbeeRow[] = [];
  for (const a of articles) {
    const qty = window === "30" ? a.qty30 : window === "90" ? a.qty90 : window === "365" ? a.qty365 : a.qtyAll;
    if (qty <= 0) continue;
    // Realisierter Ø-VK streut leicht je Fenster (aeltere Verkaeufe etwas guenstiger).
    const drift = window === "all" ? 0.94 : window === "365" ? 0.97 : 1;
    const revenue = round2(qty * a.vk * drift);
    const ek = round2(qty * a.ekPerUnit);
    rows.push({
      sku: a.setCode,
      nameRaw: a.nameRaw,
      nameNormalized: a.nameNormalized,
      packQty: a.packQty,
      setCode: a.setCode,
      isCard: true,
      qty,
      revenue,
      ek,
      marge: round2(revenue - ek),
    });
  }
  return { window, windowFrom: from, windowTo: to, rows };
}

async function main() {
  const sqlitePath = process.env.LEC_SQLITE_PATH
    ? path.resolve(process.env.LEC_SQLITE_PATH)
    : path.join(process.cwd(), "data", "lec.sqlite");
  const prisma = new PrismaClient({ datasourceUrl: `file:${sqlitePath}` });
  const today = new Date(Date.UTC(2026, 9, 12));

  console.log(`Demodaten -> ${sqlitePath}`);
  await prisma.purchase.deleteMany();
  await prisma.marketPrice.deleteMany();
  await prisma.saleWindow.deleteMany();
  await prisma.ebayListingFact.deleteMany();
  await prisma.reviewItem.deleteMany();
  await prisma.articleAlias.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.article.deleteMany();

  const articles = makeArticles(300);
  const results = [
    windowResult(articles, "30", 30, today),
    windowResult(articles, "90", 90, today),
    windowResult(articles, "365", 365, today),
    windowResult(articles, "all", null, today),
  ];
  // eBay-Report (365 T) mit Gebuehren nach dem geprueften Modell 0,35 + VK×11 %×1,19 + VK×9 %×1,19,
  // damit die Fenster-Snapshots wie in Produktion einen eBay-Gebuehrenblock tragen.
  const ebay: EbayImportResult = {
    reportFrom: results[2].windowFrom,
    reportTo: results[2].windowTo,
    subscriptionFee: 665.98,
    rows: results[2].rows.map((r, i) => {
      const commission = r.qty * DEFAULT_COST_SETTINGS.ebayCommissionFixed + r.revenue * DEFAULT_COST_SETTINGS.ebayCommissionRate * 1.19;
      const ad = r.revenue * DEFAULT_COST_SETTINGS.adFeeRateSingle * 1.19;
      const total = round2(commission + ad);
      return {
        titleRaw: r.nameRaw,
        titleNormalized: r.nameNormalized,
        setCode: r.setCode,
        isCard: true,
        ebayItemId: String(300000000000 + i),
        shopCategoryL1: "Yu-Gi-Oh!",
        shopCategoryL2: null,
        qtySold: r.qty,
        totalRevenueGross: r.revenue,
        revenueNetShipping: r.revenue,
        shippingPaidByBuyer: 0,
        totalSellingCosts: total,
        listingFees: 0,
        optionalFees: 0,
        salesCommission: round2(commission),
        adFeesBasic: round2(ad),
        adFeesPremium: 0,
        adFeesExpress: 0,
        adFeesExternal: 0,
        internationalFees: 0,
        otherFees: 0,
        depositFees: 0,
        feeCredits: 0,
        shippingLabelCost: 0,
        revenueAfterCosts: round2(r.revenue - total),
        avgSellingPrice: round2(r.revenue / r.qty),
      };
    }),
  };
  const plan = buildImportPlan(results, ebay, DEFAULT_COST_SETTINGS);
  const persisted = await persistImportPlan(prisma, plan);
  console.log(`Artikel: ${persisted.articlesUpserted}, Fenster-Snapshots: ${persisted.saleWindowsWritten}`);

  const stamm: BillbeeArtikelRow[] = articles
    .filter((a) => a.active)
    .map((a) => ({
      nameRaw: a.nameRaw,
      nameNormalized: a.nameNormalized,
      packQty: a.packQty,
      setCode: a.setCode,
      isCard: true,
      stock: a.stock,
      currentVk: a.currentVk,
      currentEk: a.currentEk,
      statusRaw: "Aktiv",
    }));
  const stammResult = await persistBillbeeArtikel(prisma, stamm);
  console.log(`Artikelstamm: ${stammResult.upserted} aktiv`);

  for (const r of results) {
    await prisma.importBatch.create({
      data: {
        kind: "billbee",
        window: r.window,
        windowFrom: r.windowFrom,
        windowTo: r.windowTo,
        fileName: `demo-billbee-${r.window}.xlsx`,
        rowCount: r.rows.length,
        matchedCount: r.rows.length,
        createdAt: today,
      },
    });
  }
  await prisma.importBatch.create({
    data: { kind: "billbee_artikel", fileName: "demo-artikelstamm.xlsx", rowCount: stamm.length, matchedCount: stamm.length, createdAt: today },
  });
  await prisma.importBatch.create({
    data: {
      kind: "ebay",
      windowFrom: new Date(today.getTime() - 365 * 86400000),
      windowTo: today,
      fileName: "demo-ebay-report.csv",
      rowCount: ebay.rows.length,
      matchedCount: plan.stats.matchedArticles,
      unmatchedCount: plan.stats.unmatchedEbayListings,
      createdAt: today,
    },
  });

  // Einige Einkaeufe der letzten 120 Tage (Demo fuer "Einkaufstempo"; in Produktion liefert
  // derzeit kein Importer diese Tabelle -> dort leerer Zustand).
  const dbArticles = await prisma.article.findMany({ where: { active: true, currentEk: { not: null } }, select: { id: true, currentEk: true } });
  let purchases = 0;
  for (let d = 2; d < 120; d += Math.floor(between(2, 6))) {
    const date = new Date(today.getTime() - d * 86400000);
    const n = Math.floor(between(2, 5));
    for (let i = 0; i < n; i++) {
      const a = pick(dbArticles);
      await prisma.purchase.create({
        data: { articleId: a.id, date, qty: Math.floor(between(1, 4)), unitEk: a.currentEk ?? 1, buyShipping: i === 0 ? 1.15 : 0, source: "Cardmarket" },
      });
      purchases++;
    }
  }
  console.log(`Einkaeufe: ${purchases}`);

  // Cardmarket-Marktwerte (automatische Preisliste, Werte JE KARTE) fuer ~70 % der aktiven
  // Artikel: Trend um den eigenen EK gestreut, damit "zu guenstig / im Korridor / zu teuer"
  // nach Chris' Formel alle vorkommen; ~15 % mehrdeutig mit Spanne.
  const marketArticles = await prisma.article.findMany({ where: { active: true }, select: { id: true, currentVk: true, currentEk: true, packQty: true } });
  let quotes = 0;
  for (const a of marketArticles) {
    if (rand() > 0.7) continue;
    const perCardVk = (a.currentVk ?? 5) / Math.max(1, a.packQty);
    // Marktwert ≈ ein Drittel des VK (Formel VK = EK×3+0,99), gestreut 0,5..2,2 -> alle Urteile.
    const trend = round2(Math.max(0.05, ((perCardVk - 0.99) / 3) * between(0.5, 2.2)));
    const ambiguous = rand() < 0.15;
    await prisma.marketPrice.create({
      data: {
        articleId: a.id,
        source: "cardmarket-priceguide",
        priceFrom: round2(trend * between(0.6, 0.95)),
        priceTrend: trend,
        priceAvg30: round2(trend * between(0.9, 1.1)),
        priceAvg7: round2(trend * between(0.9, 1.1)),
        priceAvg1: null,
        available: Math.floor(between(3, 400)),
        fetchedAt: new Date(today.getTime() - Math.floor(between(0, 45)) * 86400000),
        matchQuality: ambiguous ? "mehrdeutig" : "eindeutig",
        priceMin: ambiguous ? round2(trend * 0.4) : null,
        priceMax: ambiguous ? round2(trend * 3) : null,
        variants: ambiguous ? Math.floor(between(2, 6)) : null,
      },
    });
    quotes++;
  }
  console.log(`Marktwerte: ${quotes}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
