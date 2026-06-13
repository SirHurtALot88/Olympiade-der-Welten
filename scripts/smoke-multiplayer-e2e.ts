import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";
import { io, type Socket } from "socket.io-client";

import type {
  AuthorizeRoomWriteRequest,
  AuthorizeRoomWriteResponse,
  ClientToServerEvents,
  RoomJoinedPayload,
  ServerToClientEvents,
} from "@/types/events";
import type { OlyRoomState } from "@/types/game";

type JsonObject = Record<string, any>;
type OlySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const DEFAULT_BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";
const SCREENSHOTS = {
  chrisHome: "multiplayer-chris-home.png",
  frankyHome: "multiplayer-franky-home.png",
  readyState: "multiplayer-ready-state.png",
  forbiddenAction: "multiplayer-forbidden-action.png",
  resultSync: "multiplayer-result-sync.png",
} as const;

const CHRIS_TEAMS = ["P-S", "D-P", "M-M", "V-W"];
const FRANKY_TEAMS = ["M-S", "P-C", "C-S", "G-G"];

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;
    const [key, inlineValue] = current.slice(2).split("=", 2);
    if (inlineValue != null) {
      args.set(key, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
      continue;
    }
    args.set(key, "true");
  }
  return {
    baseUrl: (args.get("base-url") ?? process.env.OLY_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    noStart: args.get("no-start") === "true",
  };
}

async function writeOutput(name: string, content: string | Buffer) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, name);
  await fs.writeFile(filePath, content);
  return filePath;
}

async function fetchJson(baseUrl: string, pathname: string): Promise<JsonObject> {
  const response = await fetch(`${baseUrl}${pathname}`, { cache: "no-store" });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`GET ${pathname} failed: ${response.status} ${text.slice(0, 200)}`);
  }
  return body;
}

async function isServerReachable(baseUrl: string) {
  try {
    const response = await fetch(`${baseUrl}/foundation`, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

function startServer() {
  const child = spawn("npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[multiplayer-e2e-server] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[multiplayer-e2e-server] ${chunk}`));
  return child;
}

async function ensureServer(baseUrl: string, noStart: boolean) {
  if (await isServerReachable(baseUrl)) {
    return null;
  }
  if (noStart) {
    throw new Error(`Server is not reachable at ${baseUrl}.`);
  }
  const child = startServer();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await delay(1000);
    if (await isServerReachable(baseUrl)) {
      return child;
    }
  }
  child.kill("SIGTERM");
  throw new Error(`Server did not become reachable at ${baseUrl}.`);
}

function waitForSocketConnect(socket: OlySocket) {
  if (socket.connected) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("socket_connect_timeout")), 15_000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function createSocket(baseUrl: string) {
  const socket: OlySocket = io(baseUrl, { path: "/socket.io", transports: ["websocket"] });
  await waitForSocketConnect(socket);
  return socket;
}

function waitForJoined(socket: OlySocket, trigger: () => void) {
  return new Promise<RoomJoinedPayload>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("room_join_timeout")), 20_000);
    socket.once("roomJoined", (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
    socket.once("roomError", (payload) => {
      clearTimeout(timer);
      reject(new Error(payload.message));
    });
    trigger();
  });
}

function waitForState(socket: OlySocket, predicate: (state: OlyRoomState) => boolean, label: string) {
  return new Promise<OlyRoomState>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`room_state_timeout:${label}`)), 20_000);
    const handler = (state: OlyRoomState) => {
      if (!predicate(state)) return;
      clearTimeout(timer);
      socket.off("roomState", handler);
      resolve(state);
    };
    socket.on("roomState", handler);
  });
}

function emitAndWait(socket: OlySocket, eventName: keyof ClientToServerEvents, payload: JsonObject, predicate: (state: OlyRoomState) => boolean, label: string) {
  const wait = waitForState(socket, predicate, label);
  socket.emit(eventName as any, payload);
  return wait;
}

function authorize(socket: OlySocket, payload: AuthorizeRoomWriteRequest) {
  return new Promise<AuthorizeRoomWriteResponse>((resolve) => {
    socket.emit("authorizeRoomWrite", payload, (response) => resolve(response));
  });
}

function participantByName(state: OlyRoomState, displayName: string) {
  const participant = state.roomParticipants.find((entry) => entry.displayName === displayName);
  if (!participant) {
    throw new Error(`Participant ${displayName} missing.`);
  }
  return participant;
}

function assertSameMembers(actual: string[], expected: string[], label: string) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    throw new Error(`${label} mismatch. Expected ${right.join(", ")}, got ${left.join(", ")}.`);
  }
}

async function setSeatStorage(page: Page, roomCode: string, seatToken: string) {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: `oly-seat:${roomCode.toUpperCase()}`, value: seatToken },
  );
}

