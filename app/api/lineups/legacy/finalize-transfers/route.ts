export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { ensureLocalLegacyFormCardsForSeason } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { mapSaveResolutionErrorToResponse } from "@/lib/persistence/save-resolution-response";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { parseRoomWriteContextFromRequest } from "@/lib/room/parse-room-write-context";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";

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

/**
 * "Transfers finalisieren" confirm endpoint (game-flow step `finalize_transfers`).
 *
 * This calls the EXISTING, unmodified `ensureLocalLegacyFormCardsForSeason`
 * (lib/lineups/legacy-lineup-local-service.ts) -- the same fixed positive/
 * negative-per-player form-card distribution the game already produces. That
 * function is idempotent: it only generates + persists the season's form-card
 * pool when no cards exist yet for that season, so calling this endpoint
 * again after transfers were already finalized is a safe no-op and never
 * re-distributes or replaces cards (unlike the destructive
 * `/api/lineups/legacy/form-cards` "regenerate" endpoint, which always
 * replaces the season's pool and is intentionally NOT used here).
 */
export async function POST(request: Request) {
  const params = parseKeyParams(request);
  if (!params) {
    return NextResponse.json({ error: "saveId, seasonId, matchdayId and teamId are required." }, { status: 400 });
  }

  const writeAuth = authorizeServerRoomWrite({
    ...parseRoomWriteContextFromRequest(request),
    saveId: params.saveId,
    teamId: params.teamId,
    /**
     * `formcards`, NICHT `formcards_season_regenerate`.
     *
     * Hier stand die Regenerier-Klasse — und die steht in `HOST_LEVEL_ACTIONS`
     * (`lib/room/server-authoritative-write-guard.ts`). Im Raum hiess das fuer jeden ausser dem
     * Host: 403 `host_only_action`. Befund F10 hat das schon nachgemessen, aber nur die MELDUNG
     * geradegezogen ("Transfers nicht finalisiert" statt stiller Schluck) — nicht die Sache. Der
     * Gast kam damit nie durch seinen `finalize_transfers`-Schritt, und weil dessen Bestaetigung
     * erst NACH einer erfolgreichen Antwort passiert (`acknowledgeFlowStep`, siehe
     * use-foundation-shell-router-body-scope.tsx), meldete er sich nie bereit. Der Host konnte
     * den Raum dann nicht weiterschalten (`canHostAdvance` verlangt alle Menschen bereit) — der
     * Spieltagszyklus stand.
     *
     * `formcards` ist die team-bezogene Klasse: `authorizeTeamWrite` prueft sie ueber den Besitz
     * des `teamId`, jeder also fuer seine eigenen Teams. Genau das ist hier gemeint.
     *
     * WAS DAS NICHT AUFWEICHT: der zerstoererische Regenerier-Weg
     * (`/api/lineups/legacy/form-cards`) behaelt `formcards_season_regenerate` und bleibt
     * host-only. Diese Route hier ist ausdruecklich der IDEMPOTENTE Weg — sie legt den
     * Formkarten-Pool der Saison nur an, wenn es noch keinen gibt, und ersetzt nie einen
     * bestehenden (siehe Kommentar oben). Wer von beiden zuerst drueckt, aendert das Ergebnis
     * nicht; der zweite Aufruf ist ein No-op.
     */
    action: "formcards",
    source: "sqlite",
    dryRun: false,
  });
  if (!writeAuth.allowed) {
    return NextResponse.json({ error: writeAuth.reason, warnings: writeAuth.warnings }, { status: writeAuth.status });
  }

  let result;
  try {
    result = ensureLocalLegacyFormCardsForSeason(params);
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
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

  notifyRoomGameplayWrite(writeAuth, {
    saveId: params.saveId,
    teamId: params.teamId,
    action: "formcards",
    eventType: "lineup_updated",
    affectedViews: ["home", "lineup", "matchday", "arena"],
    dryRun: false,
    success: true,
  });

  return NextResponse.json({
    summary: result,
    source: "sqlite",
    readOnly: false,
  });
}
