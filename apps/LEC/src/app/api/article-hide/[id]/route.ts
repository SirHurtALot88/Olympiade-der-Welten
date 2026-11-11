import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Blendet einen Artikel manuell aus (hidden=true) oder holt ihn zurueck (hidden=false). Daten bleiben erhalten. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { hidden?: unknown } | null;
  if (!body || typeof body.hidden !== "boolean") {
    return NextResponse.json({ error: "hidden (boolean) fehlt" }, { status: 400 });
  }
  const res = await prisma.article.updateMany({ where: { id }, data: { hidden: body.hidden } });
  if (res.count === 0) return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
  for (const p of ["/", "/sortiment", "/empfehlungen", "/top-flop", "/marktpreise"]) revalidatePath(p);
  return NextResponse.json({ ok: true, hidden: body.hidden });
}
