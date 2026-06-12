import { describe, expect, it } from "vitest";

import {
  applyRoomOwnershipPreset,
  advanceRoomFlow,
  canSeatControlTeam,
  createRoom,
  joinRoom,
  rejoinRoom,
  runRoomAiAutoStep,
  setParticipantReadyState,
  startRoom,
} from "@/lib/room/room-store";
import { authorizeTeamWrite } from "@/lib/room/online-room-model";

describe("room store", () => {
  it("creates, joins and rejoins a room", () => {
    const created = createRoom("socket-a", { displayName: "Chris" });
    expect(created.seat.role).toBe("A");
    expect(created.room.roomCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(created.room.state.multiplayerRoom.status).toBe("lobby");
    expect(created.room.state.roomParticipants[0]?.displayName).toBe("Chris");
    expect(created.room.state.serverWritePolicy.clientMayWriteDirectly).toBe(false);

    const joined = joinRoom(created.room.roomCode, "socket-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) {
      return;
    }

    expect(joined.seat.role).toBe("B");
    expect(joined.room.state.roomParticipants.map((participant) => participant.displayName)).toEqual(["Chris", "Franky"]);
    expect(joined.room.state.teamOwnership.filter((entry) => entry.controllerType === "human")).toHaveLength(8);
    expect(joined.room.state.teamOwnership.filter((entry) => entry.ownerDisplayName === "Chris")).toHaveLength(4);
    expect(joined.room.state.teamOwnership.filter((entry) => entry.ownerDisplayName === "Franky")).toHaveLength(4);
    expect(joined.room.state.teamOwnership.filter((entry) => entry.controllerType === "ai")).toHaveLength(24);
    expect(canSeatControlTeam(joined.room.roomCode, created.seat.seatToken, "P-S")).toBe(true);
    expect(canSeatControlTeam(joined.room.roomCode, created.seat.seatToken, "V-W")).toBe(true);
    expect(canSeatControlTeam(joined.room.roomCode, created.seat.seatToken, "C-S")).toBe(false);

    const rejoined = rejoinRoom(created.room.roomCode, created.seat.seatToken, "socket-c");
    expect(rejoined.ok).toBe(true);
    if (rejoined.ok) {
      expect(rejoined.seat.role).toBe("A");
      expect(rejoined.room.seats.A?.socketId).toBe("socket-c");
      expect(rejoined.room.state.roomParticipants.find((participant) => participant.displayName === "Chris")?.connectionStatus).toBe("online");
    }
  });

  it("blocks room start until required human participants are ready", () => {
    const created = createRoom("socket-a", { displayName: "Chris", preset: "chris_4_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const preset = applyRoomOwnershipPreset(created.room.roomCode, created.seat.seatToken, "chris_4_franky_4_rest_ai");
    expect(preset.ok).toBe(true);
    if (!preset.ok) return;

    expect(startRoom(created.room.roomCode, created.seat.seatToken).ok).toBe(false);
    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(startRoom(created.room.roomCode, created.seat.seatToken).ok).toBe(false);
    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);

    const started = startRoom(created.room.roomCode, created.seat.seatToken);
    expect(started.ok).toBe(true);
    if (started.ok) {
      expect(started.room.state.multiplayerRoom.status).toBe("season_active");
      expect(started.room.state.roomFlowState.step).toBe("training");
      expect(started.room.state.turnState.canAdvance).toBe(false);
    }
  });

  it("keeps the multiplayer flow blocked until Franky and AI teams are ready", () => {
    const created = createRoom("socket-flow-a", { displayName: "Chris", preset: "chris_4_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-flow-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
    const started = startRoom(created.room.roomCode, created.seat.seatToken);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(started.room.state.roomFlowState.step).toBe("training");
    expect(started.room.state.roomFlowState.canHostAdvance).toBe(false);
    expect(started.room.state.roomFlowState.blockingTeamIds).toContain("P-S");

    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    const chrisReadyRoom = runRoomAiAutoStep(created.room.roomCode, created.seat.seatToken);
    expect(chrisReadyRoom.ok).toBe(true);
    if (!chrisReadyRoom.ok) return;
    expect(chrisReadyRoom.room.state.roomFlowState.aiAutoCompletedTeamIds).toHaveLength(24);
    expect(chrisReadyRoom.room.state.roomFlowState.canHostAdvance).toBe(false);
    expect(chrisReadyRoom.room.state.roomFlowState.blockingTeamIds).toContain("M-S");

    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
    const advanced = advanceRoomFlow(created.room.roomCode, created.seat.seatToken);
    expect(advanced.ok).toBe(true);
    if (advanced.ok) {
      expect(advanced.room.state.roomFlowState.step).toBe("lineup");
      expect(advanced.room.state.roomFlowState.completedParticipantIds).toHaveLength(0);
      expect(advanced.room.state.roomFlowState.aiAutoCompletedTeamIds).toHaveLength(0);
      expect(advanced.room.state.teamOwnership.filter((entry) => entry.controllerType === "human")).toHaveLength(8);
      expect(advanced.room.state.teamOwnership.filter((entry) => entry.controllerType === "ai")).toHaveLength(24);
    }
  });

  it("authorizes team writes only through teamOwnership, not UI focus or control mode", () => {
    const created = createRoom("socket-auth-a", { displayName: "Chris", preset: "chris_4_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-auth-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const room = joined.room;
    const chris = room.state.roomParticipants.find((participant) => participant.displayName === "Chris");
    const franky = room.state.roomParticipants.find((participant) => participant.displayName === "Franky");
    expect(chris).toBeTruthy();
    expect(franky).toBeTruthy();
    if (!chris || !franky) return;

    expect(authorizeTeamWrite({ state: room.state, participantId: chris.participantId, teamId: "P-S", action: "buy" })).toEqual({
      allowed: true,
      reason: "ok",
    });

    expect(
      authorizeTeamWrite({
        state: room.state,
        participantId: franky.participantId,
        teamId: "P-S",
        action: "lineup_save",
      }),
    ).toEqual({
      allowed: false,
      reason: "team_ownership_missing",
    });

    expect(
      authorizeTeamWrite({
        state: room.state,
        participantId: franky.participantId,
        teamId: "P-S",
        action: "buy",
        activeManagerTeamId: "P-S",
      }),
    ).toEqual({
      allowed: false,
      reason: "active_manager_team_is_ui_only",
    });

    expect(
      authorizeTeamWrite({
        state: room.state,
        participantId: chris.participantId,
        teamId: "H-R",
        action: "sell",
        controlMode: "ai",
      }),
    ).toEqual({
      allowed: false,
      reason: "control_mode_is_not_permission",
    });

    const spectatorState = {
      ...room.state,
      roomParticipants: [
        ...room.state.roomParticipants,
        {
          participantId: "participant-spectator",
          userId: "user-spectator",
          displayName: "Spectator",
          connectionStatus: "online" as const,
          role: "spectator" as const,
          controlledTeamIds: [],
          readyState: "not_ready" as const,
          lastSeenAt: "2026-06-12T00:00:00.000Z",
        },
      ],
    };
    expect(
      authorizeTeamWrite({
        state: spectatorState,
        participantId: "participant-spectator",
        teamId: "P-S",
        action: "lineup_save",
      }),
    ).toEqual({
      allowed: false,
      reason: "participant_has_no_team_ownership",
    });
  });
});
