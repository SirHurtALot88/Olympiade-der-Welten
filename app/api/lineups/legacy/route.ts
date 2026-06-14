import { NextResponse } from "next/server";

import {
  getLocalLegacyLineupDraft,
  saveLocalLegacyLineupDraft,
} from "@/lib/lineups/legacy-lineup-local-service";
import type { LineupDraftModifiers } from "@/lib/data/olyDataTypes";
import { LegacyLineupService } from "@/lib/lineups/legacy-lineup-service";
import type { LegacyLineupEntryInput, LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

function parseKeyParams(request: Request): LegacyLineupKeyParams | null {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() ?? "";
  const seasonId = searchParams.get("seasonId")?.trim() ?? "";
  const matchdayId = searchParams.get("matchdayId")?.trim() ?? "";
  const teamId = searchParams.get("teamId")?.trim() ?? "";

  if (!saveId || !seasonId || !matchdayId || !teamId) {
    return null;
  }

  return { saveId, seasonId, matchdayId, teamId };
}

function parseSource(request: Request) {
  return new URL(request.url).searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
}

function parseRoomWriteContext(request: Request) {
  const { searchParams } = new URL(request.url);
  return {
    roomCode: searchParams.get("roomCode"),
    participantId: searchParams.get("participantId"),
    seatToken: searchParams.get("seatToken"),
    userId: searchParams.get("userId"),
    activeManagerTeamId: searchParams.get("activeManagerTeamId"),
    controlMode: searchParams.get("controlMode") as "human" | "ai" | "passive" | "manual" | null,
  };
}

export async function GET(request: Request) {
  const params = parseKeyParams(request);
  if (!params) {
    return NextResponse.json({ error: "saveId, seasonId, matchdayId and teamId are required." }, { status: 400 });
  }

  if (parseSource(request) !== "prisma") {
    const draft = getLocalLegacyLineupDraft(params);
    return NextResponse.json({ draft, source: "sqlite", readOnly: false });
  }

  const service = new LegacyLineupService();
  const draft = await service.getLegacyLineupDraft(params);
  return NextResponse.json({ draft, source: "prisma", readOnly: true });
}

export async function PUT(request: Request) {
  const params = parseKeyParams(request);
  if (!params) {
    return NextResponse.json({ error: "saveId, seasonId, matchdayId and teamId are required." }, { status: 400 });
  }

  const body = (await request.json()) as { entries?: LegacyLineupEntryInput[]; modifiers?: LineupDraftModifiers };
  if (!Array.isArray(body.entries)) {
    return NextResponse.json({ error: "entries array is required." }, { status: 400 });
  }

  if (parseSource(request) !== "prisma") {
    const writeAuth = authorizeServerRoomWrite({
      ...parseRoomWriteContext(request),
      saveId: params.saveId,
      teamId: params.teamId,
      action: "lineup_save",
      source: "sqlite",
      dryRun: false,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json({ error: writeAuth.reason, warnings: writeAuth.warnings }, { status: writeAuth.status });
    }

    const result = saveLocalLegacyLineupDraft(params, body.entries, body.modifiers);
    if (!result.ok) {
      return NextResponse.json(
        {
          errors: result.errors,
          warnings: result.warnings,
        },
        { status: 422 },
      );
    }
    notifyRoomGameplayWrite(writeAuth, {
      saveId: params.saveId,
      teamId: params.teamId,
      action: "lineup_save",
      eventType: "lineup_updated",
      affectedViews: ["home", "lineup", "matchday"],
      dryRun: false,
      success: true,
    });

    return NextResponse.json({
      draft: result.draft,
      warnings: [...writeAuth.warnings, ...result.warnings],
      source: "sqlite",
      readOnly: false,
    });
  }

  return NextResponse.json(
    {
      error: "Prisma/Supabase mode is read-only in this build.",
    },
    { status: 409 },
  );
}
