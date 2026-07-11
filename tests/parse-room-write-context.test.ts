import { describe, expect, it } from "vitest";

import {
  describeRoomWriteError,
  isStaleSaveVersionError,
  mergeRoomWriteContext,
  parseRoomWriteContextFromBody,
  parseRoomWriteContextFromRequestAndBody,
  readRoomWriteErrorCode,
} from "@/lib/room/parse-room-write-context";

describe("parse room write context helpers", () => {
  it("detects stale save version errors", () => {
    expect(isStaleSaveVersionError({ code: "stale_save_version" })).toBe(true);
    expect(readRoomWriteErrorCode({ code: "forbidden_team_control" })).toBe("forbidden_team_control");
    expect(describeRoomWriteError({ code: "stale_save_version" })).toContain("veraltet");
  });

  it("prefers room context from JSON body over query params", () => {
    const request = new Request(
      "https://example.test/api/ai/market-plan-apply?roomCode=ROOM1&seatToken=query-token&saveId=save-1",
    );
    const merged = parseRoomWriteContextFromRequestAndBody(request, {
      roomCode: "ROOM2",
      seatToken: "body-token",
      participantId: "participant-1",
      userId: "user-1",
    });

    expect(merged.roomCode).toBe("ROOM2");
    expect(merged.seatToken).toBe("body-token");
    expect(merged.participantId).toBe("participant-1");
    expect(merged.userId).toBe("user-1");
  });

  it("falls back to query params when body omits room fields", () => {
    const merged = mergeRoomWriteContext(
      {
        roomCode: "ROOM1",
        participantId: "participant-query",
        seatToken: "query-token",
        userId: "user-query",
        activeManagerTeamId: null,
        activeOwnerId: null,
        controlMode: null,
      },
      parseRoomWriteContextFromBody({}),
    );

    expect(merged.roomCode).toBe("ROOM1");
    expect(merged.seatToken).toBe("query-token");
  });
});
