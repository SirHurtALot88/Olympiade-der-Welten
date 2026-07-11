export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { buildTeamOverviewSlice } from "@/lib/foundation/team-overview-slice";
import { resolveSliceSave } from "@/lib/foundation/resolve-slice-save-context";
import { respondWithSliceEtag } from "@/lib/foundation/season-slice-http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saveId = searchParams.get("saveId")?.trim() || undefined;
    const seasonId = searchParams.get("seasonId")?.trim() || undefined;
    const contentSignature = searchParams.get("contentSignature")?.trim() || undefined;

    const resolved = resolveSliceSave({
      saveId,
      contentSignature,
      allowProjectionOnly: Boolean(contentSignature),
    });

    if (!resolved) {
      return NextResponse.json({ error: "Save could not be resolved." }, { status: 404 });
    }

    if (!resolved.gameState) {
      return NextResponse.json({ error: "Save could not be materialized." }, { status: 500 });
    }

    const payload = buildTeamOverviewSlice({
      gameState: resolved.gameState,
      saveId: resolved.saveId,
      seasonId: seasonId ?? resolved.gameState.season.id,
      contentSignature: contentSignature ?? resolved.contentSignature ?? null,
    });
    const responsePayload = resolved.projectionOnly
      ? { ...payload, warnings: ["projection_read"] as string[] }
      : payload;

    return respondWithSliceEtag(request, {
      slice: "team-overview-slice",
      saveId: payload.scope.saveId,
      seasonId: payload.scope.seasonId,
      contentSignature: payload.scope.contentSignature,
      payload: responsePayload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Team overview slice could not be loaded.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
