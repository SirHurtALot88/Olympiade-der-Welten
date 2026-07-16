import { describe, expect, it } from "vitest";

import {
  appendFoundationRoomParamsToSearchParams,
  buildFoundationHref,
  buildFoundationSearchParams,
  readFoundationRoomParamsFromSearchParams,
  type FoundationUrlState,
} from "@/lib/foundation/foundation-navigation-history";

const ROOM_PARAMS = {
  roomCode: "ABCD",
  participantId: "participant-chris",
  userId: "user-chris",
  seatToken: "seat-token-chris",
  saveId: "save-room-1",
};

const BASE_STATE: FoundationUrlState = {
  view: "homeV2",
  tab: null,
  playerId: null,
  team: "A-A",
  panel: null,
  facilityId: null,
  facilityAction: null,
};

describe("foundation room url persistence", () => {
  it("reads room params from search params", () => {
    const source = new URLSearchParams({
      roomCode: "abcd",
      participantId: "p1",
      userId: "u1",
      seatToken: "st1",
      saveId: "s1",
    });

    expect(readFoundationRoomParamsFromSearchParams(source)).toEqual({
      roomCode: "ABCD",
      participantId: "p1",
      userId: "u1",
      seatToken: "st1",
      saveId: "s1",
    });
  });

  it("preserves room params when navigating home to lineup to arena", () => {
    const entryUrl = new URLSearchParams({
      view: "homeV2",
      team: "A-A",
      ...ROOM_PARAMS,
    });

    const homeHref = buildFoundationHref(BASE_STATE, "/foundation", { preserveRoomParamsFrom: entryUrl });
    expect(homeHref).toContain("roomCode=ABCD");
    expect(homeHref).toContain("seatToken=seat-token-chris");

    const lineupState: FoundationUrlState = { ...BASE_STATE, view: "lineup" };
    const lineupHref = buildFoundationHref(lineupState, "/foundation", { preserveRoomParamsFrom: entryUrl });
    expect(lineupHref).toContain("view=lineup");
    expect(lineupHref).toContain("roomCode=ABCD");
    expect(lineupHref).toContain("participantId=participant-chris");

    const arenaState: FoundationUrlState = { ...BASE_STATE, view: "matchdayArena" };
    const arenaHref = buildFoundationHref(arenaState, "/foundation", { preserveRoomParamsFrom: entryUrl });
    expect(arenaHref).toContain("view=matchdayArena");
    expect(arenaHref).toContain("saveId=save-room-1");
  });

  it("does not inject room params when source url has none", () => {
    const soloUrl = new URLSearchParams({ view: "homeV2", team: "A-A" });
    const href = buildFoundationHref(BASE_STATE, "/foundation", { preserveRoomParamsFrom: soloUrl });
    expect(href).not.toContain("roomCode=");
    expect(href).not.toContain("seatToken=");
  });

  it("appends explicit room params to search params", () => {
    const params = buildFoundationSearchParams(BASE_STATE, { roomParams: ROOM_PARAMS });
    expect(params.get("roomCode")).toBe("ABCD");
    expect(params.get("saveId")).toBe("save-room-1");
    expect(appendFoundationRoomParamsToSearchParams(new URLSearchParams(), ROOM_PARAMS).get("userId")).toBe("user-chris");
  });
});
