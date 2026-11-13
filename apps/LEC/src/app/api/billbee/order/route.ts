import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { getBillbeeSyncState } from "@/lib/billbee/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Bestellung pruefen": sucht eine Billbee-Bestellnummer (oder Teil davon) in den Bestellungen des letzten Abrufs und sagt,
 * ob sie geliefert wurde, ob der Status sie ausschliesst und ob zu jeder Position ein Artikel existiert. Login-geschuetzt wie alle Routen.
 */
export async function GET(req: NextRequest) {
  const nr = (req.nextUrl.searchParams.get("nr") ?? "").trim();
  if (nr.length < 3) return NextResponse.json({ error: "Bestellnummer zu kurz" }, { status: 400 });
  const state = await getBillbeeSyncState(prisma);
  const report = state.lastReport;
  if (!report) return NextResponse.json({ checked: false, message: "Noch kein Abruf seit dem Start der Seite: erst „Jetzt aktualisieren“ drücken." });
  const hits = (report.recentOrders ?? []).filter((o) => o.nr.includes(nr) || (o.id ?? "").includes(nr)).slice(0, 10);
  const newest = (report.recentOrders ?? [])[0]?.at ?? null;
  return NextResponse.json({
    checked: true,
    found: hits.length,
    hits,
    lastRun: report.finishedAt,
    newestOrderAt: newest,
    message:
      hits.length === 0
        ? `Die Bestellung steht nicht in den ${(report.recentOrders ?? []).length} Bestellungen der letzten 60 Tage, die Billbee beim letzten Abruf geliefert hat. Jüngste gelieferte Bestellung: ${newest ?? "keine"}.`
        : undefined,
  });
}
