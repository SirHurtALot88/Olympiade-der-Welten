export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  applyNewGameSetup,
  previewNewGameSetup,
  type NewGamePresetId,
} from "@/lib/game/new-game-setup-service";
import type { GameMode } from "@/lib/data/olyDataTypes";
import { isAuthEnabled } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { kickoffLeagueSetupDraft } from "@/lib/game/league-setup-draft-service";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";

type NewGameRequestBody = {
  presetId?: NewGamePresetId;
  // Battle-Mode-Spielmodus-Wahl (docs/design/battle-mode-spielmodus-plan.md, Abschnitt 2.3).
  // Kommt seit PR 4 aus dem Kachel-Umschalter oben im Anlege-Assistenten
  // (`data-testid="new-game-mode-picker"`), Default "manager".
  gameMode?: GameMode;
  chrisTeamIds?: string[];
  frankyTeamIds?: string[];
  sandbox?: boolean;
  saveName?: string;
  dryRun?: boolean;
  confirmToken?: string | null;
};

function normalizeBody(body: NewGameRequestBody) {
  return {
    presetId: body.presetId ?? "solo_1",
    // Default "manager", nicht `undefined`, damit Preview und Create garantiert denselben Wert
    // sehen -- derselbe Grund, aus dem `presetId` hier schon einen Default bekommt.
    gameMode: body.gameMode === "battle" ? "battle" : ("manager" as GameMode),
    chrisTeamIds: body.chrisTeamIds,
    frankyTeamIds: body.frankyTeamIds,
    sandbox: Boolean(body.sandbox),
    saveName: body.saveName,
    confirmToken: body.confirmToken,
  };
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source")?.trim();
  if (source === "prisma") {
    return NextResponse.json(
      {
        error: "Prisma/Supabase mode is read-only for New Game setup.",
      },
      { status: 409 },
    );
  }

  // Parse + preview live INSIDE the try below. They used to run unguarded here, so a malformed
  // body (`request.json()` throwing) or any error inside `previewNewGameSetup` escaped as an
  // uncaught 500 — Next then answers with an HTML error page, `response.json()` on the client
  // throws, and the only thing the user ever saw was the opaque
  // "New-Game-Setup konnte nicht geladen werden." catch-all. Wrapping them means the real reason
  // reaches the UI as a proper JSON `error` string instead.
  try {
    let body: NewGameRequestBody;
    try {
      body = (await request.json()) as NewGameRequestBody;
    } catch {
      return NextResponse.json({ error: "Ungültiger Anfrage-Body (kein JSON)." }, { status: 400 });
    }
    const input = normalizeBody(body);

    if (body.dryRun !== false) {
      return NextResponse.json({
        preview: previewNewGameSetup(input),
      });
    }

    // Per-user active-save scoping: with auth on, the new game becomes active for the acting
    // user only (their pointer), leaving the other player's active save untouched. Auth off ->
    // ownerId null -> unchanged global activate.
    const ownerId = isAuthEnabled() ? (await getSessionUser())?.ownerId ?? null : null;
    const persistence = createPersistenceService();
    const result = applyNewGameSetup(input, persistence, { ownerId });

    // Every team (the caller's own plus every AI/passive team) is created with an EMPTY roster —
    // matchdays cannot resolve until each team has a roster/lineup. Runs through the SHARED
    // league-setup-draft-service (also used by the `fresh-season-1` quick-action in
    // app/api/singleplayer-state/route.ts and by `startRoom` in lib/room/room-store.ts) — same
    // detached background draft, same "in_progress"/"ready"/"failed" status contract.
    const setupSaveId = result.save.saveId;
    const setupSeasonId = result.preview.seasonSetup.seasonId;
    // Exclude every HUMAN team from the draft. Unlike the `fresh-season-1` quick-action (which has
    // no human team, so its whole-league draft is harmless), the "Neues Spiel" wizard hands one or
    // more teams to Chris/Franky (controlMode "manual", humanControlled true) — those players draft
    // their own squad, so their team ids must never reach `runAiPicksExecutePreview`.
    const humanTeamIds = [...result.preview.chrisTeamIds, ...result.preview.frankyTeamIds];
    kickoffLeagueSetupDraft({
      persistence,
      saveId: setupSaveId,
      seasonId: setupSeasonId,
      excludeTeamIds: humanTeamIds,
      logPrefix: "[new-game]",
    });

    return NextResponse.json({ result });
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "new_game_setup_failed",
      },
      { status: 409 },
    );
  }
}
