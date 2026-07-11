import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";

type PlayerProfileCacheEntry = {
  contentSignature: string;
  data: PlayerDetailDrawerData;
  storedAt: number;
};

const MAX_PLAYER_PROFILE_ENTRIES = 24;

const playerProfileByKey = new Map<string, PlayerProfileCacheEntry>();

export function buildPlayerProfileSessionKey(saveId: string, seasonId: string, playerId: string) {
  return `${saveId}:${seasonId}:${playerId}`;
}

export function getCachedPlayerProfileData(
  key: string,
  contentSignature: string,
): PlayerDetailDrawerData | null {
  const entry = playerProfileByKey.get(key);
  if (!entry || entry.contentSignature !== contentSignature) {
    return null;
  }
  return entry.data;
}

export function setCachedPlayerProfileData(
  key: string,
  contentSignature: string,
  data: PlayerDetailDrawerData,
) {
  playerProfileByKey.set(key, {
    contentSignature,
    data,
    storedAt: Date.now(),
  });

  while (playerProfileByKey.size > MAX_PLAYER_PROFILE_ENTRIES) {
    const oldestKey = playerProfileByKey.keys().next().value;
    if (oldestKey == null) {
      break;
    }
    playerProfileByKey.delete(oldestKey);
  }
}

export function invalidatePlayerProfileSessionCache(input?: { saveId?: string; seasonId?: string }) {
  if (!input?.saveId && !input?.seasonId) {
    playerProfileByKey.clear();
    return;
  }

  for (const key of [...playerProfileByKey.keys()]) {
    const [saveId, seasonId] = key.split(":");
    if (input.saveId && saveId !== input.saveId) {
      continue;
    }
    if (input.seasonId && seasonId !== input.seasonId) {
      continue;
    }
    playerProfileByKey.delete(key);
  }
}
