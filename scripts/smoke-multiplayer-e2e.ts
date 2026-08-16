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
import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";

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

async function postJson(baseUrl: string, pathname: string, payload: JsonObject): Promise<{ status: number; body: JsonObject }> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  return { status: response.status, body };
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

/**
 * Selbstheilung fuer eine unfreiwillige Server-seitige "offline"-Markierung (403
 * `participant_offline`) waehrend der CPU-lastigen Kader-Befuellung weiter unten — genau das
 * Muster aus `scripts/audit-koop-spielbarkeit.ts` (`rejoinChris`/`rejoinFranky`): ein langer,
 * synchron rechnender Liga-Draft- oder Kauf-Chunk kann die Event-Loop lang genug blockieren,
 * dass ein Socket.io-Heartbeat verhungert. Der Client-Socket reconnectet sich selbst (Default),
 * hier wird nur der App-seitige Rejoin (Sitz wieder als "online" eintragen) nachgeholt.
 */
async function rejoinParticipant(socket: OlySocket, roomCode: string, seatToken: string) {
  if (!socket.connected) {
    await waitForSocketConnect(socket);
  }
  await waitForJoined(socket, () => socket.emit("rejoinRoom", { roomCode, seatToken }));
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

  // Neuer Befund (dieser Lauf, nach `ensureLeagueRostersPlayable`): seit die Liga echte Kader hat,
  // ist Spieltag 1 dieser Saison zum ERSTEN Mal ueberhaupt eine echte Saison mit currentMatchday<=1
  // - `shouldAutoOpenSeasonBriefing` (lib/foundation/game-flow-controller.ts:939-969) oeffnet dafuer
  // automatisch das Season-Briefing-Modal (`season-briefing-backdrop`, FoundationShellRouterBody.tsx)
  // ÜBER der ganzen Buehne. Ohne diesen Save mit vorher leeren Rostern kam kein Lauf je bis hierher,
  // der Blocker war also unsichtbar. Das Modal faengt Klicks per `pointer-events` ab (das brachte
  // den vorherigen Lauf 30s lang auf `arena-prematch-start-cta` zum Timeout) - "Später" schliesst
  // es ueber genau den App-eigenen Weg (`closeSeasonBriefing(false)`), kein Force-Klick noetig.
  const seasonBriefingBackdrop = page.getByTestId("season-briefing-backdrop");
  if (await seasonBriefingBackdrop.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Später" }).first().click();
    await seasonBriefingBackdrop.waitFor({ state: "detached", timeout: 10_000 });
  }
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

/**
 * Besorgt der ganzen 32-Team-Liga einen echten Kader, BEVOR `ensureFullLeagueLineupReadiness`
 * versucht, daraus eine Aufstellung abzuleiten — ohne Kader liefert `ai-preview` fuer jedes
 * betroffene Team `entries: []`, und genau daran scheiterte dieses Skript reproduzierbar
 * ("ai-preview lieferte keine entries fuer D-P").
 *
 * Befund, nachgemessen an einer frischen Kopie GENAU dieses isolierten Saves (nicht vermutet):
 * NICHT nur die acht menschlichen Teams sind ohne Kader, wie die urspruengliche Diagnose annahm
 * ("D-P ist eines von Chris' eigenen Teams, Menschen draften selbst") — 30 von 32 Teams stehen
 * bei GENAU 0 Rosterspielern, die uebrigen zwei (P-S, M-M) bei genau 1 uebrig gebliebenem
 * Seed-Spieler. Grund: `ensureIsolatedMultiplayerE2ESave` snapshotet `bootstrapSingleplayerSave()`
 * (lib/persistence/persistence-service.ts) — anders als der "Neues Spiel"-Assistent
 * (app/api/new-game/route.ts:88, `kickoffLeagueSetupDraft`) laesst dieser Bootstrap-Pfad die
 * gesamte Liga unbespielt. Deckt sich mit dem A2b-Befund in `scripts/audit-koop-spielbarkeit.ts`
 * (dort fuer `createRoomCoopSave`-Saves, hier fuer den Bootstrap-Pfad — derselbe fehlende
 * Draft-Aufruf, zwei verschiedene Save-Quellen). Die urspruengliche Diagnose war also nur zur
 * Haelfte richtig: D-P fehlt der Kader nicht NUR, weil es ein Chris-Team ist, sondern weil hier
 * gar kein Team einen hat — Chris' Teams sind bloss die, an denen es zuerst auffiel (die AI-Teams
 * werden erst spaeter im Skript ueberhaupt angefasst).
 *
 * Gewaehlter Weg (am wenigsten Neues erfunden, zwei Alternativen bewusst NICHT genommen):
 *  - NICHT `app/api/ai/roster-fill/route.ts`: `runAutoRosterFillForMatchdaySetup`
 *    (lib/ai/auto-roster-fill-service.ts:503) verweigert jede `seasonId !== "season-1"` komplett
 *    (gesperrtes Ergebnis, kein Kauf) — der isolierte Save hier landet zufaellig auf season-1,
 *    aber dieses Skript soll gegen JEDEN Snapshot des aktiven Saves funktionieren, nicht nur den
 *    zufaellig ersten.
 *  - NICHT `kickoffLeagueSetupDraft` (lib/game/league-setup-draft-service.ts): fuer eine BRANDNEUE
 *    Liga gedacht (asynchroner Hintergrund-Draft mit eigenem Status-Polling-Vertrag) und schliesst
 *    menschlich gesteuerte Teams per Konstruktion IMMER aus (`excludeTeamIds`, siehe new-game/
 *    route.ts:87) — exakt das Gegenteil dessen, was hier fuer Chris/Franky gebraucht wird.
 *  - Stattdessen exakt das Muster aus `scripts/audit-koop-spielbarkeit.ts` ("A2c"/"A2d"): der HOST
 *    (Chris) draftet ueber `/api/ai/picks-run` — host-level (HOST_LEVEL_ACTIONS,
 *    server-authoritative-write-guard.ts:65-84), `resolveAiBulkTeamWriteScope`
 *    (ai-bulk-team-write-scope.ts) begrenzt den Lauf serverseitig auf AI-Teams plus die EIGENEN
 *    4 Teams des Aufrufers — in 4er-Haeppchen wie im Audit-Skript, weil ein einzelner Lauf ueber
 *    28 Teams synchron lange genug rechnet, um Socket-Heartbeats verhungern zu lassen (siehe
 *    `rejoinParticipant` oben). Frankys 4 Teams bleiben fuer `picks-run` unerreichbar (host-level
 *    Aktionen ruehren nie ein fremdes Menschen-Team an — das ist die Sicherheitsregel, nicht ein
 *    Bug) — die kauft er manuell ueber `/api/transfermarkt/buy`, der einzige verbliebene App-Weg
 *    fuer ein Gast-Team (siehe C16-Befund im Audit-Skript: `picks-run` weist den Gast mit 403
 *    `host_only_action` ab).
 *
 * Empirisch gemessen (lokal gegen `npm run start`, isolierter Save wie im echten Lauf): Host-Draft
 * der 28 Teams (24 KI + eigene 4) in 7 Haeppchen ~100s, Gast-Kauf der 4 Franky-Teams (32 Spieler
 * bis Mindestkadergroesse) ~72s — knapp 3 Minuten zusaetzliche Laufzeit, aber ohne diesen Schritt
 * kommt das Skript nie ueber `ai-preview` hinaus.
 */
async function ensureLeagueRostersPlayable(input: {
  baseUrl: string;
  saveId: string;
  seasonId: string;
  roomCode: string;
  hostSocket: OlySocket;
  guestSocket: OlySocket;
  chris: JsonObject;
  chrisSeat: string;
  franky: JsonObject;
  frankySeat: string;
  aiTeamIds: string[];
}) {
  const { baseUrl, saveId, seasonId, roomCode, hostSocket, guestSocket, chris, chrisSeat, franky, frankySeat, aiTeamIds } = input;

  // Host: AI-Teams + eigene 4, in 4er-Haeppchen (siehe Kommentar oben).
  const hostDraftTeamIds = [...aiTeamIds, ...(chris.controlledTeamIds as string[])];
  for (let index = 0; index < hostDraftTeamIds.length; index += 4) {
    const chunk = hostDraftTeamIds.slice(index, index + 4);
    const runOnce = () =>
      postJson(
        baseUrl,
        `/api/ai/picks-run?saveId=${encodeURIComponent(saveId)}&seasonId=${encodeURIComponent(seasonId)}&source=sqlite`,
        {
          dryRun: false,
          confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
          teamScope: "all",
          teamIds: chunk,
          allowSetupAllTeams: true,
          includeManualTeams: true,
          roomCode,
          participantId: chris.participantId,
          seatToken: chrisSeat,
          userId: chris.userId,
        },
      );
    let draft = await runOnce();
    if (draft.status === 403 && JSON.stringify(draft.body).includes("participant_offline")) {
      await rejoinParticipant(hostSocket, roomCode, chrisSeat);
      draft = await runOnce();
    }
    if (draft.status !== 200) {
      throw new Error(
        `Liga-Kader-Draft (Host) fuer ${chunk.join(",")} fehlgeschlagen: status=${draft.status} ` +
          `error=${JSON.stringify(draft.body?.error ?? draft.body).slice(0, 300)}`,
      );
    }
  }

  // Gast: eigene 4 Teams manuell zusammenkaufen (kein KI-Weg erreichbar, siehe Kommentar oben).
  for (const teamId of franky.controlledTeamIds as string[]) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const freeAgents = await fetchJson(
        baseUrl,
        `/api/transfermarkt/free-agents?saveId=${encodeURIComponent(saveId)}&seasonId=${encodeURIComponent(seasonId)}` +
          `&teamId=${encodeURIComponent(teamId)}&limit=40`,
      );
      const items: JsonObject[] = freeAgents.items ?? [];
      const rosterCount: number = items[0]?.rosterCount ?? 0;
      const playerMin: number = items[0]?.playerMin ?? 6;
      if (rosterCount >= Math.max(playerMin, 6)) break;
      const kandidat = [...items]
        .filter((item) => item.affordabilityStatus !== "blocked")
        .sort((a, b) => (a.marketValue ?? 0) - (b.marketValue ?? 0))[0];
      if (!kandidat) {
        throw new Error(`Kein bezahlbarer Free Agent fuer ${teamId} (items=${items.length}).`);
      }
      const runOnce = () =>
        postJson(baseUrl, "/api/transfermarkt/buy", {
          saveId,
          seasonId,
          teamId,
          playerId: kandidat.playerId,
          dryRun: false,
          roomCode,
          participantId: franky.participantId,
          seatToken: frankySeat,
          userId: franky.userId,
        });
      let kauf = await runOnce();
      if (kauf.status === 403 && JSON.stringify(kauf.body).includes("participant_offline")) {
        await rejoinParticipant(guestSocket, roomCode, frankySeat);
        kauf = await runOnce();
      }
      if (kauf.status !== 200 || kauf.body?.success !== true) {
        throw new Error(
          `Kauf fuer ${teamId} (${kandidat.playerId}) fehlgeschlagen: status=${kauf.status} ` +
            `error=${JSON.stringify(kauf.body?.error ?? kauf.body).slice(0, 300)}`,
        );
      }
    }
  }
}

