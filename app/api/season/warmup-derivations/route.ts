export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { getSeasonDerivations } from "@/lib/foundation/get-season-derivations";
import { buildGameStateContentSignature } from "@/lib/foundation/season-derivations-signature";
import { withPersistedSeasonDerivations } from "@/lib/foundation/materialize-season-derivations";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { readPersistedSeasonDerivationsProjection } from "@/lib/persistence/save-projection-read";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saveId = searchParams.get("saveId")?.trim() || undefined;
    const materialize = searchParams.get("materialize")?.trim() === "1";

    const persistence = createPersistenceService();
    const resolvedSaveId =
      saveId ??
      persistence.getActiveSave()?.saveId ??
      persistence.bootstrapSingleplayerSave().save?.saveId;

    if (!resolvedSaveId) {
      return NextResponse.json({ error: "Save could not be resolved." }, { status: 404 });
    }

    const projection = readPersistedSeasonDerivationsProjection(resolvedSaveId);
    const save = persistence.getSaveById(resolvedSaveId);
    if (!save) {
      return NextResponse.json({ error: "Save could not be resolved." }, { status: 404 });
    }

    const seasonId = save.gameState.season.id;
    const contentSignature = buildGameStateContentSignature(save.gameState);
    const derivations = getSeasonDerivations({
      gameState: save.gameState,
      saveId: save.saveId,
      seasonId,
      contentSignature,
    });

    if (materialize) {
      persistence.saveSingleplayerState(
        save.saveId,
        withPersistedSeasonDerivations(save.gameState),
      );
    }

    const persisted = materialize
      ? (persistence.getSaveById(save.saveId)?.gameState.seasonState.persistedSeasonDerivations as
          | { marketValueByPlayerId?: Record<string, number> }
          | null
          | undefined)
      : (save.gameState.seasonState.persistedSeasonDerivations as
          | { marketValueByPlayerId?: Record<string, number> }
          | null
          | undefined);

    return NextResponse.json({
      ok: true,
      scope: {
        saveId: save.saveId,
        seasonId,
        contentSignature,
      },
      counts: {
        ratings: derivations.ratingsById.size,
        performances: derivations.performanceByPlayerId.size,
        ledgerEntries: derivations.ledger.pointEntries.length,
        marketValues: Object.keys(persisted?.marketValueByPlayerId ?? {}).length,
      },
      projection: projection
        ? {
            signatureMatches: projection.signatureMatches,
            persistedRatings: Object.keys(projection.persistedSeasonDerivations?.ratingsByPlayerId ?? {}).length,
          }
        : null,
      materialized: materialize,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Season derivations warmup failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
