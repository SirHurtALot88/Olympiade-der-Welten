"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  MAX_TEAMS_PER_HUMAN_PARTICIPANT,
  ONLINE_ROOM_TEAM_IDS,
  ROOM_OWNERSHIP_PRESET_IDS,
  isRoomMatchdayInProgress,
  resolveFrankyParticipant,
  resolveRoomParticipantActiveOwnerId,
} from "@/lib/room/online-room-model";
import { describeRoomFlowButton, getRoomFlowStep, isSandboxRoomSave } from "@/lib/room/room-flow-controller";
import { emitRoomFlowButtonAction } from "@/lib/room/room-flow-socket-actions";
import {
  RAUM_EXISTIERT_NICHT_MEHR_MELDUNG,
  RAUM_NICHT_GEFUNDEN_MELDUNG,
  RAUM_VOLL_MELDUNG,
} from "@/lib/room/room-session-fehler";
import { SocketProvider, useSocket } from "@/lib/socket/socket-context";
import type { RoomErrorPayload, RoomJoinedPayload, RoomOwnershipPreset } from "@/types/events";
import type { OlyRoomState } from "@/types/game";

// Stufe 1 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): frueher hier UND in
// `online-room-model.ts:MAX_TEAMS_PER_HUMAN_PARTICIPANT` als zwei getrennte Konstanten gepflegt --
// eine zweite Quelle fuer dieselbe Groesse. Jetzt nur noch der Import oben.
const MAX_TEAMS_PER_HUMAN = MAX_TEAMS_PER_HUMAN_PARTICIPANT;
type TeamAssignmentTarget = "chris" | "franky" | "ai";

// PAKET 2 (docs/MULTIPLAYER_MODI_1V1_2V2_PLAN.md, E3): siehe Kommentar an der gleichnamigen Liste
// in app/HomePageClient.tsx -- dieselbe Quelle (`ROOM_OWNERSHIP_PRESET_IDS`), eigene Beschriftung.
const PRESET_LABELS: Record<RoomOwnershipPreset, string> = {
  chris_1_rest_ai: "1 Team Chris, Rest KI",
  chris_2_rest_ai: "2 Teams Chris, Rest KI",
  chris_4_rest_ai: "4 Teams Chris, Rest KI",
  chris_4_franky_4_rest_ai: "4 Teams Chris + 4 Teams Franky, Rest KI",
  chris_1_franky_1_rest_ai: "1 Team Chris + 1 Team Franky, Rest KI",
  chris_2_franky_2_rest_ai: "2 Teams Chris + 2 Teams Franky, Rest KI",
};

const PRESET_OPTIONS: Array<{ value: RoomOwnershipPreset; label: string }> = ROOM_OWNERSHIP_PRESET_IDS.map((value) => ({
  value,
  label: PRESET_LABELS[value],
}));

function roomStorageKey(roomCode: string) {
  return `oly-seat:${roomCode.toUpperCase()}`;
}

function connectionLabel(connected: boolean) {
  return connected ? "Verbunden" : "Verbinde ...";
}

function readyLabel(readyState: string) {
  if (readyState === "ready") return "Bereit";
  if (readyState === "waiting") return "Wartet";
  return "Nicht bereit";
}

// Stufe 1.1 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): "Der Link ist die Einladung" -- kopiert wurde
// bislang nur der nackte Code, der fuer sich genommen niemanden ins Spiel bringt (die Startseite
// verlangt zusaetzlich einen Anzeigenamen). Diese Seite (`/room/CODE`) nimmt jetzt selbst neue
// Gaeste per Beitritts-Maske auf (siehe `needsJoin` im `RoomScreen` unten) -- der kopierte Link
// fuehrt also direkt zum Ziel.
function CopyInviteLinkButton({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="secondary-button inline-button"
      type="button"
      onClick={async () => {
        try {
          const inviteUrl = `${window.location.origin}/room/${roomCode}`;
          await navigator.clipboard.writeText(inviteUrl);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          /* Clipboard kann in manchen Umgebungen fehlen - kein hartes Fehlverhalten. */
        }
      }}
    >
      {copied ? "Kopiert!" : "Einladungslink kopieren"}
    </button>
  );
}

