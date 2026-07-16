export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { buildTeamControlSettingsMap, withNormalizedTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

/**
 * Fields a caller may patch on a team's control settings. Deliberately excludes
 * `teamId`, `controlMode`, `ownerId` and `ownerSlot` — those determine *who* controls a
 * team and must never be settable by an arbitrary participant through this endpoint.
 * Cross-team ownership reassignment (moving a team between Chris/Franky, or claiming an
 * AI team) stays on the existing Team-Settings "Spielmodus & Team-Zuordnung" flow, which
 * remains solo/setup-time only for now (see route-level notes in Phase 2 report).
 */
type TeamControlPatch = {
  notes?: string | null;
  strategyLock?: string | null;
  displayLabel?: string | null;
  aiLineupPreviewEnabled?: boolean;
  aiLineupApplyEnabled?: boolean;
  aiLineupAutoApplyEnabled?: boolean;
  aiTransferPreviewEnabled?: boolean;
  aiTransferAutoApplyEnabled?: boolean;
  aiSellPreviewEnabled?: boolean;
  aiSellAutoApplyEnabled?: boolean;
};

const PATCHABLE_FIELDS = [
  "notes",
  "strategyLock",
  "displayLabel",
  "aiLineupPreviewEnabled",
  "aiLineupApplyEnabled",
  "aiLineupAutoApplyEnabled",
  "aiTransferPreviewEnabled",
  "aiTransferAutoApplyEnabled",
  "aiSellPreviewEnabled",
  "aiSellAutoApplyEnabled",
] as const satisfies ReadonlyArray<keyof TeamControlPatch>;

type TeamControlUpdateBody = {
  saveId?: string;
  teamId?: string;
  control?: TeamControlPatch;
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
 * Team-scoped control-settings write (AI automation toggles, notes, strategy lock,
 * display label). Mirrors the ~29 existing gameplay write routes: read fresh server
 * state, authorize per-team ownership, merge only this team's patch onto the freshly-read
 * settings map, persist, notify the room.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as TeamControlUpdateBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const patch = body.control ?? null;

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId || !teamId || !patch) {
      return NextResponse.json({ success: false, error: "saveId, teamId and control are required." }, { status: 400 });
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json({ success: false, error: "save_not_found" }, { status: 404 });
    }

    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId,
      action: "team_control_update",
      source,
      dryRun: false,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId: body.activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json({ success: false, error: writeAuth.reason }, { status: writeAuth.status });
    }

    // Fresh-read the current settings map and merge only the allowlisted, provided fields —
    // never a client-held snapshot, so a concurrent write from the other player can't be
    // clobbered, and ownership fields can never be smuggled in through this endpoint.
    const settingsMap = buildTeamControlSettingsMap(save.gameState.teams, save.gameState.seasonState.teamControlSettings);
    const currentSettings = settingsMap[teamId];
    if (!currentSettings) {
      return NextResponse.json({ success: false, error: "team_control_settings_not_found" }, { status: 404 });
    }

    const safePatch: Partial<TeamControlPatch> = {};
    for (const field of PATCHABLE_FIELDS) {
      if (patch[field] !== undefined) {
        (safePatch as Record<string, unknown>)[field] = patch[field];
      }
    }

    const nextSettings = {
      ...currentSettings,
      ...safePatch,
      teamId,
      controlMode: currentSettings.controlMode,
      ownerId: currentSettings.ownerId,
      ownerSlot: currentSettings.ownerSlot,
    };

    const nextGameState = withNormalizedTeamControlSettings({
      ...save.gameState,
      seasonState: {
        ...save.gameState.seasonState,
        teamControlSettings: {
          ...settingsMap,
          [teamId]: nextSettings,
        },
      },
    });

    const persisted = persistence.saveSingleplayerState(saveId, nextGameState);
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: "team_control_update",
      eventType: "save_updated",
      affectedViews: ["home", "team", "teamSettings"],
      dryRun: false,
      success: true,
    });

    return NextResponse.json({
      success: true,
      saveVersion: persisted.gameState.saveVersion,
      teamControlSettings: persisted.gameState.seasonState.teamControlSettings?.[teamId] ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "team_control_update_failed" },
      { status: 500 },
    );
  }
}
