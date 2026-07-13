export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { applyEarlyPayoff } from "@/lib/finance/loan-service";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type LoanEarlyPayoffBody = {
  saveId?: string;
  seasonId?: string;
  teamId?: string;
  loanId?: string;
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
 * Vorab-Rückzahlung (vorzeitige Ablösung), siehe docs/design/kredit-system.md
 * ("Vorab-Rückzahlung"). Gate: `credit_early_payoff` — dieselbe
 * Preseason/Verkaufsphase-Policy wie `credit_borrow` (siehe
 * `game-phase-action-policy.ts` für die Begründung), fog-of-war-safe (nur
 * das eigene Team des Aufrufers via `authorizeServerRoomWrite`). Kern-Logik
 * (Ablösesumme, Cash-Belastung, Verleiher-Gutschrift bei Team-Krediten)
 * bleibt in `applyEarlyPayoff` (lib/finance/loan-service.ts) — diese Route
 * validiert nur die Transport-Ebene, prüft, dass der Kredit dem
 * anfragenden Team gehört, und persistiert das Ergebnis.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as LoanEarlyPayoffBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const loanId = body.loanId?.trim() ?? "";

    if (source === "prisma") {
      return NextResponse.json({ ok: false, reason: "prisma_read_only", payoff: 0 }, { status: 409 });
    }
    if (!saveId || !teamId || !loanId) {
      return NextResponse.json({ ok: false, reason: "missing_fields", payoff: 0 }, { status: 400 });
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json({ ok: false, reason: "save_not_found", payoff: 0 }, { status: 404 });
    }

    if (seasonId && seasonId !== save.gameState.season.id) {
      return NextResponse.json({ ok: false, reason: "stale_season", payoff: 0 }, { status: 409 });
    }

    // Fog of war: das anfragende Team darf nur seine eigenen Kredite ablösen
    // — `applyEarlyPayoff` selbst kennt keinen "Aufrufer" und prüft das
    // nicht, das ist Aufgabe dieser Route.
    const loan = (save.gameState.seasonState.loans ?? []).find((entry) => entry.loanId === loanId) ?? null;
    if (!loan) {
      return NextResponse.json({ ok: false, reason: "loan_not_found", payoff: 0 }, { status: 404 });
    }
    if (loan.borrowerTeamId !== teamId) {
      return NextResponse.json({ ok: false, reason: "loan_not_own_team", payoff: 0 }, { status: 403 });
    }

    // Gleiche Gate-Logik wie `credit_borrow` (Preseason-Fenster, das
    // `transfer_sell_phase` mit einschließt — siehe
    // game-phase-action-policy.ts für die Begründung dieser Wahl).
    const phaseGate = evaluateGamePhaseAction(save.gameState, "credit_early_payoff");
    if (!phaseGate.allowed) {
      return NextResponse.json({ ok: false, reason: "not_preseason", payoff: 0 }, { status: 409 });
    }

    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId,
      action: "credit_early_payoff",
      source,
      dryRun: false,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId: body.activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json({ ok: false, reason: writeAuth.reason, payoff: 0 }, { status: writeAuth.status });
    }

    const result = applyEarlyPayoff(save.gameState, loanId, { execute: true });
    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason, payoff: result.payoff }, { status: 400 });
    }

    persistence.saveSingleplayerState(saveId, result.gameState);
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: "credit_early_payoff",
      eventType: "save_updated",
      affectedViews: ["home", "credits"],
      dryRun: false,
      success: true,
    });

    return NextResponse.json({ ok: true, reason: null, payoff: result.payoff });
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : "loan_early_payoff_failed", payoff: 0 },
      { status: 500 },
    );
  }
}