// Stufe 1.1 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): exakte Texte aus `joinRoom`
// (lib/room/room-store.ts), damit die Beitritts-Maske einen abgelehnten Beitritt als
// ENDGUELTIG erkennt (Raum voll/nicht gefunden) statt als etwas, das ein erneuter Klick loest.
//
// Befund F6 (Aufgabe #44): das waren bis eben drei handkopierte Zeichenketten neben denen in
// `room-store.ts` — zwei Quellen fuer denselben Text. Jetzt kommen sie aus `room-session-fehler.ts`,
// aus dem auch `room-store.ts` sie zurueckgibt.
const ROOM_FULL_MESSAGE = RAUM_VOLL_MELDUNG;
const ROOM_NOT_FOUND_MESSAGE = RAUM_NICHT_GEFUNDEN_MELDUNG;
// F1 (Notausfahrt-Korrektur, docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): exakter Text aus `rejoinRoom`
// (room-store.ts) -- wer NOCH ein gespeichertes Sitzplatz-Token hat, versucht beim Verbinden immer
// zuerst `rejoinRoom`, nicht `joinRoom` (siehe `handleConnect` unten). Vorher fehlte fuer diesen
// Fehlerfall jede Behandlung: die Seite blieb bei "Raum wird geladen ..." haengen, obwohl der Raum
// laengst weg war (verwaist + ersetzt, oder verfallen) -- eine Sackgasse ohne jeden Hinweis, wie
// es weitergeht.
const ROOM_GONE_AFTER_REJOIN_MESSAGE = RAUM_EXISTIERT_NICHT_MEHR_MELDUNG;

