/**
 * Koop-Spielbarkeits-Audit: prueft, ob die drei Koop-Aenderungen ZUSAMMEN wirklich tragen —
 * nicht nur, ob ihre eigenen Unit-Tests gruen sind. Muster und Robustheit wie
 * `scripts/smoke-coop-sync.ts`: Socket-/Server-Ebene, `check(name, ok, detail)`, bewusst ohne
 * bruechige UI-Selektoren.
 *
 *  A) SAISON ZU ZWEIT DURCHSPIELBAR (Punkt 1, PR #370): der Room-Flow faehrt eine ECHTE ganze
 *     Saison ueber den gebundenen Spielstand — der Zyklus kehrt vom Saisonstand zur
 *     Einsatzliste zurueck, `activeMatchday` waechst mit dem persistierten Spielstand mit, und
 *     nach dem letzten Spieltag endet die Kette im Season Review statt in einer weiteren Runde.
 *     Die Unit-Tests (tests/room-flow-spieltag-zyklus.test.ts) pruefen den Uebergang punktuell
 *     mit einer Persistenz-Attrappe; hier laeuft der komplette Durchlauf gegen den echten Server.
 *
 *  B) FLOW AN EINEM ORT BEDIENBAR (Punkt 2): Ready/Weiter laufen ueber GENAU die Verdrahtung,
 *     die die Foundation-Shell benutzt — `describeRoomFlowButton().action` (typisiert, kein
 *     Label-Vergleich) + die Event-Zuordnung aus `emitRoomFlowButtonAction`. Das Audit steuert
 *     die ganze Saison ausschliesslich ueber dieses Knopf-Modell und weist nach, wo das NICHT
 *     reicht (Host-Ready, siehe Check B6).
 *
 *  C) ADMIN-WERKZEUGE PRALLEN AB (Punkt 3): in zeitlicher Reihenfolge — Werkzeug laeuft ohne
 *     Raum, wird nach der Raumbindung abgelehnt (409 admin_write_blocked_room_bound_save:*),
 *     Vorschau/Dry-Run geht weiter. Inklusive des zustandsbehafteten Falls: ein legal
 *     gestarteter Simulations-Lauf wird gestoppt, sobald sein Save NACHTRAEGLICH raumgebunden
 *     wird (Tick-Recheck).
 *
 *  D) ZUSAMMENSPIEL: Ablehnung mitten im Spieltag-Zyklus laesst den Flow unbeschaedigt;
 *     Reconnect/Rejoin mitten im Zyklus erhaelt Schritt, Spieltag und `seasonContinues`;
 *     die Sperre haelt auch, wenn beide Spieler getrennt sind.
 *
 * Aufruf:
 *   npm run audit:koop-spielbarkeit -- --no-start                       (gegen laufenden Server)
 *   npm run audit:koop-spielbarkeit                                     (startet dev-Server selbst)
 *   npm run audit:koop-spielbarkeit -- --no-start --base-url http://localhost:3311
 *
 * ACHTUNG Schreibverhalten: das Audit ist fuer eine lokale Dev-/Test-Datenbank gedacht. Es
 * erstellt eigene Raeume samt frischer Koop-Saves, legt einen Scratch-Klon des aktiven Saves an
 * (und aktiviert den Original-Save danach wieder) und laesst auf diesem Scratch-Klon einen
 * Simulations-Tick laufen. Der aktive Solo-Save selbst wird nicht veraendert (auf ihm laufen nur
 * `start`/`cancel` der Saison-Simulation, die ausschliesslich Lauf-Metadaten unter `outputs/`
 * schreiben). Bericht: outputs/audit-koop-spielbarkeit/bericht.md (+ ergebnis.json).
 *
 * Die angelegten Raeume leben im Server-Prozess weiter (es gibt keinen Raum-Abbau, siehe
 * Beobachtung im Bericht) — ihre Saves bleiben deshalb bis zum Server-Neustart admin-gesperrt.
 * Fuer den selbststartenden Modus lohnt ausserdem OLY_AUTO_EXPORT_SAVES=0, sonst committet der
 * Dev-Server seine Save-Spiegelung periodisch nach data/online-saves/ (server.ts →
 * startOnlineSaveAutoExport).
 */
// `ChildProcess` statt `ChildProcessWithoutNullStreams`: der Server startet mit `stdio: "ignore"`
// und hat keine Streams (gleiche Begruendung wie in smoke-coop-sync.ts).
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { io, type Socket } from "socket.io-client";

import { AI_PICK_AUDIT_RESET_CONFIRM_TOKEN } from "@/lib/ai/ai-pick-audit-reset-contract";
import { AI_PICK_IMPORT_CONFIRM_TOKEN } from "@/lib/ai/ai-pick-import-contract";
import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import {
  ROOM_FLOW_SEASON_TRANSITION_TARGET,
  ROOM_FLOW_STEPS,
  describeRoomFlowButton,
  getRoomFlowStep,
  mapRoomFlowViewToFoundationViewId,
  type RoomFlowButtonAction,
} from "@/lib/room/room-flow-controller";
// Eigene, importfreie Datei (siehe Kommentar dort) — deshalb OHNE das Gewicht des
// season-transition-service, den Punkt A20 unten ueber die REST-Route ansteuert.
import { SEASON_TRANSITION_STEPS } from "@/lib/season/season-transition-steps";

const DEFAULT_BASE_URL = "http://localhost:3000";

/**
 * Diese Tokens/Meldungen leben in schweren Service-/Store-Modulen (matchday-auto-run-service zieht
 * die halbe Engine, season-snapshot-service haengt an einem "use client"-Modul,
 * season-transition-service zieht die AI-Transferfenster-Session, room-store.ts den kompletten
 * Socket-/Persistenz-Stack). Sie sind hier bewusst als Literal kopiert und werden unten per
 * Quelltext-Kontrakt-Check gegen die jeweilige Quelldatei abgeglichen — Drift faellt also im
 * Audit selbst auf, ohne dass das Skript die Module laedt.
 */
const MATCHDAY_AUTO_RUN_CONFIRM_TOKEN = "RUN_LOCAL_MATCHDAY_AUTO";
const SEASON_SNAPSHOT_CONFIRM_TOKEN = "CREATE_LOCAL_SEASON_SNAPSHOT";
const CASH_PRIZE_APPLY_CONFIRM_TOKEN = "APPLY_LOCAL_CASH_PRIZE";
/** season-transition-service.ts:121 — der Riegel, den A20 beim Schritt "season_rewards" auffaengt. */
const SEASON_REWARDS_PENDING_REASON = "season_end_cash_settlement_pending";
/** room-store.ts:1352 — Ready-Gate-Ablehnung, exakter Wortlaut fuer A18b. */
const ROOM_FLOW_READY_GATE_BLOCKED_MESSAGE = "Room-Flow ist noch blockiert: Human- oder AI-Schritte sind offen.";
/** room-store.ts:1409 — Riegel-Ablehnung ("neue Saison noch nicht begonnen"), exakter Wortlaut fuer A19. */
const ROOM_FLOW_SEASON_TRANSITION_RIEGEL_MESSAGE =
  "Die neue Saison hat noch nicht begonnen. Schließe den Saisonwechsel im Cockpit ab — danach geht es hier weiter.";

type AnyState = any;

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i += 1;
    } else {
      args.set(key, "true");
    }
  }
  return {
    baseUrl: (args.get("base-url") ?? process.env.OLY_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    noStart: args.get("no-start") === "true",
  };
}

const results: { section: string; name: string; ok: boolean; detail: string }[] = [];
const beobachtungen: string[] = [];
let currentSection = "Vorbereitung";

function section(name: string) {
  currentSection = name;
  console.log(`\n=== ${name} ===`);
}

function check(name: string, ok: boolean, detail = "") {
  results.push({ section: currentSection, name, ok, detail });
  console.log(`${ok ? "OK " : "ERR"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Befund, der kein Pass/Fail ist, aber in den Bericht gehoert (z. B. latente Luecken). */
function beobachtung(text: string) {
  beobachtungen.push(text);
  console.log(`INF ${text}`);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function isServerReachable(baseUrl: string) {
  try {
    const r = await fetch(`${baseUrl}/api/health`, { cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

async function ensureServer(baseUrl: string, noStart: boolean): Promise<ChildProcess | null> {
  if (await isServerReachable(baseUrl)) return null;
  if (noStart) throw new Error(`Server nicht erreichbar unter ${baseUrl} (und --no-start gesetzt).`);
  const child = spawn("npm", ["run", "dev"], { stdio: "ignore", detached: false });
  for (let i = 0; i < 90; i += 1) {
    if (await isServerReachable(baseUrl)) return child;
    await delay(2000);
  }
  throw new Error(`Server wurde nicht erreichbar unter ${baseUrl}.`);
}

function connect(baseUrl: string): Promise<Socket> {
  // reconnection:false — ein stiller Socket.io-Auto-Reconnect wuerde den Socket zwar wieder
  // oeffnen, aber NICHT erneut den Raum betreten (rejoinRoom): der Teilnehmer bliebe
  // serverseitig offline und die eigene Zustands-Kopie stumm-veraltet. Ohne Auto-Reconnect ist
  // ein Abriss als `connected === false` sichtbar und die Selbstheilung (rejoin*) greift.
  const socket = io(baseUrl, { path: "/socket.io", transports: ["websocket"], forceNew: true, reconnection: false });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("socket connect timeout")), 15000);
    socket.once("connect", () => {
      clearTimeout(t);
      resolve(socket);
    });
    socket.once("connect_error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

type TrackedSocket = {
  socket: Socket;
  state: AnyState | null;
  gameplayEvents: AnyState[];
  errors: AnyState[];
};

/** Haelt roomState + roomGameplayEvents + roomErrors pro Socket fest. */
function trackSocket(socket: Socket): TrackedSocket {
  const box: TrackedSocket = { socket, state: null, gameplayEvents: [], errors: [] };
  socket.on("roomState", (state: AnyState) => {
    box.state = state;
  });
  socket.on("roomGameplayEvent", (evt: AnyState) => {
    box.gameplayEvents.push(evt);
  });
  socket.on("roomError", (err: AnyState) => {
    box.errors.push(err);
  });
  return box;
}

function emitJoined(socket: Socket, event: string, payload: AnyState): Promise<AnyState> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${event} timeout`)), 15000);
    socket.once("roomJoined", (p: AnyState) => {
      clearTimeout(t);
      resolve(p);
    });
    socket.once("roomError", (p: AnyState) => {
      clearTimeout(t);
      reject(new Error(p?.message ?? "roomError"));
    });
    socket.emit(event, payload);
  });
}

async function waitFor(getVal: () => boolean, label: string, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (getVal()) return true;
    await delay(100);
  }
  throw new Error(`Timeout warten auf: ${label}`);
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; body: AnyState }> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

