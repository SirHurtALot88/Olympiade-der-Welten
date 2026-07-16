import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const lobbyPath = path.join(process.cwd(), "app/HomePageClient.tsx");
const roomPagePath = path.join(process.cwd(), "app/room/[roomCode]/RoomPageClient.tsx");
const modelPath = path.join(process.cwd(), "lib/room/online-room-model.ts");
const flowPath = path.join(process.cwd(), "lib/room/room-flow-controller.ts");
const arenaSyncPath = path.join(process.cwd(), "lib/room/arena-sync-state.ts");

describe("online multiplayer room UI contract", () => {
  it("exposes a clean, player-facing online-room setup instead of local-only runtime sessions", async () => {
    const lobbyText = await fs.readFile(lobbyPath, "utf8");

    expect(lobbyText).toContain("Zu zweit spielen (Online)");
    expect(lobbyText).toContain("Raum erstellen");
    expect(lobbyText).toContain("Raum beitreten");
    expect(lobbyText).toContain("createRoom");
    expect(lobbyText).toContain("joinRoom");
    expect(lobbyText).toContain("chris_1_rest_ai");
    expect(lobbyText).toContain("chris_4_franky_4_rest_ai");
    // Developer/internal scaffolding copy must not leak into the player-facing screen.
    expect(lobbyText).not.toContain("Oly Umbau App v2");
    expect(lobbyText).not.toContain("Server-authoritative Flow");
    expect(lobbyText).not.toContain("echte Writes laufen später serverseitig über Services");
  });

  it("renders a clean lobby with participants, ready state and host controls in the room page", async () => {
    const roomText = await fs.readFile(roomPagePath, "utf8");

    expect(roomText).toContain("state.roomParticipants");
    expect(roomText).toContain("state.teamOwnership");
    expect(roomText).toContain("setReadyState");
    expect(roomText).toContain("applyRoomPreset");
    expect(roomText).toContain("startRoom");
    expect(roomText).toContain("chris_4_franky_4_rest_ai");
    // The primary CTA into the game reuses the existing foundation-room-context href.
    expect(roomText).toContain("foundationHref");
    expect(roomText).toContain("buildFoundationHref");
    // The debug token-moving harness ("Staffel-Arena", moveToken canvas) is gone.
    expect(roomText).not.toContain("moveToken");
    expect(roomText).not.toContain("RelayArenaPhaser");
    expect(roomText).not.toContain("Staffel-Arena");
    expect(roomText).not.toContain("Staffel-Testbahn");
  });

  it("renders a multiplayer-ready room flow controller with AI and participant gates", async () => {
    const roomText = await fs.readFile(roomPagePath, "utf8");
    const flowText = await fs.readFile(flowPath, "utf8");

    expect(roomText).toContain("room-flow-controller");
    expect(roomText).toContain("describeRoomFlowButton");
    expect(roomText).toContain("runRoomAiAutoStep");
    expect(roomText).toContain("advanceRoomFlow");
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
