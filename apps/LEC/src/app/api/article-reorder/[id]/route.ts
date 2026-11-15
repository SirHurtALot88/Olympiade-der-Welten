import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Erstmal nicht nachbestellen": stellt den Artikel fuer `days` Tage zurueck (1..365); days = null hebt die Zurueckstellung auf. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { days?: unknown } | null;
  const days = body?.days;
  if (days !== null && !(typeof days === "number" && Number.isInteger(days) && days >= 1 && days <= 365)) {
    return NextResponse.json({ error: "days (1..365) oder null fehlt" }, { status: 400 });
  }
  const until = days === null ? null : new Date(Date.now() + (days as number) * 86_400_000);
  const res = await prisma.article.updateMany({ where: { id }, data: { reorderSnoozeUntil: until } });
  if (res.count === 0) return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
  for (const p of ["/", "/sortiment", "/empfehlungen"]) revalidatePath(p);
  return NextResponse.json({ ok: true, until: until ? until.toISOString() : null });
}