async function postJson(url: string, payload: AnyState): Promise<{ status: number; body: AnyState }> {
  return fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Spiegel der Zuordnung aus `emitRoomFlowButtonAction` (lib/room/room-flow-socket-actions.ts).
 * Das Original ist ein "use client"-Modul, dessen `getClientSocket()` nur im Browser existiert —
 * hier senden wir ueber den Audit-Socket. Damit die Kopie nie von der Shell abweichen kann,
 * wird sie unten per Quelltext-Kontrakt-Check (S1) Fall fuer Fall gegen die Originaldatei
 * abgeglichen; weicht die Datei ab, faellt das Audit rot aus.
 */
function sendeKnopfAktion(
  socket: Socket,
  input: { action: RoomFlowButtonAction; roomCode: string; seatToken: string; toggleReadyTo: boolean },
) {
  const { roomCode, seatToken } = input;
  switch (input.action) {
    case "set_ready":
      socket.emit("setReadyState", { roomCode, seatToken, ready: input.toggleReadyTo });
      return;
    case "run_ai_auto_step":
      socket.emit("runRoomAiAutoStep", { roomCode, seatToken });
      return;
    case "start_room":
      socket.emit("startRoom", { roomCode, seatToken });
      return;
    case "advance_flow":
      socket.emit("advanceRoomFlow", { roomCode, seatToken });
      return;
    case "none":
      return;
  }
}

function knopf(box: TrackedSocket, participantId: string) {
  return describeRoomFlowButton({ state: box.state, participantId });
}

// ---------------------------------------------------------------------------------------------
// Quelltext-Kontrakt-Checks (Punkt 2): typisierte Aktion statt Label-Vergleich, EINE Verdrahtung
// ---------------------------------------------------------------------------------------------
function runSourceContractChecks() {
  section("S) Quelltext-Kontrakte (Punkt 2: eine Verdrahtung, typisierte Aktion)");
  const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

  const socketActions = read("lib/room/room-flow-socket-actions.ts");
  const mappingPairs: Array<[RoomFlowButtonAction, string]> = [
    ["set_ready", "setReadyState"],
    ["run_ai_auto_step", "runRoomAiAutoStep"],
    ["start_room", "startRoom"],
    ["advance_flow", "advanceRoomFlow"],
  ];
  const mappingOk = mappingPairs.every(([action, event]) =>
    new RegExp(`case "${action}":\\s*socket\\.emit\\("${event}"`).test(socketActions),
  );
  check(
    "S1: emitRoomFlowButtonAction bildet jede Aktion auf genau das erwartete Socket-Event ab (Audit-Spiegel driftfrei)",
    mappingOk,
    mappingPairs.map(([a, e]) => `${a}→${e}`).join(", "),
  );

  const roomPage = read("app/room/[roomCode]/RoomPageClient.tsx");
  const flowBar = read("components/foundation/FoundationRoomFlowBar.tsx");
  check(
    "S2: Room-Seite UND Shell-Leiste senden ueber dieselbe Funktion emitRoomFlowButtonAction",
    roomPage.includes("emitRoomFlowButtonAction(") && flowBar.includes("emitRoomFlowButtonAction("),
    "app/room/[roomCode]/RoomPageClient.tsx + components/foundation/FoundationRoomFlowBar.tsx",
  );
  const labelVergleich = /\.label\s*===|label\s*===\s*["']/;
  check(
    "S3: Keine Stelle entscheidet mehr per Label-String-Vergleich, was ein Klick sendet",
    !labelVergleich.test(roomPage) && !labelVergleich.test(flowBar) && !labelVergleich.test(socketActions),
    "kein `label ===` in RoomPageClient/FoundationRoomFlowBar/room-flow-socket-actions",
  );

  const unmapped = ROOM_FLOW_STEPS.filter((step) => !mapRoomFlowViewToFoundationViewId(step.targetView));
  check(
    "S4: Jede Room-Flow-View hat ein definiertes Foundation-View-Ziel (Auto-Navigation kann nie ins Leere laufen)",
    unmapped.length === 0,
    unmapped.length === 0 ? `${ROOM_FLOW_STEPS.length} Schritte geprueft` : `ohne Ziel: ${unmapped.map((s) => s.stepId).join(",")}`,
  );

  // Beide server-getriebenen Navigationen (Schrittwechsel "arena" und onHostStartedArena) muessen
  // auf DIESELBE View zeigen, sonst wuerden sie sich gegenseitig ueberschreiben.
  const scope = read("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
  const hostArenaTarget = /onHostStartedArena:\s*\(\)\s*=>\s*\{\s*setActiveView\("matchdayArena"\)/.test(scope);
  check(
    "S5: Schrittwechsel 'arena' und onHostStartedArena zielen auf dieselbe View (kein Navigations-Pingpong)",
    hostArenaTarget && mapRoomFlowViewToFoundationViewId(getRoomFlowStep("arena").targetView) === "matchdayArena",
    `arena→${mapRoomFlowViewToFoundationViewId(getRoomFlowStep("arena").targetView)}, onHostStartedArena→matchdayArena`,
  );

  const autoRunService = read("lib/season/matchday-auto-run-service.ts");
  const snapshotService = read("lib/season/season-snapshot-service.ts");
  const cashPrizeService = read("lib/season/cash-prize-apply-service.ts");
  check(
    "S6: Confirm-Token-Literale des Audits stimmen mit den Service-Quellen ueberein (Driftschutz)",
    autoRunService.includes(`MATCHDAY_AUTO_RUN_CONFIRM_TOKEN = "${MATCHDAY_AUTO_RUN_CONFIRM_TOKEN}"`) &&
      snapshotService.includes(`SEASON_SNAPSHOT_CONFIRM_TOKEN = "${SEASON_SNAPSHOT_CONFIRM_TOKEN}"`) &&
      cashPrizeService.includes(`CASH_PRIZE_APPLY_CONFIRM_TOKEN = "${CASH_PRIZE_APPLY_CONFIRM_TOKEN}"`),
    `${MATCHDAY_AUTO_RUN_CONFIRM_TOKEN} / ${SEASON_SNAPSHOT_CONFIRM_TOKEN} / ${CASH_PRIZE_APPLY_CONFIRM_TOKEN}`,
  );

  // Fuer Paket C (docs/MULTIPLAYER_SAISONWECHSEL_PLAN.md): der Blocker-String, an dem A20 den
  // season_rewards-Riegel erkennt, und die beiden woertlichen Ablehnungs-Meldungen, an denen
  // A18b/A19 pruefen (nicht nur am Schritt) — alle drei als Literal kopiert (s.o.), hier gegen die
  // Quelle abgeglichen.
  const seasonTransitionService = read("lib/season/season-transition-service.ts");
  const roomStore = read("lib/room/room-store.ts");
  check(
    "S7: SEASON_REWARDS_PENDING_REASON stimmt mit season-transition-service.ts ueberein (Driftschutz fuer A20)",
    seasonTransitionService.includes(`SEASON_REWARDS_PENDING_REASON = "${SEASON_REWARDS_PENDING_REASON}"`),
    SEASON_REWARDS_PENDING_REASON,
  );
  check(
    "S8: Die beiden Ablehnungs-Meldungen des Saisonwechsel-Gates (Ready-Gate A18b, Riegel A19) stehen wortgleich in room-store.ts — die Checks pruefen an der Meldung, nicht nur am Schritt",
    roomStore.includes(ROOM_FLOW_READY_GATE_BLOCKED_MESSAGE) && roomStore.includes(ROOM_FLOW_SEASON_TRANSITION_RIEGEL_MESSAGE),
    "lib/room/room-store.ts:1352 (Ready-Gate) + :1409 (Riegel)",
  );
}

// ---------------------------------------------------------------------------------------------
// Bericht
// ---------------------------------------------------------------------------------------------
function writeReport(input: { baseUrl: string; startedAt: string; extra: Record<string, unknown> }) {
  const dir = path.join(process.cwd(), "outputs", "audit-koop-spielbarkeit");
  fs.mkdirSync(dir, { recursive: true });
  const failed = results.filter((r) => !r.ok);

  const lines: string[] = [];
  lines.push("# Koop-Spielbarkeits-Audit");
  lines.push("");
  lines.push(`- Zeitpunkt: ${input.startedAt}`);
  lines.push(`- Server: ${input.baseUrl}`);
  lines.push(`- Ergebnis: ${results.length - failed.length}/${results.length} Checks gruen${failed.length > 0 ? ` — ${failed.length} ROT` : ""}`);
  lines.push("");
  let lastSection = "";
  for (const r of results) {
    if (r.section !== lastSection) {
      lines.push(`## ${r.section}`);
      lines.push("");
      lastSection = r.section;
    }
    lines.push(`- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  if (beobachtungen.length > 0) {
    lines.push("");
    lines.push("## Beobachtungen (kein Pass/Fail, aber berichtspflichtig)");
    lines.push("");
    for (const b of beobachtungen) lines.push(`- ${b}`);
  }
  lines.push("");
  fs.writeFileSync(path.join(dir, "bericht.md"), lines.join("\n"), "utf8");
  fs.writeFileSync(
    path.join(dir, "ergebnis.json"),
    `${JSON.stringify({ startedAt: input.startedAt, baseUrl: input.baseUrl, checks: results, beobachtungen, ...input.extra }, null, 2)}\n`,
    "utf8",
  );
  console.log(`\nBericht: outputs/audit-koop-spielbarkeit/bericht.md`);
}

// ---------------------------------------------------------------------------------------------
// Hauptlauf
// ---------------------------------------------------------------------------------------------
async function main() {
  const startedAt = new Date().toISOString();
  const opts = parseArgs(process.argv.slice(2));

  runSourceContractChecks();

  section("Vorbereitung: Server + aktiver Save");
  const server = await ensureServer(opts.baseUrl, opts.noStart);
  const api = (p: string) => `${opts.baseUrl}${p}`;

  const active = await fetchJson(api("/api/singleplayer-state"));
  const soloSaveId: string | undefined = active.body.save?.saveId ?? active.body.saveId;
  if (!soloSaveId) throw new Error("Kein aktiver Save gefunden.");
  console.log(`Aktiver Save: ${soloSaveId}`);

  const leseSave = async (saveId: string) => {
    const r = await fetchJson(api(`/api/singleplayer-state?saveId=${encodeURIComponent(saveId)}`));
    return r.body.save?.gameState ?? null;
  };

  // Hilfen fuer die Admin-Werkzeug-Sonden. "Positiv" heisst hier ausschliesslich: der
  // Room-Bound-Guard hat NICHT gefeuert (kein 409 admin_write_blocked_room_bound_save:*).
  // Fachliche Warnungen/Blocker der Werkzeuge selbst sind fuer Punkt 3 irrelevant.
  const istRoomBound409 = (r: { status: number; body: AnyState }, werkzeug: string) =>
    r.status === 409 &&
    JSON.stringify(r.body).includes(`admin_write_blocked_room_bound_save:${werkzeug}`);

  const simStart = (saveId: string, mode: "apply" | "dry_run") =>
    postJson(api("/api/admin/season-simulation"), { action: "start", saveId, mode, seasonCount: 1 });
  const simTick = (runId: string) => postJson(api("/api/admin/season-simulation"), { action: "tick", runId });
  const simCancel = (runId: string) => postJson(api("/api/admin/season-simulation"), { action: "cancel", runId });

  // -------------------------------------------------------------------------------------------
  // C) Admin-Werkzeuge — Schritt 1: OHNE Raum laeuft das Werkzeug
  // -------------------------------------------------------------------------------------------
  section("C) Admin-Schreibsperre — vor dem Raum");
  const simVorRaum = await simStart(soloSaveId, "apply");
  check(
    "C1: Saison-Simulation (apply) startet auf dem raum-FREIEN Save (Werkzeug grundsaetzlich funktionsfaehig)",
    simVorRaum.status === 200 && simVorRaum.body.ok === true && Boolean(simVorRaum.body.run?.runId),
    `status=${simVorRaum.status} runId=${simVorRaum.body.run?.runId ?? "-"}`,
  );
  if (simVorRaum.body.run?.runId) await simCancel(simVorRaum.body.run.runId);

  // -------------------------------------------------------------------------------------------
  // Raum 1: anlegen + beitreten (Chris = Host, Franky = Gast)
  // -------------------------------------------------------------------------------------------
  section("Setup: Raum 1 (Chris + Franky)");
  // BEWUSST ohne saveId: der Raum startet dann mit dem Sandbox-Platzhalter
  // ("local-sandbox-active-save", lib/room/online-room-model.ts:72) und `startRoom` praegt beim
  // Spielstart einen FRISCHEN Koop-Save (createRoomCoopSave) — so bleibt der aktive Solo-Save
  // des Servers vom gesamten Saison-Durchlauf unberuehrt. Der andere Zweig ("continue
  // existing", Raum auf einem existierenden Save) wird separat in C14 geprueft.
  let chrisSocket = await connect(opts.baseUrl);
  let chris = trackSocket(chrisSocket);
  const created = await emitJoined(chrisSocket, "createRoom", {
    displayName: "Chris",
    preset: "chris_4_franky_4_rest_ai",
  });
  const roomCode: string = created.roomCode;
  const chrisSeat: string = created.seatToken;

  const frankySocketInitial = await connect(opts.baseUrl);
  let franky = trackSocket(frankySocketInitial);
  const joined = await emitJoined(frankySocketInitial, "joinRoom", { roomCode, displayName: "Franky" });
  const frankySeat: string = joined.seatToken;

  await waitFor(() => Boolean(chris.state) && Boolean(franky.state), "beide Sockets haben roomState");
  const chrisP = (chris.state.roomParticipants as AnyState[]).find((p) => p.displayName === "Chris");
  const frankyP = (chris.state.roomParticipants as AnyState[]).find((p) => p.displayName === "Franky");

  /**
   * Selbstheilung fuer unfreiwillige Trennungen: CPU-lastige, synchron rechnende Server-Phasen
   * (Liga-Draft, Kaeufe, Spieltags-Aufloesung) blockieren die Event-Loop so lange, dass
   * Socket.io-Heartbeats verhungern und der Server Teilnehmer als offline markiert — deren
   * HTTP-Writes prallen dann mit 403 participant_offline ab. Menschliche Clients heilt der
   * automatische Socket.io-Reconnect + rejoinRoom; das Audit macht hier dasselbe (und zaehlt
   * mit, wie oft es noetig war — siehe Beobachtung im Bericht).
   */
  const reconnects = { chris: 0, franky: 0 };
  async function rejoinChris() {
    reconnects.chris += 1;
    if (!chrisSocket.connected) {
      chrisSocket = await connect(opts.baseUrl);
      chris = trackSocket(chrisSocket);
    }
    await emitJoined(chrisSocket, "rejoinRoom", { roomCode, seatToken: chrisSeat });
    await waitFor(() => Boolean(chris.state), "Chris nach Auto-Rejoin verbunden");
  }
  async function rejoinFranky() {
    reconnects.franky += 1;
    if (!franky.socket.connected) {
      const socketNeu = await connect(opts.baseUrl);
      franky = trackSocket(socketNeu);
    }
    await emitJoined(franky.socket, "rejoinRoom", { roomCode, seatToken: frankySeat });
    await waitFor(() => Boolean(franky.state), "Franky nach Auto-Rejoin verbunden");
  }
  /** Stellt sicher, dass der Teilnehmer aus SERVER-Sicht online ist (nicht nur Socket offen). */
  async function sichereChrisVerbindung() {
    const online =
      chrisSocket.connected &&
      (chris.state?.roomParticipants as AnyState[] | undefined)?.find((p) => p.participantId === chrisP.participantId)
        ?.connectionStatus === "online";
    if (!online) await rejoinChris();
  }
  async function sichereFrankyVerbindung() {
    const online =
      franky.socket.connected &&
      (franky.state?.roomParticipants as AnyState[] | undefined)?.find((p) => p.participantId === frankyP.participantId)
        ?.connectionStatus === "online";
    if (!online) await rejoinFranky();
  }
  check(
    "Setup: Raum mit 2 Teilnehmern, beide mit eigenen Teams",
    Boolean(chrisP?.controlledTeamIds?.length) && Boolean(frankyP?.controlledTeamIds?.length),
    `Raum ${roomCode}, Chris=${chrisP?.controlledTeamIds?.length ?? 0} Teams, Franky=${frankyP?.controlledTeamIds?.length ?? 0} Teams`,
  );

  // -------------------------------------------------------------------------------------------
  // B) Lobby → Start: alles ueber das Shell-Knopf-Modell (plus dokumentierter Host-Umweg)
  // -------------------------------------------------------------------------------------------
  section("B) Room-Flow ueber das Shell-Knopf-Modell: Lobby und Spielstart");
  let hostUmwege = 0;

  // Gast: das Knopf-Modell bietet "Ready" an — genau das sendet die Shell-Leiste.
  const frankyLobbyKnopf = knopf(franky, frankyP.participantId);
  check(
    "B1: Gast-Knopf in der Lobby ist klickbar mit Aktion 'set_ready'",
    frankyLobbyKnopf.canClick && frankyLobbyKnopf.action === "set_ready",
    `label="${frankyLobbyKnopf.label}" action=${frankyLobbyKnopf.action}`,
  );
  sendeKnopfAktion(franky.socket, { action: "set_ready", roomCode, seatToken: frankySeat, toggleReadyTo: true });
  await waitFor(
    () => (chris.state.roomParticipants as AnyState[]).find((p) => p.participantId === frankyP.participantId)?.readyState === "ready",
    "Franky ready in Lobby",
  );

  // Host: seit der mussBereitMelden-Erweiterung (room-flow-controller.ts:307-330, commit
  // c70739f3) bietet das Knopf-Modell AUCH dem Host 'set_ready' an, sobald er selbst noch nicht
  // bereit ist — "auch der Host" steht da woertlich im Kommentar. Hier stand bis eben nur die
  // ALTE Lesart ("Host bekommt nie set_ready") als Bedingung (`if (!chrisLobbyKnopf.canClick)`):
  // seit der Host-Zweig canClick:true liefert, feuerte dieser Zweig nie mehr, Chris' eigene
  // Bereitmeldung ging NIE raus, und `startKnopf` unten zeigte weiter 'set_ready' statt
  // 'start_room' -- B2 schlug fehl UND der Raum startete nie (Timeout auf "Raum gestartet",
  // empirisch nachgemessen: kompletter Audit-Abbruch direkt nach B2, siehe Bericht). Der Umweg
  // bleibt nur als Rueckfall fuer den Fall, dass canClick aus einem ANDEREN Grund false ist
  // (z. B. "Warten auf Franky").
  const chrisLobbyKnopf = knopf(chris, chrisP.participantId);
  if (chrisLobbyKnopf.action === "set_ready" && chrisLobbyKnopf.canClick) {
    sendeKnopfAktion(chrisSocket, { action: "set_ready", roomCode, seatToken: chrisSeat, toggleReadyTo: true });
    await waitFor(
      () => (chris.state.roomParticipants as AnyState[]).find((p) => p.participantId === chrisP.participantId)?.readyState === "ready",
      "Chris ready in Lobby",
    );
  } else if (!chrisLobbyKnopf.canClick) {
    hostUmwege += 1;
    chrisSocket.emit("setReadyState", { roomCode, seatToken: chrisSeat, ready: true });
    await waitFor(
      () => (chris.state.roomParticipants as AnyState[]).find((p) => p.participantId === chrisP.participantId)?.readyState === "ready",
      "Chris ready in Lobby (Umweg)",
    );
  }

  const startKnopf = knopf(chris, chrisP.participantId);
  check(
    "B2: Host-Knopf traegt im Lobby-Status die typisierte Aktion 'start_room' (nicht am Label festgemacht)",
    startKnopf.canClick && startKnopf.action === "start_room",
    `label="${startKnopf.label}" action=${startKnopf.action}`,
  );
  sendeKnopfAktion(chrisSocket, { action: startKnopf.action, roomCode, seatToken: chrisSeat, toggleReadyTo: true });
  await waitFor(() => chris.state.multiplayerRoom.status === "season_active", "Raum gestartet (season_active)");

  const coopSaveId: string = chris.state.multiplayerRoom.saveId;
  check(
    "A1: Spielstart praegt einen eigenen frischen Koop-Save und setzt den Flow auf 'training', Spieltag 1",
    coopSaveId !== soloSaveId &&
      coopSaveId !== "local-sandbox-active-save" &&
      chris.state.roomFlowState.step === "training" &&
      chris.state.multiplayerRoom.activeMatchday === 1,
    `coopSave=${coopSaveId}, step=${chris.state.roomFlowState.step}, activeMatchday=${chris.state.multiplayerRoom.activeMatchday}`,
  );

  // -------------------------------------------------------------------------------------------
  // C) Admin-Werkzeuge — Schritt 2: NACH der Bindung prallt jedes Werkzeug ab, Vorschau nicht
  // -------------------------------------------------------------------------------------------
  section("C) Admin-Schreibsperre — nach der Bindung (alle 5 Routen + Gegenproben)");

  const simSoloNachStart = await simStart(soloSaveId, "apply");
  check(
    "C3: Der Solo-Save ist nach dem Spielstart wieder frei (Sperre trifft exakt den gebundenen Save, nicht alles)",
    simSoloNachStart.status === 200 && simSoloNachStart.body.ok === true,
    `status=${simSoloNachStart.status}`,
  );
  if (simSoloNachStart.body.run?.runId) await simCancel(simSoloNachStart.body.run.runId);

  const simCoop = await simStart(coopSaveId, "apply");
  check(
    "C4: admin/season-simulation (apply) auf dem Koop-Save → 409 admin_write_blocked_room_bound_save",
    istRoomBound409(simCoop, "admin_season_simulation"),
    `status=${simCoop.status} error=${simCoop.body.error ?? "-"}`,
  );
  const simCoopDry = await simStart(coopSaveId, "dry_run");
  check(
    "C5: Gegenprobe — Dry-Run der Simulation bleibt auf dem Koop-Save erlaubt",
    simCoopDry.status === 200 && simCoopDry.body.ok === true,
    `status=${simCoopDry.status} runId=${simCoopDry.body.run?.runId ?? "-"}`,
  );
  if (simCoopDry.body.run?.runId) await simCancel(simCoopDry.body.run.runId);

  const coopSeasonId: string = chris.state.multiplayerRoom.activeSeasonId ?? "season-1";
  const resetExec = await postJson(
    api(`/api/singleplayer-state/season-start-reset?saveId=${encodeURIComponent(coopSaveId)}&seasonId=${encodeURIComponent(coopSeasonId)}`),
    { dryRun: false, confirmToken: SEASON_START_RESET_CONFIRM_TOKEN },
  );
  check(
    "C6: season-start-reset (execute) auf dem Koop-Save → 409 (trotz gueltigem Confirm-Token)",
    istRoomBound409(resetExec, "season_start_reset"),
    `status=${resetExec.status} error=${resetExec.body.error ?? "-"}`,
  );

  const picksReset = await postJson(
    api(`/api/ai/picks-audit-reset?saveId=${encodeURIComponent(coopSaveId)}&seasonId=${encodeURIComponent(coopSeasonId)}`),
    { dryRun: false, confirmToken: AI_PICK_AUDIT_RESET_CONFIRM_TOKEN },
  );
  check(
    "C7: ai/picks-audit-reset (execute) auf dem Koop-Save → 409",
    istRoomBound409(picksReset, "ai_picks_audit_reset"),
    `status=${picksReset.status} error=${picksReset.body.error ?? "-"}`,
  );
  const picksResetDry = await postJson(
    api(`/api/ai/picks-audit-reset?saveId=${encodeURIComponent(coopSaveId)}&seasonId=${encodeURIComponent(coopSeasonId)}`),
    { dryRun: true },
  );
  check(
    "C8: Gegenprobe — ai/picks-audit-reset Vorschau (dryRun) bleibt auf dem Koop-Save erlaubt",
    picksResetDry.status === 200,
    `status=${picksResetDry.status} resultStatus=${picksResetDry.body.status ?? "-"}`,
  );

  const picksImport = await postJson(api("/api/ai/picks-import"), {
    sourceSaveId: soloSaveId,
    targetSaveId: coopSaveId,
    seasonId: coopSeasonId,
    dryRun: false,
    confirmToken: AI_PICK_IMPORT_CONFIRM_TOKEN,
  });
  check(
    "C9: ai/picks-import (execute) gegen den Koop-Save als Ziel → 409",
    istRoomBound409(picksImport, "ai_picks_import"),
    `status=${picksImport.status} error=${picksImport.body.error ?? "-"}`,
  );

  const snapshotExec = await postJson(api("/api/season/season-snapshot"), {
    saveId: coopSaveId,
    execute: true,
    confirmToken: SEASON_SNAPSHOT_CONFIRM_TOKEN,
    forceCreate: true,
  });
  check(
    "C10: season/season-snapshot (execute) auf dem Koop-Save → 409 (Guard sitzt VOR dem Service)",
    istRoomBound409(snapshotExec, "season_snapshot"),
    `status=${snapshotExec.status} error=${JSON.stringify(snapshotExec.body.error ?? "-")}`,
  );
  // Gegenprobe Vorschau fuer season-snapshot: in der Dev-Umgebung scheitert bereits der SERVICE
  // (unabhaengig vom Guard) — siehe Beobachtung unten. Wir pruefen deshalb nur, dass der
  // Room-Bound-Guard im Dry-Run nicht feuert.
  const snapshotDry = await postJson(api("/api/season/season-snapshot"), { saveId: coopSaveId, dryRun: true });
  check(
    "C11: Gegenprobe — season-snapshot Vorschau wird NICHT vom Room-Bound-Guard abgelehnt",
    !istRoomBound409(snapshotDry, "season_snapshot"),
    `status=${snapshotDry.status}`,
  );
  if (snapshotDry.status === 500 && JSON.stringify(snapshotDry.body).includes("roundViewNumber")) {
    beobachtung(
      "VORBEFUND (nicht Teil der drei Aenderungen, seit PR #211): season-snapshot scheitert im Dev-Server " +
        "unabhaengig vom Room-Guard mit 500 'roundViewNumber ... is on the client' — " +
        "lib/season/season-snapshot-service.ts importiert ueber lib/foundation/team-discipline-rank-engine.ts:2 " +
        "das \"use client\"-Modul lib/foundation/tabs/season-stand-render-helpers.tsx. Das Werkzeug ist damit in " +
        "Route-Handlern faktisch kaputt; der neue 409-Guard (C10) greift trotzdem korrekt davor.",
    );
  }

  // Save-Loeschung: der einzige API-Weg, den Koop-Save unter dem Raum wegzuziehen (und damit
  // readRoomGameState → null zu erzwingen), ist ebenfalls versperrt.
  const deleteVersuch = await postJson(api("/api/singleplayer-state"), { action: "delete", saveIds: [coopSaveId] });
  const deleteBlocked = (deleteVersuch.body.blockedSaveIds as AnyState[] | undefined)?.some(
    (e) => e.saveId === coopSaveId && String(e.reason).includes(roomCode),
  );
  check(
    "C12: Loeschen des raumgebundenen Koop-Saves wird verweigert (kein API-Weg zu einem unlesbaren Room-Save)",
    deleteBlocked === true,
    `blockedSaveIds=${JSON.stringify(deleteVersuch.body.blockedSaveIds ?? [])}`,
  );

  const flowNachRefusals = chris.state.roomFlowState;
  check(
    "D1: Nach saemtlichen Ablehnungen ist der Flow unveraendert (step 'training', Spieltag 1)",
    flowNachRefusals.step === "training" && chris.state.multiplayerRoom.activeMatchday === 1,
    `step=${flowNachRefusals.step}, activeMatchday=${chris.state.multiplayerRoom.activeMatchday}`,
  );

  // -------------------------------------------------------------------------------------------
  // A) Die Saison: kompletter Durchlauf ueber das Knopf-Modell
  // -------------------------------------------------------------------------------------------
  section("A) Saison zu zweit durchspielbar: kompletter Zyklus-Durchlauf");

  const coopState = await leseSave(coopSaveId);
  const matchdayIds: string[] = coopState?.season?.matchdayIds ?? [];
  const spieltageGesamt = matchdayIds.length;
  check(
    "A2: Der Koop-Save ist lesbar und traegt eine echte Saison",
    spieltageGesamt > 1 && coopState?.gamePhase === "season_active",
    `${spieltageGesamt} Spieltage, gamePhase=${coopState?.gamePhase}`,
  );

  /**
   * A2b — DER LIGA-DRAFT BRAUCHT ZEIT, ALSO WIRD GEWARTET, BEVOR GEMESSEN WIRD.
   *
   * DIESE PRUEFUNG WAR IMMER ROT, und ihre Begruendung war ueberholt. Sie las den Spielstand direkt
   * nach dem Raumstart und schloss aus "31 von 32 Teams leer": `createRoomCoopSave` starte keinen
   * Liga-Draft. Nachgemessen (Aufgabe #51 und noch einmal am 18.08. ueber fuenf Raumstarts):
   * `startRoom` STARTET den Draft sehr wohl (room-store.ts, `kickoffLeagueSetupDraft`) — er laeuft
   * nur abgekoppelt weiter und braucht die gemessenen ein bis zwei Minuten. Wer sofort hinsieht,
   * sieht zwangsläufig leere Kader und haelt einen richtigen Zustand fuer einen Fehler.
   *
   * Gemessen wird deshalb, was wirklich zaehlt: ist die Liga bespielbar, NACHDEM der Draft fertig
   * ist. Das Feld dafuer gibt es (`seasonState.leagueSetupStatus`), und es ist dasselbe, an dem
   * auch das Banner in der Oberflaeche haengt.
   *
   * MENSCHLICH GEFUEHRTE TEAMS BLEIBEN DABEI LEER — das ist keine Luecke, sondern Chris' Ansage
   * ("niemals soll mit gepickt werden für menschliche teams"). Sie steht als eigene Pruefung
   * darunter, damit ein spaeterer Umbau sie nicht unbemerkt aushebelt.
   */
  const draftWartenBis = Date.now() + 6 * 60_000;
  let draftStatus: string | null = null;
  let standNachDraft: AnyState | null = coopState;
  while (Date.now() < draftWartenBis) {
    standNachDraft = await leseSave(coopSaveId);
    draftStatus = standNachDraft?.seasonState?.leagueSetupStatus ?? null;
    if (draftStatus === "ready" || draftStatus === "failed") break;
    await delay(3000);
  }

  {
    const rosterProTeam = new Map<string, number>();
    for (const eintrag of standNachDraft?.rosters ?? []) {
      rosterProTeam.set(eintrag.teamId, (rosterProTeam.get(eintrag.teamId) ?? 0) + 1);
    }
    const menschlich = new Set<string>([
      ...((chrisP.controlledTeamIds as string[]) ?? []),
      ...((frankyP.controlledTeamIds as string[]) ?? []),
    ]);
    const alleTeams: AnyState[] = standNachDraft?.teams ?? [];
    const kiTeams = alleTeams.filter((team: AnyState) => !menschlich.has(team.teamId));
    const kiOhneKader = kiTeams.filter((team: AnyState) => (rosterProTeam.get(team.teamId) ?? 0) === 0);
    const leereTeams = alleTeams.filter((team: AnyState) => (rosterProTeam.get(team.teamId) ?? 0) === 0);

    check(
      "A2b: Nach dem Liga-Draft haben alle KI-Teams einen Kader — der Raum ist bespielbar",
      draftStatus === "ready" && kiOhneKader.length === 0,
      draftStatus === "ready" && kiOhneKader.length === 0
        ? `leagueSetupStatus=ready, ${kiTeams.length} KI-Teams besetzt`
        : `leagueSetupStatus=${draftStatus ?? "(nicht gesetzt)"} nach bis zu 6 Minuten Warten, ` +
          `${kiOhneKader.length}/${kiTeams.length} KI-Teams ohne einen einzigen Spieler` +
          (draftStatus === "failed"
            ? " — der Hintergrund-Draft ist gescheitert (im Cockpit ueber 'Erneut versuchen' wiederholbar)"
            : ""),
    );

    /**
     * Die Grenze ist nicht "0 Spieler", sondern "deutlich weniger als ein gedrafteter Kader".
     *
     * CHRIS zum Einzelfall: "P-S ist in ordnung egal ob AI oder human gesteuert ist NULA dort im
     * team!" — ein einzelner, fest zum Team gehoerender Spieler ist kein Draft-Ergebnis. Auf
     * "genau 0" zu pruefen wuerde genau diesen richtigen Zustand als Fehler melden. Gemessen wird
     * deshalb gegen den kleinsten KI-Kader: ein Team, das der Draft bedient hat, ist mindestens so
     * gross wie der kleinste, den er hinterlassen hat.
     */
    const kleinsterKiKader = kiTeams.length
      ? Math.min(...kiTeams.map((team: AnyState) => rosterProTeam.get(team.teamId) ?? 0))
      : 0;
    const menschlicheGedraftet = alleTeams.filter(
      (team: AnyState) => menschlich.has(team.teamId) && (rosterProTeam.get(team.teamId) ?? 0) >= kleinsterKiKader,
    );
    check(
      "A2b2: Der Draft laesst die menschlich gefuehrten Teams in Ruhe — sie werden NICHT mitgepickt",
      draftStatus === "ready" && menschlicheGedraftet.length === 0,
      `${menschlich.size} menschliche Teams, davon ${menschlicheGedraftet.length} mit gedraftetem Kader ` +
        `(Schwelle: kleinster KI-Kader = ${kleinsterKiKader}); Kadergroessen: ` +
        [...menschlich].map((teamId) => `${teamId}=${rosterProTeam.get(teamId) ?? 0}`).join(", "),
    );

    if (leereTeams.length > 0) {
      beobachtung(
        "Die menschlich gefuehrten Teams bleiben nach dem Draft ohne Kader — so gewollt. Der Room-Flow-Knopf " +
          "'AI Teams vorbereiten' (runRoomAiAutoStep, lib/room/room-store.ts:684-706) schreibt nur Flow-Buchhaltung " +
          "und fuellt sie nicht; der Host baut seine Kader im Cockpit ueber picks-run auf, der Gast ueber manuelle " +
          "Transfermarkt-Kaeufe. Genau diese beiden Wege geht das Audit im Folgenden.",
      );
      /**
       * Der Cockpit-Weg des Hosts, in kleinen Happen (wie der Chunked-Auto-Finish der Shell,
       * ~4 Teams pro Request). Besitz-Grenze beachten (resolveAiBulkTeamWriteScope): ein Bulk-Run
       * darf KI-Teams und die EIGENEN Teams fuellen, nie die des Mitspielers.
       *
       * NUR NOCH DIE EIGENEN TEAMS: die KI-Teams hat der Liga-Draft beim Raumstart bereits
       * besetzt (A2b oben misst genau das). Sie hier ein zweites Mal durchzuschicken kostete rund
       * zwei Dutzend Anfragen fuer ein Ergebnis, das schon dasteht — ein Ueberbleibsel aus der
       * Zeit, in der man glaubte, `startRoom` starte gar keinen Draft.
       */
      const aiTeamIds: string[] = (chris.state.teamOwnership as AnyState[])
        .filter((eintrag) => eintrag.controllerType === "ai")
        .map((eintrag) => eintrag.teamId);
      const hostDraftTeamIds = [...(chrisP.controlledTeamIds as string[])];
      let draftFehler = "";
      for (let index = 0; index < hostDraftTeamIds.length && !draftFehler; index += 4) {
        const chunk = hostDraftTeamIds.slice(index, index + 4);
        const draftEinmal = async () => {
          await sichereChrisVerbindung();
          return postJson(
            api(
              `/api/ai/picks-run?saveId=${encodeURIComponent(coopSaveId)}&seasonId=${encodeURIComponent(coopSeasonId)}&source=sqlite`,
            ),
            {
              dryRun: false,
              confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
              teamScope: "all",
              teamIds: chunk,
              allowSetupAllTeams: true,
      includeManualTeams: true,
              roomCode,
              participantId: chrisP.participantId,
              seatToken: chrisSeat,
              userId: chrisP.userId,
            },
          );
        };
        let draft = await draftEinmal();
        if (draft.status === 403 && JSON.stringify(draft.body).includes("participant_offline")) {
          // Heartbeat waehrend des vorigen CPU-lastigen Chunks verhungert → rejoin + einmal neu.
          await delay(500);
          draft = await draftEinmal();
        }
        if (draft.status !== 200) {
          draftFehler = `chunk ${chunk.join(",")}: status=${draft.status} error=${JSON.stringify(draft.body?.error ?? "-")}`;
        }
      }
      const nachHostDraft = await leseSave(coopSaveId);
      const hostSeiteLeer = [...hostDraftTeamIds].filter(
        (teamId) => !(nachHostDraft?.rosters ?? []).some((eintrag: AnyState) => eintrag.teamId === teamId),
      );
      check(
        "A2c: Der Cockpit-Weg des HOSTS (picks-run mit Raum-Kontext) fuellt seine EIGENEN Teams",
        draftFehler === "" && hostSeiteLeer.length === 0,
        draftFehler ||
          `${chrisP.controlledTeamIds.length} Chris-Teams besetzt (die ${aiTeamIds.length} KI-Teams kamen aus dem Liga-Draft)`,
      );

      // Und die Gast-Teams? Der Gast wird von picks-run als Nicht-Host abgewiesen (korrekt als
      // Sicherheitsregel) — aber damit existiert fuer seine Teams KEIN KI-Weg mehr.
      const gastDraft = await postJson(
        api(
          `/api/ai/picks-run?saveId=${encodeURIComponent(coopSaveId)}&seasonId=${encodeURIComponent(coopSeasonId)}&source=sqlite`,
        ),
        {
          dryRun: false,
          confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
          teamScope: "all",
          teamIds: [...(frankyP.controlledTeamIds as string[])],
          allowSetupAllTeams: true,
      includeManualTeams: true,
          roomCode,
          participantId: frankyP.participantId,
          seatToken: frankySeat,
          userId: frankyP.userId,
        },
      );
      check(
        "C16: picks-run bleibt host-only — der Gast wird mit 403 host_only_action abgewiesen (Sicherheitsregel haelt)",
        gastDraft.status === 403 && JSON.stringify(gastDraft.body).includes("host_only_action"),
        `status=${gastDraft.status} error=${gastDraft.body.error ?? "-"}`,
      );
      beobachtung(
        "Fuer die GAST-Teams existiert damit kein KI-Weg: der Bulk-Scope des Hosts schliesst fremde Human-Teams aus " +
          "(lib/room/ai-bulk-team-write-scope.ts:40-46), und picks-run des Gasts scheitert am Host-only-Gate " +
          "(lib/room/server-authoritative-write-guard.ts:200-205). Die Gast-Kader entstehen nur durch MANUELLE " +
          "Transfermarkt-Kaeufe im fruehen Saisonstart-Fenster (isEarlySeasonSetup, solange Spieltag 1 unaufgeloest ist).",
      );

      // Der Gast kauft seine Kader von Hand zusammen — der einzige verbliebene App-Weg.
      let gekaufteSpieler = 0;
      let kaufFehler = "";
      for (const teamId of frankyP.controlledTeamIds as string[]) {
        for (let versuch = 0; versuch < 12 && !kaufFehler; versuch += 1) {
          const fa = await fetchJson(
            api(
              `/api/transfermarkt/free-agents?saveId=${encodeURIComponent(coopSaveId)}&seasonId=${encodeURIComponent(coopSeasonId)}&teamId=${encodeURIComponent(teamId)}&limit=40`,
            ),
          );
          const items: AnyState[] = fa.body?.items ?? [];
          const rosterCount: number = items[0]?.rosterCount ?? 0;
          const playerMin: number = items[0]?.playerMin ?? 6;
          if (rosterCount >= Math.max(playerMin, 6)) break;
          const kandidat = [...items]
            .filter((item) => item.affordabilityStatus !== "blocked")
            .sort((a, b) => (a.marketValue ?? 0) - (b.marketValue ?? 0))[0];
          if (!kandidat) {
            kaufFehler = `${teamId}: kein bezahlbarer Free Agent (items=${items.length})`;
            break;
          }
          const kaufEinmal = () =>
            postJson(api("/api/transfermarkt/buy"), {
              saveId: coopSaveId,
              seasonId: coopSeasonId,
              teamId,
              playerId: kandidat.playerId,
              dryRun: false,
              roomCode,
              participantId: frankyP.participantId,
              seatToken: frankySeat,
              userId: frankyP.userId,
            });
          let kauf = await kaufEinmal();
          if (kauf.status === 403 && JSON.stringify(kauf.body).includes("participant_offline")) {
            await rejoinFranky();
            kauf = await kaufEinmal();
          }
          if (kauf.status === 200 && kauf.body?.success === true) {
            gekaufteSpieler += 1;
          } else {
            kaufFehler = `${teamId}: Kauf ${kandidat.playerId} status=${kauf.status} error=${JSON.stringify(kauf.body?.error ?? "-")}`;
          }
        }
      }
      const nachKauf = await leseSave(coopSaveId);
      const gastLeer = (frankyP.controlledTeamIds as string[]).filter(
        (teamId) =>
          ((nachKauf?.rosters ?? []) as AnyState[]).filter((eintrag) => eintrag.teamId === teamId).length <
          6,
      );
      check(
        "A2d: Der Gast kann seine Kader im Saisonstart-Fenster manuell zusammenkaufen (Transfermarkt mit Raum-Kontext)",
        kaufFehler === "" && gastLeer.length === 0,
        kaufFehler || `${gekaufteSpieler} Spieler fuer ${frankyP.controlledTeamIds.length} Gast-Teams gekauft`,
      );
    }
  }

  /**
   * Beide readyen ueber das Knopf-Modell (set_ready gilt seit c70739f3 auch fuer den Host, siehe
   * Kommentar an der Lobby oben); der separate Room-Seiten-Umweg bleibt nur Rueckfall, falls
   * canClick aus einem anderen Grund false ist. Danach Host-Advance.
   */
  async function schrittAbschliessenUndWeiter(): Promise<string> {
    await sichereChrisVerbindung();
    await sichereFrankyVerbindung();
    const stepVorher: string = chris.state.roomFlowState.step;
    const stepDef = getRoomFlowStep(stepVorher);

    if (stepDef.aiAutoStep) {
      const aiKnopf = knopf(chris, chrisP.participantId);
      if (aiKnopf.action === "run_ai_auto_step") {
        sendeKnopfAktion(chrisSocket, { action: aiKnopf.action, roomCode, seatToken: chrisSeat, toggleReadyTo: true });
        await waitFor(
          () => !chris.state.roomFlowState.warnings.includes("ai_auto_step_pending"),
          `KI-Teams vorbereitet (${stepVorher})`,
        );
      }
    }

    const frankyKnopf = knopf(franky, frankyP.participantId);
    if (frankyKnopf.action === "set_ready" && frankyKnopf.canClick) {
      sendeKnopfAktion(franky.socket, { action: "set_ready", roomCode, seatToken: frankySeat, toggleReadyTo: true });
    }
    await waitFor(
      () => (chris.state.roomParticipants as AnyState[]).find((p) => p.participantId === frankyP.participantId)?.readyState === "ready",
      `Franky ready (${stepVorher})`,
    );

    const chrisKnopf = knopf(chris, chrisP.participantId);
    if (chrisKnopf.action === "set_ready" && chrisKnopf.canClick) {
      sendeKnopfAktion(chrisSocket, { action: "set_ready", roomCode, seatToken: chrisSeat, toggleReadyTo: true });
    } else if (!chrisKnopf.canClick) {
      // Umweg: canClick ist aus einem ANDEREN Grund false (z. B. "Warten auf Franky"), nicht weil
      // die Leiste dem Host kein set_ready anbietet -- das tut sie seit c70739f3 (siehe oben).
      hostUmwege += 1;
      chrisSocket.emit("setReadyState", { roomCode, seatToken: chrisSeat, ready: true });
    }
    await waitFor(() => chris.state.roomFlowState.canHostAdvance === true, `Host darf weiter (${stepVorher})`);

    const weiterKnopf = knopf(chris, chrisP.participantId);
    if (weiterKnopf.action !== "advance_flow" || !weiterKnopf.canClick) {
      throw new Error(`Host-Knopf bietet kein advance_flow auf ${stepVorher}: action=${weiterKnopf.action}`);
    }
    sendeKnopfAktion(chrisSocket, { action: weiterKnopf.action, roomCode, seatToken: chrisSeat, toggleReadyTo: true });
    await waitFor(
      () => chris.state.roomFlowState.step !== stepVorher && franky.state.roomFlowState.step !== stepVorher,
      `Flow-Schritt nach ${stepVorher} gewechselt`,
    );
    return chris.state.roomFlowState.step;
  }

  // Vorsaison bis zum Zyklus-Start: training → finalize_transfers → lineup
  const durchlaufeneSchritte: string[] = ["training"];
  while (chris.state.roomFlowState.step !== "lineup") {
    const next = await schrittAbschliessenUndWeiter();
    durchlaufeneSchritte.push(next);
    if (durchlaufeneSchritte.length > 8) throw new Error(`Vorsaison erreicht 'lineup' nicht: ${durchlaufeneSchritte.join("→")}`);
  }
  check(
    "A3: Vorsaison laeuft linear bis zum Zyklus-Start 'lineup'",
    durchlaufeneSchritte.join("→") === "training→finalize_transfers→lineup",
    durchlaufeneSchritte.join("→"),
  );

  // --- B6: Regressions-Wache gegen den Shell-Deadlock des Hosts -------------------------------
  // Frueherer Fund (c70739f3): im Zustand "KI fertig, Gast ready, Host NICHT ready" bot die
  // Leiste KEINEM Teilnehmer einen klickbaren Knopf — der Host haengt an seiner eigenen
  // Ready-Meldung, die nur die Room-Seite (separater "Bereit melden"-Knopf) senden konnte. Die
  // mussBereitMelden-Erweiterung (room-flow-controller.ts:307-330, siehe Lobby-Kommentar oben)
  // behebt genau das: sie gibt dem Host in diesem Zustand ein klickbares 'set_ready'. Dieser
  // Check ist seither eine Regressions-Wache, kein offener Befund mehr.
  {
    const stepDef = getRoomFlowStep(chris.state.roomFlowState.step);
    if (stepDef.aiAutoStep) {
      const aiKnopf = knopf(chris, chrisP.participantId);
      if (aiKnopf.action === "run_ai_auto_step") {
        sendeKnopfAktion(chrisSocket, { action: aiKnopf.action, roomCode, seatToken: chrisSeat, toggleReadyTo: true });
        await waitFor(() => !chris.state.roomFlowState.warnings.includes("ai_auto_step_pending"), "KI fertig (Deadlock-Probe)");
      }
    }
    sendeKnopfAktion(franky.socket, { action: "set_ready", roomCode, seatToken: frankySeat, toggleReadyTo: true });
    await waitFor(
      () => (chris.state.roomParticipants as AnyState[]).find((p) => p.participantId === frankyP.participantId)?.readyState === "ready",
      "Franky ready (Deadlock-Probe)",
    );
    const hostKnopf = knopf(chris, chrisP.participantId);
    const gastKnopf = knopf(franky, frankyP.participantId);
    check(
      "B6: Auch der Host kann seinen Part komplett aus der Shell-Leiste bedienen (kein Klick-Deadlock)",
      hostKnopf.canClick || gastKnopf.canClick,
      `Host: label="${hostKnopf.label}" action=${hostKnopf.action} canClick=${hostKnopf.canClick}; ` +
        `Gast: label="${gastKnopf.label}" action=${gastKnopf.action} canClick=${gastKnopf.canClick}`,
    );
    // Chris' eigene Bereitmeldung fehlt an dieser Stelle bewusst noch (die Probe misst den
    // Zustand DAVOR) — der naechste schrittAbschliessenUndWeiter()-Aufruf holt sie nach.
  }

  // --- Zyklus 1 OHNE Spieltags-Aufloesung: kehrt zurueck, schiebt aber nichts weiter ----------
  {
    let step = chris.state.roomFlowState.step;
    let sicherung = 0;
    while (step !== "standings") {
      step = await schrittAbschliessenUndWeiter();
      sicherung += 1;
      if (sicherung > 8) throw new Error(`Zyklus erreicht 'standings' nicht (haengt bei ${step})`);
    }
    const naechster = await schrittAbschliessenUndWeiter();
    check(
      "A4: Zyklus OHNE Aufloesung kehrt vom Saisonstand zur Einsatzliste zurueck (kein vorzeitiges Season Review)",
      naechster === "lineup",
      `standings→${naechster}, seasonContinues=${chris.state.roomFlowState.seasonContinues}`,
    );
    const persistiert = await leseSave(coopSaveId);
    check(
      "A5: OHNE Aufloesung bewegt sich der Spielstand nicht — der Zyklus kann keinen Spieltag ueberspringen",
      chris.state.multiplayerRoom.activeMatchday === 1 && persistiert?.season?.currentMatchday === 1,
      `activeMatchday=${chris.state.multiplayerRoom.activeMatchday}, persistiert=${persistiert?.season?.currentMatchday}`,
    );
    beobachtung(
      "Der Zyklus dreht beliebig oft ohne Spieltags-Aufloesung weiter (Warteschleife auf demselben Spieltag). " +
        "Keine Endlosschleife ohne Nutzeraktion, aber der Flow erzwingt die Aufloesung nicht — er verlaesst sich darauf, " +
        "dass die Spieler die Arena tatsaechlich buchen.",
    );
  }

  // --- Zyklen MIT Aufloesung: die ganze Saison -----------------------------------------------
  const zyklusProtokoll: string[] = [];
  let aufgeloesteSpieltage = 0;
  let arenaKonsistenzGeprueft = false;
  let gastDarfNichtAufloesenGeprueft = false;
  let fremdesTeamGeprueft = false;
  let midCycleRefusalOk: boolean | null = null;
  let ctaSpieltagOk: boolean | null = null;
  let ctaReviewLabel = "";
  let rejoinChecksDone = false;
  let lineupSavesOk = 0;
  let lineupSavesGesamt = 0;
  let lineupFehlerDetail = "";

  /**
   * Beide Spieler geben im Einsatzlisten-Schritt ihre Aufstellungen ab — ueber den Weg der App
   * selbst: KI-Vorschlag (`ai-preview`) uebernehmen und mit Raum-Kontext als BESITZENDER
   * Spieler speichern (PUT /api/lineups/legacy, `lineup_save`-Guard). Manuell gesteuerte Teams
   * OHNE gespeicherte Aufstellung blockieren die Aufloesung zu Recht (`missing_manual_lineup`,
   * lib/season/matchday-auto-run-service.ts:871) — genau wie im echten Spiel.
   */
  async function beideSpielerSetzenAufstellungen(matchdayId: string, seasonIdFuerSpieltag: string = coopSeasonId) {
    await sichereChrisVerbindung();
    await sichereFrankyVerbindung();
    const besitzer = [
      { p: chrisP, seat: chrisSeat },
      { p: frankyP, seat: frankySeat },
    ];
    for (const { p, seat } of besitzer) {
      for (const teamId of p.controlledTeamIds as string[]) {
        lineupSavesGesamt += 1;
        // Die Saison kommt als Parameter, weil dieselbe Hilfe jetzt AUCH den ersten Spieltag der
        // NEUEN Saison bedient (A22) — dort waere `coopSeasonId` die abgelaufene.
        const basis =
          `saveId=${encodeURIComponent(coopSaveId)}&seasonId=${encodeURIComponent(seasonIdFuerSpieltag)}` +
          `&matchdayId=${encodeURIComponent(matchdayId)}&teamId=${encodeURIComponent(teamId)}`;
        const vorschlag = await fetchJson(api(`/api/lineups/legacy/ai-preview?${basis}`));
        const entries = vorschlag.body?.preview?.entries ?? vorschlag.body?.entries ?? [];
        if (!Array.isArray(entries) || entries.length === 0) {
          lineupFehlerDetail = `${teamId}@${matchdayId}: ai-preview ohne entries (status=${vorschlag.status})`;
          continue;
        }
        const ctx = `&roomCode=${encodeURIComponent(roomCode)}&participantId=${encodeURIComponent(p.participantId)}&seatToken=${encodeURIComponent(seat)}&userId=${encodeURIComponent(p.userId)}`;
        const putEinmal = () =>
          fetchJson(api(`/api/lineups/legacy?${basis}${ctx}`), {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ entries, confirmLock: true }),
          });
        let put = await putEinmal();
        if (put.status === 403 && JSON.stringify(put.body).includes("participant_offline")) {
          // Heartbeat-Starvation (siehe rejoin*-Kommentar): Teilnehmer serverseitig offline →
          // rejoin und genau ein zweiter Versuch.
          await (p === chrisP ? rejoinChris() : rejoinFranky());
          put = await putEinmal();
        }
        if (put.status === 200) {
          lineupSavesOk += 1;
        } else {
          lineupFehlerDetail = `${teamId}@${matchdayId}: PUT status=${put.status} error=${JSON.stringify(put.body?.error ?? put.body?.errors ?? "-")}`;
        }
      }
    }
  }

  for (let runde = 0; runde < spieltageGesamt + 2; runde += 1) {
    const persistiertVorher = await leseSave(coopSaveId);
    const aktuellerSpieltag: number = persistiertVorher?.season?.currentMatchday ?? -1;
    const aktuelleMatchdayId: string = persistiertVorher?.matchdayState?.matchdayId ?? "";

    // Reconnect-Probe mitten im Zyklus (einmal, vor Spieltag 3): Gast trennt und kehrt mit
    // seinem Seat-Token zurueck — Schritt, Spieltag und seasonContinues muessen ueberleben.
    if (!rejoinChecksDone && aktuellerSpieltag === 3) {
      const stepVorher = chris.state.roomFlowState.step;
      const continuesVorher = chris.state.roomFlowState.seasonContinues;
      franky.socket.disconnect();

      // Erfaehrt der verbliebene Client von der Trennung? Der Server aktualisiert seinen
      // Zustand (markDisconnected → syncPlayers), muesste ihn aber auch broadcasten.
      const trennungGebroadcastet = await waitFor(
        () =>
          (chris.state.roomParticipants as AnyState[]).find((p) => p.participantId === frankyP.participantId)
            ?.connectionStatus === "offline",
        "Franky offline im Chris-Client",
        4000,
      ).catch(() => false);
      check(
        "D2a: Der verbliebene Client erfaehrt per Broadcast vom Verbindungsabriss des Mitspielers",
        trennungGebroadcastet === true,
        trennungGebroadcastet === true
          ? "roomState-Broadcast nach Disconnect kam an"
          : "kein roomState-Broadcast: lib/socket/server.ts:328-330 ruft markDisconnected auf, emittiert danach aber " +
            "nichts — die Shell-Leiste des Hosts zeigt weiter 'Warten auf Franky', obwohl der Server den Offline-Gast " +
            "laengst nicht mehr verlangt (erst das naechste beliebige Event macht den Stand sichtbar)",
      );

      // Um weiter pruefen zu koennen, einen Broadcast von Hand ausloesen (harmloses Ready-Reset
      // des Hosts) — danach muss der SERVER-Zustand die Trennung korrekt tragen.
      if (!trennungGebroadcastet) {
        chrisSocket.emit("setReadyState", { roomCode, seatToken: chrisSeat, ready: false });
        await waitFor(
          () =>
            (chris.state.roomParticipants as AnyState[]).find((p) => p.participantId === frankyP.participantId)
              ?.connectionStatus === "offline",
          "Franky offline nach manuell ausgeloestem Broadcast",
        );
      }
      const requiredWaehrendOffline: string[] = chris.state.roomFlowState.requiredParticipantIds;
      beobachtung(
        `Waehrend der Gast offline ist, schrumpft requiredParticipantIds auf ${requiredWaehrendOffline.length} ` +
          "(lib/room/room-flow-controller.ts:166, connectionStatus-Filter) — der Host koennte Schritte allein " +
          "weiterschalten; der Gast landet nach dem Rejoin in einem spaeteren Schritt. Design-Entscheidung " +
          "(Offline-Spieler blockieren nicht), aber fuer eine gemeinsame Saison erwaehnenswert.",
      );
      const frankySocketNeu = await connect(opts.baseUrl);
      franky = trackSocket(frankySocketNeu);
      const rejoined = await emitJoined(frankySocketNeu, "rejoinRoom", { roomCode, seatToken: frankySeat });
      await waitFor(() => Boolean(franky.state), "Franky hat nach Rejoin roomState");
      check(
        "D2: Rejoin mitten im Zyklus — gleicher Teilnehmer, gleicher Schritt, gleicher Spieltag, seasonContinues erhalten",
        rejoined.participantId === frankyP.participantId &&
          franky.state.roomFlowState.step === stepVorher &&
          franky.state.multiplayerRoom.activeMatchday === chris.state.multiplayerRoom.activeMatchday &&
          franky.state.roomFlowState.seasonContinues === continuesVorher,
        `participant=${rejoined.participantId === frankyP.participantId}, step=${franky.state.roomFlowState.step}, ` +
          `activeMatchday=${franky.state.multiplayerRoom.activeMatchday}, seasonContinues=${franky.state.roomFlowState.seasonContinues}`,
      );
      await waitFor(() => chris.state.roomFlowState.requiredParticipantIds.length === 2, "Ready-Gate gilt nach Rejoin wieder fuer 2");
      rejoinChecksDone = true;
    }

    // Im Einsatzlisten-Schritt geben beide Spieler ihre Aufstellungen ab (der echte Spielzug).
    await beideSpielerSetzenAufstellungen(aktuelleMatchdayId);

    // Besitz-Gegenprobe (einmal): Chris darf die Aufstellung eines FRANKY-Teams nicht speichern.
    if (!fremdesTeamGeprueft && aktuellerSpieltag === 2) {
      const fremdesTeam = (frankyP.controlledTeamIds as string[])[0]!;
      const basis =
        `saveId=${encodeURIComponent(coopSaveId)}&seasonId=${encodeURIComponent(coopSeasonId)}` +
        `&matchdayId=${encodeURIComponent(aktuelleMatchdayId)}&teamId=${encodeURIComponent(fremdesTeam)}`;
      const ctx = `&roomCode=${encodeURIComponent(roomCode)}&participantId=${encodeURIComponent(chrisP.participantId)}&seatToken=${encodeURIComponent(chrisSeat)}&userId=${encodeURIComponent(chrisP.userId)}`;
      const fremdPut = await fetchJson(api(`/api/lineups/legacy?${basis}${ctx}`), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries: [], confirmLock: true }),
      });
      check(
        "B8: Chris darf die Aufstellung eines Franky-Teams NICHT speichern (Besitz-Isolation gilt im Zyklus weiter)",
        fremdPut.status === 403,
        `status=${fremdPut.status} error=${fremdPut.body.error ?? "-"} team=${fremdesTeam}`,
      );
      fremdesTeamGeprueft = true;
    }

    // lineup → formcards → arena
    let step = chris.state.roomFlowState.step;
    let sicherung = 0;
    while (step !== "arena") {
      step = await schrittAbschliessenUndWeiter();
      sicherung += 1;
      if (sicherung > 8) throw new Error(`Zyklus erreicht 'arena' nicht (haengt bei ${step})`);
    }

    // Arena-Konsistenz (einmal): der Host startet die gemeinsame Arena — Schritt und
    // arenaSyncState wechseln im SELBEN Broadcast, beide Navigations-Trigger zeigen auf dieselbe
    // View (Gegenstueck zum statischen Check S5).
    if (!arenaKonsistenzGeprueft) {
      chrisSocket.emit("startRoomArena", { roomCode, seatToken: chrisSeat, maxSlotRevealCountByDiscipline: { d1: 2, d2: 2 } });
      await waitFor(() => franky.state.arenaSyncState?.status === "ready_check", "Arena gestartet (Gast sieht ready_check)");
      check(
        "B3: Host startet Arena — Gast-Broadcast traegt Schritt 'arena' UND aktiven Arena-Sync zusammen",
        franky.state.roomFlowState.step === "arena" && franky.state.arenaSyncState.status === "ready_check",
        `step=${franky.state.roomFlowState.step}, arena=${franky.state.arenaSyncState.status}`,
      );
      arenaKonsistenzGeprueft = true;
    }

    // Gegenprobe (einmal): der GAST darf den Spieltag nicht aufloesen.
    if (!gastDarfNichtAufloesenGeprueft && aktuellerSpieltag === 2) {
      const gastVersuch = await postJson(api("/api/season/matchday-auto-run"), {
        saveId: coopSaveId,
        seasonId: coopSeasonId,
        matchdayId: aktuelleMatchdayId,
        execute: true,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        roomCode,
        participantId: frankyP.participantId,
        seatToken: frankySeat,
        userId: frankyP.userId,
      });
      check(
        "B4: Gast darf den Spieltag NICHT aufloesen (host_only_action)",
        gastVersuch.status === 403 && JSON.stringify(gastVersuch.body).includes("host_only_action"),
        `status=${gastVersuch.status} error=${gastVersuch.body.error ?? "-"}`,
      );
      gastDarfNichtAufloesenGeprueft = true;
    }

    // Der HOST loest den Spieltag echt auf — mit Raum-Kontext, wie es Cockpit/Arena tun
    // (lib/foundation/tabs/cockpit-matchday-handlers.ts:382ff). `stopOnTie: false` entspricht
    // dem Cockpit-Schalter "Bei Gleichstand stoppen" AUS: mit den guenstigen Audit-Kadern sind
    // Punktgleichstaende praktisch sicher, und ein Stopp waere hier kein Erkenntnisgewinn.
    const frankyEventsVorher = franky.gameplayEvents.length;
    const aufloesenEinmal = async () => {
      await sichereChrisVerbindung();
      return postJson(api("/api/season/matchday-auto-run"), {
        saveId: coopSaveId,
        seasonId: coopSeasonId,
        matchdayId: aktuelleMatchdayId,
        execute: true,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        roomCode,
        participantId: chrisP.participantId,
        seatToken: chrisSeat,
        userId: chrisP.userId,
        options: { stopOnTie: false },
      });
    };
    let aufloesung = await aufloesenEinmal();
    if (aufloesung.status === 403 && JSON.stringify(aufloesung.body).includes("participant_offline")) {
      await rejoinChris();
      aufloesung = await aufloesenEinmal();
    }
    if (!(aufloesung.status === 200 && aufloesung.body.success === true)) {
      check(
        `A6: Spieltag ${aktuellerSpieltag} liess sich nicht aufloesen — Saison haengt`,
        false,
        `status=${aufloesung.status} error=${JSON.stringify(aufloesung.body.error ?? aufloesung.body.blockingReasons ?? "-")}`,
      );
      break;
    }
    aufgeloesteSpieltage += 1;
    await waitFor(() => franky.gameplayEvents.length > frankyEventsVorher, "Gast erhaelt Aufloesungs-Broadcast").catch(() => {});
    if (aufgeloesteSpieltage === 1) {
      check(
        "B5: Die Aufloesung erreicht den Gast als roomGameplayEvent (Live-Sync statt stiller Save-Aenderung)",
        franky.gameplayEvents.length > frankyEventsVorher,
        `+${franky.gameplayEvents.length - frankyEventsVorher} Event(s), zuletzt=${franky.gameplayEvents.at(-1)?.type ?? "-"}`,
      );
    }

    // Ablehnung MITTEN im Zyklus (einmal, nach Aufloesung von Spieltag 2): Werkzeug prallt ab,
    // Flow bleibt exakt stehen.
    if (midCycleRefusalOk === null && aktuellerSpieltag === 2) {
      const stepVorRefusal = chris.state.roomFlowState.step;
      const mdVorRefusal = chris.state.multiplayerRoom.activeMatchday;
      const refusal = await simStart(coopSaveId, "apply");
      midCycleRefusalOk =
        istRoomBound409(refusal, "admin_season_simulation") &&
        chris.state.roomFlowState.step === stepVorRefusal &&
        chris.state.multiplayerRoom.activeMatchday === mdVorRefusal;
      check(
        "D3: Admin-Sperre greift auch MITTEN im Zyklus, und die Ablehnung laesst den Flow unangetastet",
        midCycleRefusalOk === true,
        `status=${refusal.status}, step=${chris.state.roomFlowState.step}, activeMatchday=${chris.state.multiplayerRoom.activeMatchday}`,
      );
    }

    // arena → result → standings
    step = await schrittAbschliessenUndWeiter(); // result
    step = await schrittAbschliessenUndWeiter(); // standings
    if (step !== "standings") throw new Error(`Nach 'result' kam '${step}' statt 'standings'`);

    const persistiertNachher = await leseSave(coopSaveId);
    const spieltagNachher: number = persistiertNachher?.season?.currentMatchday ?? -1;
    const continues: boolean | null = chris.state.roomFlowState.seasonContinues;

    // CTA am Zyklus-Ende: benennt das echte Ziel (naechster Spieltag bzw. Season Review) —
    // dafuer muss erst wieder Ready-Stand hergestellt sein (canHostAdvance), sonst zeigt der
    // Knopf "Warten".
    await sichereChrisVerbindung();
    await sichereFrankyVerbindung();
    sendeKnopfAktion(franky.socket, { action: "set_ready", roomCode, seatToken: frankySeat, toggleReadyTo: true });
    await waitFor(
      () => (chris.state.roomParticipants as AnyState[]).find((p) => p.participantId === frankyP.participantId)?.readyState === "ready",
      "Franky ready (standings)",
    );
    const chrisKnopf = knopf(chris, chrisP.participantId);
    if (chrisKnopf.action === "set_ready" && chrisKnopf.canClick) {
      sendeKnopfAktion(chrisSocket, { action: "set_ready", roomCode, seatToken: chrisSeat, toggleReadyTo: true });
    } else if (!chrisKnopf.canClick) {
      hostUmwege += 1;
      chrisSocket.emit("setReadyState", { roomCode, seatToken: chrisSeat, ready: true });
    }
    await waitFor(() => chris.state.roomFlowState.canHostAdvance === true, "Host darf weiter (standings)");
    const standingsKnopf = knopf(chris, chrisP.participantId);
    if (continues === true && ctaSpieltagOk === null) {
      ctaSpieltagOk = standingsKnopf.label === `Weiter: Spieltag ${chris.state.multiplayerRoom.activeMatchday}`;
      check(
        "A7: CTA am Zyklus-Ende benennt den naechsten Spieltag aus dem Spielstand",
        ctaSpieltagOk,
        `label="${standingsKnopf.label}", activeMatchday=${chris.state.multiplayerRoom.activeMatchday}`,
      );
    }
    if (continues === false) {
      ctaReviewLabel = standingsKnopf.label;
    }
    sendeKnopfAktion(chrisSocket, { action: standingsKnopf.action, roomCode, seatToken: chrisSeat, toggleReadyTo: true });
    await waitFor(() => chris.state.roomFlowState.step !== "standings", "Flow verlaesst standings");
    const naechsterSchritt = chris.state.roomFlowState.step;

    zyklusProtokoll.push(
      `Spieltag ${aktuellerSpieltag}: aufgeloest→currentMatchday=${spieltagNachher}, activeMatchday=${chris.state.multiplayerRoom.activeMatchday}, ` +
        `seasonContinues=${continues}, standings→${naechsterSchritt}`,
    );

    const activeMatchdayKorrekt = chris.state.multiplayerRoom.activeMatchday === spieltagNachher;
    if (!activeMatchdayKorrekt) {
      check(
        `A8: activeMatchday folgt dem persistierten Spielstand (Spieltag ${aktuellerSpieltag})`,
        false,
        `activeMatchday=${chris.state.multiplayerRoom.activeMatchday}, persistiert=${spieltagNachher}`,
      );
      break;
    }

    if (naechsterSchritt === "season_review") break;
    if (naechsterSchritt !== "lineup") {
      check("A8b: Zyklus-Ende fuehrt nur zu 'lineup' oder 'season_review'", false, `standings→${naechsterSchritt}`);
      break;
    }
  }

  const endStand = await leseSave(coopSaveId);
  check(
    "A9: Beide Spieler konnten JEDE Runde ihre Aufstellungen mit Raum-Kontext speichern",
    lineupSavesGesamt > 0 && lineupSavesOk === lineupSavesGesamt,
    `${lineupSavesOk}/${lineupSavesGesamt} Aufstellungs-Schreibvorgaenge ok${lineupFehlerDetail ? `; letzter Fehler: ${lineupFehlerDetail}` : ""}`,
  );
  check(
    `A10: ALLE ${spieltageGesamt} Spieltage wurden im Zyklus aufgeloest`,
    aufgeloesteSpieltage === spieltageGesamt,
    `${aufgeloesteSpieltage}/${spieltageGesamt}; Protokoll: ${zyklusProtokoll.join(" | ")}`,
  );
  check(
    "A11: Nach dem letzten Spieltag endet der Flow im Season Review (kein weiterer Zyklus) und die Saison ist abgeschlossen",
    chris.state.roomFlowState.step === "season_review" &&
      chris.state.roomFlowState.seasonContinues === false &&
      endStand?.gamePhase === "season_completed",
    `step=${chris.state.roomFlowState.step}, seasonContinues=${chris.state.roomFlowState.seasonContinues}, gamePhase=${endStand?.gamePhase}, CTA="${ctaReviewLabel}"`,
  );
  check(
    "A12: Der letzte Zyklus-Knopf hiess 'Weiter: Season Review' (Ziel aus dem Spielstand, nicht geraten)",
    ctaReviewLabel === "Weiter: Season Review",
    `label="${ctaReviewLabel}"`,
  );
  check(
    "A13: Alle Spieltags-Ergebnisse liegen im Spielstand (die Saison wurde WIRKLICH gespielt, nicht nur durchgeklickt)",
    (endStand?.seasonState?.matchdayResults ?? []).length >= spieltageGesamt,
    `${(endStand?.seasonState?.matchdayResults ?? []).length} Ergebnisse fuer ${spieltageGesamt} Spieltage`,
  );

  /**
   * A14 PINNTE BIS EBEN DAS GEGENTEIL (docs/MULTIPLAYER_SAISONWECHSEL_PLAN.md Korrektur 2, dritter
   * Fall dieses Musters nach F8 und dem season_review→season_review-Test): "Season Review ist die
   * Endstation — kein Wrap-around zurueck in Lobby oder Zyklus" mit der Behauptung
   * `step === "season_review"` NACH einem erneuten Weiter-Klick. Das war die Sackgasse selbst, die
   * Paket A aufgeloest hat (`getNextRoomFlowStepId`, room-flow-controller.ts:187-189: aus
   * `season_review` geht es jetzt IMMER weiter zu `season_transition`). Der Test haette also genau
   * den reparierten Fehler wieder verlangt.
   *
   * Umgedreht statt geloescht: die EIGENTLICH gemeinte Eigenschaft — kein Wrap-around zurueck in
   * Lobby oder Spieltag-Zyklus — bleibt bestehen. Neu ist nur, dass es jetzt einen geordneten
   * Ausgang nach VORN gibt (`season_transition`), statt gar keinen.
   */
  {
    const next = await schrittAbschliessenUndWeiter();
    check(
      "A14: Aus Season Review geht es weiter in den Saisonwechsel — keine Sackgasse mehr, aber (Gegenprobe) auch kein Wrap-around zurueck in Lobby oder Spieltag-Zyklus",
      next === "season_transition",
      `season_review→${next}`,
    );
  }

  // -------------------------------------------------------------------------------------------
  // E) Der Saisonwechsel im Raum (Paket C, docs/MULTIPLAYER_SAISONWECHSEL_PLAN.md): Gast-Abweisung
  // mit Gegenprobe, Ready-Gate, der sich erklaerende Riegel, und der Durchstich in die neue Saison.
  // Numeriert an die A-Reihe angehaengt (A15..), weil sie inhaltlich die Saison-Kette fortsetzen.
  // -------------------------------------------------------------------------------------------
  section("E) Der Saisonwechsel im Raum: Gast-Abweisung, Ready-Gate, Riegel, Durchstich");

  // A15/A16: `season_completion` UND `season_transition` stehen in HOST_LEVEL_ACTIONS
  // (server-authoritative-write-guard.ts:75-76) — der Gast wird an BEIDEN Routen mit 403
  // host_only_action abgewiesen. dryRun:true, damit ein unerwartet durchgelassener Schreibzugriff
  // hier nichts am Spielstand veraendert, bevor A17 die Gegenprobe misst.
  const gastCompletionVersuch = await postJson(api("/api/season/completion"), {
    saveId: coopSaveId,
    seasonId: coopSeasonId,
    dryRun: true,
    roomCode,
    participantId: frankyP.participantId,
    seatToken: frankySeat,
    userId: frankyP.userId,
  });
  check(
    "A15: Der Gast wird bei season_completion abgewiesen (403 host_only_action) — die Saisonende-Kette gehoert dem Host",
    gastCompletionVersuch.status === 403 && JSON.stringify(gastCompletionVersuch.body).includes("host_only_action"),
    `status=${gastCompletionVersuch.status} error=${gastCompletionVersuch.body.error ?? "-"}`,
  );

  const gastTransitionVersuch = await postJson(api("/api/season/transition"), {
    saveId: coopSaveId,
    dryRun: true,
    action: "advance_step",
    roomCode,
    participantId: frankyP.participantId,
    seatToken: frankySeat,
    userId: frankyP.userId,
  });
  check(
    "A16: Der Gast wird bei season_transition abgewiesen (403 host_only_action) — derselbe Riegel, die andere der zwei genannten Routen",
    gastTransitionVersuch.status === 403 && JSON.stringify(gastTransitionVersuch.body).includes("host_only_action"),
    `status=${gastTransitionVersuch.status} error=${gastTransitionVersuch.body.error ?? "-"}`,
  );

  /**
   * A17 — DIE ZWEITE HAELFTE, sonst waeren A15/A16 nur die Haelfte des Falls (Plan, Paket C,
   * Punkt 2: "Ein Check, der nur die Ablehnung misst, waere genau der halbe Test"). Nachgemessen
   * (server-authoritative-write-guard.ts:66-83, HOST_LEVEL_ACTIONS): `sponsor_choice` steht dort
   * NICHT drin — genau wie contract_renewal, contract_dissolution und Team-Verkaeufe (Plan-Text).
   * Und die Phase erlaubt es genau JETZT: `evaluateGamePhaseAction(..., "sponsor_choice")` laesst
   * `season_completed` ausdruecklich zu (game-phase-action-policy.ts:74-85) — der Raum steht exakt
   * dort (A11: gamePhase "season_completed"), noch bevor die Kette unten irgendeine Station
   * angefasst hat. Franky waehlt mit seinem EIGENEN Sitz-Token einen Sponsor fuer sein EIGENES
   * Team — keine Host-Aktion, sondern die Art Saisonende-Aktion, die ihm laut 1.3 im Plan gehoert.
   * Die Angebote selbst muessen nicht erst erzeugt werden: `createRoomCoopSave` ruft
   * `ensureSeasonSponsorOffers` fuer ALLE Teams beim Praegen des Saves auf (new-game-setup-service.ts:480)
   * — auch fuer das manuell gefuehrte Team, das seinen Sponsor bewusst erst hier waehlt.
   */
  {
    const frankyTeamId = (frankyP.controlledTeamIds as string[])[0]!;
    const standVorSponsorwahl = await leseSave(coopSaveId);
    const frankyOffers = (standVorSponsorwahl?.seasonState?.sponsorOffersByTeamId?.[frankyTeamId] ?? []) as AnyState[];
    const offer = frankyOffers.find((entry) => entry.seasonId === standVorSponsorwahl?.season?.id);
    if (!offer) {
      check(
        "A17: Gegenprobe — Franky's eigene Saisonende-Aktion (sponsor_choice, NICHT in HOST_LEVEL_ACTIONS) geht mit seinem Sitz-Token durch",
        false,
        `kein Sponsor-Angebot fuer Team ${frankyTeamId} in Saison ${standVorSponsorwahl?.season?.id} gefunden — sponsorOffersByTeamId leer?`,
      );
    } else {
      const sponsorWahl = await postJson(api("/api/sponsor/choose"), {
        saveId: coopSaveId,
        teamId: frankyTeamId,
        offerId: offer.offerId,
        dryRun: false,
        roomCode,
        participantId: frankyP.participantId,
        seatToken: frankySeat,
        userId: frankyP.userId,
      });
      check(
        "A17: Gegenprobe — Franky's eigene Saisonende-Aktion (sponsor_choice, NICHT in HOST_LEVEL_ACTIONS) geht mit seinem Sitz-Token durch, waehrend derselbe Raum A15/A16 gerade abgewiesen hat",
        sponsorWahl.status === 200 && sponsorWahl.body.success === true,
        `status=${sponsorWahl.status} success=${sponsorWahl.body.success} error=${JSON.stringify(sponsorWahl.body.error ?? "-")} team=${frankyTeamId} offer=${offer.offerId}`,
      );
    }
  }

  /**
   * A18 — DAS READY-GATE AM SAISONWECHSEL (Paket A, E3): `season_transition` hat `aiAutoStep:
   * false` und laeuft ueber GENAU dasselbe `canHostAdvance`-Gate wie jeder Spieltag-Schritt
   * (buildRoomFlowState, room-flow-controller.ts:239-253). Frisch auf dem Schritt sind BEIDE
   * `not_ready` (advanceRoomFlow resetet bei jedem Schrittwechsel, room-store.ts:1427) — der Host
   * darf noch nicht weiter, und ein Versuch wird server-seitig abgelehnt (room-store.ts:1351-1353),
   * nicht nur clientseitig ausgegraut.
   */
  await sichereChrisVerbindung();
  await sichereFrankyVerbindung();
  check(
    "A18: Frisch auf season_transition ist noch niemand bereit — canHostAdvance ist false",
    chris.state.roomFlowState.step === "season_transition" && chris.state.roomFlowState.canHostAdvance === false,
    `step=${chris.state.roomFlowState.step}, canHostAdvance=${chris.state.roomFlowState.canHostAdvance}`,
  );
  const vorschubOhneReady = await new Promise<AnyState>((resolve) => {
    chrisSocket.once("roomError", resolve);
    chrisSocket.emit("advanceRoomFlow", { roomCode, seatToken: chrisSeat });
  });
  check(
    "A18b: Der Host kann season_transition nicht weiterschalten, solange der Mitspieler nicht bereit ist (Ready-Gate haelt, Meldung benennt es)",
    vorschubOhneReady?.message === ROOM_FLOW_READY_GATE_BLOCKED_MESSAGE && chris.state.roomFlowState.step === "season_transition",
    `Meldung="${vorschubOhneReady?.message}", step=${chris.state.roomFlowState.step}`,
  );

  // Beide readyen ueber das Knopf-Modell (wie schrittAbschliessenUndWeiter, aber ohne den
  // Vorschub-Klick selbst — den brauchen A19/A20 getrennt, um die Ablehnungs-Meldung zu pruefen).
  sendeKnopfAktion(franky.socket, { action: "set_ready", roomCode, seatToken: frankySeat, toggleReadyTo: true });
  await waitFor(
    () => (chris.state.roomParticipants as AnyState[]).find((p) => p.participantId === frankyP.participantId)?.readyState === "ready",
    "Franky ready (season_transition)",
  );
  const chrisTransitionKnopf = knopf(chris, chrisP.participantId);
  if (chrisTransitionKnopf.action === "set_ready" && chrisTransitionKnopf.canClick) {
    sendeKnopfAktion(chrisSocket, { action: "set_ready", roomCode, seatToken: chrisSeat, toggleReadyTo: true });
  } else if (!chrisTransitionKnopf.canClick) {
    hostUmwege += 1;
    chrisSocket.emit("setReadyState", { roomCode, seatToken: chrisSeat, ready: true });
  }
  await waitFor(() => chris.state.roomFlowState.canHostAdvance === true, "Host darf weiter (season_transition, Ready-Gate erfuellt)");

  /**
   * A19 — DER RIEGEL ERKLAERT SICH (Paket A): beide bereit, aber die neue Saison hat im Spielstand
   * noch nicht begonnen (`seasonHasAdvanced` liest `!isSeasonEndPhase(gameState.gamePhase)`,
   * room-store.ts:1386) — der Vorschub wird trotzdem abgelehnt (room-store.ts:1404-1412), mit
   * einem Grund, der das COCKPIT benennt, statt beiden Coaches wortlos die Bereitmeldung
   * wegzuraeumen (genau das waere sonst der Nebeneffekt: der Rumpf darunter setzt jeden
   * Teilnehmer auf not_ready zurueck). Geprueft wird die MELDUNG, nicht nur der Schritt — ein
   * Test, der nur `step === "season_transition"` misst, wuerde denselben Text durch ein
   * kommentarloses "geht nicht" ersetzen lassen, ohne rot zu werden.
   */
  const vorschubVorSaisonwechsel = await new Promise<AnyState>((resolve) => {
    chrisSocket.once("roomError", resolve);
    chrisSocket.emit("advanceRoomFlow", { roomCode, seatToken: chrisSeat });
  });
  check(
    "A19: Beide bereit, aber die neue Saison hat noch nicht begonnen — der Vorschub wird abgelehnt, mit einem Grund, der das Cockpit benennt",
    vorschubVorSaisonwechsel?.message === ROOM_FLOW_SEASON_TRANSITION_RIEGEL_MESSAGE && chris.state.roomFlowState.step === "season_transition",
    `Meldung="${vorschubVorSaisonwechsel?.message}", step=${chris.state.roomFlowState.step}`,
  );

  /**
   * A20 — DER DURCHSTICH: Saisonende-Kette (SEASON_TRANSITION_STEPS, neun Stationen) plus
   * Pre-Season-Workflow, als HOST ueber Sitz-Token. Die Reihenfolge wird NICHT nachgebaut: jeder
   * Hop ruft `advance_step` und LIEST aus der Antwort, welche Phase als naechstes dran ist
   * (computeSeasonTransitionAdvance bestimmt sie aus der Phase im Save, season-transition-service.ts:
   * 378-442) — reagiert wird nur auf den einen Blocker, den die Kette selbst meldet und benennt:
   * `season_rewards` haelt an, bis die Saisonende-Abrechnung gebucht ist
   * (SEASON_REWARDS_PENDING_REASON, season-transition-service.ts:121-125), gebucht wird ueber die
   * EIGENE, bestaetigte Route (`/api/season/cash-prize-apply`) — nicht Teil der neun Stationen,
   * aber der einzige App-Weg, den Riegel zu oeffnen (season-transition-service.ts:407-418 laesst
   * den Riegel ausdruecklich AUCH im Server greifen, nicht nur im UI-Knopf).
   */
  const stationenDurchlaufen: string[] = [];
  let ketteFehler = "";
  for (let hop = 0; hop < SEASON_TRANSITION_STEPS.length + 2 && !ketteFehler; hop += 1) {
    const zwischenstand = await leseSave(coopSaveId);
    if (zwischenstand?.gamePhase === "next_season_ready") break;
    await sichereChrisVerbindung();
    const advance = await postJson(api("/api/season/transition"), {
      saveId: coopSaveId,
      dryRun: false,
      action: "advance_step",
      roomCode,
      participantId: chrisP.participantId,
      seatToken: chrisSeat,
      userId: chrisP.userId,
    });
    if (advance.status === 200 && advance.body.success === true) {
      stationenDurchlaufen.push(advance.body.summary?.gamePhase ?? "?");
      continue;
    }
    const blocker = (advance.body.blockingReasons ?? advance.body.summary?.blockingReasons ?? [])[0];
    if (blocker === SEASON_REWARDS_PENDING_REASON) {
      const cashApply = await postJson(api("/api/season/cash-prize-apply"), {
        saveId: coopSaveId,
        seasonId: coopSeasonId,
        phase: "season_end",
        execute: true,
        confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN,
        roomCode,
        participantId: chrisP.participantId,
        seatToken: chrisSeat,
        userId: chrisP.userId,
      });
      if (!(cashApply.status === 200 && cashApply.body.success === true)) {
        ketteFehler = `cash-prize-apply blockiert: status=${cashApply.status} error=${JSON.stringify(cashApply.body.error ?? cashApply.body.summary?.blockingReasons ?? "-")}`;
        break;
      }
      stationenDurchlaufen.push("cash_prize_apply");
      continue;
    }
    ketteFehler = `advance_step blockiert bei gamePhase=${zwischenstand?.gamePhase}: status=${advance.status} blocker=${JSON.stringify(advance.body.blockingReasons ?? advance.body.error ?? "-")}`;
    break;
  }

  let preseasonFehler = ketteFehler;
  if (!preseasonFehler) {
    const preseasonPreview = await postJson(api("/api/season/preseason-workflow"), {
      saveId: coopSaveId,
      dryRun: true,
      roomCode,
      participantId: chrisP.participantId,
      seatToken: chrisSeat,
      userId: chrisP.userId,
    });
    const setupSchritt = (preseasonPreview.body.summary?.steps as AnyState[] | undefined)?.find(
      (entry) => entry.stepId === "next_season_setup",
    );
    if (!setupSchritt?.confirmToken) {
      preseasonFehler = `preseason-workflow Preview ohne confirmToken fuer next_season_setup: ${JSON.stringify(preseasonPreview.body).slice(0, 300)}`;
    } else {
      const preseasonApply = await postJson(api("/api/season/preseason-workflow"), {
        saveId: coopSaveId,
        dryRun: false,
        stepId: "next_season_setup",
        confirmToken: setupSchritt.confirmToken,
        roomCode,
        participantId: chrisP.participantId,
        seatToken: chrisSeat,
        userId: chrisP.userId,
      });
      if (!(preseasonApply.status === 200 && preseasonApply.body.success === true)) {
        preseasonFehler = `preseason-workflow next_season_setup: status=${preseasonApply.status} error=${JSON.stringify(preseasonApply.body.error ?? preseasonApply.body.summary?.blockingReasons ?? "-")}`;
      }
    }
  }
  check(
    "A20: Der Durchstich — Host faehrt die Saisonende-Kette (neun Stationen) plus Pre-Season-Workflow, ohne die Reihenfolge nachzubauen (der Server bestimmt je Hop die naechste Station aus der Phase im Save)",
    preseasonFehler === "",
    preseasonFehler || `${stationenDurchlaufen.join(" → ")} → next_season_setup`,
  );

  /**
   * Nach dem Durchstich hat die neue Saison im SPIELSTAND begonnen — jetzt darf derselbe Vorschub,
   * den A19 noch ablehnen musste, tatsaechlich durch (`seasonHasAdvanced` liest denselben
   * Spielstand neu, room-store.ts).
   *
   * ZUERST ABER EINE BEREIT-RUNDE, und die ist keine Bequemlichkeit: der Durchstich besteht aus
   * neun `advance_step`-Aufrufen plus `next_season_setup`, allesamt Raum-Schreibvorgaenge DES
   * HOSTS. Und jeder Raum-Schreibvorgang setzt seinen Urheber auf `not_ready` und feuert
   * `ready_invalidated` (`applyRoomGameplayWrite`, lib/room/room-store.ts:750-763) — eine
   * bewusste Regel, die es lange vor diesem Paket gab: wer etwas aendert, bestaetigt neu.
   *
   * Der erste Anlauf dieses Checks nahm an, der Ready-Stand ueberlebe den Durchstich, und war
   * deshalb rot: der Knopf bot `set_ready` statt `advance_flow`. Gemessen war das KEIN
   * Steckenbleiben — `canClick` stand auf `true`, der Host wurde zum Neu-Bestaetigen aufgefordert.
   * Die Pruefung hoerte schlicht eine Station zu frueh auf. Die geprueffte Eigenschaft (kommt der
   * Raum in die neue Saison?) bleibt unveraendert; nur der Weg dorthin ist jetzt der, den beide
   * Coaches im Spiel auch gehen.
   */
  await sichereChrisVerbindung();
  await sichereFrankyVerbindung();
  let saisonstartVorschubFehler = "";
  if (preseasonFehler === "") {
    sendeKnopfAktion(franky.socket, { action: "set_ready", roomCode, seatToken: frankySeat, toggleReadyTo: true });
    sendeKnopfAktion(chrisSocket, { action: "set_ready", roomCode, seatToken: chrisSeat, toggleReadyTo: true });
    await waitFor(
      () => chris.state.roomFlowState.canHostAdvance === true,
      "Beide erneut bereit nach dem Durchstich (jeder Schreibvorgang verwirft die Bereitmeldung seines Urhebers)",
    ).catch((error) => {
      saisonstartVorschubFehler = String(error);
    });
  }
  if (preseasonFehler === "" && saisonstartVorschubFehler === "") {
    const nachDurchstichKnopf = knopf(chris, chrisP.participantId);
    if (nachDurchstichKnopf.action !== "advance_flow" || !nachDurchstichKnopf.canClick) {
      saisonstartVorschubFehler = `Host-Knopf bietet kein advance_flow nach dem Durchstich: action=${nachDurchstichKnopf.action} canClick=${nachDurchstichKnopf.canClick}`;
    } else {
      sendeKnopfAktion(chrisSocket, { action: "advance_flow", roomCode, seatToken: chrisSeat, toggleReadyTo: true });
      await waitFor(() => chris.state.roomFlowState.step !== "season_transition", "Flow verlaesst season_transition nach dem Durchstich").catch(
        (error) => {
          saisonstartVorschubFehler = String(error);
        },
      );
    }
  }
  check(
    "A20b: Nach dem Durchstich schaltet der Raum-Flow von season_transition auf den Saisonstart-Schritt weiter — kein Stehenbleiben mehr",
    preseasonFehler === "" && saisonstartVorschubFehler === "" && chris.state.roomFlowState.step === ROOM_FLOW_SEASON_TRANSITION_TARGET,
    saisonstartVorschubFehler ||
      `season_transition→${chris.state.roomFlowState.step} (erwartetes Ziel: ${ROOM_FLOW_SEASON_TRANSITION_TARGET}, E4/gemessen an startRoom)`,
  );

  // A21: der Raum meldet danach die NEUE Saison und Spieltag 1 — activeSeasonId/activeMatchday
  // werden beim Rueckweg aus season_transition aus dem Spielstand nachgezogen (room-store.ts:1417-1426).
  const nachDurchstichStand = await leseSave(coopSaveId);
  check(
    "A21: Der Raum meldet nach dem Wechsel die NEUE Saison und Spieltag 1 — nicht die alte",
    chris.state.multiplayerRoom.activeSeasonId === nachDurchstichStand?.season?.id &&
      chris.state.multiplayerRoom.activeSeasonId !== coopSeasonId &&
      chris.state.multiplayerRoom.activeMatchday === 1 &&
      nachDurchstichStand?.season?.currentMatchday === 1 &&
      nachDurchstichStand?.gamePhase === "season_active",
    `activeSeasonId ${coopSeasonId}→${chris.state.multiplayerRoom.activeSeasonId} (Save-Saison: ${nachDurchstichStand?.season?.id}), ` +
      `activeMatchday=${chris.state.multiplayerRoom.activeMatchday}, save.currentMatchday=${nachDurchstichStand?.season?.currentMatchday}, ` +
      `gamePhase=${nachDurchstichStand?.gamePhase}`,
  );

  /**
   * A22 — DER ERSTE SPIELTAG DER NEUEN SAISON WIRD WIRKLICH GEWERTET.
   *
   * CHRIS: „ja mach den ersten spieltag noch mit rein dass man sieht dass keine blocker
   * netstanden sind."
   *
   * Bis hierher endete das Audit bei der ANKUNFT in Saison 2 (A21: der Raum meldet die neue Saison
   * und Spieltag 1). Ankommen ist aber nicht weiterspielen: ein Blocker, der erst beim Aufloesen
   * zuschlaegt — fehlende Aufstellung, leerer Kader, eine Sperre, die den Saisonwechsel nicht
   * losgelassen hat — waere genau hier stehengeblieben und im Audit trotzdem gruen gewesen.
   *
   * Deshalb geht dieser Abschnitt denselben Weg wie die ganze Saison davor, nur einmal: Flow bis
   * zur Einsatzliste, beide Spieler geben ab, der Host loest auf. Und er misst nicht „kein
   * Fehler", sondern das Ergebnis — der Spielstand muss danach auf Spieltag 2 stehen und Punkte
   * tragen. Ein Aufloesungslauf, der 200 meldet und nichts bewegt, waere sonst ununterscheidbar
   * von einem echten.
   */
  {
    const s2SeasonId: string = nachDurchstichStand?.season?.id ?? "";
    const s2Spieltag1: string = nachDurchstichStand?.season?.matchdayIds?.[0] ?? "";
    const punkteSumme = (stand: AnyState | null) =>
      Object.values((stand?.seasonState?.standings ?? {}) as Record<string, AnyState>).reduce(
        (summe, eintrag) => summe + (Number(eintrag?.points) || 0),
        0,
      );
    const punkteVorher = punkteSumme(nachDurchstichStand);

    if (!s2SeasonId || !s2Spieltag1) {
      check("A22: Der erste Spieltag der neuen Saison wird gewertet", false, "neue Saison oder ihr Spieltag 1 nicht lesbar");
    } else {
      // Flow bis zur Einsatzliste — dieselbe Kette wie in Saison 1, hier einmal durchlaufen. Sie
      // ist Teil der Messung: bliebe der Flow im Saisonstart haengen, kaeme man gar nicht zum
      // Aufloesen.
      let s2Step: string = chris.state.roomFlowState.step;
      let s2Sicherung = 0;
      let s2FlowFehler = "";
      while (s2Step !== "lineup" && s2Sicherung < 8) {
        s2Step = await schrittAbschliessenUndWeiter();
        s2Sicherung += 1;
      }
      if (s2Step !== "lineup") {
        s2FlowFehler = `Flow erreicht in Saison 2 die Einsatzliste nicht (haengt bei ${s2Step} nach ${s2Sicherung} Schritten)`;
      }
      check(
        "A22a: In der neuen Saison fuehrt der Flow wieder bis zur Einsatzliste",
        s2FlowFehler === "",
        s2FlowFehler || `${ROOM_FLOW_SEASON_TRANSITION_TARGET}→…→lineup in ${s2Sicherung} Schritt(en)`,
      );

      await beideSpielerSetzenAufstellungen(s2Spieltag1, s2SeasonId);

      const s2AufloesenEinmal = async () => {
        await sichereChrisVerbindung();
        return postJson(api("/api/season/matchday-auto-run"), {
          saveId: coopSaveId,
          seasonId: s2SeasonId,
          matchdayId: s2Spieltag1,
          execute: true,
          confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
          roomCode,
          participantId: chrisP.participantId,
          seatToken: chrisSeat,
          userId: chrisP.userId,
          options: { stopOnTie: false },
        });
      };
      let s2Aufloesung = await s2AufloesenEinmal();
      if (s2Aufloesung.status === 403 && JSON.stringify(s2Aufloesung.body).includes("participant_offline")) {
        await rejoinChris();
        s2Aufloesung = await s2AufloesenEinmal();
      }
      const s2Stand = await leseSave(coopSaveId);
      const punkteNachher = punkteSumme(s2Stand);
      check(
        "A22: Der erste Spieltag der NEUEN Saison laesst sich aufloesen — die Saison geht wirklich weiter",
        s2Aufloesung.status === 200 &&
          s2Aufloesung.body.success === true &&
          s2Stand?.season?.id === s2SeasonId &&
          s2Stand?.season?.currentMatchday === 2 &&
          punkteNachher > punkteVorher,
        `status=${s2Aufloesung.status} success=${s2Aufloesung.body.success} ` +
          `error=${JSON.stringify(s2Aufloesung.body.error ?? s2Aufloesung.body.blockingReasons ?? "-")} · ` +
          `Saison ${s2Stand?.season?.id}, currentMatchday ${nachDurchstichStand?.season?.currentMatchday}→${s2Stand?.season?.currentMatchday}, ` +
          `Punktsumme ${punkteVorher}→${punkteNachher}`,
      );
    }
  }

  check(
    "B7: Die GESAMTE Saison lief ueber describeRoomFlowButton().action + die geteilte Event-Zuordnung — ohne Host-Ready-Umwege",
    hostUmwege === 0,
    `Host brauchte ${hostUmwege}x den separaten 'Bereit melden'-Knopf der Room-Seite (setReadyState) statt des ` +
      "eigenen set_ready-Knopfmodells — erwartet ist 0, seit mussBereitMelden (room-flow-controller.ts:307-330) " +
      "dem Host in jedem Schritt ein klickbares 'set_ready' anbietet, sobald er selbst noch nicht bereit ist",
  );

  // -------------------------------------------------------------------------------------------
  // C) Tick-Recheck: Save wird NACH legalem Start raumgebunden → der Lauf wird gestoppt
  // -------------------------------------------------------------------------------------------
  section("C) Tick-Recheck: nachtraegliche Raumbindung stoppt einen laufenden apply-Lauf");

  // Scratch-Klon des Solo-Saves; der Original-Save wird sofort wieder aktiviert, damit das Audit
  // den aktiven Save des Servers nicht verstellt. (Der Scratch-Save bleibt danach zurueck — er
  // laesst sich nicht loeschen, solange sein Raum im Server-Prozess lebt, siehe Beobachtung.)
  const scratch = await postJson(api("/api/singleplayer-state"), {
    action: "snapshot",
    sourceSaveId: soloSaveId,
    name: "Audit Koop Scratch",
  });
  const scratchSaveId: string | undefined = scratch.body.save?.saveId;
  await postJson(api("/api/singleplayer-state"), { action: "activate", saveId: soloSaveId });
  if (!scratchSaveId) {
    check("C13: Scratch-Save fuer den Tick-Recheck liess sich anlegen", false, JSON.stringify(scratch.body).slice(0, 200));
  } else {
    const lauf = await simStart(scratchSaveId, "apply");
    const laufId: string | undefined = lauf.body.run?.runId;
    const ersterTick = laufId ? await simTick(laufId) : { status: -1, body: {} as AnyState };
    check(
      "C13: apply-Lauf startet und tickt auf dem (noch) raumfreien Scratch-Save",
      lauf.status === 200 && ersterTick.status === 200 && ersterTick.body.ok === true,
      `start=${lauf.status}, tick=${ersterTick.status}, runId=${laufId ?? "-"}`,
    );

    // Jetzt wandert der Save NACHTRAEGLICH in einen Raum: createRoom(saveId=scratch) + startRoom
    // nimmt den EXISTIERENDEN Save weiter ("continue existing", lib/room/room-store.ts:620-632).
    const emilSocket = await connect(opts.baseUrl);
    const emil = trackSocket(emilSocket);
    const raum2 = await emitJoined(emilSocket, "createRoom", {
      displayName: "Chris",
      saveId: scratchSaveId,
      preset: "chris_4_franky_4_rest_ai",
    });
    const paulaSocket = await connect(opts.baseUrl);
    const paulaJoin = await emitJoined(paulaSocket, "joinRoom", { roomCode: raum2.roomCode, displayName: "Franky" });
    await waitFor(() => (emil.state?.roomParticipants?.length ?? 0) === 2, "Raum 2 hat 2 Teilnehmer");

    // Schon die LOBBY zaehlt als aktiver Raum: zwischen Raum-Anlage und Spielstart darf kein
    // Werkzeug mehr in den referenzierten Save schreiben (startRoom wuerde ihn fortsetzen).
    const tickInLobby = await simTick(laufId ?? "");
    check(
      "C2: Schon die Lobby-Referenz sperrt den Save — der naechste Tick wird VOR dem Spielstart abgelehnt",
      istRoomBound409(tickInLobby, "admin_season_simulation"),
      `status=${tickInLobby.status} error=${tickInLobby.body.error ?? "-"}`,
    );

    emilSocket.emit("setReadyState", { roomCode: raum2.roomCode, seatToken: raum2.seatToken, ready: true });
    paulaSocket.emit("setReadyState", { roomCode: raum2.roomCode, seatToken: paulaJoin.seatToken, ready: true });
    await waitFor(
      () => (emil.state.roomParticipants as AnyState[]).every((p) => p.readyState === "ready"),
      "Raum 2: beide ready",
    );
    emilSocket.emit("startRoom", { roomCode: raum2.roomCode, seatToken: raum2.seatToken });
    await waitFor(() => emil.state.multiplayerRoom.status === "season_active", "Raum 2 gestartet");
    check(
      "C14: startRoom uebernimmt den existierenden Scratch-Save (continue existing) statt einen neuen zu praegen",
      emil.state.multiplayerRoom.saveId === scratchSaveId,
      `gebunden=${emil.state.multiplayerRoom.saveId}`,
    );

    const zweiterTick = laufId ? await simTick(laufId) : { status: -1, body: {} as AnyState };
    check(
      "C15: Der legal gestartete apply-Lauf wird beim naechsten Tick gestoppt, sobald sein Save raumgebunden ist",
      istRoomBound409(zweiterTick, "admin_season_simulation"),
      `status=${zweiterTick.status} error=${zweiterTick.body.error ?? "-"}`,
    );
    if (laufId) await simCancel(laufId);
    emilSocket.close();
    paulaSocket.close();
  }

  // -------------------------------------------------------------------------------------------
  // D) Beide Spieler getrennt: die Sperre haelt weiter (und "paused" tritt real nie ein)
  // -------------------------------------------------------------------------------------------
  section("D) Sperre bei getrenntem Raum 1 (beide offline)");
  chrisSocket.disconnect();
  franky.socket.disconnect();
  await delay(500);
  const simBeideOffline = await simStart(coopSaveId, "apply");
  check(
    "D4: Auch mit BEIDEN Spielern offline bleibt der Koop-Save gesperrt (Raum gilt weiter als aktiv)",
    istRoomBound409(simBeideOffline, "admin_season_simulation"),
    `status=${simBeideOffline.status} error=${simBeideOffline.body.error ?? "-"}`,
  );

  /**
   * "UNVERAENDERT" heisst: derselbe Schritt wie VOR der Trennung — GEMESSEN, nicht hineingeschrieben.
   *
   * Hier stand fest `=== "season_review"`, und das war der VIERTE Check in diesem Vorhaben, der den
   * alten Endzustand als den richtigen festhielt (nach A14 und zwei Vitest-Faellen): seit der Raum
   * den Saisonwechsel kennt, endet der Lauf dort nicht mehr. Ihn auf den neuen Zielwert
   * umzuschreiben waere nur die halbe Lehre gewesen — dieser Check misst "der Rejoin aendert
   * nichts", und dafuer ist JEDER feste Schrittname die falsche Groesse. Er schlaegt sonst beim
   * naechsten Ausbau des Flows wieder an, ohne dass an der geprueften Eigenschaft etwas fehlt.
   */
  const stepVorTrennung = chris.state.roomFlowState.step;
  const chrisSocketNeu = await connect(opts.baseUrl);
  const chrisNeu = trackSocket(chrisSocketNeu);
  await emitJoined(chrisSocketNeu, "rejoinRoom", { roomCode, seatToken: chrisSeat });
  await waitFor(() => Boolean(chrisNeu.state), "Chris hat nach Rejoin roomState");
  check(
    "D5: Rejoin nach Doppel-Trennung fuehrt in denselben Raum mit unveraendertem Endstand zurueck",
    chrisNeu.state.multiplayerRoom.saveId === coopSaveId && chrisNeu.state.roomFlowState.step === stepVorTrennung,
    `saveId=${chrisNeu.state.multiplayerRoom.saveId === coopSaveId}, step=${chrisNeu.state.roomFlowState.step} (vor der Trennung: ${stepVorTrennung}), status=${chrisNeu.state.multiplayerRoom.status}`,
  );
  beobachtung(
    `Der Raum-Status blieb waehrend der Doppel-Trennung "${chrisNeu.state.multiplayerRoom.status}" — der Zustand ` +
      "'paused' (den getActiveRoomBySaveId von der Sperre ausnehmen wuerde, lib/room/room-store.ts:290-301) ist im " +
      "aktuellen Code faktisch unerreichbar: Sitze werden bei Disconnect nie entfernt (markDisconnected setzt nur " +
      "connected=false), getSeatCount zaehlt Sitz-Objekte, und niemand setzt je 'completed'. Konservativ fuer die " +
      "Admin-Sperre (sie haelt), aber: einmal raumgebundene Saves bleiben bis zum Server-Neustart gesperrt, auch " +
      "wenn der Raum laengst verlassen ist — inkl. Scratch-/Koop-Saves dieses Audits.",
  );
  chrisSocketNeu.close();

  if (server) {
    try {
      server.kill();
    } catch {
      /* noop */
    }
  }

  if (server) {
    try {
      server.kill();
    } catch {
      /* noop */
    }
  }

  if (reconnects.chris + reconnects.franky > 0) {
    beobachtung(
      `Waehrend CPU-lastiger Server-Phasen (Liga-Draft/Kaeufe/Aufloesung) verhungerten Socket-Heartbeats: das Audit ` +
        `musste ${reconnects.chris}x (Chris) bzw. ${reconnects.franky}x (Franky) per rejoinRoom heilen, nachdem der ` +
        "Server Teilnehmer als offline markiert hatte (403 participant_offline auf Writes). Echte Clients trifft " +
        "dasselbe: synchron rechnende Routen blockieren die Event-Loop des Custom-Servers (server.ts), der auch " +
        "Socket.io bedient.",
    );
  }
  const failed = results.filter((r) => !r.ok);
  writeReport({ baseUrl: opts.baseUrl, startedAt, extra: { hostUmwege, aufgeloesteSpieltage, spieltageGesamt, reconnects } });
  console.log(`\n${results.length - failed.length}/${results.length} Checks gruen.`);
  if (failed.length > 0) {
    console.log("Fehlgeschlagen:", failed.map((f) => f.name).join(" | "));
    process.exit(1);
  }
  console.log("Koop-Spielbarkeits-Audit: alles gruen ✅");
  process.exit(0);
}

main().catch((error) => {
  console.error("Koop-Spielbarkeits-Audit abgebrochen:", error);
  writeReport({ baseUrl: parseArgs(process.argv.slice(2)).baseUrl, startedAt: new Date().toISOString(), extra: { abgebrochen: String(error) } });
  process.exit(1);
});
