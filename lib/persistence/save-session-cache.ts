import type { PersistedSaveGame } from "@/lib/persistence/types";

type SaveSessionCacheEntry = {
  updatedAt: string;
  contentSignature: string;
  save: PersistedSaveGame;
};

const saveSessionCache = new Map<string, SaveSessionCacheEntry>();
const MAX_SAVE_SESSION_CACHE_ENTRIES = 8;

function cacheSignatureForRow(input: { updated_at: string; content_signature?: string }) {
  return input.content_signature?.trim() || input.updated_at;
}

function trimSaveSessionCache() {
  while (saveSessionCache.size > MAX_SAVE_SESSION_CACHE_ENTRIES) {
    const oldestKey = saveSessionCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    saveSessionCache.delete(oldestKey);
  }
}

export function readSaveSessionCache(
  saveId: string,
  updatedAt: string,
  contentSignature: string,
): PersistedSaveGame | null {
  const entry = saveSessionCache.get(saveId);
  if (!entry) {
    return null;
  }

  if (entry.updatedAt !== updatedAt || entry.contentSignature !== contentSignature) {
    saveSessionCache.delete(saveId);
    return null;
  }

  return entry.save;
}

export function writeSaveSessionCache(save: PersistedSaveGame, contentSignature?: string | null) {
  saveSessionCache.set(save.saveId, {
    updatedAt: save.updatedAt,
    contentSignature: contentSignature?.trim() || save.updatedAt,
    save,
  });
  trimSaveSessionCache();
}

export function invalidateSaveSessionCache(saveId?: string) {
  if (!saveId) {
    saveSessionCache.clear();
    return;
  }

  saveSessionCache.delete(saveId);
}

export function buildSaveSessionCacheSignature(input: { updated_at: string; content_signature?: string }) {
  return cacheSignatureForRow(input);
}
