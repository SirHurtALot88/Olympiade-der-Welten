/**
 * Temporary admin/dev bypass for Foundation team-management scope.
 * Set FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS to false before production release.
 */
export const FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS = true;

export function resolveFoundationTeamCanManage(canManage: boolean): boolean {
  return FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS || canManage;
}

export function isFoundationTeamManagementLocked(
  teamId: string | null | undefined,
  manageableTeamIds: string[] | null | undefined,
): boolean {
  if (FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS) {
    return false;
  }
  return Boolean(
    teamId &&
      manageableTeamIds &&
      manageableTeamIds.length > 0 &&
      !manageableTeamIds.includes(teamId),
  );
}

export function resolveFoundationManageableTeamIds(
  allTeamIds: string[],
  scopedTeamIds: string[],
): string[] {
  if (FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS) {
    return allTeamIds;
  }
  return scopedTeamIds;
}

export function isFoundationLineupReadOnly(input: {
  source: string;
  sourceReadOnly: boolean;
  teamManagementLocked: boolean;
}): boolean {
  if (input.source === "prisma") {
    return true;
  }
  if (FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS) {
    return false;
  }
  return input.sourceReadOnly || input.teamManagementLocked;
}

export function canFoundationLocalUserManageTeam(canManage: boolean): boolean {
  return FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS || canManage;
}
