import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { loadStand } from "@/lib/dashboard/stand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Datenstand fuer die Stand-Zeile in der Seitenleiste (login-geschuetzt wie alle Routen). */
export async function GET() {
  return NextResponse.json(await loadStand(prisma));
}
