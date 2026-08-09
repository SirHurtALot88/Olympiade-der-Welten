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
import { ROOM_FLOW_STEPS } from "@/lib/room/room-flow-controller";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type JsonObject = Record<string, any>;
type OlySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const DEFAULT_BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.join(process.cwd(), "outputs", "multiplayer-e2e");
const SCREENSHOTS = {
  chrisHome: "multiplayer-chris-home.png",
  frankyHome: "multiplayer-franky-home.png",
  readyState: "multiplayer-ready-state.png",
  forbiddenAction: "multiplayer-forbidden-action.png",
  foundationArenaSync: "multiplayer-foundation-arena-sync.png",
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
  // Die "Participant <Name>"-Textzusicherung existierte so nie auf der Room-Seite (RoomPageClient
  // zeigt den Namen nur als reine Tabellenzelle) - data-testid statt sichtbarem Text, siehe
  // app/room/[roomCode]/RoomPageClient.tsx.
  await page
    .getByTestId("room-participant-name")
    .filter({ hasText: expectedName })
    .first()
    .waitFor({ timeout: 20_000 });
  await page.getByTestId("room-code-pill").getByText(roomCode, { exact: false }).waitFor({ timeout: 20_000 });
}

function buildFoundationHref(input: {
  baseUrl: string;
  view: string;
  state: OlyRoomState;
  participant: JsonObject;
  seatToken: string;
  teamId?: string | null;
}) {
  const params = new URLSearchParams({
    view: input.view,
    team: input.teamId ?? input.participant.controlledTeamIds?.[0] ?? "A-A",
    roomCode: input.state.roomCode.toUpperCase(),
    participantId: input.participant.participantId,
    userId: input.participant.userId,
    seatToken: input.seatToken,
    saveId: input.state.multiplayerRoom.saveId,
  });
  return `${input.baseUrl}/foundation?${params.toString()}`;
}

