export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { fuehreKiPreseasonLaufAus, KiPreseasonLaufFehler } from "@/lib/ai/ai-preseason-background-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { parseRoomWriteContextFromRequestAndBody } from "@/lib/room/parse-room-write-context";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";

/**
 * KI-Preseason-Lauf (Setup-Draft in Saison 1, Kauffenster der Folgesaison).
 *
 * Die Logik selbst — Reihenfolge Draft/Training, Markt, Kredite, Notkredit, Snapshot-Patch, die
 * Sperren gegen Doppel- und Saisonende-Laeufe, `shouldRunSetupDraft` — steht seit dem 02.11. in
 * `lib/ai/ai-preseason-background-service.ts`, damit auch der Server selbst sie beim Saisonwechsel
 * anstossen kann (Saisontest-Fund: Saison 2 ohne einen einzigen KI-Kauf, weil nur der Browser
 * ausloeste). Diese Route prueft nur noch Anfrage, Raum-Schreibrecht und Identitaet und reicht die
 * Antwort des Dienstes durch.
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() ?? "";
  const seasonId = searchParams.get("seasonId")?.trim() ?? "";
  const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";

  if (!saveId || !seasonId) {
    return NextResponse.json({ error: "saveId and seasonId are required." }, { status: 400 });
  }

  if (source === "prisma") {
    return NextResponse.json({ error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
  }

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    return NextResponse.json({ error: `Save ${saveId} not found.` }, { status: 404 });
  }
  if (save.gameState.season.id !== seasonId) {
    return NextResponse.json({ error: `Season ${seasonId} is not active in save ${saveId}.` }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const roomWriteContext = parseRoomWriteContextFromRequestAndBody(request, body);
  const writeAuth = authorizeServerRoomWrite({
    ...roomWriteContext,
    saveId,
    action: "ai_preseason_background",
    source: "sqlite",
    dryRun: false,
  });
  if (!writeAuth.allowed) {
    return NextResponse.json({ error: writeAuth.reason, warnings: writeAuth.warnings }, { status: writeAuth.status });
  }
  // Stufe 0.3 (Befund B2): die Identitaet fuer den Nicht-Raum-Fall kommt serverseitig aus der
  // Sitzung (`resolveAuthoritativeWriteOwnerId`), nicht mehr aus `roomWriteContext.activeOwnerId`
  // (siehe Verwendung im Dienst bei `resolveAiBulkTeamWriteScope`).
  const scopeOwnerId = await resolveAuthoritativeWriteOwnerId();

  try {
    const ergebnis = await fuehreKiPreseasonLaufAus({
      saveId,
      seasonId,
      scope: { room: writeAuth.room, participant: writeAuth.participant, activeOwnerId: scopeOwnerId },
      persistence,
    });
    if (ergebnis.succeeded) {
      notifyRoomGameplayWrite(writeAuth, {
        saveId,
        teamId: null,
        action: "ai_preseason_background",
        eventType: "save_updated",
        affectedViews: ["home", "team", "market", "lineup", "facilities", "training"],
        dryRun: false,
        success: true,
      });
    }
    return NextResponse.json(ergebnis.body, { status: ergebnis.httpStatus });
  } catch (error) {
    if (error instanceof KiPreseasonLaufFehler) {
      return NextResponse.json({ error: error.message }, { status: error.httpStatus });
    }
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI preseason background failed.",
      },
      { status: 500 },
    );
  }
}
