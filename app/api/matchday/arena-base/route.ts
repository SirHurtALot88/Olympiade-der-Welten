export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { loadMatchdayArenaBase } from "@/lib/foundation/matchday-arena-base-service";
import { DEFAULT_ACTIVE_OWNER_ID } from "@/lib/foundation/team-control-settings";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saveId = searchParams.get("saveId")?.trim() ?? "";
    const seasonId = searchParams.get("seasonId")?.trim() ?? "";
    const matchdayId = searchParams.get("matchdayId")?.trim() ?? "";
    const teamId = searchParams.get("teamId")?.trim() ?? "";
    const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
    const activeOwnerId = searchParams.get("activeOwnerId")?.trim() || DEFAULT_ACTIVE_OWNER_ID;

    if (source === "prisma") {
      return NextResponse.json(
        { error: "Prisma/Supabase mode is read-only in this build." },
        { status: 409 },
      );
    }

    if (!saveId || !seasonId || !matchdayId || !teamId) {
      return NextResponse.json(
        { error: "saveId, seasonId, matchdayId and teamId are required." },
        { status: 400 },
      );
    }

    const payload = await loadMatchdayArenaBase({
      saveId,
      seasonId,
      matchdayId,
      teamId,
      activeOwnerId,
    });

    if (!payload.context) {
      return NextResponse.json(
        {
          ok: false,
          error: payload.contextErrors[0] ?? "Arena base context could not be loaded.",
          contextErrors: payload.contextErrors,
          contextWarnings: payload.contextWarnings,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      ...payload,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Arena base could not be loaded." },
      { status: 500 },
    );
  }
}
