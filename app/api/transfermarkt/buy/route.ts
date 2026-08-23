export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { executeLocalTransfermarktBuy, previewLocalTransfermarktBuy } from "@/lib/market/transfermarkt-local-service";
import type { TransfermarktBuyExecuteResult, TransfermarktBuyPreview } from "@/lib/market/transfermarkt-buy-service";
import type { ContractShape, GameState } from "@/lib/data/olyDataTypes";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";

type BuyRequestBody = {
  saveId?: string;
  seasonId?: string;
  teamId?: string;
  playerId?: string;
  contractLength?: number;
  contractShape?: ContractShape;
  offeredSalary?: number;
  /** Optionaler Idempotenz-Schlüssel: verhindert Doppelbuchung bei Doppelklick/Retry. */
  idempotencyKey?: string;
  dryRun?: boolean;
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
  activeOwnerId?: string | null;
  controlMode?: "human" | "ai" | "passive" | "manual" | null;
  confirmToken?: string | null;
  expectedConfirmToken?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as BuyRequestBody;
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const playerId = body.playerId?.trim() ?? "";
    const dryRun = body.dryRun !== false;
    const source = body.source === "prisma" ? "prisma" : "sqlite";

    if (!saveId || !seasonId || !teamId || !playerId) {
      return NextResponse.json(
        {
          success: false,
          error: "saveId, seasonId, teamId and playerId are required.",
          summary: null,
          warnings: [],
          scope: { saveId, seasonId, teamId, playerId, dryRun, source },
        },
        { status: 400 },
      );
    }

    const params = {
      saveId,
      seasonId,
      teamId,
      playerId,
      contractLength: body.contractLength,
      contractShape: body.contractShape,
      offeredSalary: body.offeredSalary,
      // Schickt der Client denselben Schlüssel erneut (Doppelklick/Retry), wird der Kauf
      // nicht ein zweites Mal gebucht — siehe `executeLocalTransfermarktBuy`.
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
    };

    if (source === "prisma") {
      return NextResponse.json(
        {
          success: false,
          error: "Prisma-Referenz ist read-only. Für Käufe bitte lokalen Testspielstand starten.",
          summary: null,
          warnings: [],
          scope: { saveId, seasonId, teamId, playerId, dryRun, source },
        },
        { status: 409 },
      );
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json(
        {
          success: false,
          error: "save_not_found",
          summary: null,
          warnings: [],
          scope: { saveId, seasonId, teamId, playerId, dryRun, source },
        },
        { status: 404 },
      );
    }

    const phaseGate = evaluateGamePhaseAction(save.gameState, "buy_players");
    if (!phaseGate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: phaseGate.reason,
          summary: null,
          warnings: phaseGate.warnings,
          scope: { saveId, seasonId, teamId, playerId, dryRun, source, phase: phaseGate.phase },
        },
        { status: 409 },
      );
    }

    // Stufe 0.3 (Befund B2): Identitaet AUSSERHALB eines Raums kommt serverseitig aus der Sitzung
    // (resolveAuthoritativeWriteOwnerId), nie aus `body.activeOwnerId` — der Client schickte dort
    // die Owner-ID des ZIELTEAMS, nicht die eigene. Im Raum ignoriert der Guard dieses Feld ohnehin
    // (Sitz-Token entscheidet).
    const activeOwnerId = await resolveAuthoritativeWriteOwnerId();
    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId,
      action: "buy",
      source,
      dryRun,
      confirmToken: body.confirmToken,
      expectedConfirmToken: body.expectedConfirmToken,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: writeAuth.reason,
          summary: null,
          warnings: writeAuth.warnings,
          scope: { saveId, seasonId, teamId, playerId, dryRun, source, roomCode: body.roomCode ?? null },
        },
        { status: writeAuth.status },
      );
    }

    // `executeLocalTransfermarktBuy` hat den resultierenden, bereits persistierten Spielstand schon
    // in der Hand (`gameStateAfter`) — nur bei einem echten, erfolgreichen lokalen Kauf gesetzt. Vor
    // dem Rausschicken aus `summary` herausziehen (der ungekürzte Zustand würde bei jedem Kauf das
    // ganze Saisonarchiv mitschicken) und stattdessen kompakt daneben mitgeben — in genau derselben
    // Form (`compactFoundationInitialGameState`), die auch der State-Endpunkt mit `compactInitial`
    // liefert. Der Client übernimmt ihn dann direkt, statt den ganzen Spielstand neu zu holen. Fehlt
    // er (alte Summary-Form, Preview, Batch-Pfad), bleibt es bei `null` — der Client fällt dann auf
    // den bisherigen vollständigen Reload zurück.
    let gameStateAfter: GameState | null = null;
    let summary: TransfermarktBuyPreview | TransfermarktBuyExecuteResult;
    if (dryRun) {
      summary = previewLocalTransfermarktBuy(params);
    } else {
      const executed = executeLocalTransfermarktBuy(params);
      if (executed.gameStateAfter) {
        gameStateAfter = compactFoundationInitialGameState(executed.gameStateAfter);
      }
      const { gameStateAfter: _executedGameStateAfter, ...summaryWithoutState } = executed;
      summary = summaryWithoutState;
    }

    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: "transfermarkt_buy",
      eventType: "transfer_completed",
      affectedViews: ["home", "team", "market", "contracts"],
      dryRun,
      success: summary.canBuy,
    });

    return NextResponse.json(
      {
        success: summary.canBuy,
        summary,
        gameStateAfter,
        warnings: [...phaseGate.warnings, ...writeAuth.warnings, ...summary.warnings],
        scope: { saveId, seasonId, teamId, playerId, dryRun, source },
      },
      { status: summary.canBuy ? 200 : 409 },
    );
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    const message = error instanceof Error ? error.message : "Transfermarkt buy could not be processed.";
    return NextResponse.json(
      {
        success: false,
        error: message,
        summary: null,
        warnings: [],
        scope: null,
      },
      { status: 500 },
    );
  }
}
