import { mkdir, rename, writeFile, access } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { loadAliasMap } from "../pipeline/aliases";
import { ebayImageUrl, parseStorePage, parseTotalListings, storePageUrl, type StoreListing } from "./ebayStore";

const STORE_PAGE_SIZE = 48;
import { matchListingsToArticles, type ImageMatchKind } from "./match";
import { YGO_CARDINFO_URL, buildSetCodeIndex, lookupCardImageId, ygoImageUrl } from "./ygoprodeck";

/** Wie ein Artikel an sein Bild kam. "set_code" = YGOPRODeck-Rueckfall. */
export type ImageSourceKind = ImageMatchKind | "set_code";

/**
 * Holt die Kartenbilder und legt sie einmal im Volume ab.
 *
 * 1. Chris' eigene Fotos aus dem eBay-Shop (Vorrang, seine Wahl): Shopseite
 *    durchblaettern, jedes Angebot einem Artikel zuordnen (match.ts).
 * 2. Rueckfall YGOPRODeck ueber den Set-Code fuer Artikel, die bei eBay gerade
 *    nicht gelistet sind und noch kein eigenes Foto haben. Ein einmal geholtes
 *    eBay-Foto wird nie durch ein YGOPRODeck-Bild ersetzt.
 *
 * Geladen wird nur, was fehlt oder sich geaendert hat (Bildkennung imageGuid).
 * Ein zweiter Lauf laedt also fast nichts.
 */

export interface SyncOptions {
  imageDir: string;
  fetchFn?: typeof fetch;
  /** Obergrenze fuer Shopseiten (48 Angebote je Seite). */
  maxPages?: number;
  /** Pause zwischen zwei Shopseiten — nicht hektischer als ein Mensch. */
  pageDelayMs?: number;
  /** Alles neu laden, auch vorhandene Bilder. */
  force?: boolean;
  /** YGOPRODeck-Rueckfall abschalten. */
  skipFallback?: boolean;
}

export interface SyncReport {
  pages: number;
  /** Seiten, die auch nach Wiederholung leer blieben (eBay-Drosselung). */
  emptyPages: number[];
  listings: number;
  /** Artikel mit Bild aus diesem Lauf, je Weg. */
  matchedBy: Record<ImageSourceKind, number>;
  downloaded: number;
  unchanged: number;
  failed: { articleId: string; source: string; error: string }[];
  /** Angebote ohne passenden Artikel (Stichprobe, max. 50). */
  unmatchedSample: string[];
  unmatchedCount: number;
  /** Artikel, deren aktueller eBay-Preis in diesem Lauf gesetzt wurde. */
  priced: number;
  /** Artikel, die nicht mehr im Shop stehen (eBay-Preis geleert). */
  delisted: number;
  /** Artikel mit Set-Code, die auch YGOPRODeck nicht kennt (Stichprobe). */
  fallbackMissSample: string[];
  fallbackMissCount: number;
  articlesWithImage: number;
  articlesTotal: number;
  startedAt: string;
  finishedAt: string;
}

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "accept-language": "de-DE,de;q=0.9",
};

interface Job {
  articleId: string;
  guid: string;
  url: string;
  matchedBy: ImageSourceKind;
  ebayItemId: string | null;
  /** Aktueller Angebotspreis laut Shopseite (nur eBay-Jobs). */
  price: number | null;
}

export async function crawlStore(
  fetchFn: typeof fetch,
  maxPages: number,
  pageDelayMs: number
): Promise<{ listings: StoreListing[]; pages: number; emptyPages: number[] }> {
  const all = new Map<string, StoreListing>();
  const emptyPages: number[] = [];
  let pages = 0;
  let lastPage = maxPages;
  for (let page = 1; page <= lastPage; page++) {
    if (page > 1 && pageDelayMs > 0) await sleep(pageDelayMs);
    // eBay drosselt zwischendurch und liefert dann eine Seite ohne Angebote aus
    // (HTTP 200!). Eine leere Seite heisst deshalb nicht "Ende", sondern: warten,
    // nochmal. Das Ende steht fest, sobald Seite 1 die Gesamtzahl verraten hat.
    let found: StoreListing[] = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await sleep(pageDelayMs * 4 * 2 ** attempt);
      const res = await fetchFn(storePageUrl(page), { headers: BROWSER_HEADERS });
      if (!res.ok) continue;
      const html = await res.text();
      if (page === 1 && lastPage === maxPages) {
        const total = parseTotalListings(html);
        if (total) lastPage = Math.min(maxPages, Math.ceil(total / STORE_PAGE_SIZE));
      }
      found = parseStorePage(html);
      if (found.length > 0) break;
    }
    pages++;
    if (found.length === 0) {
      if (page === 1) throw new Error("Auf der eBay-Shopseite wurden keine Angebote erkannt (gesperrt oder Seitenaufbau geändert?).");
      emptyPages.push(page);
      continue;
    }
    for (const l of found) if (!all.has(l.itemId)) all.set(l.itemId, l);
  }
  return { listings: [...all.values()], pages, emptyPages };
}

