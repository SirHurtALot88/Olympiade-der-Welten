import { describe, expect, it } from "vitest";

import {
  applyRoomOwnershipPreset,
  applyRoomTeamSelection,
  advanceRoomArenaStep,
  advanceRoomFlow,
  canSeatControlTeam,
  createRoom,
  getRoom,
  joinRoom,
  recordRoomGameplayWrite,
  rejoinRoom,
  runRoomAiAutoStep,
  setRoomArenaReadyState,
  setParticipantReadyState,
  startRoomArenaSync,
  startRoom,
} from "@/lib/room/room-store";
import { authorizeTeamWrite, buildExplicitTeamOwnership } from "@/lib/room/online-room-model";
import { isSandboxRoomSave } from "@/lib/room/room-flow-controller";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/**
 * In-memory persistence stub for startRoom: captures the co-op save's gameState and counts fresh
 * creates, so room-store tests never touch the sqlite file (and can assert the bound save's
 * ownership). Only the methods startRoom / createRoomCoopSave actually call are implemented.
 */
function createFakePersistence() {
  const saves = new Map<string, PersistedSaveGame>();
  const counters = { freshCreates: 0 };
  const service = {
    getSaveById: (saveId: string) => saves.get(saveId) ?? null,
    createFreshSeasonOneSave: (input?: { saveId?: string; name?: string; status?: "active" | "archived" | "template" }) => {
      counters.freshCreates += 1;
      const save = {
        saveId: input?.saveId ?? `fake-${saves.size}`,
        name: input?.name ?? "Fake",
        status: input?.status ?? "active",
      } as unknown as PersistedSaveGame;
      saves.set(save.saveId, save);
      return save;
    },
    saveSingleplayerState: (saveId: string, gameState: unknown) => {
      const existing = saves.get(saveId);
      const save = {
        ...(existing ?? {}),
        saveId,
        name: existing?.name ?? "Fake",
        status: existing?.status ?? "archived",
        gameState,
      } as unknown as PersistedSaveGame;
      saves.set(saveId, save);
      return save;
    },
  };
  return { service: service as unknown as PersistenceService, saves, counters };
}

