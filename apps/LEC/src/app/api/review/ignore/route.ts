import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { ignoreReviewItem } from "@/lib/pipeline/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const reviewItemId = typeof body?.reviewItemId === "string" ? body.reviewItemId : "";
  if (!reviewItemId) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  try {
    const result = await ignoreReviewItem(prisma, reviewItemId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Aktion fehlgeschlagen.";
    return NextResponse.json({ error: "ignore_failed", message }, { status: 422 });
  }
}
