import { describe, expect, it } from "vitest";

import {
  FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS,
  canFoundationLocalUserManageTeam,
  isFoundationLineupReadOnly,
  isFoundationTeamManagementLocked,
  resolveFoundationManageableTeamIds,
  resolveFoundationTeamCanManage,
} from "@/lib/foundation/foundation-admin-dev-flags";

describe("foundation admin dev flags", () => {
  it("unlocks team management when admin flag is active", () => {
    if (!FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS) {
      expect(resolveFoundationTeamCanManage(false)).toBe(false);
      expect(isFoundationTeamManagementLocked("H-R", ["M-M"])).toBe(true);
      return;
    }

    expect(resolveFoundationTeamCanManage(false)).toBe(true);
    expect(isFoundationTeamManagementLocked("H-R", ["M-M"])).toBe(false);
    expect(resolveFoundationManageableTeamIds(["H-R", "M-M", "A-A"], ["M-M"])).toEqual(["H-R", "M-M", "A-A"]);
    expect(canFoundationLocalUserManageTeam(false)).toBe(true);
    expect(
      isFoundationLineupReadOnly({
        source: "sqlite",
        sourceReadOnly: true,
        teamManagementLocked: true,
      }),
    ).toBe(false);
    expect(
      isFoundationLineupReadOnly({
        source: "prisma",
        sourceReadOnly: false,
        teamManagementLocked: false,
      }),
    ).toBe(true);
  });
});
