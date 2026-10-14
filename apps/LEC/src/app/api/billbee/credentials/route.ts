import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { BillbeeClient, BillbeeError, BILLBEE_BASE_URL } from "@/lib/billbee/client";
import { MissingSecretError, deleteBillbeeCredentials, saveBillbeeCredentials } from "@/lib/billbee/credentials";
import { startBillbeeSync } from "@/lib/billbee/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Billbee-Zugangsdaten einmal eingeben: wird erst gegen Billbee geprueft (ein Artikel abrufen),
 * dann verschluesselt gespeichert, dann startet der erste Abruf. Antwortet nie mit den Werten.
 */
export async function POST(req: NextRequest) {
  let body: { user?: unknown; password?: unknown; apiKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const user = typeof body.user === "string" ? body.user.trim() : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!user || !password || !apiKey) {
    return NextResponse.json({ error: "missing_fields", message: "Alle drei Felder ausfüllen." }, { status: 400 });
  }

  try {
    await new BillbeeClient({ user, password, apiKey, baseUrl: BILLBEE_BASE_URL }, { maxRetries: 1 }).get("/products", { page: 1, pageSize: 1 });
  } catch (e) {
    const message =
      e instanceof BillbeeError && e.status === 400
        ? "Billbee lehnt den API-Schlüssel ab (400). Prüfe, ob er vollständig und ohne Leerzeichen eingefügt ist."
        : e instanceof BillbeeError && e.status === 401
        ? "Billbee lehnt die Werte ab. Prüfe Login-Mail, API-Passwort und API-Schlüssel."
        : e instanceof BillbeeError && e.status === 403
          ? "Billbee verweigert den Zugriff. Ist die API in Billbee aktiviert und der Schlüssel freigeschaltet?"
          : e instanceof Error
            ? e.message
            : "Verbindung zu Billbee fehlgeschlagen.";
    return NextResponse.json({ error: "rejected", message }, { status: 422 });
  }

  try {
    await saveBillbeeCredentials(prisma, { user, password, apiKey });
  } catch (e) {
    if (e instanceof MissingSecretError) return NextResponse.json({ error: "no_secret", message: e.message }, { status: 500 });
    throw e;
  }
  const started = await startBillbeeSync(prisma);
  return NextResponse.json({ ok: true, started });
}

/** Zugang aus der App entfernen. */
export async function DELETE() {
  await deleteBillbeeCredentials(prisma);
  return NextResponse.json({ ok: true });
}