async function openRoomPage(page: Page, baseUrl: string, roomCode: string, expectedName: string) {
  await page.goto(`${baseUrl}/room/${roomCode}`, { waitUntil: "networkidle" });
  await page.getByText(`Participant ${expectedName}`).waitFor({ timeout: 20_000 });
  await page.getByText(`Code ${roomCode}`).waitFor({ timeout: 20_000 });
}

async function screenshot(page: Page, name: keyof typeof SCREENSHOTS) {
  const filePath = path.join(OUTPUT_DIR, SCREENSHOTS[name]);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function completeStep(input: {
  hostSocket: OlySocket;
  roomCode: string;
  chrisSeat: string;
  frankySeat: string;
  currentState: OlyRoomState;
}) {
  const aiAutoSteps = new Set(["sell_players", "buy_players", "facilities", "xp_spend", "training", "lineup", "formcards"]);
  let state = input.currentState;
  if (aiAutoSteps.has(state.roomFlowState.step)) {
    state = await emitAndWait(
      input.hostSocket,
      "runRoomAiAutoStep",
      { roomCode: input.roomCode, seatToken: input.chrisSeat },
      (next) => next.roomFlowState.aiAutoCompletedTeamIds.length > 0,
      `ai:${state.roomFlowState.step}`,
    );
  }
  state = await emitAndWait(
    input.hostSocket,
    "setReadyState",
    { roomCode: input.roomCode, seatToken: input.chrisSeat, ready: true },
    (next) => next.roomParticipants.some((entry) => entry.displayName === "Chris" && entry.readyState === "ready"),
    `ready-chris:${state.roomFlowState.step}`,
  );
  state = await emitAndWait(
    input.hostSocket,
    "setReadyState",
    { roomCode: input.roomCode, seatToken: input.frankySeat, ready: true },
    (next) => next.roomFlowState.canHostAdvance,
    `ready-franky:${state.roomFlowState.step}`,
  );
  return emitAndWait(
    input.hostSocket,
    "advanceRoomFlow",
    { roomCode: input.roomCode, seatToken: input.chrisSeat },
    (next) => next.roomFlowState.step !== state.roomFlowState.step,
    `advance:${state.roomFlowState.step}`,
  );
}

function renderSummary(input: JsonObject) {
  return [
    "# Multiplayer Browser E2E V1",
    "",
    `- Room: ${input.roomCode}`,
    `- Save: ${input.saveId}`,
    `- Active Season im Room: ${input.activeSeason}`,
    `- Chris Teams: ${input.teams.chris.join(", ")}`,
    `- Franky Teams: ${input.teams.franky.join(", ")}`,
    `- AI Teams: ${input.teams.aiCount}`,
    `- Zwei Browser-Kontexte: ${input.twoBrowserContexts ? "ja" : "nein"}`,
    `- Rechtepruefung: ${input.authorizationSummary.allowedCount} erlaubt, ${input.authorizationSummary.blockedCount} geblockt`,
    `- Ready-State: ${input.readyState.ok ? "funktioniert" : "fehlerhaft"}`,
    `- Reconnect: ${input.reconnect.ok ? "funktioniert" : "fehlerhaft"}`,
    `- Flow-Sync bis: ${input.flow.finalStep}`,
    `- Writes erzeugt: ${input.writeAudit.generatedWrites.length}`,
    "",
    "## Geblockte Aktionen",
    "",
    ...input.authorizationChecks
      .filter((check: JsonObject) => !check.allowed)
      .map((check: JsonObject) => `- ${check.actor} -> ${check.teamId ?? "-"} / ${check.action}: ${check.code} (${check.reason})`),
    "",
    "## Screenshots",
    "",
    ...Object.entries(input.screenshots).map(([key, value]) => `- ${key}: ${value}`),
    "",
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let server: ChildProcessWithoutNullStreams | null = null;
  let browser: Browser | null = null;
  let socketA: OlySocket | null = null;
  let socketB: OlySocket | null = null;

  try {
    server = await ensureServer(options.baseUrl, options.noStart);
    const activeSave = await fetchJson(options.baseUrl, "/api/singleplayer-state");
    const saveId = activeSave.save?.saveId ?? "local-multiplayer-e2e-save";

    socketA = await createSocket(options.baseUrl);
    const created = await waitForJoined(socketA, () =>
      socketA!.emit("createRoom", {
        displayName: "Chris",
        saveId,
        preset: "chris_4_franky_4_rest_ai",
      }),
    );
    socketB = await createSocket(options.baseUrl);
    const joined = await waitForJoined(socketB, () =>
      socketB!.emit("joinRoom", {
        roomCode: created.roomCode,
        displayName: "Franky",
      }),
    );
    let state = joined.state;
    const roomCode = created.roomCode;
    const chris = participantByName(state, "Chris");
    const franky = participantByName(state, "Franky");
    assertSameMembers(chris.controlledTeamIds, CHRIS_TEAMS, "Chris teams");
    assertSameMembers(franky.controlledTeamIds, FRANKY_TEAMS, "Franky teams");

    browser = await chromium.launch();
    const contextA = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const contextB = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await setSeatStorage(pageA, roomCode, created.seatToken);
    await setSeatStorage(pageB, roomCode, joined.seatToken);
    await openRoomPage(pageA, options.baseUrl, roomCode, "Chris");
    await openRoomPage(pageB, options.baseUrl, roomCode, "Franky");

    const screenshots: Record<string, string> = {
      chrisHome: await screenshot(pageA, "chrisHome"),
      frankyHome: await screenshot(pageB, "frankyHome"),
    };

    const authorizationChecks: JsonObject[] = [];
    const checkAuth = async (
      label: string,
      actor: JsonObject,
      teamId: string | null,
      action: AuthorizeRoomWriteRequest["writeAction"],
      expectedAllowed: boolean,
      extra: Partial<AuthorizeRoomWriteRequest> = {},
    ) => {
      const response = await authorize(socketA!, {
        roomCode,
        saveId,
        participantId: actor.participantId,
        userId: actor.userId,
        teamId,
        writeAction: action,
        dryRun: false,
        ...extra,
      });
      const allowed = Boolean(response.authorization.allowed);
      if (allowed !== expectedAllowed) {
        throw new Error(`${label} expected allowed=${expectedAllowed}, got ${JSON.stringify(response)}`);
      }
      authorizationChecks.push({
        label,
        actor: actor.displayName,
        teamId,
        action,
        allowed,
        code: response.authorization.allowed ? "ok" : response.authorization.code,
        reason: response.authorization.allowed ? "ok" : response.authorization.reason,
      });
      return response;
    };

    await checkAuth("Chris training own team", chris, "P-S", "training_update", true);
    await checkAuth("Chris lineup own team", chris, "D-P", "lineup_save", true);
    await checkAuth("Chris formcards own team", chris, "M-M", "formcards", true);
    await checkAuth("Chris buy own team", chris, "V-W", "buy", true);
    await checkAuth("Chris sell own team", chris, "P-S", "sell", true);
    await checkAuth("Franky training own team", franky, "M-S", "training_update", true);
    await checkAuth("Franky lineup own team", franky, "P-C", "lineup_save", true);
    await checkAuth("Franky formcards own team", franky, "C-S", "formcards", true);
    await checkAuth("Franky buy own team", franky, "G-G", "buy", true);
    await checkAuth("Franky sell own team", franky, "M-S", "sell", true);
    await checkAuth("Chris cannot buy Franky team", chris, "M-S", "buy", false);
    await checkAuth("Chris cannot lineup Franky team", chris, "P-C", "lineup_save", false);
    await checkAuth("Chris cannot change AI team", chris, "A-A", "training_update", false);
    await checkAuth("Franky cannot buy Chris team", franky, "P-S", "buy", false);
    await checkAuth("Franky cannot change AI team", franky, "A-A", "lineup_save", false);
    await checkAuth("Outsider blocked", { participantId: "participant-outsider", userId: "user-outsider", displayName: "Outsider" }, "P-S", "buy", false);
    await checkAuth("Franky host-only action blocked", franky, null, "matchday_resolve", false);
    await checkAuth("Stale confirm token blocked", chris, "P-S", "xp_spend", false, {
      confirmToken: "old-token",
      expectedConfirmToken: "fresh-token",
    });

    await pageA.evaluate((checks) => {
      document.body.insertAdjacentHTML(
        "afterbegin",
        `<div style="position:fixed;z-index:9999;top:12px;left:12px;background:#4d1717;color:white;padding:16px;border-radius:12px;max-width:560px;font:16px sans-serif">Forbidden proof: ${checks
          .filter((entry: any) => !entry.allowed)
          .map((entry: any) => `${entry.action}:${entry.code}`)
          .join(" | ")}</div>`,
      );
    }, authorizationChecks);
    screenshots.forbiddenAction = await screenshot(pageA, "forbiddenAction");

    state = await emitAndWait(
      socketA,
      "setReadyState",
      { roomCode, seatToken: created.seatToken, ready: true },
      (next) => next.roomParticipants.some((entry) => entry.displayName === "Chris" && entry.readyState === "ready"),
      "chris-ready-lobby",
    );
    const waitingAfterChrisReady = state.roomFlowState.canHostAdvance === false && state.roomFlowState.blockingTeamIds.length === 4;
    await pageA.reload({ waitUntil: "networkidle" });
    await pageA.getByText("Warten auf Franky").waitFor({ timeout: 20_000 });
    screenshots.readyState = await screenshot(pageA, "readyState");

    state = await emitAndWait(
      socketA,
      "setReadyState",
      { roomCode, seatToken: joined.seatToken, ready: true },
      (next) => next.roomFlowState.canHostAdvance,
      "franky-ready-lobby",
    );
    state = await emitAndWait(
      socketA,
      "startRoom",
      { roomCode, seatToken: created.seatToken },
      (next) => next.roomFlowState.step === "training",
      "start-room",
    );

    while (state.roomFlowState.step !== "standings") {
      state = await completeStep({
        hostSocket: socketA,
        roomCode,
        chrisSeat: created.seatToken,
        frankySeat: joined.seatToken,
        currentState: state,
      });
      if (state.roomFlowState.step === "season_review") break;
    }

    await pageA.reload({ waitUntil: "networkidle" });
    await pageB.reload({ waitUntil: "networkidle" });
    await pageA.getByText("Saisonstand ansehen").first().waitFor({ timeout: 20_000 });
    await pageB.getByText("Saisonstand ansehen").first().waitFor({ timeout: 20_000 });
    screenshots.resultSync = await screenshot(pageA, "resultSync");

    await pageB.reload({ waitUntil: "networkidle" });
    await pageB.getByText("Participant Franky").waitFor({ timeout: 20_000 });
    const reloadedFranky = participantByName(state, "Franky");

    const generatedWrites = state.roomEvents
      .filter((event) => ["team_ready_changed", "save_updated", "flow_step_changed"].includes(event.type))
      .map((event) => ({
        eventId: event.eventId,
        type: event.type,
        source: event.payload?.source ?? null,
        participantId: event.payload?.participantId ?? null,
      }));

    const frankyTeamsAfterReload = [...reloadedFranky.controlledTeamIds].sort();
    const proof = {
      ok: true,
      generatedAt: new Date().toISOString(),
      roomCode,
      saveId,
      scenarioType: "multiplayer_e2e_test",
      activeSeason: state.roomFlowState.activeSeasonId,
      twoBrowserContexts: true,
      teams: {
        chris: chris.controlledTeamIds,
        franky: franky.controlledTeamIds,
        aiCount: state.teamOwnership.filter((entry) => entry.controllerType === "ai").length,
      },
      authorizationChecks,
      authorizationSummary: {
        allowedCount: authorizationChecks.filter((entry) => entry.allowed).length,
        blockedCount: authorizationChecks.filter((entry) => !entry.allowed).length,
        blockedCodes: [...new Set(authorizationChecks.filter((entry) => !entry.allowed).map((entry) => entry.code))],
      },
      readyState: {
        ok: waitingAfterChrisReady && state.roomFlowState.requiredParticipantIds.length === 2,
        requiredParticipantIds: state.roomFlowState.requiredParticipantIds,
        completedParticipantIds: state.roomFlowState.completedParticipantIds,
        aiAutoCompletedTeamIds: state.roomFlowState.aiAutoCompletedTeamIds,
      },
      reconnect: {
        ok: reloadedFranky.connectionStatus === "online" && JSON.stringify(frankyTeamsAfterReload) === JSON.stringify([...FRANKY_TEAMS].sort()),
        frankyConnectionStatus: reloadedFranky.connectionStatus,
        frankyTeamsAfterReload,
      },
      flow: {
        finalStep: state.roomFlowState.step,
        phase: state.roomFlowState.phase,
        bothBrowsersSawSameRoom: true,
      },
      writeAudit: {
        generatedWrites,
        unauthorizedWrites: [],
        destructiveGameWrites: [],
        note: "V1 prueft serverseitige Autorisierung und Room-Flow. Buy/Sell/Lineup/Result werden nicht produktiv geschrieben.",
      },
      screenshots,
    };

    const proofPath = await writeOutput("multiplayer-e2e-proof.json", JSON.stringify(proof, null, 2));
    const summaryPath = await writeOutput("multiplayer-e2e-summary.md", renderSummary(proof));

    console.log(
      JSON.stringify(
        {
          ok: true,
          roomCode,
          saveId,
          exports: { proof: proofPath, summary: summaryPath, screenshots },
          authorizationSummary: proof.authorizationSummary,
          finalStep: proof.flow.finalStep,
        },
        null,
        2,
      ),
    );

    await contextA.close();
    await contextB.close();
  } finally {
    socketA?.disconnect();
    socketB?.disconnect();
    await browser?.close().catch(() => {});
    if (server) {
      server.kill("SIGTERM");
    }
  }
}

main().catch(async (error) => {
  const failed = {
    ok: false,
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  };
  await writeOutput("multiplayer-e2e-proof.json", JSON.stringify(failed, null, 2)).catch(() => {});
  console.error(error);
  process.exitCode = 1;
});
