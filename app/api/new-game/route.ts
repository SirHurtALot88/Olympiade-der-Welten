export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  applyNewGameSetup,
  previewNewGameSetup,
  type NewGamePresetId,
} from "@/lib/game/new-game-setup-service";
import { isAuthEnabled } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";
import type { LeagueSetupTeamWarning } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";

type NewGameRequestBody = {
  presetId?: NewGamePresetId;
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

  const body = (await request.json()) as NewGameRequestBody;
  const input = normalizeBody(body);

  if (body.dryRun !== false) {
    return NextResponse.json({
      preview: previewNewGameSetup(input),
    });
  }

  try {
    // Per-user active-save scoping: with auth on, the new game becomes active for the acting
    // user only (their pointer), leaving the other player's active save untouched. Auth off ->
    // ownerId null -> unchanged global activate.
    const ownerId = isAuthEnabled() ? (await getSessionUser())?.ownerId ?? null : null;
    const persistence = createPersistenceService();
    const result = applyNewGameSetup(input, persistence, { ownerId });

    // Every team (the caller's own plus every AI/passive team) is created with an EMPTY roster —
    // matchdays cannot resolve until each team has a roster/lineup. Unlike the `fresh-season-1`
    // quick-action in app/api/singleplayer-state/route.ts, this route previously returned without
    // ever kicking off the whole-league AI draft, so a fresh save created through this "Neues Spiel
    // erstellen" wizard left every AI team permanently empty (no automatic or reachable trigger ever
    // populated them). Mirror the same detached background-draft pattern here: mark the save
    // "in_progress" now (the Foundation shell shows a "Liga wird erstellt…" gate and polls until
    // "ready" — see use-foundation-shell-router-body-scope.tsx) and run the whole-league draft
    // through the same ORGANIC engine (`/api/ai/picks-run`'s service) used everywhere else, so the
    // "new game" HTTP request itself still returns immediately instead of blocking ~40s+.
    const setupSaveId = result.save.saveId;
    const setupSeasonId = result.preview.seasonSetup.seasonId;
    const savedForDraft = persistence.getSaveById(setupSaveId);
    if (savedForDraft) {
      persistence.saveSingleplayerState(setupSaveId, {
        ...savedForDraft.gameState,
        seasonState: { ...savedForDraft.gameState.seasonState, leagueSetupStatus: "in_progress" },
      });
      void (async () => {
        try {
          const runResult = await runAiPicksExecutePreview(
            {
              source: "sqlite",
              saveId: setupSaveId,
              seasonId: setupSeasonId,
              dryRun: false,
              confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
              teamScope: "all",
              allowSetupAllTeams: true,
              draftSeed: `${setupSaveId}:${setupSeasonId}:setup`,
              yieldBetweenTeams: true,
              batchPersistence: true,
            },
            persistence,
          );
          const leagueSetupWarnings: LeagueSetupTeamWarning[] = runResult.teams
            .filter((team) => team.targetRosterMin != null && team.rosterAfter < team.targetRosterMin)
            .map((team) => ({
              teamId: team.teamId,
              teamName: team.teamName,
              rosterAfter: team.rosterAfter,
              targetMin: team.targetRosterMin ?? 0,
              status: team.blockingReasons.length > 0 ? "blocked" : "below_min",
            }));
          const filled = persistence.getSaveById(setupSaveId);
          if (filled) {
            persistence.saveSingleplayerState(setupSaveId, {
              ...filled.gameState,
              seasonState: { ...filled.gameState.seasonState, leagueSetupStatus: "ready", leagueSetupWarnings },
            });
          }
        } catch (error) {
          console.error("[new-game] background AI draft failed (retryable from Cockpit):", error);
          const errored = persistence.getSaveById(setupSaveId);
          if (errored) {
            persistence.saveSingleplayerState(setupSaveId, {
              ...errored.gameState,
              seasonState: { ...errored.gameState.seasonState, leagueSetupStatus: "failed" },
            });
          }
        }
      })();
    }

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "new_game_setup_failed",
      },
      { status: 409 },
    );
  }
}
