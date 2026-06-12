import { NextResponse } from "next/server";

import { FACILITY_CATALOG_BY_ID, type FacilityId } from "@/lib/facilities/facility-catalog";
import { applyFacilityUpgrade, previewFacilityUpgrade } from "@/lib/facilities/facility-upgrade-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type FacilityUpgradeBody = {
  saveId?: string;
  teamId?: string;
  facilityId?: string;
  variant?: string | null;
  dryRun?: boolean;
  confirmToken?: string | null;
  source?: "sqlite" | "prisma";
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

    const summary = dryRun
      ? previewFacilityUpgrade(save, teamId, facilityId, body.variant)
      : applyFacilityUpgrade(save, teamId, facilityId, body.confirmToken ?? null, body.variant, persistence);
    const success = "applied" in summary ? summary.applied : summary.ok;

    return NextResponse.json(
      {
        success,
        summary,
        warnings: summary.warnings,
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
