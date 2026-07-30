export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { executeLocalTransfermarktSell, previewLocalTransfermarktSell } from "@/lib/market/transfermarkt-local-service";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type SellRequestBody = {
  saveId?: string;
  seasonId?: string;
  teamId?: string;
  activePlayerId?: string;
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
    const body = (await request.json().catch(() => ({}))) as SellRequestBody;
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const activePlayerId = body.activePlayerId?.trim() ?? "";
    const dryRun = body.dryRun !== false;
    const source = body.source === "prisma" ? "prisma" : "sqlite";

    if (!saveId || !seasonId || !teamId || !activePlayerId) {
      return NextResponse.json(
        {
          success: false,
          error: "saveId, seasonId, teamId and activePlayerId are required.",
          summary: null,
          warnings: [],
        },
        { status: 400 },
      );
    }

    if (source === "prisma") {
      return NextResponse.json(
        {
          success: false,
          error: "Prisma-Referenz ist read-only. Für Verkäufe bitte lokalen Testspielstand starten.",
          summary: null,
          warnings: [],
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
        },
        { status: 404 },
      );
    }

    /**
     * Die Phasensperre gilt fuer den VERKAUF, nicht fuer das Nachschlagen.
     *
     * Vorher lief auch die reine Vorschau (`dryRun`) dagegen: ausserhalb des
     * Verkaufsfensters kam 409 mit `summary: null`, und der Spieler sah statt
     * Preis, Erloes und GuV nur Striche — genau in dem Moment, in dem er
     * entscheiden will, wen er am Saisonende abgibt.
     *
     * Die Vorschau darf hier durch, weil sie den Verkauf NICHT ermoeglicht:
     * `previewLocalTransfermarktSell` traegt denselben Sachverhalt selbst als
     * `blockingReasons: ["sell_only_at_season_end"]` mit `canSell: false`
     * (am echten Spielstand in `season_completed` nachgemessen). Die Sperre
     * verschwindet also nicht, sie wird nur nicht mehr zur leeren Antwort.
     *
     * Der ausfuehrende Pfad (`dryRun: false`) laeuft unveraendert in die
     * Sperre — zwei unabhaengige Riegel, nicht einer.
     */
    const phaseGate = evaluateGamePhaseAction(save.gameState, "sell_players");
    if (!phaseGate.allowed && !dryRun) {
      return NextResponse.json(
        {
          success: false,
          error: phaseGate.reason,
          summary: null,
          warnings: phaseGate.warnings,
        },
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
      action: "sell",
      source,
      dryRun,
      confirmToken: body.confirmToken,
      expectedConfirmToken: body.expectedConfirmToken,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId: body.activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: writeAuth.reason,
          summary: null,
          warnings: writeAuth.warnings,
        },
        { status: writeAuth.status },
      );
    }

    // `idempotencyKey`: Doppelklick/Retry mit demselben Schlüssel bucht den Erlös nicht
    // erneut — siehe `executeLocalTransfermarktSell`.
    const params = {
      saveId,
      seasonId,
      teamId,
      activePlayerId,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
    };
    const summary = dryRun ? previewLocalTransfermarktSell(params) : executeLocalTransfermarktSell(params);
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: "transfermarkt_sell",
      eventType: "transfer_completed",
      affectedViews: ["home", "team", "market", "contracts"],
      dryRun,
      success: summary.canSell,
    });

    return NextResponse.json(
      {
        success: summary.canSell,
        summary,
        warnings: [...phaseGate.warnings, ...writeAuth.warnings, ...summary.warnings],
      },
      { status: summary.canSell ? 200 : 409 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfermarkt sell could not be processed.";
    return NextResponse.json(
      {
        success: false,
        error: message,
        summary: null,
        warnings: [],
      },
      { status: 500 },
    );
  }
}
