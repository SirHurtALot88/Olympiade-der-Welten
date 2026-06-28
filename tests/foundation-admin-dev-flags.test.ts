import { describe, expect, it } from "vitest";

import {
  FOUNDATION_ADMIN_UNLOCK_ALL_TEAMS,
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
  });
});