export async function syncArticleImages(prisma: PrismaClient, options: SyncOptions): Promise<SyncReport> {
  const startedAt = new Date().toISOString();
  const fetchFn = options.fetchFn ?? fetch;

  const articles = await prisma.article.findMany({
    select: { id: true, nameNormalized: true, packQty: true, setCode: true, imageGuid: true, imageFile: true, imageMatchedBy: true },
  });
  const current = new Map(articles.map((a) => [a.id, a]));

  // --- 1. eBay ---------------------------------------------------------------
  const { listings, pages, emptyPages } = await crawlStore(fetchFn, options.maxPages ?? 100, options.pageDelayMs ?? 1000);
  const facts = await prisma.ebayListingFact.findMany({
    where: { articleId: { not: null } },
    select: { ebayItemId: true, articleId: true },
  });
  const articleIdByItemId = new Map<string, string>();
  for (const f of facts) if (f.ebayItemId && f.articleId) articleIdByItemId.set(f.ebayItemId, f.articleId);
  const aliases = await loadAliasMap(prisma);
  const { assignments, unmatched } = matchListingsToArticles(listings, articles, articleIdByItemId, aliases);

  const jobs: Job[] = assignments.map((a) => ({
    articleId: a.articleId,
    guid: a.listing.imageGuid,
    url: ebayImageUrl(a.listing.imageGuid),
    matchedBy: a.matchedBy,
    ebayItemId: a.listing.itemId,
    price: a.listing.price,
  }));

  // --- 2. YGOPRODeck fuer den Rest -------------------------------------------
  const covered = new Set(jobs.map((j) => j.articleId));
  const needFallback = articles.filter(
    (a) =>
      !covered.has(a.id) &&
      a.setCode &&
      // ein eigenes eBay-Foto bleibt, auch wenn das Angebot gerade nicht gelistet ist
      (!a.imageFile || a.imageMatchedBy === "set_code")
  );
  const fallbackMisses: string[] = [];
  if (!options.skipFallback && needFallback.length > 0) {
    const res = await fetchFn(YGO_CARDINFO_URL, { headers: BROWSER_HEADERS });
    if (!res.ok) throw new Error(`YGOPRODeck antwortet mit HTTP ${res.status}`);
    const index = buildSetCodeIndex(await res.json());
    for (const a of needFallback) {
      const cardId = lookupCardImageId(index, a.setCode!);
      if (cardId === null) {
        fallbackMisses.push(a.setCode!);
        continue;
      }
      jobs.push({ articleId: a.id, guid: `ygo:${cardId}`, url: ygoImageUrl(cardId), matchedBy: "set_code", ebayItemId: null, price: null });
    }
  }

  // --- 3. Laden und ablegen --------------------------------------------------
  await mkdir(options.imageDir, { recursive: true });
  const matchedBy: Record<ImageSourceKind, number> = { item_id: 0, name: 0, alias: 0, set_code: 0 };
  const failed: SyncReport["failed"] = [];
  let downloaded = 0;
  let unchanged = 0;

  // Aktuelle Angebotspreise zuerst und unabhaengig vom Bild: ein haengender Bilder-Abruf darf den VK nicht veralten lassen.
  const now = new Date();
  const priced = jobs.filter((j) => j.ebayItemId && j.price !== null);
  await runLimited(priced, 8, async (job) => {
    await prisma.article.update({
      where: { id: job.articleId },
      data: { ebayItemId: job.ebayItemId, ebayPrice: job.price, ebayPriceAt: now },
    });
  });
  // Nicht mehr gelistet (und der Abruf war vollstaendig): kein aktueller eBay-Preis mehr.
  // Bei Drosselluecken (leere Seiten) oder einem auffaellig kleinen Abruf nichts loeschen.
  let delisted = 0;
  if (emptyPages.length === 0 && priced.length > 0) {
    const res = await prisma.article.updateMany({
      where: { ebayPrice: { not: null }, id: { notIn: priced.map((j) => j.articleId) } },
      data: { ebayPrice: null, ebayPriceAt: null },
    });
    delisted = res.count;
  }

  await runLimited(jobs, 4, async (job) => {
    const art = current.get(job.articleId)!;
    const fileName = `${job.articleId}.jpg`;
    const filePath = path.join(options.imageDir, fileName);

    const upToDate =
      !options.force && art.imageGuid === job.guid && art.imageFile === fileName && (await exists(filePath));

    if (!upToDate) {
      try {
        const res = await fetchFn(job.url, { headers: BROWSER_HEADERS });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const type = res.headers.get("content-type") ?? "";
        if (!type.startsWith("image/")) throw new Error(`kein Bild (${type || "ohne Typ"})`);
        const buf = Buffer.from(await res.arrayBuffer());
        const tmp = `${filePath}.tmp`;
        await writeFile(tmp, buf);
        await rename(tmp, filePath);
        downloaded++;
      } catch (e) {
        failed.push({ articleId: job.articleId, source: job.url, error: e instanceof Error ? e.message : String(e) });
        return;
      }
    } else {
      unchanged++;
    }
    matchedBy[job.matchedBy]++;

    await prisma.article.update({
      where: { id: job.articleId },
      data: {
        imageGuid: job.guid,
        imageFile: fileName,
        imageMatchedBy: job.matchedBy,
        ...(upToDate ? {} : { imageFetchedAt: new Date() }),
      },
    });
  });

  const articlesWithImage = await prisma.article.count({ where: { imageFile: { not: null } } });

  return {
    pages,
    emptyPages,
    listings: listings.length,
    matchedBy,
    downloaded,
    unchanged,
    failed,
    unmatchedSample: unmatched.slice(0, 50).map((l) => l.title),
    unmatchedCount: unmatched.length,
    priced: priced.length,
    delisted,
    fallbackMissSample: fallbackMisses.slice(0, 50),
    fallbackMissCount: fallbackMisses.length,
    articlesWithImage,
    articlesTotal: articles.length,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

async function runLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
