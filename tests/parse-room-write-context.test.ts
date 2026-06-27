import { describe, expect, it } from "vitest";

import {
  describeRoomWriteError,
  isStaleSaveVersionError,
  readRoomWriteErrorCode,
} from "@/lib/room/parse-room-write-context";

describe("parse room write context helpers", () => {
  it("detects stale save version errors", () => {
    expect(isStaleSaveVersionError({ code: "stale_save_version" })).toBe(true);
    expect(readRoomWriteErrorCode({ code: "forbidden_team_control" })).toBe("forbidden_team_control");
    expect(describeRoomWriteError({ code: "stale_save_version" })).toContain("veraltet");
  });
});
