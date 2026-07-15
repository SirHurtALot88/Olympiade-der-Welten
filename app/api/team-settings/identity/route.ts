export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import type { TeamIdentity } from "@/lib/data/olyDataTypes";
import {
  buildResolvedTeamIdentities,
  buildTeamIdentityOverrideMap,
  withNormalizedTeamIdentityOverrides,
} from "@/lib/foundation/team-identity-settings";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

/** Fields a caller may patch on a team's identity draft. Never accepts `teamId`. */
type TeamIdentityPatch = Partial<Omit<TeamIdentity, "teamId">>;

type TeamIdentityUpdateBody = {
  saveId?: string;
  teamId?: string;
  identity?: TeamIdentityPatch;
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
 * Team-scoped identity override write. Mirrors the ~29 existing gameplay write routes:
 * read fresh server state, authorize per-team ownership, merge only this team's identity
 * override onto the freshly-read overrides map (never a client-supplied snapshot), persist,
 * notify the room. This lets `Team-Settings` work inside an active Online-Room, where the
 * generic whole-state PUT (`/api/singleplayer-state`) is blocked with 409
 * `room_save_generic_write_forbidden`.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as TeamIdentityUpdateBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const identityPatch = body.identity ?? null;

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId || !teamId || !identityPatch) {
      return NextResponse.json({ success: false, error: "saveId, teamId and identity are required." }, { status: 400 });
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json({ success: false, error: "save_not_found" }, { status: 404 });
    }

    const team = save.gameState.teams.find((entry) => entry.teamId === teamId);
    if (!team) {
      return NextResponse.json({ success: false, error: "team_not_found" }, { status: 404 });
    }

    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId,
      action: "team_identity_update",
      source,
      dryRun: false,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId: body.activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json({ success: false, error: writeAuth.reason }, { status: writeAuth.status });
    }

    // Fresh-read the current resolved identity (defaults + existing overrides) and apply the
    // patch on top of it — never trust a client-held identity snapshot, so a concurrent write
    // from the other player can't be clobbered.
    const existingOverrides = save.gameState.seasonState.teamIdentityOverrides ?? {};
    const currentIdentity = buildResolvedTeamIdentities(save.gameState.teams, save.gameState.teamIdentities, existingOverrides).find(
      (entry) => entry.teamId === teamId,
    );
    if (!currentIdentity) {
      return NextResponse.json({ success: false, error: "team_identity_not_found" }, { status: 404 });
    }

    const draftIdentity: TeamIdentity = { ...currentIdentity, ...identityPatch, teamId };
    const perTeamOverride = buildTeamIdentityOverrideMap([team], { [teamId]: draftIdentity });
    const nextOverrides = { ...existingOverrides };
    if (perTeamOverride[teamId]) {
      nextOverrides[teamId] = perTeamOverride[teamId];
    } else {
      delete nextOverrides[teamId];
    }

    const nextGameState = withNormalizedTeamIdentityOverrides({
      ...save.gameState,
      seasonState: {
        ...save.gameState.seasonState,
        teamIdentityOverrides: nextOverrides,
      },
    });

    const persisted = persistence.saveSingleplayerState(saveId, nextGameState);
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: "team_identity_update",
      eventType: "save_updated",
      affectedViews: ["home", "team", "teamSettings"],
      dryRun: false,
      success: true,
    });

    return NextResponse.json({
      success: true,
      saveVersion: persisted.gameState.saveVersion,
      teamIdentity: persisted.gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "team_identity_update_failed" },
      { status: 500 },
    );
  }
}
