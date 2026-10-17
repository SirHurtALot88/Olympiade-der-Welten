export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/persistence/sqlite";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";
import { leseSelftestStatusOhneZuWarten } from "@/lib/battle/arena-chromium-selftest";

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
    //
    // OPUS-REVIEW (Merge-Bedingung "Kleinigkeit"): NICHT mehr `await` -- der Selbsttest laeuft seit
    // PR 3 unter dem globalen Chromium-Semaphor (`arena-chromium-semaphor.ts`) und kann deshalb
    // hinter einem echten, gerade laufenden Arena-Vorlauf warten (bis zu dessen Gesamt-Timeout,
    // s. `arena-headless-runner.ts` B2). Ein `await` hier wuerde `/api/health` fuer diese ganze
    // Zeit blockieren -- genau der Healthcheck, der am dringendsten SOFORT antworten soll, wenn
    // der Server gerade unter Last steht. `leseSelftestStatusOhneZuWarten()` stoesst den
    // Selbsttest bei Bedarf an, wartet aber nie: solange er (noch) laeuft, antwortet diese Route
    // sofort mit `arenaChromium: "pruefe"`, kein Hinweis auf einen Fehler.
    const arenaChromium = leseSelftestStatusOhneZuWarten();

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      database: {
        ok: true,
        activeSaveId: activeSave?.save_id ?? null,
      },
      arenaChromium: "status" in arenaChromium ? "pruefe" : arenaChromium.ok ? "ok" : "fehlt",
      arenaChromiumDetail: "status" in arenaChromium ? null : arenaChromium.detail,
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

