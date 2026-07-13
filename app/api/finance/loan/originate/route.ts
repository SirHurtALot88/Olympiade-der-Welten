export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { originateLoan } from "@/lib/finance/loan-service";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type LoanOriginateBody = {
  saveId?: string;
  seasonId?: string;
  teamId?: string;
  principal?: number;
  termSeasons?: number;
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
 * Kreditaufnahme (Bank), Phase 1 — siehe docs/design/kredit-system.md.
 * Preseason-only (dieselbe Gate-Logik wie `sponsor_choice`,
 * `evaluateGamePhaseAction`), fog-of-war-safe (nur das eigene Team des
 * Aufrufers via `authorizeServerRoomWrite`), Kern-Validierung/Kapazität
 * bleibt in `originateLoan` (lib/finance/loan-service.ts) — diese Route
 * validiert nur die Transport-Ebene und persistiert das Ergebnis.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as LoanOriginateBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const principal = typeof body.principal === "number" ? body.principal : NaN;
    const termSeasons = typeof body.termSeasons === "number" ? body.termSeasons : NaN;

    if (source === "prisma") {
      return NextResponse.json(
        { ok: false, reason: "prisma_read_only", loan: null, capacity: 0, terms: null },
        { status: 409 },
      );
    }
    if (!saveId || !teamId) {
      return NextResponse.json(
        { ok: false, reason: "missing_fields", loan: null, capacity: 0, terms: null },
        { status: 400 },
      );
    }
    if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(termSeasons)) {
      return NextResponse.json(
        { ok: false, reason: "invalid_principal", loan: null, capacity: 0, terms: null },
        { status: 400 },
      );
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json(
        { ok: false, reason: "save_not_found", loan: null, capacity: 0, terms: null },
        { status: 404 },
      );
    }

    if (seasonId && seasonId !== save.gameState.season.id) {
      return NextResponse.json(
        { ok: false, reason: "stale_season", loan: null, capacity: 0, terms: null },
        { status: 409 },
      );
    }

    // Preseason-only Gate — dieselbe Policy wie `sponsor_choice` (siehe
    // lib/foundation/game-phase-action-policy.ts), aber mit dem im Auftrag
    // fest verlangten Reason-String, damit der Client eine stabile,
    // sprachneutrale Fehlerkonstante bekommt.
    const phaseGate = evaluateGamePhaseAction(save.gameState, "credit_borrow");
    if (!phaseGate.allowed) {
      return NextResponse.json(
        { ok: false, reason: "not_preseason", loan: null, capacity: 0, terms: null },
        { status: 409 },
      );
    }

    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId,
      action: "credit_borrow",
      source,
      dryRun: false,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId: body.activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json(
        { ok: false, reason: writeAuth.reason, loan: null, capacity: 0, terms: null },
        { status: writeAuth.status },
      );
    }

    // Kern-Validierung (Betrag, Laufzeit, Kapazität) lebt im Service — hier
    // nie den Client-Betrag/Laufzeit blind vertrauen, `originateLoan`
    // clamped/prüft erneut serverseitig und liefert den maßgeblichen `reason`.
    const result = originateLoan(save.gameState, { borrowerTeamId: teamId, principal, termSeasons }, { execute: true });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason, loan: null, capacity: result.capacity, terms: result.terms },
        { status: 400 },
      );
    }

    persistence.saveSingleplayerState(saveId, result.gameState);
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: "credit_borrow",
      eventType: "save_updated",
      affectedViews: ["home", "credits"],
      dryRun: false,
      success: true,
    });

    return NextResponse.json({
      ok: true,
      reason: null,
      loan: result.loan,
      capacity: result.capacity,
      terms: result.terms,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        reason: error instanceof Error ? error.message : "loan_originate_failed",
        loan: null,
        capacity: 0,
        terms: null,
      },
      { status: 500 },
    );
  }
}
