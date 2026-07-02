export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  buildPlayerDirectorySlice,
  buildPlayerDirectorySliceFromPersisted,
} from "@/lib/foundation/player-directory-slice";
import { resolveSliceSave } from "@/lib/foundation/resolve-slice-save-context";
import { readSaveSliceHeadProjection } from "@/lib/persistence/save-projection-read";

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

    if (resolved.projectionOnly && resolved.persistedRecord) {
      const head = readSaveSliceHeadProjection(resolved.saveId);
      if (!head) {
        return NextResponse.json({ error: "Save head could not be resolved." }, { status: 404 });
      }

      const payload = buildPlayerDirectorySliceFromPersisted({
        saveId: resolved.saveId,
        seasonId: seasonId ?? resolved.seasonId ?? resolved.persistedRecord.seasonId,
        contentSignature: resolved.contentSignature ?? resolved.persistedRecord.contentSignature,
        persistedRecord: resolved.persistedRecord,
        seasonState: head.seasonState,
      });

      return NextResponse.json({ ...payload, warnings: ["projection_read"] });
    }

    if (!resolved.gameState) {
      return NextResponse.json({ error: "Save could not be materialized." }, { status: 500 });
    }

    const payload = buildPlayerDirectorySlice({
      gameState: resolved.gameState,
      saveId: resolved.saveId,
      seasonId: seasonId ?? resolved.gameState.season.id,
      contentSignature: contentSignature ?? null,
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Player directory slice could not be loaded.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
