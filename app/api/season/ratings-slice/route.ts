export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { buildSeasonRatingsSlice } from "@/lib/foundation/season-ratings-slice";
import {
  resolveSliceSave,
  tryResolvePersistedRatingsSlice,
} from "@/lib/foundation/resolve-slice-save-context";
import { respondWithSliceEtag } from "@/lib/foundation/season-slice-http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saveId = searchParams.get("saveId")?.trim() || undefined;
    const seasonId = searchParams.get("seasonId")?.trim() || undefined;
    const contentSignature = searchParams.get("contentSignature")?.trim() || undefined;
    const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
    const playerIds = (searchParams.get("playerIds") ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (source !== "sqlite") {
      return NextResponse.json(
        {
          scope: null,
          ratingsByPlayerId: {},
          count: 0,
          warnings: ["ratings_slice_sqlite_only"],
          error: "Ratings slice is only available for local sqlite saves.",
        },
        { status: 501 },
      );
    }

    const persistedSlice = tryResolvePersistedRatingsSlice({
      saveId,
      seasonId,
      contentSignature,
      playerIds: playerIds.length > 0 ? playerIds : undefined,
    });
    if (persistedSlice) {
      return respondWithSliceEtag(request, {
        slice: "ratings-slice",
        saveId: persistedSlice.saveId,
        seasonId: persistedSlice.seasonId,
        contentSignature: persistedSlice.contentSignature,
        payload: {
          scope: {
            saveId: persistedSlice.saveId,
            seasonId: persistedSlice.seasonId,
            contentSignature: persistedSlice.contentSignature,
          },
          ratingsByPlayerId: persistedSlice.ratingsByPlayerId,
          count: Object.keys(persistedSlice.ratingsByPlayerId).length,
          warnings: ["projection_read"],
        },
      });
    }

    const resolved = resolveSliceSave({
      saveId,
      contentSignature,
      allowProjectionOnly: Boolean(contentSignature),
    });

    if (!resolved) {
      return NextResponse.json(
        {
          scope: null,
          ratingsByPlayerId: {},
          count: 0,
          warnings: ["save_not_found"],
          error: "Save could not be resolved.",
        },
        { status: 404 },
      );
    }

    if (!resolved.gameState) {
      return NextResponse.json(
        {
          scope: null,
          ratingsByPlayerId: {},
          count: 0,
          warnings: ["game_state_unavailable"],
          error: "Save could not be materialized.",
        },
        { status: 500 },
      );
    }

    const payload = buildSeasonRatingsSlice({
      gameState: resolved.gameState,
      saveId: resolved.saveId,
      seasonId: seasonId ?? resolved.gameState.season.id,
      contentSignature: contentSignature ?? null,
      playerIds: playerIds.length > 0 ? playerIds : undefined,
    });

    return respondWithSliceEtag(request, {
      slice: "ratings-slice",
      saveId: payload.scope.saveId,
      seasonId: payload.scope.seasonId,
      contentSignature: payload.scope.contentSignature,
      payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Season ratings slice could not be loaded.";
    return NextResponse.json(
      {
        scope: null,
        ratingsByPlayerId: {},
        count: 0,
        warnings: [],
        error: message,
      },
      { status: 500 },
    );
  }
}
