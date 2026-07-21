/**
 * Co-op-Sync-Smoke: prueft die zwei Kern-Garantien des gemeinsamen Online-Spiels
 * auf Socket-/Server-Ebene (robust, ohne bruechige UI-Selektoren):
 *
 *  A) ÄNDERUNGEN SYNCEN: Eine team-scoped Aenderung von Chris (hier: Team-Identitaet,
 *     derselbe serverautoritative Broadcast-Pfad wie Spielerkaeufe/Aufstellung/Training)
 *     erreicht Frankys Client (roomGameplayEvent + roomState). Und: Franky darf ein
 *     Chris-Team NICHT schreiben (Besitz-Isolation).
 *
 *  B) ARENA LAEUFT PARALLEL: Der Reveal ist host-gesteuert und laueft bei beiden im
 *     Gleichschritt. Beide Clients sehen zu jedem Zeitpunkt denselben arenaSyncState
 *     (identische version). Das "beide bereit"-Gate haelt (Reveal startet erst, wenn
 *     beide bereit sind), und ein Gast kann den Reveal nicht weiterschalten.
 *
 * Aufruf:
 *   npm run app:smoke-coop-sync -- --no-start        (gegen laufenden Server)
 *   npm run app:smoke-coop-sync                       (startet dev-Server selbst)
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import { io, type Socket } from "socket.io-client";

const DEFAULT_BASE_URL = "http://localhost:3000";
const CHRIS_TEAMS = ["P-S", "D-P", "M-M", "V-W"];
const FRANKY_TEAMS = ["M-S", "P-C", "C-S", "G-G"];

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

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK " : "ERR"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function isServerReachable(baseUrl: string) {
  try {
    const r = await fetch(`${baseUrl}/foundation`, { cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

async function ensureServer(baseUrl: string, noStart: boolean): Promise<ChildProcessWithoutNullStreams | null> {
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
  const socket = io(baseUrl, { path: "/socket.io", transports: ["websocket"], forceNew: true });
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

/** Haelt den zuletzt empfangenen roomState + zaehlt roomGameplayEvents pro Socket. */
function trackSocket(socket: Socket) {
  const box: { state: AnyState | null; gameplayEvents: AnyState[] } = { state: null, gameplayEvents: [] };
  socket.on("roomState", (state: AnyState) => {
    box.state = state;
  });
  socket.on("roomGameplayEvent", (evt: AnyState) => {
    box.gameplayEvents.push(evt);
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

async function waitFor(getVal: () => boolean, label: string, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (getVal()) return true;
    await delay(100);
  }
  throw new Error(`Timeout warten auf: ${label}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const server = await ensureServer(opts.baseUrl, opts.noStart);

  const active = await (await fetch(`${opts.baseUrl}/api/singleplayer-state`, { cache: "no-store" })).json();
  const saveId = active.save?.saveId ?? active.saveId;
  if (!saveId) throw new Error("Kein aktiver Save gefunden (ensure-gameplay-smoke-save vorher laufen lassen).");

  const chrisSocket = await connect(opts.baseUrl);
  const frankySocket = await connect(opts.baseUrl);
  const chris = trackSocket(chrisSocket);
  const franky = trackSocket(frankySocket);

  // --- Setup: Raum anlegen (Chris = Host) + Franky beitreten ---
  const created = await emitJoined(chrisSocket, "createRoom", { displayName: "Chris", saveId, preset: "chris_4_franky_4_rest_ai" });
  const roomCode: string = created.roomCode;
  const joined = await emitJoined(frankySocket, "joinRoom", { roomCode, displayName: "Franky" });
  const chrisSeat: string = created.seatToken;
  const frankySeat: string = joined.seatToken;

  await waitFor(() => Boolean(chris.state) && Boolean(franky.state), "beide Sockets haben roomState");
  const chrisP = (franky.state.roomParticipants as AnyState[]).find((p) => p.displayName === "Chris");
  const frankyP = (franky.state.roomParticipants as AnyState[]).find((p) => p.displayName === "Franky");
  check(
    "Setup: Raum + 2 Teilnehmer, Teams verteilt",
    Boolean(chrisP && frankyP) &&
      JSON.stringify([...chrisP.controlledTeamIds].sort()) === JSON.stringify([...CHRIS_TEAMS].sort()) &&
      JSON.stringify([...frankyP.controlledTeamIds].sort()) === JSON.stringify([...FRANKY_TEAMS].sort()),
    `Raum ${roomCode}, Chris=${chrisP?.controlledTeamIds?.join(",")}, Franky=${frankyP?.controlledTeamIds?.join(",")}`,
  );

  // ============================================================
  // A) ÄNDERUNGEN SYNCEN
  // ============================================================
  const marker = 42; // markanter Wert
  const beforeCount = franky.gameplayEvents.length;
  // WICHTIG: der Raum legt seinen EIGENEN Co-op-Spielstand an — nicht den aktiven Solo-Save.
  const roomSaveId: string = franky.state.multiplayerRoom.saveId;
  const writeRes = await fetch(`${opts.baseUrl}/api/team-settings/identity`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      saveId: roomSaveId,
      teamId: "P-S", // Chris-Team
      identity: { ambition: marker },
      roomCode,
      participantId: chrisP.participantId,
      seatToken: chrisSeat,
      userId: chrisP.userId,
      activeManagerTeamId: "P-S",
      activeOwnerId: chrisP.userId,
    }),
  });
  const writeBody = await writeRes.json().catch(() => ({}));
  check("A1: Chris darf sein Team aendern (Server erlaubt Schreibzugriff)", writeRes.ok && writeBody.success === true, `status=${writeRes.status} err=${writeBody.error ?? "-"} roomSave=${roomSaveId}`);

  // Franky-Client muss den Broadcast bekommen (roomGameplayEvent)
  await waitFor(() => franky.gameplayEvents.length > beforeCount, "Franky empfaengt Gameplay-Broadcast").catch(() => {});
  check("A2: Frankys Client sieht Chris' Aenderung (Broadcast angekommen)", franky.gameplayEvents.length > beforeCount, `+${franky.gameplayEvents.length - beforeCount} Event(s)`);

  // Franky darf ein Chris-Team NICHT schreiben (Besitz-Isolation)
  const forbidden = await new Promise<AnyState>((resolve) => {
    frankySocket.emit(
      "authorizeRoomWrite",
      { roomCode, saveId, participantId: frankyP.participantId, userId: frankyP.userId, teamId: "P-S", writeAction: "team_identity_update", dryRun: true },
      (resp: AnyState) => resolve(resp),
    );
  });
  check("A3: Franky darf Chris' Team NICHT aendern (Besitz-Isolation)", forbidden?.authorization?.allowed === false, `code=${forbidden?.authorization?.code ?? "?"}`);

  // ============================================================
  // B) ARENA LAEUFT PARALLEL (host-gesteuert, Gleichschritt, Ready-Gate)
  // ============================================================
  const arenaVersion = (box: { state: AnyState }) => box.state?.arenaSyncState?.version ?? -1;
  const arenaStatus = (box: { state: AnyState }) => box.state?.arenaSyncState?.status ?? null;
  const bothArenaEqual = () => arenaVersion(chris) === arenaVersion(franky) && arenaVersion(chris) >= 0;

  // Host startet die Arena
  chrisSocket.emit("startRoomArena", { roomCode, seatToken: chrisSeat, maxSlotRevealCountByDiscipline: { d1: 2, d2: 2 } });
  await waitFor(() => arenaStatus(chris) === "ready_check" && arenaStatus(franky) === "ready_check", "Arena gestartet (beide ready_check)");
  check("B1: Host startet Arena → beide Clients im selben Zustand (ready_check)", bothArenaEqual() && arenaStatus(chris) === "ready_check", `v=${arenaVersion(chris)}/${arenaVersion(franky)}`);

  const requiredIds: string[] = chris.state.arenaSyncState.requiredParticipantIds;
  check("B2: Beide Menschen sind fuer die Arena erforderlich (Ready-Gate gilt fuer 2)", requiredIds.length === 2, `required=${requiredIds.length}`);

  // Nur Chris bereit → Reveal darf NOCH NICHT laufen
  chrisSocket.emit("setRoomArenaReady", { roomCode, seatToken: chrisSeat, ready: true });
  await waitFor(() => (chris.state.arenaSyncState.readyParticipantIds ?? []).includes(chrisP.participantId), "Chris bereit gesetzt");
  await delay(300);
  check(
    "B3: Nur Chris bereit → Reveal startet NICHT (Gate haelt)",
    arenaStatus(chris) === "ready_check" && arenaStatus(franky) === "ready_check" && bothArenaEqual(),
    `status=${arenaStatus(chris)}`,
  );

  // Jetzt auch Franky bereit → Reveal darf laufen
  frankySocket.emit("setRoomArenaReady", { roomCode, seatToken: frankySeat, ready: true });
  await waitFor(() => arenaStatus(chris) === "revealing" && arenaStatus(franky) === "revealing", "beide bereit → revealing");
  check("B4: Beide bereit → Reveal freigegeben, beide synchron (revealing)", arenaStatus(chris) === "revealing" && bothArenaEqual(), `v=${arenaVersion(chris)}/${arenaVersion(franky)}`);

  // Host schaltet einen Reveal-Schritt weiter → beide im Gleichschritt
  const vBefore = arenaVersion(chris);
  const phaseBefore = chris.state.arenaSyncState.phaseIndex;
  chrisSocket.emit("advanceRoomArenaStep", { roomCode, seatToken: chrisSeat, maxSlotRevealCountByDiscipline: { d1: 2, d2: 2 } });
  await waitFor(() => arenaVersion(chris) > vBefore && arenaVersion(franky) > vBefore, "Host schaltet Reveal-Schritt weiter");
  check(
    "B5: Host schaltet weiter → beide Clients rücken im Gleichschritt vor (gleiche version)",
    bothArenaEqual() && arenaVersion(chris) > vBefore && chris.state.arenaSyncState.phaseIndex >= phaseBefore,
    `v ${vBefore}→${arenaVersion(chris)}, phase ${phaseBefore}→${chris.state.arenaSyncState.phaseIndex}`,
  );

  // Gast (Franky) darf den Reveal NICHT weiterschalten
  const vGuard = arenaVersion(chris);
  frankySocket.emit("advanceRoomArenaStep", { roomCode, seatToken: frankySeat, maxSlotRevealCountByDiscipline: { d1: 2, d2: 2 } });
  await delay(400);
  check("B6: Gast (Franky) kann den Reveal NICHT weiterschalten (host-autoritativ)", arenaVersion(chris) === vGuard && bothArenaEqual(), `v blieb ${arenaVersion(chris)}`);

  chrisSocket.close();
  frankySocket.close();
  if (server) {
    try {
      server.kill();
    } catch {
      /* noop */
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} Checks grün.`);
  if (failed.length > 0) {
    console.log("Fehlgeschlagen:", failed.map((f) => f.name).join(" | "));
    process.exit(1);
  }
  console.log("Co-op-Sync-Smoke: alles grün ✅");
  process.exit(0);
}

main().catch((error) => {
  console.error("Co-op-Sync-Smoke abgebrochen:", error);
  process.exit(1);
});