describe("room store", () => {
  it("records gameplay writes and invalidates the acting participant ready state", () => {
    const created = createRoom("socket-gameplay-a", { displayName: "Chris", preset: "chris_4_rest_ai", saveId: "room-gameplay-save" });
    const chris = created.room.state.roomParticipants[0];
    expect(chris).toBeTruthy();
    if (!chris) return;

    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    const recorded = recordRoomGameplayWrite({
      roomCode: created.room.roomCode,
      saveId: "room-gameplay-save",
      teamId: "P-S",
      participantId: chris.participantId,
      action: "transfermarkt_buy",
      eventType: "transfer_completed",
      affectedViews: ["team", "market"],
    });

    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    expect(recorded.room.state.roomParticipants[0]?.readyState).toBe("not_ready");
    expect(recorded.room.state.roomEvents.at(-2)?.type).toBe("transfer_completed");
    expect(recorded.room.state.roomEvents.at(-1)?.type).toBe("ready_invalidated");
  });

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
    const persistence = createFakePersistence();
    const created = createRoom("socket-a", { displayName: "Chris", preset: "chris_4_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const preset = applyRoomOwnershipPreset(created.room.roomCode, created.seat.seatToken, "chris_4_franky_4_rest_ai");
    expect(preset.ok).toBe(true);
    if (!preset.ok) return;

    expect(startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service }).ok).toBe(false);
    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service }).ok).toBe(false);
    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);

    const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
    expect(started.ok).toBe(true);
    if (started.ok) {
      expect(started.room.state.multiplayerRoom.status).toBe("season_active");
      expect(started.room.state.roomFlowState.step).toBe("training");
      expect(started.room.state.turnState.canAdvance).toBe(false);
    }
  }, 120_000);

  it("keeps the multiplayer flow blocked until Franky and AI teams are ready", () => {
    const persistence = createFakePersistence();
    const created = createRoom("socket-flow-a", { displayName: "Chris", preset: "chris_4_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-flow-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
    const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
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
      expect(advanced.room.state.roomFlowState.step).toBe("finalize_transfers");
      expect(advanced.room.state.roomFlowState.completedParticipantIds).toHaveLength(0);
      expect(advanced.room.state.roomFlowState.aiAutoCompletedTeamIds).toHaveLength(0);
      expect(advanced.room.state.teamOwnership.filter((entry) => entry.controllerType === "human")).toHaveLength(8);
      expect(advanced.room.state.teamOwnership.filter((entry) => entry.controllerType === "ai")).toHaveLength(24);
    }
  }, 120_000);

  it("keeps arena reveal steps server-authoritative with ready gates", () => {
    const created = createRoom("socket-arena-a", { displayName: "Chris", preset: "chris_4_rest_ai", saveId: "arena-save" });
    const joined = joinRoom(created.room.roomCode, "socket-arena-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const started = startRoomArenaSync(created.room.roomCode, created.seat.seatToken, {
      seasonId: "season-2",
      matchdayId: "season-2-matchday-1",
      disciplineSide: "d1",
      maxSlotRevealIndex: 5,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.room.state.arenaSyncState.status).toBe("ready_check");
    expect(started.room.state.arenaSyncState.requiredParticipantIds).toHaveLength(2);
    expect(started.room.state.roomEvents.at(-1)?.type).toBe("arena_started");

    expect(advanceRoomArenaStep(created.room.roomCode, created.seat.seatToken).ok).toBe(false);
    expect(setRoomArenaReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(advanceRoomArenaStep(created.room.roomCode, created.seat.seatToken).ok).toBe(false);
    expect(setRoomArenaReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);

    const firstStep = advanceRoomArenaStep(created.room.roomCode, created.seat.seatToken);
    expect(firstStep.ok).toBe(true);
    if (!firstStep.ok) return;
    expect(firstStep.room.state.arenaSyncState.phaseId).toBe("slots");
    expect(firstStep.room.state.arenaSyncState.slotRevealIndex).toBe(1);
    expect(firstStep.room.state.arenaSyncState.revealedSlotCountByDiscipline.d1).toBe(1);
    expect(firstStep.room.state.roomEvents.at(-1)?.type).toBe("arena_step_changed");

    const secondStep = advanceRoomArenaStep(created.room.roomCode, created.seat.seatToken);
    expect(secondStep.ok).toBe(true);
    if (secondStep.ok) {
      expect(secondStep.room.state.arenaSyncState.phaseId).toBe("slots");
      expect(secondStep.room.state.arenaSyncState.slotRevealIndex).toBe(2);
      expect(secondStep.room.state.arenaSyncState.revealedSlotCountByDiscipline.d1).toBe(2);
    }
  });

  it("advances from d1 slots through d2 into total result phases", () => {
    const created = createRoom("socket-arena-d1d2-a", { displayName: "Chris", preset: "chris_4_franky_4_rest_ai", saveId: "arena-d1d2-save" });
    const joined = joinRoom(created.room.roomCode, "socket-arena-d1d2-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const limits = { d1: 2, d2: 2 };
    const started = startRoomArenaSync(created.room.roomCode, created.seat.seatToken, {
      seasonId: "season-2",
      matchdayId: "season-2-matchday-1",
      maxSlotRevealCountByDiscipline: limits,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(setRoomArenaReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setRoomArenaReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);

    let roomState = started.room.state;
    for (let slot = 0; slot < limits.d1; slot += 1) {
      const advanced = advanceRoomArenaStep(created.room.roomCode, created.seat.seatToken, {
        maxSlotRevealCountByDiscipline: limits,
      });
      expect(advanced.ok).toBe(true);
      if (!advanced.ok) return;
      roomState = advanced.room.state;
      expect(roomState.arenaSyncState.activeDisciplinePhase).toBe("d1");
    }

    const intoPush = advanceRoomArenaStep(created.room.roomCode, created.seat.seatToken, {
      maxSlotRevealCountByDiscipline: limits,
    });
    expect(intoPush.ok).toBe(true);
    if (!intoPush.ok) return;
    expect(intoPush.room.state.arenaSyncState.phaseId).not.toBe("slots");

    let current = intoPush.room.state;
    while (current.arenaSyncState.activeDisciplinePhase === "d1" && current.arenaSyncState.phaseId !== "result") {
      const advanced = advanceRoomArenaStep(created.room.roomCode, created.seat.seatToken, {
        maxSlotRevealCountByDiscipline: limits,
        force: true,
      });
      expect(advanced.ok).toBe(true);
      if (!advanced.ok) return;
      current = advanced.room.state;
    }

    expect(current.arenaSyncState.activeDisciplinePhase === "d2" || current.arenaSyncState.activeDisciplinePhase === "total").toBe(true);

    const recorded = recordRoomGameplayWrite({
      roomCode: created.room.roomCode,
      saveId: "arena-d1d2-save",
      participantId: created.room.state.roomParticipants[0]!.participantId,
      action: "matchday_apply",
      eventType: "matchday_applied",
      affectedViews: ["arena", "standings"],
    });
    expect(recorded.ok).toBe(true);
    if (recorded.ok) {
      expect(recorded.room.state.arenaSyncState.status).toBe("result_applied");
      expect(recorded.room.state.arenaSyncState.phaseId).toBe("result");
    }
  });

  it("marks arena result state when a matchday write is applied", () => {
    const created = createRoom("socket-arena-result-a", { displayName: "Chris", preset: "chris_4_rest_ai", saveId: "arena-result-save" });
    const chris = created.room.state.roomParticipants[0];
    expect(chris).toBeTruthy();
    if (!chris) return;

    const started = startRoomArenaSync(created.room.roomCode, created.seat.seatToken, {
      seasonId: "season-2",
      matchdayId: "season-2-matchday-1",
      maxSlotRevealIndex: 5,
    });
    expect(started.ok).toBe(true);

    const recorded = recordRoomGameplayWrite({
      roomCode: created.room.roomCode,
      saveId: "arena-result-save",
      participantId: chris.participantId,
      action: "matchday_apply",
      eventType: "matchday_applied",
      affectedViews: ["arena", "standings"],
    });
    expect(recorded.ok).toBe(true);
    if (recorded.ok) {
      expect(recorded.room.state.arenaSyncState.status).toBe("result_applied");
      expect(recorded.room.state.arenaSyncState.resultStatus).toBe("applied");
      expect(recorded.room.state.arenaSyncState.phaseId).toBe("result");
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

  it("lets the host explicitly assign specific team ids to Chris and Franky", () => {
    const created = createRoom("socket-select-a", { displayName: "Chris", preset: "chris_4_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-select-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const applied = applyRoomTeamSelection(created.room.roomCode, created.seat.seatToken, {
      chrisTeamIds: ["M-M"],
      frankyTeamIds: ["C-S", "G-G"],
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    const ownership = applied.room.state.teamOwnership;
    expect(ownership.find((entry) => entry.teamId === "M-M")).toMatchObject({
      controllerType: "human",
      ownerDisplayName: "Chris",
    });
    expect(ownership.find((entry) => entry.teamId === "C-S")).toMatchObject({
      controllerType: "human",
      ownerDisplayName: "Franky",
    });
    // A-A was the alphabetically-first team the old preset always handed Chris - it must now be AI.
    expect(ownership.find((entry) => entry.teamId === "A-A")).toMatchObject({ controllerType: "ai" });
    expect(ownership.filter((entry) => entry.controllerType === "human")).toHaveLength(3);
    expect(ownership.filter((entry) => entry.controllerType === "ai")).toHaveLength(29);

    const chrisParticipant = applied.room.state.roomParticipants.find((participant) => participant.displayName === "Chris");
    expect(chrisParticipant?.controlledTeamIds).toEqual(["M-M"]);
  });

  it("rejects team selections from a non-host seat token", () => {
    const created = createRoom("socket-select-nonhost-a", { displayName: "Chris" });
    const joined = joinRoom(created.room.roomCode, "socket-select-nonhost-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    // T-T is outside both default "chris_4_franky_4_rest_ai" allotments (auto-applied on join), so it
    // starts AI-controlled - the assertion below proves the rejected non-host attempt left it untouched.
    const applied = applyRoomTeamSelection(created.room.roomCode, joined.seat.seatToken, {
      chrisTeamIds: ["T-T"],
      frankyTeamIds: [],
    });
    expect(applied.ok).toBe(false);
    if (applied.ok) return;
    expect(applied.error).toContain("Host");

    const room = getRoom(created.room.roomCode);
    expect(room?.state.teamOwnership.find((entry) => entry.teamId === "T-T")?.controllerType).toBe("ai");
  });

  it("rejects explicit selections that exceed the per-human team cap", () => {
    const participants = [
      { participantId: "p-host", userId: "u-host", displayName: "Chris", connectionStatus: "online" as const, role: "host" as const, controlledTeamIds: [], readyState: "not_ready" as const, lastSeenAt: "2026-01-01T00:00:00.000Z" },
      { participantId: "p-franky", userId: "u-franky", displayName: "Franky", connectionStatus: "online" as const, role: "player" as const, controlledTeamIds: [], readyState: "not_ready" as const, lastSeenAt: "2026-01-01T00:00:00.000Z" },
    ];

    const tooMany = buildExplicitTeamOwnership(participants, {
      chrisTeamIds: ["A-A", "B-B", "C-C", "D-L", "G-G"],
      frankyTeamIds: [],
    });
    expect(tooMany.ok).toBe(false);
    if (tooMany.ok) return;
    expect(tooMany.reason).toBe("too_many_teams_for_participant");
  });

  it("rejects explicit selections that assign the same team to both humans", () => {
    const participants = [
      { participantId: "p-host", userId: "u-host", displayName: "Chris", connectionStatus: "online" as const, role: "host" as const, controlledTeamIds: [], readyState: "not_ready" as const, lastSeenAt: "2026-01-01T00:00:00.000Z" },
      { participantId: "p-franky", userId: "u-franky", displayName: "Franky", connectionStatus: "online" as const, role: "player" as const, controlledTeamIds: [], readyState: "not_ready" as const, lastSeenAt: "2026-01-01T00:00:00.000Z" },
    ];

    const overlapping = buildExplicitTeamOwnership(participants, {
      chrisTeamIds: ["M-M"],
      frankyTeamIds: ["M-M"],
    });
    expect(overlapping.ok).toBe(false);
    if (overlapping.ok) return;
    expect(overlapping.reason).toBe("team_assigned_twice");
  });

  it("keeps Franky's requested teams on AI until Franky has joined", () => {
    const participants = [
      { participantId: "p-host", userId: "u-host", displayName: "Chris", connectionStatus: "online" as const, role: "host" as const, controlledTeamIds: [], readyState: "not_ready" as const, lastSeenAt: "2026-01-01T00:00:00.000Z" },
    ];

    const result = buildExplicitTeamOwnership(participants, {
      chrisTeamIds: ["M-M"],
      frankyTeamIds: ["C-S"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ownership.find((entry) => entry.teamId === "C-S")).toMatchObject({ controllerType: "ai" });
    expect(result.ownership.find((entry) => entry.teamId === "M-M")).toMatchObject({ controllerType: "human", ownerDisplayName: "Chris" });
  });

  it("starts a room by creating a fresh co-op save bound to the room with the picked split", () => {
    const persistence = createFakePersistence();
    const created = createRoom("socket-fresh-a", { displayName: "Chris", preset: "chris_4_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-fresh-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    // Host picks exactly the teams each human plays; everything else must fall to AI.
    const selection = applyRoomTeamSelection(created.room.roomCode, created.seat.seatToken, {
      chrisTeamIds: ["M-M", "D-P"],
      frankyTeamIds: ["C-S", "P-C"],
    });
    expect(selection.ok).toBe(true);
    if (!selection.ok) return;

    expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);

    // The room save is still the default sandbox id until the host starts.
    expect(isSandboxRoomSave(created.room.state.multiplayerRoom.saveId)).toBe(true);

    const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const boundSaveId = started.room.state.multiplayerRoom.saveId;
    expect(isSandboxRoomSave(boundSaveId)).toBe(false);
    expect(boundSaveId).toMatch(/^new-game-/);
    expect(persistence.counters.freshCreates).toBe(1);

    const boundSave = persistence.saves.get(boundSaveId);
    expect(boundSave).toBeTruthy();
    const gameState = boundSave?.gameState as {
      seasonState: { teamControlSettings: Record<string, { controlMode: string; ownerId?: string }> };
      teams: Array<{ teamId: string; humanControlled: boolean }>;
    };
    const settings = gameState.seasonState.teamControlSettings;
    // Chris's picks -> human/manual, owner user_local.
    expect(settings["M-M"]).toMatchObject({ controlMode: "manual", ownerId: "user_local" });
    expect(settings["D-P"]).toMatchObject({ controlMode: "manual", ownerId: "user_local" });
    // Franky's picks -> human/manual, owner franky_remote_placeholder.
    expect(settings["C-S"]).toMatchObject({ controlMode: "manual", ownerId: "franky_remote_placeholder" });
    expect(settings["P-C"]).toMatchObject({ controlMode: "manual", ownerId: "franky_remote_placeholder" });
    // A team nobody picked -> AI.
    expect(settings["R-R"]?.controlMode).toBe("ai");
    expect(gameState.teams.find((team) => team.teamId === "M-M")?.humanControlled).toBe(true);
    expect(gameState.teams.find((team) => team.teamId === "R-R")?.humanControlled).toBe(false);

    // A second start while status is no longer "lobby" must NOT mint another save (idempotent).
    const room = getRoom(created.room.roomCode);
    expect(room).toBeTruthy();
    if (!room) return;
    room.state = { ...room.state, turnState: { ...room.state.turnState, canAdvance: true } };
    const secondStart = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
    expect(secondStart.ok).toBe(true);
    if (secondStart.ok) {
      expect(secondStart.room.state.multiplayerRoom.saveId).toBe(boundSaveId);
    }
    expect(persistence.counters.freshCreates).toBe(1);

    // Non-host cannot start.
    const nonHostStart = startRoom(created.room.roomCode, joined.seat.seatToken, { persistence: persistence.service });
    expect(nonHostStart.ok).toBe(false);
    if (!nonHostStart.ok) {
      expect(nonHostStart.error).toContain("Host");
    }
  }, 120_000);

  it("rejects room start when the host has not assigned himself a team", () => {
    const persistence = createFakePersistence();
    const created = createRoom("socket-noteam-a", { displayName: "Chris", preset: "chris_4_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-noteam-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    // Give every human team to Franky only, so Chris (host) owns nothing.
    const selection = applyRoomTeamSelection(created.room.roomCode, created.seat.seatToken, {
      chrisTeamIds: [],
      frankyTeamIds: ["C-S", "P-C"],
    });
    expect(selection.ok).toBe(true);
    if (!selection.ok) return;

    expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);

    const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence: persistence.service });
    expect(started.ok).toBe(false);
    if (!started.ok) {
      expect(started.error).toContain("Team");
    }
    expect(persistence.counters.freshCreates).toBe(0);
  });
});
