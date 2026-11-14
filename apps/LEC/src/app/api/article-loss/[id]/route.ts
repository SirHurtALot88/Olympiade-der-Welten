import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const LOSS_KINDS = ["retoure", "reklamation", "beschaedigt", "verloren"] as const;

/** Erfasst Schwund oder eine Retoure zu einem Artikel; bewertet wird zum aktuellen EK des Artikels. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { kind?: unknown; qty?: unknown; note?: unknown } | null;
  const kind = typeof body?.kind === "string" && (LOSS_KINDS as readonly string[]).includes(body.kind) ? body.kind : null;
  const qty = typeof body?.qty === "number" && Number.isInteger(body.qty) && body.qty >= 1 && body.qty <= 999 ? body.qty : null;
  if (!kind || !qty) return NextResponse.json({ error: "kind (retoure|reklamation|beschaedigt|verloren) und qty (1-999) erforderlich" }, { status: 400 });
  const article = await prisma.article.findUnique({ where: { id }, select: { currentEk: true } });
  if (!article) return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : null;
  const loss = await prisma.stockLoss.create({ data: { articleId: id, kind, qty, unitEk: article.currentEk ?? null, note } });
  revalidatePath("/sortiment");
  return NextResponse.json({ ok: true, id: loss.id });
}

/** Loescht eine Erfassung wieder (Vertipper). Query: ?lossId=... */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lossId = req.nextUrl.searchParams.get("lossId");
  if (!lossId) return NextResponse.json({ error: "lossId fehlt" }, { status: 400 });
  const res = await prisma.stockLoss.deleteMany({ where: { id: lossId, articleId: id } });
  if (res.count === 0) return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
  revalidatePath("/sortiment");
  return NextResponse.json({ ok: true });
}
