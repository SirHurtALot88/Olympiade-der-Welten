import path from "node:path";

import { NextResponse } from "next/server";

import { getStaticTeamLogoUrl, getTeamLogoPathById } from "@/lib/data/mediaAssets";
import { serveMediaAsset } from "@/lib/media/serveMediaAsset";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await context.params;
  // Prefer the repo-relative static index (public/team-logos/<id>.<ext>); fall
  // back to the legacy absolute-path map only when no static file is indexed.
  const staticUrl = getStaticTeamLogoUrl(teamId);
  const logoPath = staticUrl
    ? path.join(process.cwd(), "public", staticUrl)
    : getTeamLogoPathById(teamId);

  if (!logoPath) {
    return NextResponse.json({ error: "logo_not_found" }, { status: 404 });
  }

  try {
    return await serveMediaAsset({
      request,
      kind: "team-logo",
      assetId: teamId,
      sourcePath: logoPath,
    });
  } catch {
    return NextResponse.json({ error: "logo_unreadable" }, { status: 404 });
  }
}
