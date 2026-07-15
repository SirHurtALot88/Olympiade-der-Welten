import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const lobbyPath = path.join(process.cwd(), "app/HomePageClient.tsx");
const roomPagePath = path.join(process.cwd(), "app/room/[roomCode]/RoomPageClient.tsx");
const modelPath = path.join(process.cwd(), "lib/room/online-room-model.ts");
const flowPath = path.join(process.cwd(), "lib/room/room-flow-controller.ts");
const arenaSyncPath = path.join(process.cwd(), "lib/room/arena-sync-state.ts");

describe("online multiplayer room UI contract", () => {
  it("exposes online-room setup instead of local-only runtime sessions", async () => {
    const lobbyText = await fs.readFile(lobbyPath, "utf8");

    expect(lobbyText).toContain("Online Multiplayer Rooms V1");
    expect(lobbyText).toContain("Online-Room erstellen");
    expect(lobbyText).toContain("Room beitreten");
    expect(lobbyText).toContain("chris_1_rest_ai");
    expect(lobbyText).toContain("chris_4_franky_4_rest_ai");
    expect(lobbyText).toContain("Server-authoritative Flow");
    expect(lobbyText).toContain("Client sendet Requests, keine Direktwrites.");
  });

  it("renders participants, ownership, ready state and host start controls in room page", async () => {
    const roomText = await fs.readFile(roomPagePath, "utf8");

    expect(roomText).toContain("Online Lobby");
    expect(roomText).toContain("Team Ownership");
    expect(roomText).toContain("state.roomParticipants");
    expect(roomText).toContain("state.teamOwnership");
    expect(roomText).toContain("setReadyState");
    expect(roomText).toContain("applyRoomPreset");
    expect(roomText).toContain("startRoom");
    expect(roomText).toContain("Season / Room starten");
    expect(roomText).toContain("room-arena-sync-controller");
    expect(roomText).toContain("startRoomArena");
    expect(roomText).toContain("setRoomArenaReady");
    expect(roomText).toContain("advanceRoomArenaStep");
  });

  it("renders a multiplayer-ready room flow controller with AI and participant gates", async () => {
    const roomText = await fs.readFile(roomPagePath, "utf8");
    const flowText = await fs.readFile(flowPath, "utf8");

    expect(roomText).toContain("room-flow-controller");
    expect(roomText).toContain("describeRoomFlowButton");
    expect(roomText).toContain("runRoomAiAutoStep");
    expect(roomText).toContain("advanceRoomFlow");
    expect(roomText).toContain("source: sandbox_auto_ready");
    expect(flowText).toContain("Warten auf");
    expect(flowText).toContain("AI Teams vorbereiten");
    expect(flowText).toContain("host_only");
    expect(flowText).toContain("sandbox_override_available");
    expect(flowText).toContain("targetView: \"lineup\"");
    expect(flowText).toContain("targetView: \"matchdayArena\"");
  });

  it("models server-ready room participants and team ownership", async () => {
    const modelText = await fs.readFile(modelPath, "utf8");
    const arenaSyncText = await fs.readFile(arenaSyncPath, "utf8");

    expect(modelText).toContain("SERVER_AUTHORITATIVE_WRITE_POLICY");
    expect(modelText).toContain("clientMayWriteDirectly: false");
    expect(modelText).toContain("authorizeTeamWrite");
    expect(modelText).toContain("active_manager_team_is_ui_only");
    expect(modelText).toContain("control_mode_is_not_permission");
    expect(modelText).toContain("buildOwnershipForPreset");
    expect(modelText).toContain("canParticipantControlTeam");
    expect(modelText).toContain("buildTurnState");
    expect(modelText).toContain("syncParticipantControlledTeams");
    expect(arenaSyncText).toContain("ROOM_ARENA_PHASES");
    expect(arenaSyncText).toContain("startRoomArena");
    expect(arenaSyncText).toContain("advanceRoomArenaReveal");
    expect(arenaSyncText).toContain("readyParticipantIds");
  });
});
