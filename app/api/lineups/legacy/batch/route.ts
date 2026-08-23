export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { ensureMatchdayResolveSnapshot } from "@/lib/foundation/matchday-resolve-snapshot";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { describeLineupCommitment } from "@/lib/lineups/matchday-lineup-lock";
import { saveLocalLegacyLineupDraftBatch } from "@/lib/lineups/legacy-lineup-local-service";
import type { LineupDraftModifiers } from "@/lib/data/olyDataTypes";
import type { LegacyLineupEntryInput } from "@/lib/lineups/legacy-lineup-types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { mapSaveResolutionErrorToResponse } from "@/lib/persistence/save-resolution-response";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { parseRoomWriteContextFromRequestAndBody } from "@/lib/room/parse-room-write-context";
import { authorizeServerRoomWrite, type ServerRoomWriteAuthorization } from "@/lib/room/server-authoritative-write-guard";
import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";

/**
 * SAMMEL-SPEICHERN FUER MENSCHEN — Stufe 2.1/2.5 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Befund B5).
 *
 * Ersetzt fuer n eigene Teams NICHT die Einzelroute (`app/api/lineups/legacy/route.ts` bleibt fuer
 * Altaufrufer/Einzelteam-Speichern unveraendert), sondern ergaenzt sie um EINEN Aufruf fuer den
 * ganzen Stapel: eine Besitzpruefung JE TEAM, EINE Sperr-Bestaetigung fuer alle Teams zusammen
 * (statt eines Dialogs je Team), und GENAU EIN Schreibvorgang
 * (`saveLocalLegacyLineupDraftBatch`) fuer alle Teams, die durchkommen. Ein Kaderproblem bei einem
 * Team blockiert die anderen nicht mehr — jedes Team bekommt sein eigenes Ergebnis in `results`.
 */

type BatchTeamInput = {
  teamId: string;
  entries: LegacyLineupEntryInput[];
  modifiers?: LineupDraftModifiers;
};

type BatchTeamResultResponse = {
  teamId: string;
  ok: boolean;
  draft?: unknown;
  errors: string[];
  warnings: string[];
};