function RoomScreen({ roomCode }: { roomCode: string }) {
  const socket = useSocket();
  const [state, setState] = useState<OlyRoomState | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(() => socket.connected);
  // Stufe 1.1: wer `/room/CODE` ohne gespeicherten Sitzplatz oeffnet (der Einladungslink-Fall),
  // bekommt hier eine Beitritts-Maske statt der frueheren Sackgasse ("Bitte ueber die Startseite
  // beitreten"). `joinBlocked` haelt fest, wenn der Beitritt ENDGUELTIG abgelehnt wurde (Raum
  // voll/nicht mehr da) -- dann macht ein erneuter Versuch keinen Sinn, die Maske verschwindet.
  const [needsJoin, setNeedsJoin] = useState(false);
  const [joinDisplayName, setJoinDisplayName] = useState("Franky");
  const [joinBlocked, setJoinBlocked] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const seatToken = localStorage.getItem(roomStorageKey(roomCode));

    function handleConnect() {
      setIsConnected(true);
      if (seatToken) {
        socket.emit("rejoinRoom", { roomCode, seatToken });
      } else {
        setNeedsJoin(true);
      }
    }

    function handleDisconnect() {
      setIsConnected(false);
    }

    function handleJoined(payload: RoomJoinedPayload) {
      if (payload.roomCode !== roomCode.toUpperCase()) {
        return;
      }

      localStorage.setItem(roomStorageKey(payload.roomCode), payload.seatToken);
      setParticipantId(payload.participantId);
      setState(payload.state);
      setError(null);
      setNeedsJoin(false);
      setIsJoining(false);
    }

    function handleRoomState(nextState: OlyRoomState) {
      if (nextState.roomCode !== roomCode.toUpperCase()) {
        return;
      }

      setState(nextState);
    }

    function handleError(payload: RoomErrorPayload) {
      if (payload.roomCode && payload.roomCode !== roomCode.toUpperCase()) {
        return;
      }

      setError(payload.message);
      setIsJoining(false);
      // Diese drei Texte kommen ausschliesslich aus `joinRoom`/`rejoinRoom`s eigenen Ablehnungen
      // (Raum voll / nicht gefunden / nicht mehr vorhanden) -- ein erneuter Versuch (mit einem
      // anderen Namen, oder einfach nochmal) wuerde am selben Ergebnis scheitern, die Maske macht
      // das deshalb sichtbar statt es erneut anzubieten. `ROOM_GONE_AFTER_REJOIN_MESSAGE` kommt vom
      // AUTOMATISCHEN `rejoinRoom`-Versuch beim Verbinden (kein Klick noetig) -- ohne diesen Zweig
      // blieb die Seite bei einem laengst verwaisten/verfallenen Raum stumm bei "Raum wird
      // geladen ...", siehe Kommentar an der Konstante.
      if (
        payload.message === ROOM_FULL_MESSAGE ||
        payload.message === ROOM_NOT_FOUND_MESSAGE ||
        payload.message === ROOM_GONE_AFTER_REJOIN_MESSAGE
      ) {
        setJoinBlocked(payload.message);
      }
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("roomJoined", handleJoined);
    socket.on("roomState", handleRoomState);
    socket.on("roomError", handleError);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("roomJoined", handleJoined);
      socket.off("roomState", handleRoomState);
      socket.off("roomError", handleError);
    };
  }, [roomCode, socket]);

  const currentParticipant = state?.roomParticipants.find((participant) => participant.participantId === participantId) ?? null;
  const isHost = currentParticipant?.role === "host";
  const seatToken = typeof window !== "undefined" ? localStorage.getItem(roomStorageKey(roomCode)) : null;
  const roomFlowButton = state ? describeRoomFlowButton({ state, participantId }) : null;
  const currentFlowStep = state ? getRoomFlowStep(state.roomFlowState.step) : null;
  const aiTeamCount = state?.teamOwnership.filter((entry) => entry.controllerType === "ai").length ?? 0;
  const aiReadyCount = state?.roomFlowState.aiAutoCompletedTeamIds.length ?? 0;

  function buildFoundationHref(view: string, teamId?: string | null) {
    const params = new URLSearchParams({
      view,
      team: teamId ?? currentParticipant?.controlledTeamIds[0] ?? "A-A",
    });
    if (state && currentParticipant && seatToken) {
      params.set("roomCode", roomCode.toUpperCase());
      params.set("participantId", currentParticipant.participantId);
      params.set("userId", currentParticipant.userId);
      params.set("seatToken", seatToken);
      params.set("saveId", state.multiplayerRoom.saveId);
      // BEFUND (siehe Auftrag): `userId` ist ohne Login ein zufaelliger `user-<uuid>`-String und
      // stimmt mit keinem `teamControlSettings[...].ownerId` im Spielstand ueberein — Frankys
      // Browser fiel dadurch im Foundation-Client auf den lokalen Standard (Chris) zurueck. Diese
      // eigene `ownerId`, aus der SERVER-VERGEBENEN Sitzrolle abgeleitet, ist die Groesse, die
      // dort tatsaechlich gebraucht wird (siehe Kommentar an `resolveRoomParticipantActiveOwnerId`).
      const ownerId = resolveRoomParticipantActiveOwnerId(currentParticipant.role);
      if (ownerId) {
        params.set("ownerId", ownerId);
      }
    }
    return `/foundation?${params.toString()}`;
  }

  const foundationHref = roomFlowButton
    ? buildFoundationHref(roomFlowButton.targetView, roomFlowButton.activeTeamId)
    : buildFoundationHref("home");

  const primaryCtaLabel = useMemo(() => {
    if (!state) return "Ins Spiel";
    if (state.multiplayerRoom.status === "lobby") return "Zum Spieltag";
    return "Ins Spiel";
  }, [state]);

  const isLobby = state?.multiplayerRoom.status === "lobby";
  // Stufe 1.3 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): der Host darf Teams auch NACH dem Start
  // umverteilen, aber nur zwischen zwei Spieltagen -- siehe `isRoomMatchdayInProgress` fuer die
  // genaue Grenze. In der Lobby ist das immer "kein Spieltag laeuft", das Panel bleibt dort also
  // wie bisher sichtbar.
  const matchdayInProgress = state ? isRoomMatchdayInProgress(state) : false;
  const canReassignTeams = isHost && !matchdayInProgress;
  // A real (non-sandbox) save already bound to the room means "Spiel starten" continues it
  // rather than creating a fresh one - surface that to the host in the lobby.
  const hasExistingRealSave = Boolean(state && !isSandboxRoomSave(state.multiplayerRoom.saveId));
  // In the lobby the host's start action still creates/binds the real save, so relabel the
  // generic flow CTA ("Room starten") to the clearer "Spiel starten".
  const roomFlowButtonLabel =
    isLobby && roomFlowButton?.isHostAction && roomFlowButton?.canClick ? "Spiel starten" : roomFlowButton?.label ?? "Lädt ...";

  const teamRosterParticipants = state?.roomParticipants.filter((participant) => participant.controlledTeamIds.length > 0) ?? [];

  // Mirrors the server-side host/Franky resolution in buildExplicitTeamOwnership /
  // buildOwnershipForPreset (resolveFrankyParticipant: Sitzrolle statt Namens-Regex) so the
  // picker shows exactly who a click would assign teams to.
  const chrisParticipant = state?.roomParticipants.find((participant) => participant.role === "host") ?? null;
  const frankyParticipant = state ? resolveFrankyParticipant(state.roomParticipants) : null;
  const chrisDisplayName = chrisParticipant?.displayName ?? "Chris";
  const frankyDisplayName = frankyParticipant?.displayName ?? "Franky";

  const teamAssignment: Record<string, TeamAssignmentTarget> = {};
  if (state) {
    for (const entry of state.teamOwnership) {
      if (entry.controllerType === "human" && chrisParticipant && entry.participantId === chrisParticipant.participantId) {
        teamAssignment[entry.teamId] = "chris";
      } else if (entry.controllerType === "human" && frankyParticipant && entry.participantId === frankyParticipant.participantId) {
        teamAssignment[entry.teamId] = "franky";
      } else {
        teamAssignment[entry.teamId] = "ai";
      }
    }
  }
  const pickerChrisTeamIds = ONLINE_ROOM_TEAM_IDS.filter((teamId) => teamAssignment[teamId] === "chris");
  const pickerFrankyTeamIds = ONLINE_ROOM_TEAM_IDS.filter((teamId) => teamAssignment[teamId] === "franky");

  function assignTeam(teamId: string, target: TeamAssignmentTarget) {
    if (!seatToken) return;
    const nextChris = new Set(pickerChrisTeamIds);
    const nextFranky = new Set(pickerFrankyTeamIds);
    nextChris.delete(teamId);
    nextFranky.delete(teamId);
    if (target === "chris") nextChris.add(teamId);
    if (target === "franky") nextFranky.add(teamId);
    socket.emit("setTeamSelection", {
      roomCode: roomCode.toUpperCase(),
      seatToken,
      chrisTeamIds: Array.from(nextChris),
      frankyTeamIds: Array.from(nextFranky),
    });
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">Olympiade der Welten</p>
        <h1>Warteraum</h1>
        <p>Teile den Raum-Code mit deinem Mitspieler. Sobald alle bereit sind, geht es gemeinsam ins Spiel.</p>
      </header>

      <div className="room-meta">
        <span className="pill oly-room-code-pill" data-testid="room-code-pill">
          Raum-Code <strong>{roomCode.toUpperCase()}</strong>
        </span>
        <CopyInviteLinkButton roomCode={roomCode.toUpperCase()} />
        <span className={`pill${isConnected ? " is-ready" : " is-warning"}`}>{connectionLabel(isConnected)}</span>
        <Link className="pill" href="/">
          Zur Startseite
        </Link>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {state ? (
        <div className="stack oly-lobby-layout">
          <section className="panel">
            <div className="panel-header">
              <h2>Mitspieler</h2>
              <p className="muted">Wer ist im Raum und wer ist bereit.</p>
            </div>
            <div className="table-shell">
              <table className="data-table compact-table">
                <thead>
                  <tr>
                    <th>Spieler</th>
                    <th>Rolle</th>
                    <th>Teams</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {state.roomParticipants.map((participant) => (
                    <tr key={participant.participantId}>
                      <td data-testid="room-participant-name">{participant.displayName}</td>
                      <td>{participant.role === "host" ? "Host" : participant.role === "spectator" ? "Zuschauer" : "Mitspieler"}</td>
                      <td>{participant.controlledTeamIds.join(", ") || "—"}</td>
                      <td>
                        <span className={`pill${participant.readyState === "ready" ? " is-ready" : " is-warning"}`}>
                          {readyLabel(participant.readyState)}
                          {participant.connectionStatus === "offline" ? " · offline" : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {aiTeamCount > 0 ? (
              <p className="muted">Die übrigen {aiTeamCount} Teams ({state.teamOwnership.filter((entry) => entry.controllerType === "ai").map((entry) => entry.teamId).join(", ")}) übernimmt die KI.</p>
            ) : null}
            <button
              className="secondary-button"
              type="button"
              disabled={!seatToken}
              onClick={() => {
                if (!seatToken) return;
                socket.emit("setReadyState", {
                  roomCode: roomCode.toUpperCase(),
                  seatToken,
                  ready: currentParticipant?.readyState !== "ready",
                });
              }}
            >
              {currentParticipant?.readyState === "ready" ? "Bereit ✓" : "Bereit melden"}
            </button>
          </section>

          {isHost && matchdayInProgress ? (
            <section className="panel">
              <div className="panel-header">
                <h2>Teams verteilen</h2>
                <p className="muted">
                  Team-Zuordnung ist gesperrt, solange ein Spieltag läuft. Zwischen zwei Spieltagen kannst du hier wieder umverteilen.
                </p>
              </div>
            </section>
          ) : null}

          {canReassignTeams ? (
            <section className="panel">
              <div className="panel-header">
                <h2>Teams verteilen</h2>
                <p className="muted">
                  {isLobby
                    ? "Als Host legst du fest, wer welche Teams übernimmt. Der Rest läuft über KI."
                    : "Als Host kannst du zwischen den Spieltagen umverteilen. Der Rest läuft über KI."}
                </p>
              </div>
              <div className="form-stack">
                <label className="filter-field">
                  <span>Schnellauswahl (Preset)</span>
                  <select
                    className="input"
                    onChange={(event) => {
                      if (!seatToken) return;
                      socket.emit("applyRoomPreset", {
                        roomCode: roomCode.toUpperCase(),
                        seatToken,
                        preset: event.target.value as RoomOwnershipPreset,
                      });
                    }}
                    defaultValue="chris_4_franky_4_rest_ai"
                  >
                    {PRESET_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="room-meta">
                  <span className={`pill${pickerChrisTeamIds.length >= MAX_TEAMS_PER_HUMAN ? " is-warning" : " is-ready"}`}>
                    {chrisDisplayName}: {pickerChrisTeamIds.length}/{MAX_TEAMS_PER_HUMAN} Teams
                  </span>
                  {frankyParticipant ? (
                    <span className={`pill${pickerFrankyTeamIds.length >= MAX_TEAMS_PER_HUMAN ? " is-warning" : " is-ready"}`}>
                      {frankyDisplayName}: {pickerFrankyTeamIds.length}/{MAX_TEAMS_PER_HUMAN} Teams
                    </span>
                  ) : (
                    <span className="pill is-warning">Franky ist noch nicht im Raum</span>
                  )}
                </div>
                <p className="muted">
                  Waehle pro Team, wer es steuert: {chrisDisplayName}, {frankyDisplayName} oder KI. Maximal {MAX_TEAMS_PER_HUMAN} Teams pro
                  Mitspieler.
                </p>

                <div className="table-shell">
                  <table className="data-table compact-table" data-testid="team-selection-picker">
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>Zuweisung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ONLINE_ROOM_TEAM_IDS.map((teamId) => {
                        const assignment = teamAssignment[teamId] ?? "ai";
                        const chrisDisabled = assignment !== "chris" && pickerChrisTeamIds.length >= MAX_TEAMS_PER_HUMAN;
                        const frankyDisabled =
                          !frankyParticipant || (assignment !== "franky" && pickerFrankyTeamIds.length >= MAX_TEAMS_PER_HUMAN);
                        return (
                          <tr key={teamId}>
                            <td>{teamId}</td>
                            <td>
                              <div className="pill-toggle-group">
                                <button
                                  type="button"
                                  className={`pill-toggle${assignment === "chris" ? " is-selected" : ""}`}
                                  disabled={!seatToken || chrisDisabled}
                                  onClick={() => assignTeam(teamId, "chris")}
                                >
                                  {chrisDisplayName}
                                </button>
                                <button
                                  type="button"
                                  className={`pill-toggle${assignment === "franky" ? " is-selected" : ""}`}
                                  disabled={!seatToken || frankyDisabled}
                                  onClick={() => assignTeam(teamId, "franky")}
                                >
                                  {frankyDisplayName}
                                </button>
                                <button
                                  type="button"
                                  className={`pill-toggle${assignment === "ai" ? " is-selected" : ""}`}
                                  disabled={!seatToken}
                                  onClick={() => assignTeam(teamId, "ai")}
                                >
                                  KI
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

          <section className="panel" data-testid="room-flow-controller">
            <div className="panel-header">
              <div>
                <h2>Spielstand</h2>
                <p className="muted">{currentFlowStep?.label ?? "Room Flow"}</p>
              </div>
              <span className={`pill${state.roomFlowState.canHostAdvance ? " is-ready" : " is-warning"}`}>
                {state.roomFlowState.canHostAdvance ? "Bereit" : "Wartet"}
              </span>
            </div>
            <div className="stack">
              <div className="room-meta">
                {teamRosterParticipants.map((participant) => {
                  const ready = state.roomFlowState.completedParticipantIds.includes(participant.participantId);
                  return (
                    <span key={participant.participantId} className={`pill${ready ? " is-ready" : " is-warning"}`}>
                      {participant.displayName}: {ready ? participant.controlledTeamIds.length : 0}/{participant.controlledTeamIds.length} Teams bereit
                    </span>
                  );
                })}
                {aiTeamCount > 0 ? (
                  <span className={`pill${aiReadyCount >= aiTeamCount ? " is-ready" : " is-warning"}`}>
                    KI: {aiReadyCount}/{aiTeamCount} bereit
                  </span>
                ) : null}
              </div>
              {isHost && isLobby ? (
                <p className="muted">
                  {hasExistingRealSave
                    ? "Für diesen Raum existiert bereits ein Spielstand. Mit „Spiel starten“ wird der bestehende Spielstand fortgesetzt."
                    : "Mit „Spiel starten“ wird ein frischer Spielstand mit genau den gewählten Teams erstellt und beiden Spielern zugewiesen."}
                </p>
              ) : null}
              <div className="foundation-flow-actions">
                <button
                  className={`primary-button foundation-flow-button ${roomFlowButton?.status === "waiting_for_player" ? "is-blocked" : ""}`}
                  type="button"
                  disabled={!seatToken || !roomFlowButton?.canClick}
                  onClick={() => {
                    if (!seatToken || !roomFlowButton) return;
                    // Welches Socket-Event ein Klick sendet, entscheidet `roomFlowButton.action`
                    // (typisiert, von `describeRoomFlowButton` gesetzt) — NICHT mehr ein
                    // String-Vergleich auf `label`. Ein Vergleich auf die Beschriftung brach
                    // lautlos, sobald jemand nur den Text aenderte (siehe Commit-Historie);
                    // `action` ist von `label` unabhaengig und dafuer typsicher verdrahtet.
                    emitRoomFlowButtonAction({
                      action: roomFlowButton.action,
                      roomCode: roomCode.toUpperCase(),
                      seatToken,
                      toggleReadyTo: currentParticipant?.readyState !== "ready",
                    });
                  }}
                >
                  {roomFlowButtonLabel}
                </button>
                {isLobby ? (
                  // Do NOT navigate while still in the lobby: the room save is only bound the
                  // moment the host presses "Spiel starten". Entering now would carry the stale
                  // sandbox saveId, so keep the CTA inert until status leaves "lobby".
                  <button
                    type="button"
                    className="primary-button inline-button oly-primary-cta"
                    disabled
                    title="Erst nach dem Spielstart verfügbar"
                  >
                    {primaryCtaLabel}
                  </button>
                ) : (
                  <Link className="primary-button inline-button oly-primary-cta" href={foundationHref}>
                    {primaryCtaLabel}
                  </Link>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : joinBlocked ? (
        <section className="panel" data-testid="room-join-blocked">
          <div className="panel-header">
            <h2>Dieser Raum ist nicht verfügbar</h2>
          </div>
          <p className="muted">
            {joinBlocked === ROOM_FULL_MESSAGE
              ? "Der Raum hat bereits zwei aktive Coaches — für dich ist hier kein Platz mehr frei."
              : // F1 (Notausfahrt-Korrektur): dieser Raum-CODE ist weg, der SPIELSTAND dahinter
                // aber nicht -- Chris hat ausdruecklich verlangt, dass ein Koop-Save nie solo
                // weiterspielbar wird, also ist "verloren" hier bewusst NICHT die Botschaft.
                // "Raum erstellen" auf der Startseite bindet automatisch an den aktiven Spielstand
                // (HomePageClient.tsx) -- ist das noch derselbe Save, entsteht entweder ein neuer
                // Raum dafuer oder (mit Login als nachgewiesener Host) der alte Sitz kommt zurueck
                // (siehe `createRoom` in room-store.ts).
                "Dieser Raum-Code ist nicht mehr aktiv. Der Spielstand dahinter ist deshalb nicht verloren — geh zur Startseite: ist er noch dein aktiver Spielstand, verbindet dich „Raum erstellen“ automatisch wieder."}
          </p>
          <Link className="secondary-button inline-button" href="/">
            Zur Startseite
          </Link>
        </section>
      ) : needsJoin ? (
        <section className="panel" data-testid="room-join-panel">
          <div className="panel-header">
            <h2>Diesem Raum beitreten</h2>
            <p className="muted">Du wurdest über einen Einladungslink hierher geschickt. Trag deinen Namen ein und leg direkt los.</p>
          </div>
          <div className="form-stack">
            <label className="filter-field">
              <span>Anzeigename</span>
              <input
                className="input"
                value={joinDisplayName}
                onChange={(event) => setJoinDisplayName(event.target.value)}
                data-testid="room-join-display-name"
              />
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={isJoining || !isConnected || !joinDisplayName.trim()}
              data-testid="room-join-submit"
              onClick={() => {
                setError(null);
                setIsJoining(true);
                socket.emit("joinRoom", { roomCode: roomCode.toUpperCase(), displayName: joinDisplayName });
              }}
            >
              {isJoining ? "Trete bei ..." : "Beitreten"}
            </button>
          </div>
        </section>
      ) : (
        <section className="panel">
          <p>Raum wird geladen ...</p>
        </section>
      )}
    </main>
  );
}

export default function RoomPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = params?.roomCode?.toUpperCase();

  if (!roomCode) {
    return null;
  }

  return (
    <SocketProvider>
      <RoomScreen roomCode={roomCode} />
    </SocketProvider>
  );
}