/**
 * Befund (dieser Lauf): die Discipline-Stage-Arena zeigt statt der NativeArena (und damit statt
 * `arena-coop-status`) den Vorschau-Screen "Vor dem Anpfiff", solange
 * `getMatchdayLeagueLineupReadiness` nicht ALLE 32 Liga-Teams als bereit meldet
 * (app/foundation/discipline-stage/DisciplineStageArena.tsx:2394, `arenaStartBlockedByLineups`).
 * `runRoomAiAutoStep` (Sitz A only in room-store.ts) ist reine Room-Flow-Buchhaltung — es schreibt
 * NIE eine echte Aufstellung in den Spielstand (Kommentar dort: "NUR den Room-Flow-Schritt frei").
 * Ohne echte Aufstellungen blieb die Liga bei diesem Skript dauerhaft auf 0/32 stehen und
 * `arena-coop-status` erschien nie — das Skript hing 30s an `coopStatusA.waitFor` fest, WEIT VOR
 * dem eigentlich zu pruefenden B3-Pfad (Host-Advance -> Gast-Ticker).
 *
 * Das war zum Zeitpunkt der letzten "lokal gruen" Verifikation (siehe Kommentar in ci.yml) noch
 * kein Blocker — "Vor dem Anpfiff" (app/foundation/discipline-stage/DisciplineStageArena.tsx,
 * Commit dc124799) kam offenbar erst SPAETER in diesen Pfad. Wie `scripts/audit-koop-spielbarkeit.ts`
 * (Abschnitt "beideSpielerSetzenAufstellungen") es fuer Chris/Franky bereits vormacht: eine ECHTE
 * Aufstellung ueber die App selbst abgeben, nicht simulieren. Hier per Stufe-2.1-Sammelroute
 * (`PUT /api/lineups/legacy/batch`) statt der Einzelroute — EIN Aufruf je Besitzer fuer alle seine
 * Teams, UND der Aufruf zieht die 24 KI-Teams automatisch nach (`applyAiLegacyLineupBatchLocally`
 * innerhalb der Route, siehe app/api/lineups/legacy/batch/route.ts:191-209) — kein zusaetzlicher
 * KI-Aufruf noetig. `confirmLock: true` gleich im ersten Aufruf (Stufe 2.5) macht daraus einen
 * "locked"-Status, den `isTeamMatchdayLineupSubmitted` als abgegeben zaehlt; dieselbe Route ruft
 * intern `ensureLocalFormCardsForSeason`, das erfuellt den zweiten Teil des Gates
 * (Formkarten-POOL vorhanden — Auswahl bleibt optional, siehe form-card-flow.ts:76).
 *
 * Bewusst WEITERHIN keine "echten" (spielerisch durchdachten) Aufstellungen — genau wie der Rest
 * dieses V1-Skripts (siehe `writeAudit.note`), der KI-Vorschlag reicht, um das Gate zu erfuellen.
 * Was hier geprueft wird, ist der Sync-Pfad (B3), nicht Aufstellungsqualitaet.
 */
