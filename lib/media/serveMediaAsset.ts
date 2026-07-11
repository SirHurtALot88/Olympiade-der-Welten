import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import sharp from "sharp";

import {
  getMediaVariantMaxSize,
  getMediaVariantQuality,
  isResizedMediaVariant,
  MEDIA_THUMB_FORMAT,
  parseMediaImageVariant,
  type MediaImageVariant,
} from "@/lib/media/mediaThumbnailConfig";

const MIME_TYPE_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function getVariantCachePath(kind: string, assetId: string, variant: MediaImageVariant, mtimeMs: number) {
  const cacheRoot = path.join(process.cwd(), ".cache", "media-thumbs", kind);
  return path.join(cacheRoot, `${assetId}-${variant}-${Math.floor(mtimeMs)}.${MEDIA_THUMB_FORMAT}`);
}

async function readOrCreateVariantBuffer(sourcePath: string, cachePath: string, variant: MediaImageVariant) {
  try {
    return await readFile(cachePath);
  } catch {
    const maxSize = getMediaVariantMaxSize(variant);
    if (!maxSize) {
      throw new Error(`variant_not_resizable:${variant}`);
    }

    const sourceBuffer = await readFile(sourcePath);
    const variantBuffer = await sharp(sourceBuffer)
      .resize(maxSize, maxSize, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: getMediaVariantQuality(variant) })
      .toBuffer();

    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, variantBuffer);
    return variantBuffer;
  }
}

export async function serveMediaAsset(options: {
  request: Request;
  kind: "team-logo" | "player-portrait";
  assetId: string;
  sourcePath: string;
}) {
  const variant: MediaImageVariant = parseMediaImageVariant(options.request);
  const fileStat = await stat(options.sourcePath);
  const mtimeToken = Math.floor(fileStat.mtimeMs);

  if (isResizedMediaVariant(variant)) {
    const cachePath = getVariantCachePath(options.kind, options.assetId, variant, fileStat.mtimeMs);
    const etag = `"${options.kind}-${variant}-${options.assetId}-${fileStat.size}-${mtimeToken}"`;

    if (options.request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          ETag: etag,
        },
      });
    }

    const variantBuffer = await readOrCreateVariantBuffer(options.sourcePath, cachePath, variant);

    return new NextResponse(new Uint8Array(variantBuffer), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(variantBuffer.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: etag,
      },
    });
  }

  const etag = `"${options.kind}-${options.assetId}-${fileStat.size}-${mtimeToken}"`;
  if (options.request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: etag,
      },
    });
  }

  const fileBuffer = await readFile(options.sourcePath);
  const ext = path.extname(options.sourcePath).toLocaleLowerCase();
  const mimeType = MIME_TYPE_BY_EXT[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(fileBuffer.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag,
    },
  });
}
