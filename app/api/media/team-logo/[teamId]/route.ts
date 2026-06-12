import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getTeamLogoPathById } from "@/lib/data/mediaAssets";

const MIME_TYPE_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await context.params;
  const logoPath = getTeamLogoPathById(teamId);

  if (!logoPath) {
    return NextResponse.json({ error: "logo_not_found" }, { status: 404 });
  }

  try {
    const fileBuffer = await readFile(logoPath);
    const ext = path.extname(logoPath).toLocaleLowerCase();
    const mimeType = MIME_TYPE_BY_EXT[ext] ?? "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "logo_unreadable" }, { status: 404 });
  }
}
