export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/persistence/sqlite";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";
import { pruefeArenaChromiumVerfuegbarkeitGecacht } from "@/lib/battle/arena-chromium-selftest";

export async function GET() {
  try {
    const database = getDatabase();
    const activeSave = database
      .prepare("SELECT save_id FROM saves WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1")
      .get() as { save_id: string } | undefined;

    // OPUS-AUFLAGE (Plan `docs/design/battle-arena-auto-run-anbindung-plan-16-10.md` Abschnitt 9,
    // Punkt 3): `/api/health` darf NICHT bei jedem Aufruf Chromium starten. Der Selbsttest laeuft
    // genau EINMAL fuer die Lebensdauer dieses Node-Prozesses (gecacht in
    // `lib/battle/arena-chromium-selftest.ts`) — jeder weitere Aufruf dieser Route liest nur den
    // Cache bzw. haengt sich an den schon laufenden ersten Test an, startet aber NIE einen
    // zweiten Browser.
    const arenaChromium = await pruefeArenaChromiumVerfuegbarkeitGecacht();

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      database: {
        ok: true,
        activeSaveId: activeSave?.save_id ?? null,
      },
      arenaChromium: arenaChromium.ok ? "ok" : "fehlt",
      arenaChromiumDetail: arenaChromium.detail,
    });
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      {
        ok: false,
        generatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown healthcheck error.",
      },
      { status: 500 },
    );
  }
}

