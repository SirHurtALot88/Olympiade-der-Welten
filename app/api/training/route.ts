export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { isBereichDelegiert, withTrainingSelbstSpieler } from "@/lib/foundation/team-delegation";

const VALID_TRAINING_MODES: PlayerTrainingMode[] = ["leicht", "mittel", "hart"];

type TrainingUpdateBody = {
  saveId?: string;
  teamId?: string;
  playerId?: string;
  trainingMode?: PlayerTrainingMode;
  trainingClass?: string | null;
  /**
   * Delegiertes Training (Halbautomatik, 18.11.): `true` gibt den Spieler an die KI zurueck — sie
   * setzt ihn beim naechsten Spieltagswechsel wieder selbst. Ohne Modus-/Klassenwechsel erlaubt.
   */
  zurueckAufKi?: boolean;
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
 * Team-scoped player-training write (training mode / training class). Mirrors
 * `app/api/team-settings/identity/route.ts`: read fresh server state, authorize per-team
 * ownership via `authorizeServerRoomWrite`, merge only this player's training change onto
 * the freshly-read state (never a client-supplied snapshot), persist, notify the room.
 *
 * This lets the "Training" tab work inside an active Online-Room, where the generic
 * whole-state PUT (`/api/singleplayer-state`) is blocked with 409
 * `room_save_generic_write_forbidden` for room saves — previously the client's 409 handler
 * treated that as a save conflict and reloaded, silently reverting the human's training
 * edit every time (see `use-foundation-persistence-actions.ts`, `handleStaleRoomSaveWrite`).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as TrainingUpdateBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const playerId = body.playerId?.trim() ?? "";
    const trainingMode = body.trainingMode;
    const trainingClassProvided = Object.prototype.hasOwnProperty.call(body, "trainingClass");
    const trainingClass = body.trainingClass;
    const zurueckAufKi = body.zurueckAufKi === true;

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId || !teamId || !playerId) {
      return NextResponse.json({ success: false, error: "saveId, teamId and playerId are required." }, { status: 400 });
    }
    if (trainingMode === undefined && !trainingClassProvided && !zurueckAufKi) {
      return NextResponse.json({ success: false, error: "trainingMode or trainingClass is required." }, { status: 400 });
    }
    if (trainingMode !== undefined && !VALID_TRAINING_MODES.includes(trainingMode)) {
      return NextResponse.json({ success: false, error: "invalid_training_mode" }, { status: 400 });
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json({ success: false, error: "save_not_found" }, { status: 404 });
    }

    // The player must actually belong to `teamId`'s roster — never trust the client's
    // teamId/playerId pairing, so a participant can't smuggle a write to a player on
    // another team through this endpoint by mislabeling teamId.
    const rosterEntry = save.gameState.rosters.find((entry) => entry.playerId === playerId);
    if (!rosterEntry || rosterEntry.teamId !== teamId) {
      return NextResponse.json({ success: false, error: "player_not_on_team" }, { status: 404 });
    }

    const player = save.gameState.players.find((entry) => entry.id === playerId);
    if (!player) {
      return NextResponse.json({ success: false, error: "player_not_found" }, { status: 404 });
    }

    // Stufe 0.3 (Befund B2): Identitaet AUSSERHALB eines Raums kommt serverseitig aus der Sitzung,
    // nie aus `body.activeOwnerId` — siehe Kommentar an `resolveAuthoritativeWriteOwnerId`.
    const activeOwnerId = await resolveAuthoritativeWriteOwnerId();
    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId,
      action: "training_update",
      source,
      dryRun: false,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json({ success: false, error: writeAuth.reason }, { status: writeAuth.status });
    }

    // „Mensch ueberschreibt, KI respektiert das“ (Chris, 18.11.): ist das Training dieses Teams an
    // die KI delegiert, merkt sich das Team, dass der Mensch DIESEN Spieler selbst gesetzt hat. Die
    // Neubewertung je Spieltag (`reevaluateAiTrainingModesForMatchday`) laesst ihn dann in Ruhe, bis
    // er mit `zurueckAufKi` wieder abgegeben wird. Ohne Delegation bleibt alles wie bisher.
    const controlSettingsMap = buildTeamControlSettingsMap(save.gameState.teams, save.gameState.seasonState.teamControlSettings);
    const teamSettings = controlSettingsMap[teamId];
    const trainingDelegiert = isBereichDelegiert(teamSettings, "training");
    const menschSetztSelbst = trainingMode !== undefined || trainingClassProvided;
    const naechsteTeamControlSettings =
      teamSettings && trainingDelegiert && (menschSetztSelbst || zurueckAufKi)
        ? {
            ...controlSettingsMap,
            [teamId]: {
              ...teamSettings,
              delegation: withTrainingSelbstSpieler(teamSettings, playerId, !zurueckAufKi),
            },
          }
        : null;

    const nextGameState: GameState = {
      ...save.gameState,
      players: save.gameState.players.map((entry) => {
        if (entry.id !== playerId) {
          return entry;
        }
        return {
          ...entry,
          ...(trainingMode !== undefined ? { trainingMode } : {}),
          ...(trainingClassProvided ? { trainingClass } : {}),
        };
      }),
      seasonState: {
        ...(trainingMode !== undefined
          ? {
              ...save.gameState.seasonState,
              trainingIntensityConfirmations: {
                ...(save.gameState.seasonState.trainingIntensityConfirmations ?? {}),
                [teamId]: {
                  teamId,
                  seasonId: save.gameState.season.id,
                  confirmedAt: new Date().toISOString(),
                  sourcePlanId: "manual_player_training_mode",
                },
              },
            }
          : save.gameState.seasonState),
        ...(naechsteTeamControlSettings ? { teamControlSettings: naechsteTeamControlSettings } : {}),
      },
    };

    const persisted = persistence.saveSingleplayerState(saveId, nextGameState);
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: "training_update",
      eventType: "save_updated",
      affectedViews: ["home", "team", "training"],
      dryRun: false,
      success: true,
    });

    return NextResponse.json({
      success: true,
      saveVersion: persisted.gameState.saveVersion,
      player: persisted.gameState.players.find((entry) => entry.id === playerId) ?? null,
      trainingDelegiert,
    });
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "training_update_failed" },
      { status: 500 },
    );
  }
}
