export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  applyGameModeOwnership,
  deriveChrisFrankyTeamIdsFromSettings,
  getGameModeOwnershipLimits,
  resolveGameModeFromState,
} from "@/lib/foundation/team-control-settings";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";

/**
 * MENSCH/KI JE TEAM UMSTELLEN — auch im laufenden Raum.
 *
 * GEMELDET (`17xs83`) und von Chris am 20.08.2026 entschieden: „es muss eine möglichkeit geben das
 * sauber umzustellen, also wenn ich eine einstellung habe wo ich konkret meine teams auswähle! und
 * DAS gilt dann auch überall" — Zuständigkeit: nur der Host, wie bei Draft und Simulation.
 *
 * WARUM NICHT ÜBER `/api/team-settings/control`: dieser Weg schließt `controlMode`, `ownerId` und
 * `ownerSlot` ausdrücklich aus, damit kein beliebiger Teilnehmer sich ein Team nehmen kann. Diese
 * Zusicherung bleibt, wo sie ist. Die Umstellung bekommt deshalb einen eigenen Weg mit eigener
 * Host-Wache (`team_ownership_update` in `HOST_LEVEL_ACTIONS`) statt einer Ausnahme im alten.
 *
 * WARUM SAVEWEIT statt je Team: die Zuordnung ist eine Aufteilung — wer ein Team von KI auf Mensch
 * hebt, nimmt es einem anderen Eigner weg. Ein Schreibvorgang je Team ließe die Aufteilung
 * zwischendrin in einem Zustand stehen, den die Modus-Grenzen (`getGameModeOwnershipLimits`)
 * verbieten. Deshalb kommen beide Listen zusammen an und werden zusammen geprüft.
 *
 * Die Anwendung selbst geht durch `applyGameModeOwnership` — dieselbe Funktion wie im Solo-Pfad.
 * Genau das war Chris' „und DAS gilt dann auch überall": ein zweiter Nachbau hier wäre wieder eine
 * zweite Wahrheit.
 */
type TeamOwnershipUpdateBody = {
  saveId?: string;
  chrisTeamIds?: string[];
  frankyTeamIds?: string[];
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
  activeOwnerId?: string | null;
};

function leseTeamIds(wert: unknown): string[] | null {
  if (!Array.isArray(wert)) {
    return null;
  }
  const ids = wert.filter((eintrag): eintrag is string => typeof eintrag === "string" && eintrag.trim().length > 0);
  return ids.length === wert.length ? ids : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as TeamOwnershipUpdateBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const chrisTeamIds = leseTeamIds(body.chrisTeamIds);
    const frankyTeamIds = leseTeamIds(body.frankyTeamIds ?? []);

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId || chrisTeamIds == null || frankyTeamIds == null) {
      return NextResponse.json(
        { success: false, error: "saveId, chrisTeamIds and frankyTeamIds are required." },
        { status: 400 },
      );
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json({ success: false, error: "save_not_found" }, { status: 404 });
    }

    const activeOwnerId = await resolveAuthoritativeWriteOwnerId();
    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      // Bewusst ohne `teamId`: die Aktion steht in `HOST_LEVEL_ACTIONS` und wird gegen die Rolle
      // autorisiert, nicht gegen den Besitz eines einzelnen Teams.
      action: "team_ownership_update",
      source,
      dryRun: false,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json({ success: false, error: writeAuth.reason }, { status: writeAuth.status });
    }

    // Gegen den FRISCH gelesenen Spielstand prüfen, nicht gegen eine Momentaufnahme des Anrufers:
    // die Modus-Grenzen sind eine Aussage über den Spielstand, und der kann sich zwischen dem
    // Öffnen der Seite und dem Klick geändert haben.
    const saveMode = resolveGameModeFromState(save.gameState);
    const limits = getGameModeOwnershipLimits(saveMode);
    const gueltigeTeamIds = new Set(save.gameState.teams.map((team) => team.teamId));
    const unbekannt = [...chrisTeamIds, ...frankyTeamIds].filter((teamId) => !gueltigeTeamIds.has(teamId));
    if (unbekannt.length > 0) {
      return NextResponse.json({ success: false, error: "unknown_team_id" }, { status: 400 });
    }
    const doppelt = chrisTeamIds.filter((teamId) => frankyTeamIds.includes(teamId));
    if (doppelt.length > 0) {
      return NextResponse.json({ success: false, error: "team_owned_twice" }, { status: 400 });
    }
    if (saveMode === "online_4v4" && (chrisTeamIds.length !== 4 || frankyTeamIds.length !== 4)) {
      return NextResponse.json({ success: false, error: "online_4v4_needs_four_and_four" }, { status: 400 });
    }
    if (saveMode === "solo_1" && chrisTeamIds.length !== 1) {
      return NextResponse.json({ success: false, error: "solo_needs_exactly_one_human_team" }, { status: 400 });
    }
    if (chrisTeamIds.length > limits.chrisMax || frankyTeamIds.length > limits.frankyMax) {
      return NextResponse.json({ success: false, error: "too_many_human_teams_for_mode" }, { status: 400 });
    }
    // Ohne diesen Riegel könnte der Host die Liga vollständig auf KI stellen und säße in einem
    // Spielstand, den niemand mehr führt.
    if (chrisTeamIds.length + frankyTeamIds.length === 0) {
      return NextResponse.json({ success: false, error: "at_least_one_human_team_required" }, { status: 400 });
    }

    const nextGameState = applyGameModeOwnership(save.gameState, { saveMode, chrisTeamIds, frankyTeamIds });
    const persisted = persistence.saveSingleplayerState(saveId, nextGameState);

    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId: null,
      action: "team_ownership_update",
      eventType: "save_updated",
      affectedViews: ["home", "team", "teamSettings"],
      dryRun: false,
      success: true,
    });

    const gespeicherteZuordnung = deriveChrisFrankyTeamIdsFromSettings(
      persisted.gameState.teams,
      persisted.gameState.seasonState.teamControlSettings ?? {},
    );
    return NextResponse.json({
      success: true,
      saveVersion: persisted.gameState.saveVersion,
      chrisTeamIds: gespeicherteZuordnung.chrisTeamIds,
      frankyTeamIds: gespeicherteZuordnung.frankyTeamIds,
    });
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "team_ownership_update_failed" },
      { status: 500 },
    );
  }
}
