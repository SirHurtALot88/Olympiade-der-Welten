export type MediaImageVariant = "default" | "thumb" | "preview" | "full";

export const MEDIA_THUMB_MAX_SIZE = 64;
export const MEDIA_PREVIEW_MAX_SIZE = 160;
export const MEDIA_THUMB_QUALITY = 75;
export const MEDIA_PREVIEW_QUALITY = 80;
export const MEDIA_THUMB_FORMAT = "webp" as const;

export function parseMediaImageVariant(request: Request): MediaImageVariant {
  const variant = new URL(request.url).searchParams.get("variant");
  if (variant === "thumb") {
    return "thumb";
  }
  if (variant === "preview") {
    return "preview";
  }
  return "default";
}

export function resolvePortraitVariantForDisplayPx(displayPx: number): Exclude<MediaImageVariant, "default" | "full"> {
  if (displayPx <= 72) {
    return "thumb";
  }
  return "preview";
}

export function appendMediaImageVariant(url: string | null, variant: MediaImageVariant): string | null {
  if (!url || variant === "default" || variant === "full") {
    return url;
  }

  if (!url.startsWith("/api/media/")) {
    return url;
  }

  const parsed = new URL(url, "http://local");
  parsed.searchParams.set("variant", variant);
  return `${parsed.pathname}${parsed.search}`;
}

export function getMediaVariantMaxSize(variant: MediaImageVariant) {
  if (variant === "thumb") {
    return MEDIA_THUMB_MAX_SIZE;
  }
  if (variant === "preview") {
    return MEDIA_PREVIEW_MAX_SIZE;
  }
  return null;
}

export function getMediaVariantQuality(variant: MediaImageVariant) {
  if (variant === "preview") {
    return MEDIA_PREVIEW_QUALITY;
  }
  return MEDIA_THUMB_QUALITY;
}

export function isResizedMediaVariant(variant: MediaImageVariant) {
  return variant === "thumb" || variant === "preview";
}
