export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  applyNewGameSetup,
  previewNewGameSetup,
  type NewGamePresetId,
} from "@/lib/game/new-game-setup-service";

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
    return NextResponse.json({
      result: applyNewGameSetup(input),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "new_game_setup_failed",
      },
      { status: 409 },
    );
  }
}
