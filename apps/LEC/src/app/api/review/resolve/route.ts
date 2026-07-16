import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { resolveReviewToArticle } from "@/lib/pipeline/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const reviewItemId = typeof body?.reviewItemId === "string" ? body.reviewItemId : "";
  const targetArticleId = typeof body?.targetArticleId === "string" ? body.targetArticleId : "";

  if (!reviewItemId || !targetArticleId) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  try {
    const result = await resolveReviewToArticle(prisma, reviewItemId, targetArticleId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Zuordnung fehlgeschlagen.";
    return NextResponse.json({ error: "resolve_failed", message }, { status: 422 });
  }
}
