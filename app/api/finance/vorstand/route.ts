export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  beantrageAlleAufEineKarte,
  setzeUmschichtung,
  zapfeRuecklageAn,
  type VorstandAktionErgebnis,
} from "@/lib/finance/vorstand-budget-aktionen";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";

type VorstandBody = {
  saveId?: string;
  seasonId?: string;
  teamId?: string;
  /** "umschichten" | "ruecklage_anzapfen" | "alles_auf_eine_karte" | "vorstand_fordert_annehmen" */
  aktion?: string;
  /** Betrag in C (Umschichten: + Transfer -> Gehalt; Anzapfen: Gesamtbetrag). */
  betrag?: number;
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
  activeOwnerId?: string | null;
  controlMode?: "human" | "ai" | "passive" | "manual" | null;
};

/**
 * Finanzseite: Umschichten, Ruecklage anzapfen, „Alles auf eine Karte“ (Finanzkonzept V2, Zwei Budgets des Vorstands).
 * Schreibweg wie die Kredit-Routen: Identitaet aus der Sitzung bzw. dem Raum (`authorizeServerRoomWrite`), nur das
 * eigene Team des Aufrufers, frisch vom Server gelesen. Die Regeln selbst liegen in `lib/finance/vorstand-budget-aktionen.ts`
 * und werden hier nicht noch einmal geprueft.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as VorstandBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const aktion = body.aktion?.trim() ?? "";

    if (source === "prisma") {
      return NextResponse.json({ ok: false, reason: "prisma_read_only", meldung: "Nur lesbar." }, { status: 409 });
    }
    if (!saveId || !teamId || !aktion) {
      return NextResponse.json({ ok: false, reason: "missing_fields", meldung: "Angaben fehlen." }, { status: 400 });
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) return NextResponse.json({ ok: false, reason: "save_not_found", meldung: "Spielstand nicht gefunden." }, { status: 404 });
    if (seasonId && seasonId !== save.gameState.season.id) {
      return NextResponse.json({ ok: false, reason: "stale_season", meldung: "Die Saison hat gewechselt." }, { status: 409 });
    }

    const activeOwnerId = await resolveAuthoritativeWriteOwnerId();
    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId,
      action: "vorstand_budget_update",
      source,
      dryRun: false,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json({ ok: false, reason: writeAuth.reason, meldung: "Dieses Team gehoert dir nicht." }, { status: writeAuth.status });
    }

    let ergebnis: VorstandAktionErgebnis;
    if (aktion === "umschichten") {
      ergebnis = setzeUmschichtung(save.gameState, teamId, typeof body.betrag === "number" ? body.betrag : NaN);
    } else if (aktion === "ruecklage_anzapfen") {
      ergebnis = zapfeRuecklageAn(save.gameState, teamId, typeof body.betrag === "number" ? body.betrag : NaN);
    } else if (aktion === "alles_auf_eine_karte") {
      ergebnis = beantrageAlleAufEineKarte(save.gameState, teamId, "mensch");
    } else if (aktion === "vorstand_fordert_annehmen") {
      ergebnis = beantrageAlleAufEineKarte(save.gameState, teamId, "vorstand");
    } else {
      return NextResponse.json({ ok: false, reason: "unknown_action", meldung: "Unbekannte Aktion." }, { status: 400 });
    }

    // Ein abgelehnter Antrag haelt den Vermerk fuer die Anzeige fest; jede andere Ablehnung aendert nichts.
    if (!ergebnis.ok && ergebnis.reason !== "vorstand_lehnt_ab") {
      return NextResponse.json({ ok: false, reason: ergebnis.reason, meldung: ergebnis.meldung }, { status: 400 });
    }
    persistence.saveSingleplayerState(saveId, ergebnis.gameState);
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: "vorstand_budget_update",
      eventType: "save_updated",
      affectedViews: ["home", "finances", "market", "facilities"],
      dryRun: false,
      success: ergebnis.ok,
    });
    return NextResponse.json({ ok: ergebnis.ok, reason: ergebnis.reason, meldung: ergebnis.meldung });
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : "vorstand_update_failed", meldung: "Das hat nicht geklappt." },
      { status: 500 },
    );
  }
}
