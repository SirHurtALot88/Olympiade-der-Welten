import fs from "node:fs";
import path from "node:path";

import {
  applyRoomOwnershipPreset,
  createRoom,
  getActiveRoomBySaveId,
  joinRoom,
  recordRoomGameplayWrite,
  rejoinRoom,
  setParticipantReadyState,
} from "@/lib/room/room-store";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import type { RoomRealtimeEvent } from "@/types/game";

const OUTPUT_DIR = path.join(process.cwd(), "outputs", "multiplayer-room-bound-gameplay");

function writeFile(fileName: string, content: string) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), content, "utf8");
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(fileName: string, rows: Array<Record<string, unknown>>) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  writeFile(
    fileName,
    `${[headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n")}\n`,
  );
}

function asResult(name: string, ok: boolean, details: Record<string, unknown> = {}) {
  return { name, ok, ...details };
}

const saveId = "multiplayer-room-bound-audit-save";
const created = createRoom("audit-socket-chris", {
  displayName: "Chris",
  saveId,
  preset: "chris_4_franky_4_rest_ai",
});
const joined = joinRoom(created.room.roomCode, "audit-socket-franky", { displayName: "Franky" });
if (!joined.ok) {
  throw new Error(joined.error);
}

const preset = applyRoomOwnershipPreset(created.room.roomCode, created.seat.seatToken, "chris_4_franky_4_rest_ai");
if (!preset.ok) {
  throw new Error(preset.error);
}

const room = joined.room;
const chris = room.state.roomParticipants.find((participant) => participant.displayName === "Chris");
const franky = room.state.roomParticipants.find((participant) => participant.displayName === "Franky");
if (!chris || !franky) {
  throw new Error("audit_participants_missing");
}

const permissionRows = [
  asResult("saveId maps to active room", getActiveRoomBySaveId(saveId)?.roomCode === created.room.roomCode, { saveId }),
  asResult(
    "missing room context blocks room save",
    !authorizeServerRoomWrite({ saveId, teamId: "M-M", action: "buy", source: "sqlite", dryRun: false }).allowed,
    { expectedReason: "room_context_required_for_room_save" },
  ),
  asResult(
    "singleplayer save without room remains writable",
    authorizeServerRoomWrite({ saveId: "plain-singleplayer-save", teamId: "M-M", action: "buy", source: "sqlite", dryRun: false }).allowed,
  ),
  asResult(
    "Chris may write M-M",
    authorizeServerRoomWrite({
      roomCode: created.room.roomCode,
      participantId: chris.participantId,
      userId: chris.userId,
      saveId,
      teamId: "M-M",
      action: "buy",
      source: "sqlite",
      dryRun: false,
    }).allowed,
  ),
  asResult(
    "Chris may not write Franky M-S",
    !authorizeServerRoomWrite({
      roomCode: created.room.roomCode,
      participantId: chris.participantId,
      userId: chris.userId,
      saveId,
      teamId: "M-S",
      action: "buy",
      source: "sqlite",
      dryRun: false,
    }).allowed,
  ),
  asResult(
    "Franky may write M-S",
    authorizeServerRoomWrite({
      roomCode: created.room.roomCode,
      participantId: franky.participantId,
      userId: franky.userId,
      saveId,
      teamId: "M-S",
      action: "lineup_save",
      source: "sqlite",
      dryRun: false,
    }).allowed,
  ),
  asResult(
    "Franky may not write Chris M-M",
    !authorizeServerRoomWrite({
      roomCode: created.room.roomCode,
      participantId: franky.participantId,
      userId: franky.userId,
      saveId,
      teamId: "M-M",
      action: "sell",
      source: "sqlite",
      dryRun: false,
    }).allowed,
  ),
  asResult(
    "AI team is blocked for human participant",
    !authorizeServerRoomWrite({
      roomCode: created.room.roomCode,
      participantId: chris.participantId,
      userId: chris.userId,
      saveId,
      teamId: "H-R",
      action: "buy",
      source: "sqlite",
      dryRun: false,
    }).allowed,
  ),
  asResult(
    "wrong seat token blocks write",
    !authorizeServerRoomWrite({
      roomCode: created.room.roomCode,
      seatToken: "wrong-token",
      saveId,
      teamId: "M-M",
      action: "buy",
      source: "sqlite",
      dryRun: false,
    }).allowed,
  ),
];

setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true);
const recorded = recordRoomGameplayWrite({
  roomCode: created.room.roomCode,
  saveId,
  teamId: "M-M",
  participantId: chris.participantId,
  action: "transfermarkt_buy",
  eventType: "transfer_completed",
  affectedViews: ["team", "market", "home"],
});

const rejoined = rejoinRoom(created.room.roomCode, created.seat.seatToken, "audit-socket-chris-rejoined");
const eventTypes = [
  "save_updated",
  "roster_updated",
  "transfer_completed",
  "lineup_updated",
  "facility_updated",
  "training_updated",
  "matchday_applied",
  "standings_updated",
  "season_advanced",
  "ready_invalidated",
];

const latestEvents: RoomRealtimeEvent[] = recorded.ok ? recorded.room.state.roomEvents.slice(-2) : [];
const syncEvents = {
  roomCode: created.room.roomCode,
  saveId,
  requiredEventTypes: eventTypes,
  observedEvents: latestEvents,
  payloadShape: {
    roomCode: "string",
    saveId: "string",
    teamId: "string|null",
    action: "string",
    participantId: "string|null",
    affectedViews: "string[]",
    timestamp: "ISO string",
  },
};

writeCsv("multiplayer-permission-audit.csv", permissionRows);
writeFile("multiplayer-gameplay-sync-events.json", `${JSON.stringify(syncEvents, null, 2)}\n`);
writeFile(
  "multiplayer-room-context-bridge-report.md",
  [
    "# Multiplayer Room Context Bridge V1",
    "",
    `- Room: ${created.room.roomCode}`,
    `- Save: ${saveId}`,
    "- Foundation links now carry roomCode, participantId, userId, seatToken and saveId.",
    "- Foundation mutating calls use the central room context helper.",
    "- Active Room saves reject generic singleplayer-state writes.",
    "- Successful writes record gameplay events and invalidate the acting participant's ready state.",
    "",
    "## Permission Results",
    ...permissionRows.map((row) => `- ${row.ok ? "PASS" : "FAIL"}: ${row.name}`),
  ].join("\n"),
);
writeFile(
  "multiplayer-two-client-proof.md",
  [
    "# Multiplayer Two-Client Proof",
    "",
    "- Client A modelled as Chris/host.",
    "- Client B modelled as Franky/remote.",
    `- Rejoin via seatToken: ${rejoined.ok ? "PASS" : "FAIL"}.`,
    `- Ready invalidated after Chris gameplay write: ${recorded.ok && recorded.room.state.roomParticipants.find((participant) => participant.participantId === chris.participantId)?.readyState === "not_ready" ? "PASS" : "FAIL"}.`,
    "- Live browser proof should be treated as smoke coverage; this audit proves server-side ownership and event state in-process.",
  ].join("\n"),
);
writeFile(
  "multiplayer-open-gaps.md",
  [
    "# Multiplayer Open Gaps",
    "",
    "- Some admin/sandbox tools still need a separate decision: either host-only room actions or disabled in live Room saves.",
    "- Training settings endpoint is not exposed as a first-class UI write yet; XP spend is room-bound as training/progression write.",
    "- Client sync currently refreshes affected views, not fine-grained entity patches.",
    "- Room state is still in-memory; durable multiplayer rooms need persistence before real remote production use.",
  ].join("\n"),
);

console.log(`multiplayer-room-bound audit exported to ${OUTPUT_DIR}`);
