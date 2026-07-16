import type { PrismaClient } from "@prisma/client";
import { normalizedNameKey } from "../parsing/name";

/**
 * Manuelle Aufloesung eines Review-Items (KONZEPT §5.2): entweder einem
 * bestehenden Artikel zuordnen (erzeugt einen gelernten ArticleAlias, der
 * kuenftige Importe automatisch matcht) oder als Privatverkauf/Nicht-Karte
 * ignorieren.
 */

export interface ResolveResult {
  status: "resolved" | "ignored";
  aliasCreated: boolean;
}

/** Ordnet ein Review-Item einem Ziel-Artikel zu und lernt den Alias. */
export async function resolveReviewToArticle(
  prisma: PrismaClient,
  reviewItemId: string,
  targetArticleId: string
): Promise<ResolveResult> {
  const review = await prisma.reviewItem.findUnique({ where: { id: reviewItemId } });
  if (!review) throw new Error(`Review-Item ${reviewItemId} nicht gefunden.`);

  const target = await prisma.article.findUnique({ where: { id: targetArticleId } });
  if (!target) throw new Error(`Ziel-Artikel ${targetArticleId} nicht gefunden.`);

  const variant = review.nameNormalized;
  let aliasCreated = false;
  // Kein Alias noetig/moeglich, wenn die Variante bereits der Ziel-Name ist.
  if (variant !== target.nameNormalized) {
    const existing = await prisma.articleAlias.findUnique({ where: { nameVariant: variant } });
    if (!existing) {
      await prisma.articleAlias.create({
        data: { nameVariant: variant, articleId: target.id, source: review.source },
      });
      aliasCreated = true;
    }
  }

  await prisma.reviewItem.update({
    where: { id: reviewItemId },
    data: { status: "resolved", resolvedArticleId: target.id },
  });

  return { status: "resolved", aliasCreated };
}

/** Markiert ein Review-Item als Privatverkauf/kein Karten-Artikel (ignorieren). */
export async function ignoreReviewItem(
  prisma: PrismaClient,
  reviewItemId: string
): Promise<ResolveResult> {
  const review = await prisma.reviewItem.findUnique({ where: { id: reviewItemId } });
  if (!review) throw new Error(`Review-Item ${reviewItemId} nicht gefunden.`);

  await prisma.reviewItem.update({
    where: { id: reviewItemId },
    data: { status: "ignored" },
  });
  return { status: "ignored", aliasCreated: false };
}

export interface OpenReviewItem {
  id: string;
  source: string;
  nameRaw: string;
  setCode: string | null;
  qty: number | null;
  revenue: number | null;
}

/** Laedt die offenen Review-Items (Ungematchtes) fuer die Review-UI. */
export async function listOpenReviewItems(
  prisma: PrismaClient,
  limit = 200
): Promise<OpenReviewItem[]> {
  const items = await prisma.reviewItem.findMany({
    where: { status: "open" },
    orderBy: [{ source: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true, source: true, nameRaw: true, setCode: true, qty: true, revenue: true },
  });
  return items;
}

/** Volltext-Suche ueber Artikel (fuer die Zuordnungs-Auswahl in der Review-UI). */
export async function searchArticles(
  prisma: PrismaClient,
  query: string,
  limit = 20
): Promise<Array<{ id: string; nameRaw: string; setCode: string | null }>> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const normalizedQuery = normalizedNameKey(trimmed);

  const results = await prisma.article.findMany({
    where: {
      isCard: true,
      OR: [
        { nameNormalized: { contains: normalizedQuery } },
        { setCode: { contains: trimmed.toUpperCase() } },
      ],
    },
    select: { id: true, nameRaw: true, setCode: true },
    take: limit,
    orderBy: { nameNormalized: "asc" },
  });
  return results;
}
