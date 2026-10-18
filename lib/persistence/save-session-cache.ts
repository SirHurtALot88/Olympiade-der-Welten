import type { PersistedSaveGame } from "@/lib/persistence/types";

type SaveSessionCacheEntry = {
  updatedAt: string;
  contentSignature: string;
  save: PersistedSaveGame;
  approxBytes: number;
};

const saveSessionCache = new Map<string, SaveSessionCacheEntry>();
const DEFAULT_MAX_SAVE_SESSION_CACHE_ENTRIES = 8;
// Finding #177: der Eintrags-Deckel allein begrenzt nur die ANZAHL, nicht die GROESSE. Ein voll
// materialisierter 32-Team-Battle-Save (materializePersistedSave(), jeder Spieler/Team/Roster/
// Vertrag/Transferhistorie/Spielprotokoll) ist 800-900MB gross — acht davon waeren ein
// Mehrfaches dessen, was der lange laufende oly-app-Produktionscontainer verkraften soll. Der
// Byte-Deckel greift deshalb ZUSAETZLICH zum Eintrags-Deckel: faellt er unter 8 Eintraege, ist
// er der erste Riegel; haelt der Prozess viele verschiedene GROSSE Saves warm, greift er vor dem
// Eintrags-Deckel.
const DEFAULT_MAX_SAVE_SESSION_CACHE_BYTES = 2_000_000_000;

let maxSaveSessionCacheEntries = DEFAULT_MAX_SAVE_SESSION_CACHE_ENTRIES;
let maxSaveSessionCacheBytes = DEFAULT_MAX_SAVE_SESSION_CACHE_BYTES;
let totalApproxBytes = 0;

function cacheSignatureForRow(input: { updated_at: string; content_signature?: string }) {
  return input.content_signature?.trim() || input.updated_at;
}

/**
 * Grobe Byte-Schaetzung ueber JSON.stringify — `PersistedSaveGame` ist eine reine Datenstruktur
 * (keine Map/Set/Funktionen), `stringify` erfasst sie also vollstaendig und ist genau genug fuer
 * eine Eviction-Entscheidung. Bewusst NICHT byte-exakt (UTF-16 vs. UTF-8, Objekt-Overhead) —
 * das Ziel ist ein Deckel, keine exakte Speicherbuchhaltung.
 */
function estimateApproxBytes(save: PersistedSaveGame): number {
  try {
    return JSON.stringify(save).length;
  } catch {
    return 0;
  }
}

function trimSaveSessionCache() {
  while (
    saveSessionCache.size > 0 &&
    (saveSessionCache.size > maxSaveSessionCacheEntries || totalApproxBytes > maxSaveSessionCacheBytes)
  ) {
    const oldestKey = saveSessionCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    const oldestEntry = saveSessionCache.get(oldestKey);
    if (oldestEntry) {
      totalApproxBytes -= oldestEntry.approxBytes;
    }
    saveSessionCache.delete(oldestKey);
  }
  if (saveSessionCache.size === 0) {
    totalApproxBytes = 0;
  }
}

export function setSaveSessionCacheMaxEntries(maxEntries: number) {
  maxSaveSessionCacheEntries = Math.max(1, Math.round(maxEntries));
  trimSaveSessionCache();
}

export function getSaveSessionCacheMaxEntries() {
  return maxSaveSessionCacheEntries;
}

export function setSaveSessionCacheMaxBytes(maxBytes: number) {
  maxSaveSessionCacheBytes = Math.max(1, Math.round(maxBytes));
  trimSaveSessionCache();
}

export function getSaveSessionCacheMaxBytes() {
  return maxSaveSessionCacheBytes;
}

export function saveSessionCacheSizeForTests() {
  return saveSessionCache.size;
}

export function saveSessionCacheApproxBytesForTests() {
  return totalApproxBytes;
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
    totalApproxBytes -= entry.approxBytes;
    saveSessionCache.delete(saveId);
    return null;
  }

  return entry.save;
}

export function writeSaveSessionCache(save: PersistedSaveGame, contentSignature?: string | null) {
  const existing = saveSessionCache.get(save.saveId);
  if (existing) {
    totalApproxBytes -= existing.approxBytes;
  }
  const approxBytes = estimateApproxBytes(save);
  saveSessionCache.set(save.saveId, {
    updatedAt: save.updatedAt,
    contentSignature: contentSignature?.trim() || save.updatedAt,
    save,
    approxBytes,
  });
  totalApproxBytes += approxBytes;
  trimSaveSessionCache();
}

export function invalidateSaveSessionCache(saveId?: string) {
  if (!saveId) {
    saveSessionCache.clear();
    totalApproxBytes = 0;
    return;
  }

  const existing = saveSessionCache.get(saveId);
  if (existing) {
    totalApproxBytes -= existing.approxBytes;
  }
  saveSessionCache.delete(saveId);
}

export function buildSaveSessionCacheSignature(input: { updated_at: string; content_signature?: string }) {
  return cacheSignatureForRow(input);
}
