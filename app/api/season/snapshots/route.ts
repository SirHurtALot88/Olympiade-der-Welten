export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import type { SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolveLocalPersistedSave } from "@/lib/persistence/resolve-local-save";
import { resolveSessionOwnerId } from "@/lib/auth/session";
import {
  readSeasonSnapshotsCache,
  writeSeasonSnapshotsCache,
} from "@/lib/season/season-snapshots-cache";

function buildSeasonSnapshotsCacheSignature(input: {
  saveId: string;
  updatedAt: string;
  contentSignature: string;
}) {
  return [input.saveId, input.updatedAt, input.contentSignature].join("|");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saveId = searchParams.get("saveId")?.trim() || undefined;
    const persistence = createPersistenceService();
    const ownerId = await resolveSessionOwnerId();
    const resolved = resolveLocalPersistedSave(persistence, saveId, ownerId);
    if (!resolved) {
      return NextResponse.json({ ok: false, error: "Save could not be resolved." }, { status: 404 });
    }
    const localSave = resolved.save;

    const versionMeta = persistence.getSaveVersionMetadata(localSave.saveId);
    const contentSignature =
      versionMeta?.contentSignature ??
      [
        versionMeta?.seasonId ?? localSave.gameState.season.id,
        versionMeta?.matchdayId ?? localSave.gameState.matchdayState.matchdayId,
        String(versionMeta?.saveVersion ?? localSave.gameState.saveVersion ?? 0),
        String(versionMeta?.lineupDraftCount ?? 0),
        String(versionMeta?.transferHistoryCount ?? localSave.gameState.transferHistory?.length ?? 0),
      ].join("|");

    const cacheKey = `${localSave.saveId}:season-snapshots`;
    const cacheSignature = buildSeasonSnapshotsCacheSignature({
      saveId: localSave.saveId,
      updatedAt: localSave.updatedAt,
      contentSignature,
    });

    const cached = readSeasonSnapshotsCache<SeasonSnapshotRecord[]>(cacheKey, cacheSignature);
    if (cached) {
      return NextResponse.json({
        ok: true,
        seasonSnapshots: cached,
        scope: {
          saveId: localSave.saveId,
          seasonId: localSave.gameState.season.id,
        },
        cache: { hit: true },
      });
    }

    const seasonSnapshots = localSave.gameState.seasonState.seasonSnapshots ?? [];
    writeSeasonSnapshotsCache(cacheKey, cacheSignature, seasonSnapshots);

    return NextResponse.json({
      ok: true,
      seasonSnapshots,
      scope: {
        saveId: localSave.saveId,
        seasonId: localSave.gameState.season.id,
      },
      cache: { hit: false },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Season snapshots could not be loaded.",
      },
      { status: 500 },
    );
  }
}
