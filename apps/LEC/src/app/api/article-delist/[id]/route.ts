import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Markiert einen Artikel zum Auslisten (marked=true) oder nimmt die Markierung zurueck. Der Artikel bleibt sichtbar; die Markierung dient dem spaeteren Heraussuchen im Ordner. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { marked?: unknown } | null;
  if (!body || typeof body.marked !== "boolean") {
    return NextResponse.json({ error: "marked (boolean) fehlt" }, { status: 400 });
  }
  const res = await prisma.article.updateMany({ where: { id }, data: { delistMarkedAt: body.marked ? new Date() : null } });
  if (res.count === 0) return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
  for (const p of ["/", "/sortiment", "/empfehlungen"]) revalidatePath(p);
  return NextResponse.json({ ok: true, marked: body.marked });
}
