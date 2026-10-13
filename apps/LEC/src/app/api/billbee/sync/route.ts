import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getBillbeeSyncState, startBillbeeSync } from "@/lib/billbee/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stand des Billbee-Abrufs (login-geschuetzt wie alle Routen). Enthaelt nie Zugangsdaten. */
export async function GET() {
  return NextResponse.json(getBillbeeSyncState());
}

/** "Jetzt aktualisieren": startet den Abruf im Hintergrund. */
export async function POST() {
  const state = getBillbeeSyncState();
  if (!state.configured) return NextResponse.json({ error: "not_configured" }, { status: 409 });
  const started = startBillbeeSync(prisma);
  return NextResponse.json({ started, ...getBillbeeSyncState() }, { status: 202 });
}
