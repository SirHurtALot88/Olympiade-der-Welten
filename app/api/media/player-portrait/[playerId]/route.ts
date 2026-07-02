import { NextResponse } from "next/server";

import { getPlayerPortraitPathById } from "@/lib/data/mediaAssets";
import { serveMediaAsset } from "@/lib/media/serveMediaAsset";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await context.params;
  const portraitPath = getPlayerPortraitPathById(playerId);

  if (!portraitPath) {
    return NextResponse.json({ error: "portrait_not_found" }, { status: 404 });
  }

  try {
    return await serveMediaAsset({
      request,
      kind: "player-portrait",
      assetId: playerId,
      sourcePath: portraitPath,
    });
  } catch {
    return NextResponse.json({ error: "portrait_unreadable" }, { status: 404 });
  }
}