function parseSource(request: Request) {
  return new URL(request.url).searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
}

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() ?? "";
  const seasonId = searchParams.get("seasonId")?.trim() ?? "";
  const matchdayId = searchParams.get("matchdayId")?.trim() ?? "";
  if (!saveId || !seasonId || !matchdayId) {
    return NextResponse.json({ error: "saveId, seasonId and matchdayId are required." }, { status: 400 });
  }

  if (parseSource(request) === "prisma") {
    return NextResponse.json({ error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    teams?: BatchTeamInput[];
    confirmLock?: boolean;
  };
  if (!Array.isArray(body.teams) || body.teams.length === 0) {
    return NextResponse.json({ error: "teams array is required and must not be empty." }, { status: 400 });
  }
  for (const team of body.teams) {
    if (!team || typeof team.teamId !== "string" || !team.teamId.trim() || !Array.isArray(team.entries)) {
      return NextResponse.json({ error: "each team entry requires teamId and an entries array." }, { status: 400 });
    }
  }

  const save = createPersistenceService().getSaveById(saveId);
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

  // Stufe 0.3 (Befund B2): Identitaet serverseitig aus der Sitzung, nie aus Query/Body — siehe
  // `route.ts` (Einzelweg) fuer denselben Kommentar.
  const activeOwnerId = await resolveAuthoritativeWriteOwnerId();
  const roomWriteContext = parseRoomWriteContextFromRequestAndBody(request, body as Record<string, unknown>);

  // Besitzpruefung JE TEAM (Stufe 2.1, Befund B5) — dieselbe Pruefung, die die Einzelroute pro
  // Anfrage macht (`authorizeServerRoomWrite`), hier einmal je Team im Stapel. Ein fremdes Team
  // faellt hier heraus und wird unten als abgelehntes Ergebnis gemeldet, ohne die eigenen Teams
  // zu beruehren.
  const authorizedTeams: BatchTeamInput[] = [];
  const rejectedResults: BatchTeamResultResponse[] = [];
  const writeAuthByTeamId = new Map<string, ServerRoomWriteAuthorization>();
  const collectedWarnings: string[] = [];
  for (const team of body.teams) {
    const writeAuth = authorizeServerRoomWrite({
      ...roomWriteContext,
      saveId,
      teamId: team.teamId,
      action: "lineup_save",
      source: "sqlite",
      dryRun: false,
      activeOwnerId,
    });
    writeAuthByTeamId.set(team.teamId, writeAuth);
    if (writeAuth.allowed) {
      authorizedTeams.push(team);
      collectedWarnings.push(...writeAuth.warnings);
    } else {
      rejectedResults.push({ teamId: team.teamId, ok: false, errors: [writeAuth.reason], warnings: writeAuth.warnings });
    }
  }

  if (authorizedTeams.length === 0) {
    return NextResponse.json(
      { results: rejectedResults, savedCount: 0, warnings: [], source: "sqlite", readOnly: false },
      { status: 403 },
    );
  }

  /**
   * EINE Sperr-Bestaetigung fuer den GANZEN Stapel (Stufe 2.5, Befund B5): die Einzelroute
   * erzwingt pro Team einen zweiten PUT (`confirmLock` fehlt beim ersten Aufruf → 409). Die
   * Sammel-Ansicht kennt vorher schon alle Commitments aller Teams (siehe
   * `describeLineupCommitment`) und zeigt EINEN Dialog fuer alle zusammen — der Aufruf hier
   * traegt `confirmLock` deshalb gleich im ersten (und einzigen) PUT. Fehlt es trotzdem, bleibt
   * der 409-Weg bestehen (fuer Client-Code, der genau wie beim Einzelweg erst nachfragt), nur
   * fuer den ganzen Stapel auf einmal statt einmal je Team.
   */
  if (!body.confirmLock) {
    const commitments = authorizedTeams.map((team) => ({
      teamId: team.teamId,
      commitment: describeLineupCommitment(team.entries, team.modifiers ?? null),
    }));
    return NextResponse.json(
      { error: "lineup_lock_confirmation_required", commitments, warnings: [], blockingReasons: [] },
      { status: 409 },
    );
  }

  let batchResult;
  try {
    batchResult = saveLocalLegacyLineupDraftBatch(
      authorizedTeams.map((team) => ({
        params: { saveId, seasonId, matchdayId, teamId: team.teamId },
        entries: team.entries,
        modifiers: team.modifiers,
      })),
      undefined,
      {
        lockMatchday: true,
        // Nur AUSSERHALB eines Raums zusaetzlich pruefen (Verteidigung in der Tiefe). IM Raum hat
        // `authorizeServerRoomWrite` oben bereits ueber Sitz-/Host-Regeln entschieden, die NICHT
        // der einfachen Solo-Owner-Gleichheit folgen — siehe Kommentar an
        // `authorizeBatchTeamOwnership` in legacy-lineup-local-service.ts.
        activeOwnerId: roomWriteContext.roomCode ? null : activeOwnerId,
      },
    );
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    const mapped = mapSaveResolutionErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }

  for (const result of batchResult.results) {
    if (!result.ok) continue;
    const writeAuth = writeAuthByTeamId.get(result.teamId);
    if (!writeAuth) continue;
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId: result.teamId,
      action: "lineup_save",
      eventType: "lineup_updated",
      affectedViews: ["home", "lineup", "matchday", "arena"],
      dryRun: false,
      success: true,
    });
  }

  // Siehe route.ts (Einzelweg) fuer die Begruendung beider Aufrufe: KI-Teams sofort nachziehen,
  // Ergebnis-Snapshot fuer die Arena vorbereiten. Ein Fehlschlag darf das Speichern nicht kippen —
  // deshalb beide bewusst geschluckt, genau wie im Einzelweg.
  if (batchResult.savedCount > 0) {
    try {
      applyAiLegacyLineupBatchLocally({
        saveId,
        seasonId,
        matchdayId,
        dryRun: false,
        includeWarningTeams: false,
        overwriteExisting: false,
      });
    } catch {
      // bewusst geschluckt, siehe oben
    }
    try {
      ensureMatchdayResolveSnapshot({ saveId, seasonId, matchdayId });
    } catch {
      // bewusst geschluckt, siehe oben
    }
  }

  const versionMeta = createPersistenceService().getSaveVersionMetadata(saveId);
  const results: BatchTeamResultResponse[] = [
    ...batchResult.results.map((entry) => ({
      teamId: entry.teamId,
      ok: entry.ok,
      draft: entry.draft ?? undefined,
      errors: entry.errors,
      warnings: entry.warnings,
    })),
    ...rejectedResults,
  ];

  return NextResponse.json({
    results,
    savedCount: batchResult.savedCount,
    saveVersion: versionMeta?.saveVersion ?? null,
    contentSignature: versionMeta?.contentSignature ?? null,
    warnings: Array.from(new Set([...phaseGate.warnings, ...collectedWarnings, ...batchResult.warnings])),
    source: "sqlite",
    readOnly: false,
  });
}
