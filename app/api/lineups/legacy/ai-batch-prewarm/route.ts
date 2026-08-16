export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { requireLocalPersistedSave, SaveResolutionError } from "@/lib/persistence/resolve-local-save";
import { parseRoomWriteContextFromRequestAndBody } from "@/lib/room/parse-room-write-context";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

/**
 * AUFWAERMEN DER KI-AUFSTELLUNGEN IM HINTERGRUND.
 *
 * Das Erzeugen der Aufstellungen fuer 32 Teams kostet gemessen 15-21 s. Frueher lief es
 * mitten im Spieltagswechsel (`writeLocalMatchdayAdvance`) und machte damit 82 % der 46,7 s
 * aus, die "Spieltag abschliessen" gebraucht hat — Wartezeit vor stehender Oberflaeche.
 * Jetzt schreibt der Wechsel nur noch den Spieltag, und das Aufwaermen holt sich das
 * Cockpit hier ab, sobald der Spieler wieder im Saisonstand steht.
 *
 * WARUM EIN EIGENER ENDPUNKT statt `ai-batch-apply`:
 *
 * Jener verlangt `matchdayId` ausdruecklich und lehnt den Aufruf sonst mit 400 ab — eine
 * Strenge, die dort richtig ist, weil der Client dort einen BESTIMMTEN Spieltag meint.
 * Beim Aufwaermen ist es umgekehrt: gemeint ist immer "der Spieltag, der jetzt ansteht".
 * Den kennt der Server nach dem Wechsel genauer als der Client, der noch den alten in der
 * Hand haelt. Er wird deshalb hier aus `matchdayState` abgeleitet, statt ihn den Client
 * raten zu lassen. Die strenge Route bleibt unangetastet.
 *
 * IDEMPOTENT UND UNGEFAEHRLICH: `overwriteExisting: false` laesst vorhandene Aufstellungen
 * stehen, und `saveLocalLegacyLineupDraftBatch` liest den Spielstand beim Schreiben frisch
 * ein und verweigert die Arbeit, wenn der Spieltag nicht mehr der aktive ist. Ein Lauf, der
 * ins Leere geht (Spieler ist laengst weiter), schreibt also nichts.
 *
 * KEIN VERLASS NOETIG: Bleibt der Aufruf aus — Abbruch, Reload, Fehler —, aendert sich nur
 * der Zeitpunkt. Der Spieltags-Lauf und das Speichern der eigenen Aufstellung rufen den
 * Batch ohnehin selbst auf und holen Fehlendes nach.
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() ?? "";
  const seasonId = searchParams.get("seasonId")?.trim() ?? "";

  if (!saveId || !seasonId) {
    return NextResponse.json({ error: "saveId and seasonId are required." }, { status: 400 });
  }

  if (searchParams.get("source")?.trim() === "prisma") {
    return NextResponse.json({ error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const writeAuth = authorizeServerRoomWrite({
    ...parseRoomWriteContextFromRequestAndBody(request, body),
    saveId,
    action: "lineup_ai_batch_apply",
    source: "sqlite",
    dryRun: false,
  });
  if (!writeAuth.allowed) {
    return NextResponse.json({ error: writeAuth.reason, warnings: writeAuth.warnings }, { status: writeAuth.status });
  }

  try {
    const persistence = createPersistenceService();
    const { save } = requireLocalPersistedSave(persistence, saveId);
    const matchdayId = save.gameState.matchdayState?.matchdayId ?? "";

    // Saisonende (kein laufender Spieltag mehr) oder ein Spielstand, der inzwischen in einer
    // anderen Saison steht: nichts aufzuwaermen, und schon gar nichts zu schreiben.
    if (!matchdayId || save.gameState.season.id !== seasonId) {
      return NextResponse.json({ ok: true, skipped: true, reason: "no_active_matchday_for_season", matchdayId: null });
    }

    const result = applyAiLegacyLineupBatchLocally(
      {
        saveId,
        seasonId,
        matchdayId,
        dryRun: false,
        includeWarningTeams: false,
        overwriteExisting: false,
      },
      persistence,
    );

    if (result.summary.savedTeams > 0) {
      notifyRoomGameplayWrite(writeAuth, {
        saveId,
        teamId: null,
        action: "lineup_ai_batch_apply",
        eventType: "lineup_updated",
        affectedViews: ["home", "lineup", "matchday", "arena"],
        dryRun: false,
        success: true,
      });
    }

    return NextResponse.json({ ok: true, skipped: false, matchdayId, summary: result.summary });
  } catch (error) {
    if (error instanceof SaveResolutionError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI batch prewarm failed." },
      { status: 500 },
    );
  }
}
