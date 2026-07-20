import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
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

// Portrait/logo maps store absolute paths captured on the original macOS machine
// (under the user's Dropbox). On other machines (e.g. Windows) set
// OLY_MEDIA_DROPBOX_ROOT to the local Dropbox root so those Mac paths resolve to
// the local copy. When unset (the macOS original), paths are used unchanged.
const MAC_DROPBOX_PREFIX = "/Users/chrisfalk/Library/CloudStorage/Dropbox/";

function resolveMediaSourcePath(sourcePath: string): string {
  const root = process.env.OLY_MEDIA_DROPBOX_ROOT?.trim();
  if (root && sourcePath.startsWith(MAC_DROPBOX_PREFIX)) {
    return path.join(root, sourcePath.slice(MAC_DROPBOX_PREFIX.length));
  }
  return sourcePath;
}

// The absolute paths in the media maps were captured on macOS (case-insensitive
// filesystem). On a case-sensitive Linux host (e.g. the Hetzner deploy) a single
// segment whose case differs — e.g. a folder synced as "logos" instead of
// "Logos" — makes stat() fail and the UI silently falls back to initials. When
// the exact path is missing, walk it segment by segment and match each directory
// entry case-insensitively so a case drift on the server still resolves.
async function resolveExistingPathCaseInsensitive(candidate: string): Promise<string | null> {
  try {
    await stat(candidate);
    return candidate;
  } catch {
    // fall through to case-insensitive walk
  }

  if (!path.isAbsolute(candidate)) {
    return null;
  }

  const segments = candidate.split(path.sep).filter((segment) => segment.length > 0);
  let resolved: string = path.sep;

  for (const segment of segments) {
    const exact = path.join(resolved, segment);
    try {
      await stat(exact);
      resolved = exact;
      continue;
    } catch {
      // segment not present with this exact case — scan the directory
    }

    let entries: string[];
    try {
      entries = await readdir(resolved);
    } catch {
      return null;
    }

    const lower = segment.toLowerCase();
    const match = entries.find((entry) => entry.toLowerCase() === lower);
    if (!match) {
      return null;
    }
    resolved = path.join(resolved, match);
  }

  return resolved;
}

async function statMediaSource(sourcePath: string) {
  const resolvedPath = await resolveExistingPathCaseInsensitive(sourcePath);
  if (!resolvedPath) {
    // Preserve the original ENOENT semantics for the caller's catch block.
    return { path: sourcePath, stat: await stat(sourcePath) };
  }
  return { path: resolvedPath, stat: await stat(resolvedPath) };
}

function getVariantCachePath(kind: string, assetId: string, variant: MediaImageVariant, mtimeMs: number) {
  const cacheRoot = path.join(process.cwd(), ".cache", "media-thumbs", kind);
  return path.join(cacheRoot, `${assetId}-${variant}-${Math.floor(mtimeMs)}.${MEDIA_THUMB_FORMAT}`);
}

type VariantResult = { buffer: Buffer; contentType: string };

async function readOrCreateVariantBuffer(
  sourcePath: string,
  cachePath: string,
  variant: MediaImageVariant,
): Promise<VariantResult> {
  try {
    return { buffer: await readFile(cachePath), contentType: "image/webp" };
  } catch {
    const maxSize = getMediaVariantMaxSize(variant);
    if (!maxSize) {
      throw new Error(`variant_not_resizable:${variant}`);
    }

    const sourceBuffer = await readFile(sourcePath);

    try {
      // failOn: "none" makes sharp tolerant of slightly truncated / non-standard
      // JPEGs (progressive quirks, trailing garbage) that browsers render fine
      // but sharp's default strict mode would reject.
      const variantBuffer = await sharp(sourceBuffer, { failOn: "none" })
        .resize(maxSize, maxSize, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: getMediaVariantQuality(variant) })
        .toBuffer();

      await mkdir(path.dirname(cachePath), { recursive: true });
      await writeFile(cachePath, variantBuffer);
      return { buffer: variantBuffer, contentType: "image/webp" };
    } catch {
      // Last resort: sharp cannot decode the image at all. Serve the original
      // bytes unresized so the browser can still display it instead of the
      // route returning an "unreadable" error and the UI falling back to initials.
      const ext = path.extname(sourcePath).toLocaleLowerCase();
      const contentType = MIME_TYPE_BY_EXT[ext] ?? "application/octet-stream";
      return { buffer: sourceBuffer, contentType };
    }
  }
}

export async function serveMediaAsset(options: {
  request: Request;
  kind: "team-logo" | "player-portrait";
  assetId: string;
  sourcePath: string;
}) {
  const variant: MediaImageVariant = parseMediaImageVariant(options.request);
  const requestedPath = resolveMediaSourcePath(options.sourcePath);
  const { path: sourcePath, stat: fileStat } = await statMediaSource(requestedPath);
  const mtimeToken = Math.floor(fileStat.mtimeMs);

  if (isResizedMediaVariant(variant)) {
    const cachePath = getVariantCachePath(options.kind, options.assetId, variant, fileStat.mtimeMs);
    const etag = `"${options.kind}-${variant}-${options.assetId}-${fileStat.size}-${mtimeToken}"`;

    if (options.request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": "public, max-age=0, must-revalidate",
          ETag: etag,
        },
      });
    }

    const variantResult = await readOrCreateVariantBuffer(sourcePath, cachePath, variant);

    return new NextResponse(new Uint8Array(variantResult.buffer), {
      headers: {
        "Content-Type": variantResult.contentType,
        "Content-Length": String(variantResult.buffer.byteLength),
        "Cache-Control": "public, max-age=0, must-revalidate",
        ETag: etag,
      },
    });
  }

  const etag = `"${options.kind}-${options.assetId}-${fileStat.size}-${mtimeToken}"`;
  if (options.request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        ETag: etag,
      },
    });
  }

  const fileBuffer = await readFile(sourcePath);
  const ext = path.extname(sourcePath).toLocaleLowerCase();
  const mimeType = MIME_TYPE_BY_EXT[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(fileBuffer.byteLength),
      "Cache-Control": "public, max-age=0, must-revalidate",
      ETag: etag,
    },
  });
}
