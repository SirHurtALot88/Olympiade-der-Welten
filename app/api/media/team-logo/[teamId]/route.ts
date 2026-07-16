import { NextResponse } from "next/server";

import { getTeamLogoPathById } from "@/lib/data/mediaAssets";
import { serveMediaAsset } from "@/lib/media/serveMediaAsset";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await context.params;
  const logoPath = getTeamLogoPathById(teamId);

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
