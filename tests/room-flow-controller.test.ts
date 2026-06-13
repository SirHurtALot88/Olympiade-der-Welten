import { describe, expect, it } from "vitest";

import { advanceRoomFlow, createRoom, joinRoom, runRoomAiAutoStep, setParticipantReadyState, startRoom } from "@/lib/room/room-store";
import { describeRoomFlowButton, ROOM_FLOW_STEPS } from "@/lib/room/room-flow-controller";

describe("room flow controller", () => {
  it("defines the multiplayer-ready room flow steps", () => {
    expect(ROOM_FLOW_STEPS.map((step) => step.stepId)).toEqual([
      "lobby_ready",
      "sell_players",
      "buy_players",
      "facilities",
      "xp_spend",
      "training",
      "lineup",
      "formcards",
      "arena",
      "result",
      "standings",
      "season_review",
    ]);
    expect(ROOM_FLOW_STEPS.find((step) => step.stepId === "result")?.targetView).toBe("matchdayArena");
    expect(ROOM_FLOW_STEPS.some((step) => step.targetView === "matchdayResult")).toBe(false);
  });

  it("blocks host advance until Chris, Franky and AI readiness are complete", () => {
    const created = createRoom("socket-room-flow-a", { displayName: "Chris", preset: "chris_4_rest_ai" });
    const joined = joinRoom(created.room.roomCode, "socket-room-flow-b", { displayName: "Franky" });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    const chris = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Chris");
    const franky = joined.room.state.roomParticipants.find((participant) => participant.displayName === "Franky");
    expect(chris?.controlledTeamIds).toHaveLength(4);
    expect(franky?.controlledTeamIds).toHaveLength(4);
    expect(joined.room.state.teamOwnership.filter((entry) => entry.controllerType === "ai")).toHaveLength(24);
    if (!chris || !franky) return;

    expect(describeRoomFlowButton({ state: joined.room.state, participantId: chris.participantId }).label).toBe("Warten auf Chris");
    expect(startRoom(joined.room.roomCode, created.seat.seatToken).ok).toBe(false);

    expect(setParticipantReadyState(joined.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    const chrisReadyState = created.room.state;
    expect(describeRoomFlowButton({ state: chrisReadyState, participantId: chris.participantId }).label).toBe("Warten auf Franky");
    expect(chrisReadyState.roomFlowState.canHostAdvance).toBe(false);

    expect(setParticipantReadyState(joined.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
    const started = startRoom(joined.room.roomCode, created.seat.seatToken);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.room.state.roomFlowState.step).toBe("training");
    expect(started.room.state.roomFlowState.completedParticipantIds).toHaveLength(0);
    expect(started.room.state.roomFlowState.aiAutoCompletedTeamIds).toHaveLength(0);
    expect(started.room.state.roomFlowState.canHostAdvance).toBe(false);

    const trainingButton = describeRoomFlowButton({ state: started.room.state, participantId: chris.participantId });
    expect(trainingButton.label).toBe("AI Teams vorbereiten");
    expect(trainingButton.canClick).toBe(true);

    const aiPrepared = runRoomAiAutoStep(started.room.roomCode, created.seat.seatToken);
    expect(aiPrepared.ok).toBe(true);
    if (!aiPrepared.ok) return;
    expect(aiPrepared.room.state.roomFlowState.aiAutoCompletedTeamIds).toHaveLength(24);
    expect(aiPrepared.room.state.teamOwnership.filter((entry) => entry.controllerType === "human")).toHaveLength(8);
    expect(aiPrepared.room.state.roomFlowState.canHostAdvance).toBe(false);

    expect(setParticipantReadyState(aiPrepared.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
    expect(created.room.state.roomFlowState.canHostAdvance).toBe(false);
    expect(describeRoomFlowButton({ state: created.room.state, participantId: chris.participantId }).label).toBe("Warten auf Franky");

    expect(setParticipantReadyState(aiPrepared.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);
    expect(created.room.state.roomFlowState.canHostAdvance).toBe(true);
    expect(describeRoomFlowButton({ state: created.room.state, participantId: chris.participantId }).label).toBe("Weiter: Training prüfen");

    const advanced = advanceRoomFlow(aiPrepared.room.roomCode, created.seat.seatToken);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.room.state.roomFlowState.step).toBe("lineup");
    expect(advanced.room.state.roomFlowState.completedParticipantIds).toHaveLength(0);
    expect(advanced.room.state.roomFlowState.aiAutoCompletedTeamIds).toHaveLength(0);
    expect(advanced.room.state.roomFlowState.canHostAdvance).toBe(false);
  });
});
