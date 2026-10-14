import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getBillbeeSyncState, startBillbeeSync } from "@/lib/billbee/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stand des Billbee-Abrufs (login-geschuetzt wie alle Routen). Enthaelt nie Zugangsdaten. */
export async function GET() {
  return NextResponse.json(await getBillbeeSyncState(prisma));
}

/** "Jetzt aktualisieren": startet den Abruf im Hintergrund. */
export async function POST() {
  const state = await getBillbeeSyncState(prisma);
  if (!state.configured) return NextResponse.json({ error: "not_configured" }, { status: 409 });
  const started = await startBillbeeSync(prisma);
  return NextResponse.json({ started, ...(await getBillbeeSyncState(prisma)) }, { status: 202 });
}
