import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getPlayerPortraitPathById } from "@/lib/data/mediaAssets";

const MIME_TYPE_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

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
    const fileStat = await stat(portraitPath);
    const etag = `"portrait-${playerId}-${fileStat.size}-${Math.floor(fileStat.mtimeMs)}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          ETag: etag,
        },
      });
    }

    const fileBuffer = await readFile(portraitPath);
    const ext = path.extname(portraitPath).toLocaleLowerCase();
    const mimeType = MIME_TYPE_BY_EXT[ext] ?? "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(fileBuffer.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: etag,
      },
    });
  } catch {
    return NextResponse.json({ error: "portrait_unreadable" }, { status: 404 });
  }
}
