import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { parseGermanNumber } from "@/lib/parsing/number";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Laedt den juengsten Marktpreis-Datensatz eines Artikels (fuer die Erfassungs-/Detail-Karte). */
export async function GET(req: NextRequest) {
  const articleId = req.nextUrl.searchParams.get("articleId");
  if (!articleId) {
    return NextResponse.json({ error: "missing_articleId" }, { status: 400 });
  }
  const latest = await prisma.marketPrice.findFirst({
    where: { articleId },
    orderBy: { fetchedAt: "desc" },
  });
  return NextResponse.json({ latest });
}

function numOrNull(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "string" && raw.trim().length === 0) return null;
  const n = parseGermanNumber(typeof raw === "number" ? raw : String(raw));
  return Number.isFinite(n) ? n : null;
}

/**
 * Legt einen NEUEN Marktpreis-Datensatz an (KONZEPT §7.1, Provider B):
 * Chris traegt die von Cardmarket kopierten Preisfelder ein. Ein Re-Erfassen
 * ueberschreibt NICHT den vorherigen Datensatz -- die Historie bleibt (siehe
 * PAGES_CONCEPT §3), das Dashboard/`/marktpreise` nutzt jeweils den
 * juengsten (`fetchedAt` DESC).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const articleId = typeof body?.articleId === "string" ? body.articleId : "";
  if (!articleId) {
    return NextResponse.json({ error: "missing_articleId" }, { status: 400 });
  }

  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) {
    return NextResponse.json({ error: "article_not_found" }, { status: 404 });
  }

  try {
    const marketPrice = await prisma.marketPrice.create({
      data: {
        articleId,
        source: "cardmarket-manual",
        priceFrom: numOrNull(body.priceFrom),
        priceTrend: numOrNull(body.priceTrend),
        priceAvg30: numOrNull(body.priceAvg30),
        priceAvg7: numOrNull(body.priceAvg7),
        priceAvg1: numOrNull(body.priceAvg1),
        available: numOrNull(body.available) !== null ? Math.round(numOrNull(body.available)!) : null,
      },
    });
    return NextResponse.json({ ok: true, marketPrice });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Speichern fehlgeschlagen.";
    return NextResponse.json({ error: "save_failed", message }, { status: 422 });
  }
}
