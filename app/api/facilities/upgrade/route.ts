export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { FACILITY_CATALOG_BY_ID, type FacilityId } from "@/lib/facilities/facility-catalog";
import { applyFacilityUpgrade, previewFacilityUpgrade } from "@/lib/facilities/facility-upgrade-service";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type FacilityUpgradeBody = {
  saveId?: string;
  teamId?: string;
  facilityId?: string;
  variant?: string | null;
  action?: "upgrade" | "downgrade" | null;
  dryRun?: boolean;
  confirmToken?: string | null;
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
  activeOwnerId?: string | null;
  controlMode?: "human" | "ai" | "passive" | "manual" | null;
};

function normalizeFacilityId(value: string | undefined): FacilityId | null {
  return value && Object.prototype.hasOwnProperty.call(FACILITY_CATALOG_BY_ID, value) ? (value as FacilityId) : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as FacilityUpgradeBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const facilityId = normalizeFacilityId(body.facilityId?.trim());
    const dryRun = body.dryRun !== false;
    const action = body.action === "downgrade" ? "downgrade" : "upgrade";

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId || !teamId || !facilityId) {
      return NextResponse.json(
        { success: false, error: "saveId, teamId and facilityId are required.", summary: null },
        { status: 400 },
      );
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json({ success: false, error: "save_not_found", summary: null }, { status: 404 });
    }
    const phaseGate = evaluateGamePhaseAction(save.gameState, "facility_apply");
    if (!phaseGate.allowed && !dryRun) {
      return NextResponse.json(
        {
          success: false,
          error: phaseGate.reason,
          summary: null,
          warnings: phaseGate.warnings,
          blockingReasons: phaseGate.reason ? [phaseGate.reason] : [],
        },
        { status: 409 },
      );
    }

    const preview = previewFacilityUpgrade(save, teamId, facilityId, body.variant, action);
    const phaseAwarePreview =
      dryRun && !phaseGate.allowed && phaseGate.reason
        ? {
            ...preview,
            ok: false,
            confirmToken: null,
            warnings: [...preview.warnings, ...phaseGate.warnings],
            blockingReasons: [...preview.blockingReasons, phaseGate.reason],
          }
        : preview;
    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId,
      action: "facility_apply",
      source,
      dryRun,
      confirmToken: body.confirmToken,
      expectedConfirmToken: preview.confirmToken,
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
          blockingReasons: [writeAuth.reason],
        },
        { status: writeAuth.status },
      );
    }

    const summary = dryRun
      ? phaseAwarePreview
      : applyFacilityUpgrade(save, teamId, facilityId, body.confirmToken ?? null, body.variant, action, persistence);
    const success = "applied" in summary ? summary.applied : summary.ok;
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: action === "downgrade" ? "facility_downgrade" : "facility_upgrade",
      eventType: "facility_updated",
      affectedViews: ["home", "team", "facilities"],
      dryRun,
      success,
    });

    return NextResponse.json(
      {
        success,
        summary,
        warnings: [...phaseGate.warnings, ...writeAuth.warnings, ...summary.warnings],
        blockingReasons: summary.blockingReasons,
      },
      { status: success || dryRun ? 200 : 409 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Facility upgrade failed.",
        summary: null,
      },
      { status: 500 },
    );
  }
}
