import path from "node:path";

import { NextResponse } from "next/server";

import { getPlayerPortraitPathById, getStaticPortraitUrl } from "@/lib/data/mediaAssets";
import { serveMediaAsset } from "@/lib/media/serveMediaAsset";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await context.params;
  // Prefer the repo-relative static index (public/portraits/…); fall back to
  // the legacy absolute-path map only when no static file is indexed.
  const staticUrl = getStaticPortraitUrl(playerId);
  const portraitPath = staticUrl
    ? path.join(process.cwd(), "public", staticUrl)
    : getPlayerPortraitPathById(playerId);

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
