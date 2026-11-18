export const dynamic = "force-dynamic";

/**
 * LIGA-DRAFT IM EINZELSCHRITT — Lese- und Schreibroute (Draft-Neubau, Stufe Kern, 18.11.).
 * Schnittstelle: docs/design/draft-neubau-kern-18-11.md, Abschnitt „API“.
 *
 *   GET  /api/draft?saveId=…&teamId=…&vorschau=6&verlauf=40   -> { ansicht: LigaDraftAnsicht | null }
 *   POST /api/draft { saveId, teamId, aktion, … , roomCode/participantId/seatToken/userId }
 *
 * Aktionen: `ki_schritt` (maxPicks, Standard 1), `ki_hintergrund` (KI faehrt im Hintergrund bis zum naechsten
 * Menschen), `pick` (playerId), `auslassen`, `fertig`, `ueberspringen` (variante "A" | "B"), `auto_pick` (an, optional
 * zielTeamId: fuer ein fremdes Team nur der Gastgeber), `starten` (Gastgeber; legt den Draft an, falls keiner laeuft).
 *
 * RECHTE wie bei den anderen Schreibrouten: `authorizeServerRoomWrite` mit `resolveAuthoritativeWriteOwnerId`, jeder
 * Schreibweg liest frisch (der Dienst liest den Spielstand je Aktion neu). Team-Aktionen brauchen ein EIGENES Team
 * (`teamId`); das Vorspulen der KI braucht ebenfalls ein eigenes Team, als Nachweis des Sitzes. `starten` und Auto-Pick
 * fuer ein fremdes Team sind Gastgeber-Aktionen.
 */
import { NextResponse } from "next/server";

import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import {
  bucheMenschAuslassen,
  bucheMenschFertig,
  bucheMenschPick,
  bucheMenschUeberspringen,
  istHintergrundLaufAktiv,
  laufeKiImHintergrund,
  laufeKiZuege,
  LigaDraftFehler,
  setzeMenschAutoPick,
  starteLigaDraft,
} from "@/lib/draft/liga-draft-dienst";
import { baueLigaDraftAnsicht } from "@/lib/draft/liga-draft-ansicht";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type DraftAktion = "ki_schritt" | "ki_hintergrund" | "pick" | "auslassen" | "fertig" | "ueberspringen" | "auto_pick" | "starten";

const AKTIONEN = new Set<DraftAktion>(["ki_schritt", "ki_hintergrund", "pick", "auslassen", "fertig", "ueberspringen", "auto_pick", "starten"]);

type DraftRequestBody = {
  saveId?: string;
  teamId?: string;
  aktion?: string;
  playerId?: string;
  variante?: string;
  an?: boolean;
  zielTeamId?: string;
  maxPicks?: number;
  erwarteteNr?: number;
  idempotencyKey?: string;
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
};