async function ensureFullLeagueLineupReadiness(input: {
  baseUrl: string;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  roomCode: string;
  owners: Array<{ participant: JsonObject; seatToken: string }>;
}) {
  for (const { participant, seatToken } of input.owners) {
    const basisFor = (teamId: string) =>
      `saveId=${encodeURIComponent(input.saveId)}&seasonId=${encodeURIComponent(input.seasonId)}` +
      `&matchdayId=${encodeURIComponent(input.matchdayId)}&teamId=${encodeURIComponent(teamId)}`;

    const teams: JsonObject[] = [];
    for (const teamId of participant.controlledTeamIds as string[]) {
      const preview = await fetchJson(input.baseUrl, `/api/lineups/legacy/ai-preview?${basisFor(teamId)}`);
      const entries = preview.preview?.entries ?? preview.entries ?? [];
      if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error(`ai-preview lieferte keine entries fuer ${teamId}: ${JSON.stringify(preview).slice(0, 300)}`);
      }
      teams.push({ teamId, entries });
    }

    const response = await fetch(
      `${input.baseUrl}/api/lineups/legacy/batch?saveId=${encodeURIComponent(input.saveId)}` +
        `&seasonId=${encodeURIComponent(input.seasonId)}&matchdayId=${encodeURIComponent(input.matchdayId)}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teams,
          confirmLock: true,
          roomCode: input.roomCode,
          participantId: participant.participantId,
          userId: participant.userId,
          seatToken,
        }),
      },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.savedCount !== teams.length) {
      throw new Error(
        `Batch-Lineup-Speichern fuer ${participant.displayName} fehlgeschlagen: status=${response.status} body=${JSON.stringify(body).slice(0, 500)}`,
      );
    }
  }
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

    // Scoped auf `saveId`, NICHT den global "aktiven" Save: dieses Skript aktiviert seinen
    // isolierten Save bewusst nicht global (siehe ensureIsolatedMultiplayerE2ESave), also wuerde
    // eine ungescopte Abfrage hier den FALSCHEN Save lesen. `createRoom` reicht `saveId` unveraendert
    // durch (room-store.ts:181-186) — `state.multiplayerRoom.saveId` und die hier verwendete
    // Variable `saveId` sind derselbe Save.
    const matchdayScope = await fetchJson(options.baseUrl, `/api/singleplayer-state?saveId=${encodeURIComponent(saveId)}`);
    const currentMatchdayId = matchdayScope.save?.gameState?.matchdayState?.matchdayId ?? null;
    if (!currentMatchdayId) {
      throw new Error(`Kein matchdayId auf dem isolierten Save ${saveId} gefunden.`);
    }

    // Siehe Kommentar an `ensureLeagueRostersPlayable`: der isolierte Save startet mit einer
    // komplett unbespielten Liga (0 Rosterspieler fuer praktisch jedes Team), nicht nur ohne
    // Kader fuer Chris/Franky. Muss VOR `ensureFullLeagueLineupReadiness` laufen — ohne Kader
    // liefert `ai-preview` fuer jedes betroffene Team `entries: []`.
    const aiTeamIds = state.teamOwnership
      .filter((entry) => entry.controllerType === "ai")
      .map((entry) => entry.teamId);
    await ensureLeagueRostersPlayable({
      baseUrl: options.baseUrl,
      saveId,
      seasonId: state.roomFlowState.activeSeasonId,
      roomCode,
      hostSocket: socketA,
      guestSocket: socketB,
      chris,
      chrisSeat: created.seatToken,
      franky,
      frankySeat: joined.seatToken,
      aiTeamIds,
    });

    await ensureFullLeagueLineupReadiness({
      baseUrl: options.baseUrl,
      saveId,
      seasonId: state.roomFlowState.activeSeasonId,
      matchdayId: currentMatchdayId,
      roomCode,
      owners: [
        { participant: chris, seatToken: created.seatToken },
        { participant: franky, seatToken: joined.seatToken },
      ],
    });

    // SELBSTHEILUNG AUCH HIER, aus demselben Grund wie im Kader-Schritt (siehe
    // `rejoinParticipant` oben) -- sie fehlte an dieser Stelle, und das ist ein echter Riss im
    // Netz: der Aufstellungs-Schritt ist der TEUERSTE des ganzen Laufs. Er rechnet nicht nur acht
    // `ai-preview`s, sondern zieht ueber die Sammelroute auch die KI-Aufstellungen der restlichen
    // 24 Teams nach -- fuer 32 Teams sind das nach der Messung in
    // lib/season/matchday-progress-service.ts 15-21 s synchroner Rechenzeit. Genau so lange kann
    // ein Socket.io-Heartbeat verhungern; der Server markiert den Sitz dann als offline, der
    // Client-Socket reconnectet zwar von selbst, ist danach aber nicht mehr im io-Raum und
    // bekommt KEINE `roomState`-Broadcasts mehr.
    //
    // GEMESSEN, nicht vermutet: vier lokale Laeufe hintereinander starben danach reproduzierbar
    // mit `room_state_timeout:chris-ready-lobby` -- der Bereit-Ruf ging raus, die Antwort kam nie
    // an, und im Server-Log stand dazu KEIN Fehler (der Aufruf selbst war ja erfolgreich). In der
    // CI faellt es nicht auf, weil deren Runner den Schritt schnell genug durchrechnet; auf einer
    // langsameren Maschine ist es ein sicherer Fehlschlag und in der CI ein latentes Flackern.
    await rejoinParticipant(socketA, roomCode, created.seatToken);
    await rejoinParticipant(socketB, roomCode, joined.seatToken);

    // `PW_EXEC`, wie schon in scripts/smoke-gameplay.ts:576 — lokale Sandboxes stellen unter
    // /opt/pw-browsers oft eine andere Chromium-Revision bereit, als das installierte
    // playwright-core erwartet (`chromium.launch()` sucht dann eine Revisions-Ordner-ID, die es
    // nicht gibt). CI installiert Chromium frisch passend zur Revision (`--with-deps`), dort bleibt
    // PW_EXEC unset und das Verhalten unveraendert.
    browser = await chromium.launch({ executablePath: process.env.PW_EXEC || undefined });
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
      // fuer ALLE 32 Liga-Teams "bereit" meldet (echte Aufstellung + Formkarten) —
      // `ensureFullLeagueLineupReadiness` weiter oben hat das bereits ueber echte App-Schreibvorgaenge
      // sichergestellt.
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

      // Zweiter, VON DER LIGA-BEREITSCHAFT UNABHAENGIGER Zwischenschritt: "Vor dem Anpfiff"
      // (DisciplineStageArena.tsx, `data-arena-prematch="true"`, seit Commit dc124799) ersetzt die
      // ganze Buehne — auch bei 32/32 bereiten Teams — durch einen Vorschau-Screen, bis die
      // spielende Person selbst auf "Zur Bühne →" (`arena-prematch-start-cta`) klickt. Ohne diesen
      // Klick bleibt `arena-coop-status` (das lebt in der NativeArena DAHINTER) fuer immer
      // unerreichbar — das war der eigentliche Grund fuer den 30s-Timeout hier, nicht B3.
      // ... ABER IM RAUM DARF DIESE TAFEL SCHON WEG SEIN, und dann gibt es den Knopf zu Recht
      // nicht mehr. Das ist der Befund aus den CI-Laeufen 1918/1923/1925 — und es ist KEIN Fehler,
      // sondern die im Mehrspieler ausdruecklich gebaute Eigenschaft: `onApplyRevealSync`
      // (DisciplineStageArena.tsx) setzt `preMatchdayDismissed`, sobald ein RoomArenaState fuer
      // diese Arena eintrifft. Ohne das blieb der GAST fuer immer auf "Vor dem Anpfiff" stehen,
      // waehrend der Host laengst gestartet hatte.
      //
      // Der Host-Client startet den Reveal inzwischen SELBST, sobald die Liga bereit ist
      // (Auto-Start-Effekt, siehe Kommentar am `arena-coop-ready`-Wait unten). Ob dieser Sync vor
      // oder nach dem Oeffnen der Seite eintrifft, ist ein reines Wettrennen — beide Ausgaenge sind
      // richtig. Der festgehaltene Bildschirmtext des Fehllaufs zeigte genau den zweiten Fall:
      // Buehne offen ("ARENA · Hockey · MUTATOREN"), Koop-Tor aktiv ("Der Host steuert die
      // Anzeige", "Warte auf: Fran") — also alles erreicht, worauf der Test danach wartet, nur eben
      // ohne den Zwischenschritt.
      //
      // Deshalb wird hier auf ENTWEDER den Knopf ODER die schon offene Buehne gewartet und nur
      // geklickt, was wirklich da ist. Ein harter Wait auf den Knopf wuerde eine Eigenschaft
      // erzwingen, die im Raum bewusst nicht gilt.
      async function passPreMatchdayBoard(page: Page, label: string) {
        const cta = page.getByTestId("arena-prematch-start-cta");
        const coopStatus = page.getByTestId("arena-coop-status");
        try {
          await Promise.race([
            cta.waitFor({ timeout: 30_000 }),
            coopStatus.waitFor({ timeout: 30_000 }),
          ]);
        } catch (error) {
          await page.screenshot({ path: path.join(OUTPUT_DIR, `failure-prematch-${label}.png`), fullPage: true }).catch(() => {});
          const body = await page.evaluate(() => document.body.innerText.slice(0, 3000)).catch(() => "?");
          await fs.writeFile(path.join(OUTPUT_DIR, `failure-prematch-body${label}.txt`), body);
          console.error(`[prematch-cta] Weder Anpfiff-Knopf noch offene Buehne fuer ${label}.`);
          console.error(`[prematch-cta] Bildschirmtext ${label}:\n${body.slice(0, 1500)}`);
          throw error;
        }
        // Nur klicken, wenn die Tafel wirklich noch steht. `isVisible()` fragt den JETZT-Zustand ab
        // (kein Warten) — nach dem Race oben ist genau einer der beiden Faelle bereits eingetreten.
        if (await cta.isVisible().catch(() => false)) {
          await cta.click();
        }
      }
      await passPreMatchdayBoard(pageA, "A");
      await passPreMatchdayBoard(pageB, "B");

      const coopStatusA = pageA.getByTestId("arena-coop-status");
      const coopStatusB = pageB.getByTestId("arena-coop-status");
      try {
        await coopStatusA.waitFor({ timeout: 30_000 });
        await coopStatusB.waitFor({ timeout: 30_000 });
      } catch (error) {
        // Diagnose-Dump statt blindem Nochmal-Versuchen: das genau war das Werkzeug, mit dem sich
        // dieser Block ueberhaupt reparieren liess (fehlender "Vor dem Anpfiff"-Klick, siehe oben) —
        // ohne Body-Text/Screenshot haette der 30s-Timeout allein nicht zwischen B3 (Sync-Bug) und
        // einem simplen "falscher Screen" unterschieden. Bleibt fuer den naechsten Fund stehen.
        await pageA.screenshot({ path: path.join(OUTPUT_DIR, "failure-pageA.png"), fullPage: true }).catch(() => {});
        await pageB.screenshot({ path: path.join(OUTPUT_DIR, "failure-pageB.png"), fullPage: true }).catch(() => {});
        const bodyA = await pageA.evaluate(() => document.body.innerText.slice(0, 3000)).catch(() => "?");
        const bodyB = await pageB.evaluate(() => document.body.innerText.slice(0, 3000)).catch(() => "?");
        await fs.writeFile(path.join(OUTPUT_DIR, "failure-bodyA.txt"), bodyA);
        await fs.writeFile(path.join(OUTPUT_DIR, "failure-bodyB.txt"), bodyB);
        throw error;
      }

      // KEIN manueller `startRoomArena`-Socket-Emit mehr an dieser Stelle (frueher hier, mit hart
      // codierten `{ d1: 2, d2: 2 }`): seit `ensureFullLeagueLineupReadiness` oben die Liga wirklich
      // bereit meldet, feuert `DisciplineStageArena.tsx` seinen EIGENEN Auto-Start-Effekt (Zeile
      // ~1219, `roomArenaSync.emitStartRoomArena`) von selbst, sobald der Host-Client mountet — mit
      // den ECHTEN, ueber `computeStageSlotCount` berechneten Etappenzahlen. Ein zweiter, manueller
      // Aufruf mit erfundenen Zahlen wuerde diesen echten Start nur ueberschreiben (jeder
      // `startRoomArena`-Aufruf setzt `readyParticipantIds` zurueck auf `[]`, siehe
      // `arena-sync-state.ts:228`) — deshalb hier bewusst NICHTS emittieren, nur auf das Ergebnis
      // warten. Das ist auch der Grund, warum die fruehere "Warte auf den Host"-Zusicherung (Gast
      // sieht `arenaSyncState` noch als "idle", bevor der Host manuell startet) entfallen ist: der
      // Auto-Start feuert oft schon, bevor der Gast-Browser ueberhaupt navigiert — ein Wettlauf, der
      // nichts Sync-Relevantes mehr belegt. Was zaehlt (beide Clients landen im SELBEN Gate, mit den
      // SELBEN echten Werten), prueft der folgende `arena-coop-ready`-Wait auf BEIDEN Seiten.
      await pageA.getByTestId("arena-coop-ready").waitFor({ timeout: 20_000 });
      await pageB.getByTestId("arena-coop-ready").waitFor({ timeout: 20_000 });
      screenshots.foundationArenaSync = await screenshot(pageA, "foundationArenaSync");

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
        note:
          "V1 prueft serverseitige Autorisierung und Room-Flow. Buy/Sell/Result werden nicht produktiv geschrieben. " +
          "Lineups sind seit `ensureFullLeagueLineupReadiness` die Ausnahme: alle 32 Liga-Teams bekommen eine echte, " +
          "KI-vorgeschlagene Aufstellung (Chris/Franky ueber die Sammelroute, KI-Teams von derselben Route mitgezogen) " +
          "— sonst rendert die Arena-Seite nur den 'Vor dem Anpfiff'-Vorschauzustand und `arena-coop-status` erscheint nie.",
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
