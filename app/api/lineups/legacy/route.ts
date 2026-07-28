export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { ensureMatchdayResolveSnapshot } from "@/lib/foundation/matchday-resolve-snapshot";
import {
  getLocalLegacyLineupDraft,
  saveLocalLegacyLineupDraft,
} from "@/lib/lineups/legacy-lineup-local-service";
import type { LineupDraftModifiers } from "@/lib/data/olyDataTypes";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { LegacyLineupService } from "@/lib/lineups/legacy-lineup-service";
import type { LegacyLineupEntryInput, LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { mapSaveResolutionErrorToResponse } from "@/lib/persistence/resolve-local-save";
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
    activeOwnerId: searchParams.get("activeOwnerId"),
    controlMode: searchParams.get("controlMode") as "human" | "ai" | "passive" | "manual" | null,
  };
}

export async function GET(request: Request) {
  const params = parseKeyParams(request);
  if (!params) {
    return NextResponse.json({ error: "saveId, seasonId, matchdayId and teamId are required." }, { status: 400 });
  }

  if (parseSource(request) !== "prisma") {
    try {
      const draft = getLocalLegacyLineupDraft(params);
      return NextResponse.json({ draft, source: "sqlite", readOnly: false });
    } catch (error) {
      const mapped = mapSaveResolutionErrorToResponse(error);
      if (mapped) return mapped;
      throw error;
    }
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
    const save = createPersistenceService().getSaveById(params.saveId);
    if (!save) {
      return NextResponse.json({ error: "save_not_found", warnings: [], blockingReasons: ["save_not_found"] }, { status: 404 });
    }
    const phaseGate = evaluateGamePhaseAction(save.gameState, "set_lineup");
    if (!phaseGate.allowed) {
      return NextResponse.json(
        {
          error: phaseGate.reason,
          warnings: phaseGate.warnings,
          blockingReasons: phaseGate.reason ? [phaseGate.reason] : [],
        },
        { status: 409 },
      );
    }

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

    let result;
    try {
      result = saveLocalLegacyLineupDraft(params, body.entries, body.modifiers);
    } catch (error) {
      const mapped = mapSaveResolutionErrorToResponse(error);
      if (mapped) return mapped;
      throw error;
    }
    if (!result.ok) {
      return NextResponse.json(
        {
          errors: result.errors,
          warnings: result.warnings,
        },
        { status: 422 },
      );
    }
    // Sobald der Spieler seine Aufstellung abgibt, geben die KI-Teams ihre auch ab.
    // Das muss VOR der Arena passieren: Die Buehne ist nicht mehr nur Vorschau, sie
    // zeigt genau das, was am Ende jeder Disziplin gebucht wird — und dafuer muessen
    // die Gegner-Aufstellungen feststehen. Frueher entstanden sie erst beim Abschluss,
    // die Vorschau eines frischen Spieltags rechnete also gegen ein halb leeres Feld.
    // `overwriteExisting: false` laesst bereits vorhandene Aufstellungen unangetastet;
    // der Aufruf ist damit idempotent und bei vollstaendigem Feld praktisch kostenlos.
    // Ein Fehlschlag darf das Speichern der eigenen Aufstellung nicht kippen — die
    // fehlenden KI-Aufstellungen holt der Ergebnis-Commit dann wie bisher nach.
    try {
      applyAiLegacyLineupBatchLocally({
        saveId: params.saveId,
        seasonId: params.seasonId,
        matchdayId: params.matchdayId,
        dryRun: false,
        includeWarningTeams: false,
        overwriteExisting: false,
      });
    } catch {
      // bewusst geschluckt, siehe oben
    }

    // Steht das Feld, wird der Spieltag hier EINMAL gerechnet und abgelegt. Ab da
    // lesen die Arena-Buehne und beide Disziplin-Buchungen aus demselben Ergebnis,
    // statt jeweils neu zu rechnen — nur so zeigt die Buehne exakt das, was gebucht
    // wird. Der Weg zur Arena fuehrt ohnehin ueber diesen Aufruf, die Rechnung laeuft
    // also dann, wenn der Spieler ohnehin gerade den Reiter wechselt.
    // Auch hier gilt: ein Fehlschlag kippt das Speichern nicht, es wird nur spaeter
    // live gerechnet wie vorher.
    try {
      ensureMatchdayResolveSnapshot({
        saveId: params.saveId,
        seasonId: params.seasonId,
        matchdayId: params.matchdayId,
      });
    } catch {
      // bewusst geschluckt, siehe oben
    }

    notifyRoomGameplayWrite(writeAuth, {
      saveId: params.saveId,
      teamId: params.teamId,
      action: "lineup_save",
      eventType: "lineup_updated",
      affectedViews: ["home", "lineup", "matchday", "arena"],
      dryRun: false,
      success: true,
    });

    const versionMeta = createPersistenceService().getSaveVersionMetadata(params.saveId);

    return NextResponse.json({
      draft: result.draft,
      saveVersion: versionMeta?.saveVersion ?? null,
      contentSignature: versionMeta?.contentSignature ?? null,
      warnings: [...phaseGate.warnings, ...writeAuth.warnings, ...result.warnings],
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
