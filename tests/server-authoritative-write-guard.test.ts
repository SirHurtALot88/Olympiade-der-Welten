import { describe, expect, it } from "vitest";

import { createRoom, joinRoom, markDisconnected, rejoinRoom } from "@/lib/room/room-store";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

describe("server-authoritative room write guard", () => {
  it("blocks active room saves without room context but keeps singleplayer saves writable", () => {
    createRoom("guard-context-a", {
      displayName: "Chris",
      saveId: "room-bound-save",
      preset: "chris_4_rest_ai",
    });

    expect(
      authorizeServerRoomWrite({
        saveId: "room-bound-save",
        teamId: "P-S",
        action: "buy",
        source: "sqlite",
        dryRun: false,
      }),
    ).toMatchObject({
      allowed: false,
      status: 401,
      reason: "room_context_required_for_room_save",
    });

    expect(
      authorizeServerRoomWrite({
        saveId: "singleplayer-save-without-room",
        teamId: "P-S",
        action: "buy",
        source: "sqlite",
        dryRun: false,
      }).allowed,
    ).toBe(true);
  });

  it("blocks writes when a save is bound to a different active room", () => {
    const firstRoom = createRoom("guard-context-b", {
      displayName: "Chris",
      saveId: "room-bound-save-mismatch",
      preset: "chris_4_rest_ai",
    });
    const secondRoom = createRoom("guard-context-c", {
      displayName: "Chris",
      saveId: "another-room-save",
      preset: "chris_4_rest_ai",
    });
    const chris = secondRoom.room.state.roomParticipants[0];
    expect(chris).toBeTruthy();
    if (!chris) return;

    expect(
      authorizeServerRoomWrite({
        roomCode: secondRoom.room.roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
        saveId: firstRoom.room.state.multiplayerRoom.saveId,
        teamId: "P-S",
        action: "buy",
        source: "sqlite",
        dryRun: false,
      }),
    ).toMatchObject({
      allowed: false,
      status: 409,
      reason: "save_bound_to_different_room",
    });
  });

  it("allows owned team writes and blocks UI-focus-only writes", () => {
    const created = createRoom("guard-socket-a", {
      displayName: "Chris",
      saveId: "sandbox-manager-test-save",
      preset: "chris_4_rest_ai",
    });
    const joined = joinRoom(created.room.roomCode, "guard-socket-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const chris = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Chris");
    const franky = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Franky");
    expect(chris).toBeTruthy();
    expect(franky).toBeTruthy();
    if (!chris || !franky) return;

    expect(
      authorizeServerRoomWrite({
        roomCode: created.room.roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
        saveId: "sandbox-manager-test-save",
        teamId: "P-S",
        action: "buy",
        source: "sqlite",
        dryRun: false,
      }).allowed,
    ).toBe(true);

    const blocked = authorizeServerRoomWrite({
      roomCode: created.room.roomCode,
      participantId: franky.participantId,
      userId: franky.userId,
      saveId: "sandbox-manager-test-save",
      teamId: "P-S",
      action: "buy",
      source: "sqlite",
      dryRun: false,
      activeManagerTeamId: "P-S",
    });
    expect(blocked).toMatchObject({
      allowed: false,
      status: 403,
      reason: "active_manager_team_is_ui_only",
    });
  });

  it("blocks users without ownership, AI teams, stale tokens and Prisma writes", () => {
    const created = createRoom("guard-socket-c", {
      displayName: "Chris",
      saveId: "sandbox-manager-test-save-2",
      preset: "chris_4_rest_ai",
    });
    const joined = joinRoom(created.room.roomCode, "guard-socket-d", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    const chris = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Chris");
    expect(chris).toBeTruthy();
    if (!chris) return;

    expect(
      authorizeServerRoomWrite({
        roomCode: created.room.roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
        saveId: "sandbox-manager-test-save-2",
        teamId: "H-R",
        action: "lineup_save",
        controlMode: "ai",
      }),
    ).toMatchObject({ allowed: false, reason: "control_mode_is_not_permission" });

    expect(
      authorizeServerRoomWrite({
        roomCode: created.room.roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
        saveId: "sandbox-manager-test-save-2",
        teamId: "P-S",
        action: "xp_spend",
        source: "sqlite",
        dryRun: false,
        confirmToken: "old-token",
        expectedConfirmToken: "fresh-token",
      }),
    ).toMatchObject({ allowed: false, reason: "confirm_token_invalid_or_stale" });

    expect(
      authorizeServerRoomWrite({
        roomCode: created.room.roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
        saveId: "sandbox-manager-test-save-2",
        teamId: "P-S",
        action: "sell",
        source: "prisma",
      }),
    ).toMatchObject({ allowed: false, reason: "prisma_writes_forbidden_in_local_multiplayer" });
  });

  it("allows host-only flow writes, sandbox host override and reconnect", () => {
    const created = createRoom("guard-socket-e", {
      displayName: "Chris",
      saveId: "sandbox-manager-test-save-3",
      preset: "chris_4_rest_ai",
    });
    const joined = joinRoom(created.room.roomCode, "guard-socket-f", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    const chris = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Chris");
    const franky = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Franky");
    expect(chris).toBeTruthy();
    expect(franky).toBeTruthy();
    if (!chris || !franky) return;

    expect(
      authorizeServerRoomWrite({
        roomCode: created.room.roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
        saveId: "sandbox-manager-test-save-3",
        action: "matchday_resolve",
      }).allowed,
    ).toBe(true);

    expect(
      authorizeServerRoomWrite({
        roomCode: created.room.roomCode,
        participantId: franky.participantId,
        userId: franky.userId,
        saveId: "sandbox-manager-test-save-3",
        action: "matchday_resolve",
      }),
    ).toMatchObject({ allowed: false, reason: "host_only_action" });

    expect(
      authorizeServerRoomWrite({
        roomCode: created.room.roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
        saveId: "sandbox-manager-test-save-3",
        action: "formcards_season_regenerate",
      }).allowed,
    ).toBe(true);

    expect(
      authorizeServerRoomWrite({
        roomCode: created.room.roomCode,
        participantId: franky.participantId,
        userId: franky.userId,
        saveId: "sandbox-manager-test-save-3",
        teamId: "C-S",
        action: "formcards_season_regenerate",
      }),
    ).toMatchObject({ allowed: false, reason: "host_only_action" });

    expect(
      authorizeServerRoomWrite({
        roomCode: created.room.roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
        saveId: "sandbox-manager-test-save-3",
        action: "lineup_ai_batch_apply",
      }).allowed,
    ).toBe(true);

    expect(
      authorizeServerRoomWrite({
        roomCode: created.room.roomCode,
        participantId: franky.participantId,
        userId: franky.userId,
        saveId: "sandbox-manager-test-save-3",
        action: "ai_preseason_background",
      }),
    ).toMatchObject({ allowed: false, reason: "host_only_action" });

    const override = authorizeServerRoomWrite({
      roomCode: created.room.roomCode,
      participantId: chris.participantId,
      userId: chris.userId,
      saveId: "sandbox-manager-test-save-3",
      teamId: "H-R",
      action: "training_update",
      allowSandboxHostOverride: true,
    });
    expect(override.allowed).toBe(true);
    if (override.allowed) {
      expect(override.warnings).toContain("source:sandbox_host_override:team_not_human_controlled");
    }

    markDisconnected("guard-socket-e");
    expect(
      authorizeServerRoomWrite({
        roomCode: created.room.roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
        saveId: "sandbox-manager-test-save-3",
        teamId: "P-S",
        action: "buy",
      }),
    ).toMatchObject({ allowed: false, reason: "participant_offline" });

    const rejoined = rejoinRoom(created.room.roomCode, created.seat.seatToken, "guard-socket-e2");
    expect(rejoined.ok).toBe(true);
    expect(
      authorizeServerRoomWrite({
        roomCode: created.room.roomCode,
        seatToken: created.seat.seatToken,
        userId: chris.userId,
        saveId: "sandbox-manager-test-save-3",
        teamId: "P-S",
        action: "buy",
      }).allowed,
    ).toBe(true);
  });

  it("S10: reconnect via rejoinRoom clears participant_offline without duplicating the participant or changing team ownership, and still rejects a bogus seat token", () => {
    const created = createRoom("s10-socket-a", {
      displayName: "Chris",
      saveId: "s10-reconnect-save",
      preset: "chris_4_rest_ai",
    });
    const joined = joinRoom(created.room.roomCode, "s10-socket-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const chris = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Chris");
    expect(chris).toBeTruthy();
    if (!chris) return;

    const participantCountBefore = joined.room.state.roomParticipants.length;
    const chrisOwnershipBefore = joined.room.state.teamOwnership.filter(
      (entry) => entry.controllerType === "human" && entry.participantId === chris.participantId,
    );
    expect(chrisOwnershipBefore.length).toBeGreaterThan(0);

    // Simulate a brief network hiccup (laptop sleep / wifi blip / dev-server restart): the
    // transport disconnects and the server marks the seat + participant offline.
    markDisconnected("s10-socket-a");
    expect(
      authorizeServerRoomWrite({
        roomCode: created.room.roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
        saveId: "s10-reconnect-save",
        teamId: chrisOwnershipBefore[0]?.teamId,
        action: "buy",
      }),
    ).toMatchObject({ allowed: false, status: 403, reason: "participant_offline" });

    // A wrong/absent seat token must still be rejected while offline - re-identifying with
    // garbage never resurrects a participant.
    const bogusRejoin = rejoinRoom(created.room.roomCode, "not-a-real-seat-token", "s10-socket-a-bogus");
    expect(bogusRejoin.ok).toBe(false);
    expect(
      authorizeServerRoomWrite({
        roomCode: created.room.roomCode,
        seatToken: "not-a-real-seat-token",
        saveId: "s10-reconnect-save",
        teamId: chrisOwnershipBefore[0]?.teamId,
        action: "buy",
      }),
    ).toMatchObject({ allowed: false, status: 401, reason: "participant_missing" });

    // Client reconnects: socket.io re-fires "connect" with a NEW socket id after a successful
    // reconnection. The Foundation shell now re-emits "rejoinRoom" on every such "connect" (see
    // lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx), using the seatToken it
    // still holds from the URL or the `oly-seat:<ROOMCODE>` localStorage fallback. Server-side
    // this lands as rejoinRoom() rebinding the existing seat/participant to the new socket id.
    const rejoined = rejoinRoom(created.room.roomCode, created.seat.seatToken, "s10-socket-a-reconnected");
    expect(rejoined.ok).toBe(true);
    if (!rejoined.ok) return;
    expect(rejoined.seat.role).toBe("A");
    expect(rejoined.seat.participantId).toBe(chris.participantId);

    // No duplicate participant was minted for the reconnect.
    expect(rejoined.room.state.roomParticipants).toHaveLength(participantCountBefore);
    expect(
      rejoined.room.state.roomParticipants.filter((participant) => participant.participantId === chris.participantId),
    ).toHaveLength(1);

    // Team ownership for the reconnected participant is byte-for-byte unchanged (no re-seating,
    // no ownership reset).
    const chrisOwnershipAfter = rejoined.room.state.teamOwnership.filter(
      (entry) => entry.controllerType === "human" && entry.participantId === chris.participantId,
    );
    expect(chrisOwnershipAfter).toEqual(chrisOwnershipBefore);

    // The gameplay write that 403'd while offline now succeeds.
    expect(
      authorizeServerRoomWrite({
        roomCode: created.room.roomCode,
        participantId: chris.participantId,
        userId: chris.userId,
        saveId: "s10-reconnect-save",
        teamId: chrisOwnershipBefore[0]?.teamId,
        action: "buy",
      }).allowed,
    ).toBe(true);

    // rejoinRoom must be idempotent: e.g. the client's "connect" handler firing twice in quick
    // succession (or the effect re-running) must never duplicate the participant or touch
    // ownership again.
    const rejoinedAgain = rejoinRoom(created.room.roomCode, created.seat.seatToken, "s10-socket-a-reconnected-2");
    expect(rejoinedAgain.ok).toBe(true);
    if (!rejoinedAgain.ok) return;
    expect(rejoinedAgain.room.state.roomParticipants).toHaveLength(participantCountBefore);
    expect(
      rejoinedAgain.room.state.teamOwnership.filter(
        (entry) => entry.controllerType === "human" && entry.participantId === chris.participantId,
      ),
    ).toEqual(chrisOwnershipBefore);
  });

  it("scopes team-settings writes (identity/control) to the owning participant only", () => {
    const created = createRoom("guard-team-settings-a", {
      displayName: "Chris",
      saveId: "team-settings-guard-save",
      preset: "chris_4_franky_4_rest_ai",
    });
    const joined = joinRoom(created.room.roomCode, "guard-team-settings-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const chris = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Chris");
    const franky = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Franky");
    expect(chris).toBeTruthy();
    expect(franky).toBeTruthy();
    if (!chris || !franky) return;

    // Chris owns P-S under the chris_4_franky_4_rest_ai preset — his own team-identity/control
    // writes are allowed.
    for (const action of ["team_identity_update", "team_control_update"] as const) {
      expect(
        authorizeServerRoomWrite({
          roomCode: created.room.roomCode,
          participantId: chris.participantId,
          userId: chris.userId,
          saveId: "team-settings-guard-save",
          teamId: "P-S",
          action,
          source: "sqlite",
          dryRun: false,
        }).allowed,
      ).toBe(true);
    }

    // Franky owns M-S, not P-S — writing P-S's identity/control must be denied even though he
    // is a valid, online room participant.
    for (const action of ["team_identity_update", "team_control_update"] as const) {
      expect(
        authorizeServerRoomWrite({
          roomCode: created.room.roomCode,
          participantId: franky.participantId,
          userId: franky.userId,
          saveId: "team-settings-guard-save",
          teamId: "P-S",
          action,
          source: "sqlite",
          dryRun: false,
        }),
      ).toMatchObject({ allowed: false, status: 403 });
    }

    // Franky writing his own team (M-S) is allowed.
    for (const action of ["team_identity_update", "team_control_update"] as const) {
      expect(
        authorizeServerRoomWrite({
          roomCode: created.room.roomCode,
          participantId: franky.participantId,
          userId: franky.userId,
          saveId: "team-settings-guard-save",
          teamId: "M-S",
          action,
          source: "sqlite",
          dryRun: false,
        }).allowed,
      ).toBe(true);
    }
  });
});