async function openFoundationArenaPage(
  page: Page,
  input: {
    baseUrl: string;
    state: OlyRoomState;
    participant: JsonObject;
    seatToken: string;
  },
) {
  await page.goto(
    buildFoundationHref({
      ...input,
      view: "matchdayArena",
    }),
    { waitUntil: "networkidle" },
  );
  // "nl-matchday-arena" war das Testid der frueheren MatchdayArenaNewLook-Komponente, die es
  // laut Code-Kommentaren in lib/room/use-arena-room-sync.ts zwar noch geben sollte, tatsaechlich
  // aber durch die Discipline-Stage-Arena ersetzt wurde (app/foundation/discipline-stage/arena/
  // DisciplineStageNativeArena.tsx) - "arena-stage" ist deren aktueller Container.
  await page.getByTestId("arena-stage").waitFor({ timeout: 90_000 });
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
  // Aus dem echten Room-Flow-Controller abgeleitet statt hier dupliziert - eine hart codierte
  // Kopie war genau der Grund, warum dieser E2E zuletzt bei "finalize_transfers" haengen blieb:
  // die Liste kannte den (neuen) Step nicht und den (laengst abgeschafften) "xp_spend" noch.
  // `Set<string>` statt `Set<RoomFlowStepId>`: `roomFlowState.step` ist `RoomFlowStepId | string`
  // (types/game.ts) - der breitere String-Typ deckt auch abgeschaffte/unbekannte Legacy-Steps ab.
  const aiAutoSteps = new Set<string>(ROOM_FLOW_STEPS.filter((step) => step.aiAutoStep).map((step) => step.stepId));
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

/**
 * Legt einen eigenen, isolierten Save fuer diesen Lauf an (Snapshot des gerade aktiven Saves),
 * statt "irgendeinen aktiven Save" wiederzuverwenden.
 *
 * Gefundener echter Bug: ein Save bleibt seinem Room PERMANENT gebunden, sobald ein Host beigetreten
 * ist - `getSeatCount()` (lib/room/room-store.ts) zaehlt belegte Sitzplaetze, nicht verbundene; der
 * Host-Sitz bleibt nach `createRoom` immer belegt, auch nach Disconnect. Die "paused"-Markierung in
 * `syncPlayers()`, die `getActiveRoomBySaveId()` (Grundlage von `save_bound_to_different_room`) von
 * so einem Room befreien wuerde, ist dadurch fuer JEDEN echten Room unerreichbar - und nirgends im
 * Code wird `status: "completed"` je gesetzt. Ein Save, der einmal fuer einen Room genutzt wurde,
 * bleibt es fuer die Lebensdauer des Serverprozesses, unabhaengig davon, wie lange niemand mehr
 * verbunden ist. Empirisch bestaetigt: >3 Minuten nach Verbindungsabbruch weiterhin blockiert.
 *
 * Das trifft `scripts/smoke-coop-sync.ts` GENAUSO (nutzt denselben "aktiven Save" per Default) -
 * beide Skripte im selben CI-Lauf gegen denselben Server/DB haetten sich sonst gegenseitig
 * ausgesperrt (der zweite Lauf haette IMMER `save_bound_to_different_room` bekommen). Das ist kein
 * Nebeneffekt dieses Fixes, sondern war latent, seit es zwei room-erzeugende Smokes gibt - nur eben
 * nie beide im selben Lauf scharf. Ein eigener Save pro Lauf umgeht das sauber, behebt aber NICHT
 * den zugrundeliegenden Lifecycle-Bug (siehe Bericht) - der bleibt fuer echte Spieler bestehen, die
 * denselben Save absichtlich in einem NEUEN Room weiterspielen wollen (z. B. nach Verlust des
 * Raum-Codes).
 */
async function ensureIsolatedMultiplayerE2ESave(baseUrl: string) {
  const persistence = createPersistenceService();
  const bootstrap = persistence.bootstrapSingleplayerSave().save;
  // `status: "archived"`, NICHT "active": `createScenarioSnapshot` (lib/persistence/save-repository.ts)
  // ruft bei status "active" intern `setActiveSave` auf - das haette den globalen "aktive
  // Save"-Zeiger umgebogen und GENAU das Problem reproduziert, das dieser ganze Save erst umgehen
  // soll (z. B. app:smoke-coop-sync haette dann DIESEN Save als "aktiv" vorgefunden). "archived"
  // laesst den Save unangetastet lesbar - `getSaveById`/das `saveId`-Query von
  // /api/singleplayer-state filtern nicht nach Status - ohne den globalen Zeiger zu beruehren.
  const snapshot = persistence.createScenarioSnapshot({
    sourceSaveId: bootstrap.saveId,
    name: `Multiplayer E2E Smoke ${new Date().toISOString()}`,
    status: "archived",
    scenarioMeta: {
      scenarioType: "manager_multiplayer_test",
      label: "Multiplayer E2E Smoke",
      description: "Isolierter Save fuer scripts/smoke-multiplayer-e2e.ts - nie mit anderen Smokes geteilt.",
      createdAt: new Date().toISOString(),
      sourceSaveId: bootstrap.saveId,
      saveCategory: "manual",
    },
  });
  const scoped = await fetchJson(baseUrl, `/api/singleplayer-state?saveId=${encodeURIComponent(snapshot.saveId)}`);
  return { saveId: snapshot.saveId, gameState: scoped.save?.gameState };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let server: ChildProcessWithoutNullStreams | null = null;
  let browser: Browser | null = null;
  let socketA: OlySocket | null = null;
  let socketB: OlySocket | null = null;

  try {
    server = await ensureServer(options.baseUrl, options.noStart);
    const isolatedSave = await ensureIsolatedMultiplayerE2ESave(options.baseUrl);
    const saveId = isolatedSave.saveId;

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

    while (state.roomFlowState.step !== "arena") {
      if (["standings", "season_review"].includes(state.roomFlowState.step)) {
        break;
      }
      state = await completeStep({
        hostSocket: socketA,
        roomCode,
        chrisSeat: created.seatToken,
        frankySeat: joined.seatToken,
        currentState: state,
      });
    }

    let foundationArenaSync = {
      ok: false,
      reason: "arena_step_not_reached",
      hostSlotRevealIndex: null as number | null,
      guestSawHostControlledCopy: false,
    };

    if (state.roomFlowState.step === "arena") {
      // Die Discipline-Stage-Arena startet den Reveal-Sync nur, wenn `getMatchdayLeagueLineupReadiness`
      // fuer ALLE 32 Liga-Teams "bereit" meldet (echte Aufstellung + Formkarten). Dieses V1-Skript
      // schreibt - wie schon fuer sell/buy/facilities/training/lineup/formcards weiter oben - bewusst
      // KEINE echten Gameplay-Daten (siehe writeAudit.note unten), kann das Client-Gate also nicht ueber
      // echte Aufstellungen erfuellen. Der servergetriebene Start-Socket-Event ist von diesem Gate
      // unabhaengig (das Gate lebt rein im Client-Effect, siehe DisciplineStageArena.tsx), genau wie es
      // `scripts/audit-koop-spielbarkeit.ts` (B3) fuer den Server-Pfad bereits verifiziert — hier wird
      // derselbe Weg genommen, um die Arena fuer den DOM-Teil dieses Tests ueberhaupt erreichbar zu
      // machen.
      //
      // "arena-coop-ready-gate" / "Bereit für den Spieltag" / "Weiter" / "Phase X/7" waren
      // Selektoren der frueheren MatchdayArenaNewLook-Komponente. Die Arena wurde seither durch
      // die Discipline-Stage-Arena ersetzt (app/foundation/discipline-stage/arena/
      // DisciplineStageNativeArena.tsx) - deren Coop-Gate traegt eigene, stabilere Testids
      // (arena-coop-status/arena-coop-ready/arena-coop-follow/arena-primary-step).
      await openFoundationArenaPage(pageA, {
        baseUrl: options.baseUrl,
        state,
        participant: chris,
        seatToken: created.seatToken,
      });
      await openFoundationArenaPage(pageB, {
        baseUrl: options.baseUrl,
        state,
        participant: franky,
        seatToken: joined.seatToken,
      });

      const coopStatusA = pageA.getByTestId("arena-coop-status");
      const coopStatusB = pageB.getByTestId("arena-coop-status");
      await coopStatusA.waitFor({ timeout: 30_000 });
      await coopStatusB.waitFor({ timeout: 30_000 });

      // Beide Seiten sind bewusst VOR dem Arena-Start geladen: der Guest muss den
      // "Warte auf den Host"-Hinweis sehen (arenaSyncState noch "idle"), bevor der Host ueberhaupt
      // gestartet hat - das ist der Zustand, den ein echter Mitspieler beim Betreten zuerst sieht.
      await pageB.getByTestId("arena-coop-follow").getByText("Warte auf den Host").waitFor({ timeout: 20_000 });
      screenshots.foundationArenaSync = await screenshot(pageA, "foundationArenaSync");

      // Die Discipline-Stage-Arena startet den Reveal-Sync nur automatisch, wenn
      // `getMatchdayLeagueLineupReadiness` fuer ALLE 32 Liga-Teams "bereit" meldet (echte
      // Aufstellung + Formkarten). Dieses V1-Skript schreibt - wie schon fuer
      // sell/buy/facilities/training/lineup/formcards weiter oben - bewusst KEINE echten
      // Gameplay-Daten (siehe writeAudit.note unten), kann das Client-Gate also nicht ueber echte
      // Aufstellungen erfuellen. Der servergetriebene Start-Socket-Event ist von diesem Gate
      // unabhaengig (das Gate lebt rein im Client-Effect), genau wie es
      // `scripts/audit-koop-spielbarkeit.ts` (B3) fuer den Server-Pfad bereits verifiziert - hier
      // wird derselbe Weg genommen, um den Reveal fuer den DOM-Teil dieses Tests ueberhaupt
      // erreichbar zu machen. Beide Browser sind schon offen und reagieren auf den folgenden
      // Broadcast wie auf jeden echten Room-Sync auch.
      //
      // Gefundener echter Bug beim ersten Anlauf dieses Fixes: `startRoomArena` OHNE explizites
      // matchdayId liess den Server auf `String(activeMatchday)` ("1") zurueckfallen, waehrend die
      // Discipline-Stage-Arena selbst mit dem echten `gameState.matchdayState.matchdayId`
      // ("matchday-1") scoped (`matchesArenaScope` in lib/room/arena-sync-state.ts vergleicht
      // exact) - das Ready-Gate blieb dadurch fuer die UI unsichtbar (arenaSyncState "lief", aber
      // ausserhalb des vom Client erwarteten Scopes), obwohl der Server den Sync korrekt hielt.
      // Der echte Client (DisciplineStageArena.tsx) uebergibt matchdayId/seasonId immer explizit -
      // hier tun wir dasselbe, statt uns auf den (fuer echte Aufrufer nie genutzten) Server-Fallback
      // zu verlassen. Fix des Fallbacks selbst: lib/room/arena-sync-state.ts.
      // Scoped auf `saveId`, NICHT den global "aktiven" Save: dieses Skript aktiviert seinen
      // isolierten Save bewusst nicht global (siehe ensureIsolatedMultiplayerE2ESave), also wuerde
      // eine ungescopte Abfrage hier den FALSCHEN Save lesen.
      const matchdayScope = await fetchJson(options.baseUrl, `/api/singleplayer-state?saveId=${encodeURIComponent(saveId)}`);
      const currentMatchdayId = matchdayScope.save?.gameState?.matchdayState?.matchdayId ?? null;
      state = await emitAndWait(
        socketA,
        "startRoomArena",
        {
          roomCode,
          seatToken: created.seatToken,
          seasonId: state.roomFlowState.activeSeasonId,
          matchdayId: currentMatchdayId,
          maxSlotRevealCountByDiscipline: { d1: 2, d2: 2 },
        },
        (next) => next.arenaSyncState?.status === "ready_check",
        "start-room-arena",
      );

      // Co-op ready gate: both real participants control teams, so the shared reveal must NOT
      // start until both click ready — verified via the actual UI (not raw socket emits) to
      // exercise the real DisciplineStageNativeArena + useArenaRoomSync wiring end-to-end.
      await pageA.getByTestId("arena-coop-ready").waitFor({ timeout: 20_000 });
      await pageB.getByTestId("arena-coop-ready").waitFor({ timeout: 20_000 });

      const primaryStepA = pageA.getByTestId("arena-primary-step");
      const primaryStepB = pageB.getByTestId("arena-primary-step");
      // Der Ticker ist vor dem ersten Reveal-Schritt leer ("Läuft, sobald die erste Etappe
      // startet.") - ein zuverlässigerer "ist wirklich etwas passiert"-Beleg als die
      // primary-step-Beschriftung. Die zeigt naemlich fuer den Gast IMMER "Start · Etappe 1/N":
      // `started` (DisciplineStageNativeArena.tsx) wird nur im eigenen onClick-Handler gesetzt,
      // den der Gast nie ausloest (Knopf ist disabled). Der Gast folgt dem Host stattdessen ueber
      // einen separaten Effekt (`roomSync.syncedRound > round` -> `advance()`), der round/Ticker
      // trotzdem korrekt mitzieht - nur das Knopf-Label bleibt hier ein rein lokaler, fuer den
      // Gast nie erreichter Zustand. Kein Sync-Bug, nur ein irrefuehrender Test-Proxy - hier durch
      // den echten Ticker-Inhalt ersetzt.
      const tickerPlaceholder = "Läuft, sobald die erste Etappe startet.";

      await pageA.getByTestId("arena-coop-ready").click();
      await coopStatusA.getByText(/Warte auf: Franky/).waitFor({ timeout: 20_000 });
      await pageB.getByTestId("arena-coop-ready").click();

      // Once both are ready the ready-toggle button disappears on both screens (coopGate.active
      // flips false) and the host-controlled note appears for the guest.
      await pageA.getByTestId("arena-coop-ready").waitFor({ state: "detached", timeout: 20_000 });
      await pageB.getByTestId("arena-coop-ready").waitFor({ state: "detached", timeout: 20_000 });
      await pageB.getByTestId("arena-coop-follow").getByText("Der Host steuert den Reveal").waitFor({ timeout: 20_000 });

      // Guest controls must be locked: the primary-step button reflects the
      // gate/host-only rule via the disabled attribute.
      const guestWeiterDisabled = await primaryStepB.isDisabled();

      // Host advances via the real primary-step button — this is the lockstep-reveal path
      // (`handleHostRoomArenaAdvance` -> `useArenaRoomSync().emitHostRoomArenaAdvance` -> socket
      // -> server -> `roomState` -> `onApplyRevealSync` on both screens). Wir warten auf den
      // Ticker-Inhalt, NICHT auf den Knopf-Text (siehe Kommentar oben) - das ist der reale Beweis,
      // dass der Reveal-Effekt auf dem GAST-Bildschirm gelaufen ist, nicht nur beim Host.
      await primaryStepA.click();

      await pageB.getByText(tickerPlaceholder).waitFor({ state: "detached", timeout: 45_000 });
      screenshots.resultSync = await screenshot(pageB, "resultSync");

      foundationArenaSync = {
        ok: true,
        reason: "discipline_stage_arena_coop_gate_and_host_advance_synced_to_guest",
        hostSlotRevealIndex: null,
        guestSawHostControlledCopy: guestWeiterDisabled,
      };
    }

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

    // Das ist der frueher dokumentierte CI-Blocker: nach einem Reload der Foundation-Ansicht
    // muss Frankys Teilnehmer-Identitaet wieder auftauchen (Room-Chip aus PR #374,
    // app/foundation/FoundationShellRouterBody.tsx). Die alte Zusicherung suchte den Text
    // "Participant Franky", den es auf dieser Seite nie gab (der Chip zeigt nur den nackten
    // Namen) - data-testid statt sichtbarem Text, der ist stabiler.
    await pageB.reload({ waitUntil: "networkidle" });
    await pageB.getByTestId("foundation-room-participant-identity").getByText("Franky").waitFor({ timeout: 20_000 });
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
      foundationArenaSync,
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