function zahl(wert: string | null, standard: number): number {
  const n = Number(wert);
  return Number.isFinite(n) ? n : standard;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saveId = url.searchParams.get("saveId")?.trim() ?? "";
    if (!saveId) return NextResponse.json({ error: "saveId_fehlt" }, { status: 400 });
    const save = createPersistenceService().getSaveById(saveId);
    if (!save) return NextResponse.json({ error: "save_not_found" }, { status: 404 });
    const ansicht = baueLigaDraftAnsicht({
      gameState: save.gameState,
      saveId,
      betrachterTeamId: url.searchParams.get("teamId")?.trim() || null,
      vorschau: zahl(url.searchParams.get("vorschau"), 6),
      verlaufLimit: zahl(url.searchParams.get("verlauf"), 40),
    });
    return NextResponse.json({ ansicht, hintergrundLaeuft: istHintergrundLaufAktiv(saveId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "draft_lesen_fehlgeschlagen" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as DraftRequestBody;
    const saveId = body.saveId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const aktion = body.aktion as DraftAktion;
    if (!saveId || !AKTIONEN.has(aktion)) {
      return NextResponse.json({ success: false, error: "saveId_oder_aktion_fehlt" }, { status: 400 });
    }
    const persistence = createPersistenceService();
    if (!persistence.getSaveById(saveId)) {
      return NextResponse.json({ success: false, error: "save_not_found" }, { status: 404 });
    }

    // Gastgeber-Aktionen: Draft anlegen, Auto-Pick fuer ein fremdes Team (Konzept Frage 7: „Auto-Pick auslösen“ für
    // einen Abwesenden, mit Rueckfrage in der Seite und Eintrag im Verlauf).
    const zielTeamId = body.zielTeamId?.trim() || teamId;
    const gastgeberAktion = aktion === "starten" || (aktion === "auto_pick" && zielTeamId !== teamId);
    if (!gastgeberAktion && !teamId) {
      return NextResponse.json({ success: false, error: "teamId_fehlt" }, { status: 400 });
    }
    const activeOwnerId = await resolveAuthoritativeWriteOwnerId();
    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId: gastgeberAktion ? null : teamId,
      action: gastgeberAktion ? "ai_picks_run_execute" : "draft_pick",
      source: "sqlite",
      dryRun: false,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json({ success: false, error: writeAuth.reason, warnings: writeAuth.warnings }, { status: writeAuth.status });
    }

    const erwarteteNr = typeof body.erwarteteNr === "number" ? body.erwarteteNr : null;
    let ergebnis: Record<string, unknown> = {};
    switch (aktion) {
      case "starten":
        ergebnis = { draft: starteLigaDraft({ persistence, saveId }) };
        break;
      case "ki_schritt":
        ergebnis = laufeKiZuege({ persistence, saveId, maxPicks: body.maxPicks ?? 1, erwarteteNr });
        break;
      case "ki_hintergrund":
        // Kehrt sofort zurueck; den Fortschritt liest die Seite ueber GET (Variante A/B: „KI pickt fertig“).
        void laufeKiImHintergrund({ persistence, saveId, logPrefix: "[api/draft]" }).catch(() => undefined);
        ergebnis = { gestartet: true };
        break;
      case "pick":
        if (!body.playerId) return NextResponse.json({ success: false, error: "playerId_fehlt" }, { status: 400 });
        ergebnis = bucheMenschPick({ persistence, saveId, teamId, playerId: body.playerId, erwarteteNr, idempotencyKey: body.idempotencyKey });
        break;
      case "auslassen":
        ergebnis = { draft: bucheMenschAuslassen({ persistence, saveId, teamId, erwarteteNr }) };
        break;
      case "fertig":
        ergebnis = { draft: bucheMenschFertig({ persistence, saveId, teamId }) };
        break;
      case "ueberspringen": {
        const variante = body.variante === "B" ? "B" : body.variante === "A" ? "A" : null;
        if (!variante) return NextResponse.json({ success: false, error: "variante_fehlt" }, { status: 400 });
        ergebnis = { draft: bucheMenschUeberspringen({ persistence, saveId, teamId, variante }) };
        break;
      }
      case "auto_pick":
        ergebnis = { draft: setzeMenschAutoPick({ persistence, saveId, teamId: zielTeamId, an: body.an !== false }) };
        break;
    }

    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId: zielTeamId || null,
      action: `liga_draft_${aktion}`,
      eventType: "roster_updated",
      affectedViews: ["draft", "market", "team"],
      dryRun: false,
      success: true,
    });

    const save = persistence.getSaveById(saveId);
    const ansicht = save
      ? baueLigaDraftAnsicht({ gameState: save.gameState, saveId, betrachterTeamId: teamId || null, vorschau: 6 })
      : null;
    // Den rohen Draft-Zustand nicht doppelt schicken — die Sicht traegt alles, was die Seite braucht.
    const { draft: _draft, ...rest } = ergebnis as { draft?: unknown };
    return NextResponse.json({ success: true, ...rest, ansicht });
  } catch (error) {
    if (error instanceof LigaDraftFehler) {
      return NextResponse.json({ success: false, error: error.code }, { status: error.status });
    }
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "draft_aktion_fehlgeschlagen" },
      { status: 500 },
    );
  }
}
