import { NextResponse } from "next/server";

import { FACILITY_CATALOG_BY_ID, type FacilityId } from "@/lib/facilities/facility-catalog";
import { applyFacilityMaintenance, previewFacilityMaintenance } from "@/lib/facilities/facility-maintenance-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type FacilityMaintenanceRequestBody = {
  saveId?: string;
  teamId?: string;
  facilityId?: string;
  dryRun?: boolean;
  confirmToken?: string | null;
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
  controlMode?: "human" | "ai" | "passive" | "manual" | null;
};

function normalizeFacilityId(value: string | undefined): FacilityId | null {
  return value && Object.prototype.hasOwnProperty.call(FACILITY_CATALOG_BY_ID, value) ? (value as FacilityId) : null;
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
  if (source === "prisma") {
    return NextResponse.json(
      { success: false, error: "Prisma-Referenz ist read-only. Facility-Wartung läuft nur im lokalen Save.", summary: null },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as FacilityMaintenanceRequestBody;
  const saveId = body.saveId?.trim() ?? "";
  const teamId = body.teamId?.trim() ?? "";
  const facilityId = normalizeFacilityId(body.facilityId?.trim());
  if (!saveId || !teamId || !facilityId) {
    return NextResponse.json(
      { success: false, error: "saveId, teamId and facilityId are required.", summary: null },
      { status: 400 },
    );
  }

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    return NextResponse.json({ success: false, error: `Save ${saveId} not found.`, summary: null }, { status: 404 });
  }

  const dryRun = body.dryRun ?? true;
  const preview = previewFacilityMaintenance(save, teamId, facilityId);
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
    ? preview
    : applyFacilityMaintenance(save, teamId, facilityId, body.confirmToken ?? null, persistence);
  const success = dryRun ? summary.ok : "applied" in summary && summary.applied;
  notifyRoomGameplayWrite(writeAuth, {
    saveId,
    teamId,
    action: "facility_maintenance",
    eventType: "facility_updated",
    affectedViews: ["home", "team", "facilities"],
    dryRun,
    success,
  });
  return NextResponse.json({
    success,
    summary,
    warnings: [...writeAuth.warnings, ...summary.warnings],
    blockingReasons: summary.blockingReasons,
    error: success ? null : summary.blockingReasons.join(" · ") || "facility_maintenance_blocked",
  });
}
