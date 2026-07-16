import type { TeamDetailDrawerData } from "@/lib/foundation/team-detail-drawer-types";

type TeamProfileCacheEntry = {
  contentSignature: string;
  data: TeamDetailDrawerData;
  storedAt: number;
};

const MAX_TEAM_PROFILE_ENTRIES = 24;

const teamProfileByKey = new Map<string, TeamProfileCacheEntry>();

export function buildTeamProfileSessionKey(saveId: string, seasonId: string, teamId: string) {
  return `${saveId}:${seasonId}:${teamId}`;
}

export function getCachedTeamProfileData(
  key: string,
  contentSignature: string,
): TeamDetailDrawerData | null {
  const entry = teamProfileByKey.get(key);
  if (!entry || entry.contentSignature !== contentSignature) {
    return null;
  }
  return entry.data;
}

export function setCachedTeamProfileData(
  key: string,
  contentSignature: string,
  data: TeamDetailDrawerData,
) {
  teamProfileByKey.set(key, {
    contentSignature,
    data,
    storedAt: Date.now(),
  });

  while (teamProfileByKey.size > MAX_TEAM_PROFILE_ENTRIES) {
    const oldestKey = teamProfileByKey.keys().next().value;
    if (oldestKey == null) {
      break;
    }
    teamProfileByKey.delete(oldestKey);
  }
}

export function invalidateTeamProfileSessionCache(input?: { saveId?: string; seasonId?: string }) {
  if (!input?.saveId && !input?.seasonId) {
    teamProfileByKey.clear();
    return;
  }

  for (const key of [...teamProfileByKey.keys()]) {
    const [saveId, seasonId] = key.split(":");
    if (input.saveId && saveId !== input.saveId) {
      continue;
    }
    if (input.seasonId && seasonId !== input.seasonId) {
      continue;
    }
    teamProfileByKey.delete(key);
  }
}
