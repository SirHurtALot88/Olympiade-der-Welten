"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ActionLog } from "@/components/ActionLog";
import { RelayArenaPhaser } from "@/components/RelayArenaPhaser";
import { RoomStatusPanel } from "@/components/RoomStatusPanel";
import { TurnControls } from "@/components/TurnControls";
import { ROOM_FLOW_STEPS, describeRoomFlowButton, getRoomFlowStep } from "@/lib/room/room-flow-controller";
import { SocketProvider, useSocket } from "@/lib/socket/socket-context";
import type { RoomErrorPayload, RoomJoinedPayload, RoomOwnershipPreset } from "@/types/events";
import type { CoachRole, OlyRoomState } from "@/types/game";

function roomStorageKey(roomCode: string) {
  return `oly-seat:${roomCode.toUpperCase()}`;
}

function RoomScreen({ roomCode }: { roomCode: string }) {
  const socket = useSocket();
  const [state, setState] = useState<OlyRoomState | null>(null);
  const [role, setRole] = useState<CoachRole | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionText, setConnectionText] = useState(() =>
    socket.connected ? "Verbunden" : "Verbinde...",
  );

  useEffect(() => {
    const seatToken = localStorage.getItem(roomStorageKey(roomCode));

    function handleConnect() {
      setConnectionText("Verbunden");
      if (seatToken) {
        socket.emit("rejoinRoom", { roomCode, seatToken });
      } else {
        setError("Kein Sitzplatz gefunden. Bitte ueber die Startseite beitreten.");
      }
    }

    function handleDisconnect() {
      setConnectionText("Verbindung getrennt");
    }

    function handleJoined(payload: RoomJoinedPayload) {
      if (payload.roomCode !== roomCode.toUpperCase()) {
        return;
      }

      localStorage.setItem(roomStorageKey(payload.roomCode), payload.seatToken);
      setRole(payload.role);
      setParticipantId(payload.participantId);
      setState(payload.state);
      setError(null);
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

  const canEndTurn = Boolean(state && role && state.activeRole === role && state.moveCommittedThisTurn);
  const roleLabel = role ? `Coach ${role}` : "Unbekannt";
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
    }
    return `/foundation?${params.toString()}`;
  }
  const foundationHref = roomFlowButton
    ? buildFoundationHref(roomFlowButton.targetView, roomFlowButton.activeTeamId)
    : buildFoundationHref("home");

  const infoText = useMemo(() => {
    if (!state || !role) {
      return "Warte auf gueltigen Raumzustand.";
    }

    if (state.activeRole === role) {
      return state.moveCommittedThisTurn
        ? "Dein Move ist gesetzt. Du kannst jetzt den Zug beenden."
        : "Du bist aktiv. Waehle eines deiner Tokens.";
    }

    return "Der andere Coach ist gerade am Zug.";
  }, [role, state]);

  return (
    <main className="app-shell">
      <header className="hero">
        <p>Gemeinsamer Multiplayer-Raum</p>
        <h1>Staffel-Arena v0.1</h1>
        <p>
          Zwei Browser sehen denselben autoritativen Zustand. Phaser rendert nur die Arena, die
          Engine trifft die Entscheidungen.
        </p>
      </header>

      <div className="room-meta">
        <span className="pill">Raum {roomCode.toUpperCase()}</span>
        {state ? <span className="pill">Code {state.multiplayerRoom.roomCode}</span> : null}
        <span className="pill">{connectionText}</span>
        {state ? <span className="pill">Phase {state.multiplayerRoom.status}</span> : null}
        {currentParticipant ? <span className="pill">Participant {currentParticipant.displayName}</span> : null}
        <Link className="pill" href="/">
          Neue Lobby
        </Link>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      <div className="info-banner">{infoText}</div>

      {state ? (
        <div className="room-layout">
          <section className="panel room-arena-panel">
            <div className="panel-header">
              <h2>Arena</h2>
              <p className="muted">Klicks senden nur `moveToken` an den Server.</p>
            </div>
            <RelayArenaPhaser
              state={state}
              currentRole={role ?? "A"}
              onTokenSelect={(tokenId) => {
                const seatToken = localStorage.getItem(roomStorageKey(roomCode));
                if (!seatToken) {
                  setError("Kein Sitzplatz fuer diesen Raum gespeichert.");
                  return;
                }

                socket.emit("moveToken", {
                  roomCode: roomCode.toUpperCase(),
                  seatToken,
                  tokenId,
                });
              }}
            />
          </section>

          <aside className="stack room-sidebar">
            <RoomStatusPanel roleLabel={roleLabel} state={state} />
            <section className="panel" data-testid="room-flow-controller">
              <div className="panel-header">
                <div>
                  <h2>Room Flow</h2>
                  <p className="muted">
                    {state.roomFlowState.activeSeasonId} · Matchday {state.roomFlowState.activeMatchday} · {state.roomFlowState.phase}
                  </p>
                </div>
                <span className={`pill${state.roomFlowState.canHostAdvance ? " is-ready" : " is-warning"}`}>
                  {state.roomFlowState.canHostAdvance ? "Host darf weiter" : "Blockiert"}
                </span>
              </div>
              <div className="stack">
                <div className="room-meta">
                  {state.roomParticipants
                    .filter((participant) => participant.controlledTeamIds.length > 0)
                    .map((participant) => {
                      const ready = state.roomFlowState.completedParticipantIds.includes(participant.participantId);
                      return (
                        <span key={participant.participantId} className={`pill${ready ? " is-ready" : " is-warning"}`}>
                          {participant.displayName}: {ready ? participant.controlledTeamIds.length : 0}/{participant.controlledTeamIds.length} Teams ready
                        </span>
                      );
                    })}
                  <span className={`pill${aiReadyCount >= aiTeamCount ? " is-ready" : " is-warning"}`}>
                    AI: {aiReadyCount}/{aiTeamCount} ready
                  </span>
                </div>
                <div className="info-banner">
                  <strong>{currentFlowStep?.label ?? "Room Flow"}</strong>
                  <span className="muted"> · {state.roomFlowState.warnings.join(" · ") || "bereit"}</span>
                </div>
                <div className="room-meta">
                  <span className="pill">Required {state.roomFlowState.requiredParticipantIds.length}</span>
                  <span className="pill">Completed {state.roomFlowState.completedParticipantIds.length}</span>
                  <span className="pill">Blocking Teams {state.roomFlowState.blockingTeamIds.length}</span>
                </div>
                <div className="room-meta">
                  {ROOM_FLOW_STEPS.map((entry) => (
                    <Link
                      key={entry.stepId}
                      className={`pill${entry.stepId === state.roomFlowState.step ? " is-ready" : ""}`}
                      href={buildFoundationHref(entry.targetView)}
                    >
                      {entry.label}
                    </Link>
                  ))}
                </div>
                <div className="foundation-flow-actions">
                  <button
                    className={`primary-button foundation-flow-button ${roomFlowButton?.status === "waiting_for_player" ? "is-blocked" : ""}`}
                    type="button"
                    disabled={!seatToken || !roomFlowButton?.canClick}
                    onClick={() => {
                      if (!seatToken || !roomFlowButton) return;
                      if (!roomFlowButton.isHostAction) {
                        socket.emit("setReadyState", {
                          roomCode: roomCode.toUpperCase(),
                          seatToken,
                          ready: currentParticipant?.readyState !== "ready",
                        });
                        return;
                      }
                      if (roomFlowButton.label === "AI Teams vorbereiten") {
                        socket.emit("runRoomAiAutoStep", {
                          roomCode: roomCode.toUpperCase(),
                          seatToken,
                        });
                        return;
                      }
                      if (state.multiplayerRoom.status === "lobby") {
                        socket.emit("startRoom", {
                          roomCode: roomCode.toUpperCase(),
                          seatToken,
                        });
                        return;
                      }
                      socket.emit("advanceRoomFlow", {
                        roomCode: roomCode.toUpperCase(),
                        seatToken,
                      });
                    }}
                  >
                    {roomFlowButton?.label ?? "Room Flow lädt"}
                  </button>
                  <Link className="secondary-button inline-button" href={foundationHref}>
                    Ansicht öffnen
                  </Link>
                </div>
                {state.roomFlowState.warnings.includes("sandbox_override_available") ? (
                  <p className="muted">
                    Sandbox sichtbar: Test-Auto-Ready wird als <code>source: sandbox_auto_ready</code> markiert. Echte Multiplayer-Räume bekommen keinen stillen Override.
                  </p>
                ) : null}
              </div>
            </section>
            <section className="panel">
              <div className="panel-header">
                <h2>Online Lobby</h2>
              </div>
              <div className="stack">
                <div className="room-meta">
                  <span className={`pill${state.turnState.canAdvance ? " is-ready" : " is-warning"}`}>
                    {state.turnState.canAdvance ? "Alle bereit" : "Wartet"}
                  </span>
                  <span className="pill">Required {state.turnState.requiredParticipants.length}</span>
                  <span className="pill">Ready {state.turnState.readyParticipants.length}</span>
                </div>
                <div className="table-shell">
                  <table className="data-table compact-table">
                    <thead>
                      <tr>
                        <th>Spieler</th>
                        <th>Rolle</th>
                        <th>Status</th>
                        <th>Teams</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.roomParticipants.map((participant) => (
                        <tr key={participant.participantId}>
                          <td>{participant.displayName}</td>
                          <td>{participant.role}</td>
                          <td>{participant.connectionStatus} · {participant.readyState}</td>
                          <td>{participant.controlledTeamIds.join(", ") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="primary-button"
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
                  {currentParticipant?.readyState === "ready" ? "Bereits bereit" : "Bereit melden"}
                </button>
                {isHost ? (
                  <>
                    <label className="filter-field">
                      <span>Ownership-Preset</span>
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
                        <option value="chris_1_rest_ai">1 Team Chris, Rest AI</option>
                        <option value="chris_2_rest_ai">2 Teams Chris, Rest AI</option>
                        <option value="chris_4_rest_ai">4 Teams Chris, Rest AI</option>
                        <option value="chris_4_franky_4_rest_ai">4 Teams Chris + 4 Teams Franky + Rest AI</option>
                      </select>
                    </label>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={!seatToken || !state.turnState.canAdvance}
                      onClick={() => {
                        if (!seatToken) return;
                        socket.emit("startRoom", {
                          roomCode: roomCode.toUpperCase(),
                          seatToken,
                        });
                      }}
                    >
                      Season / Room starten
                    </button>
                  </>
                ) : null}
              </div>
            </section>
            <section className="panel">
              <div className="panel-header">
                <h2>Team Ownership</h2>
              </div>
              <div className="room-meta">
                <span className="pill">Human {state.teamOwnership.filter((entry) => entry.controllerType === "human").length}</span>
                <span className="pill">AI {state.teamOwnership.filter((entry) => entry.controllerType === "ai").length}</span>
                <span className="pill">Passive {state.teamOwnership.filter((entry) => entry.controllerType === "passive").length}</span>
              </div>
              <p className="muted">
                Human-Teams sind Participant-gebunden. AI-Teams haben keine Participant-Session und werden später vom Server-AI-System verarbeitet.
              </p>
              <div className="room-meta">
                {state.teamOwnership.slice(0, 12).map((entry) => (
                  <span key={entry.teamId} className="pill">
                    {entry.teamId}: {entry.ownerDisplayName ?? entry.controllerType}
                  </span>
                ))}
              </div>
            </section>
            <TurnControls
              canEndTurn={canEndTurn}
              onEndTurn={() => {
                const seatToken = localStorage.getItem(roomStorageKey(roomCode));
                if (!seatToken) {
                  setError("Kein Sitzplatz fuer diesen Raum gespeichert.");
                  return;
                }

                socket.emit("endTurn", {
                  roomCode: roomCode.toUpperCase(),
                  seatToken,
                });
              }}
            />
          </aside>

          <section className="room-log">
            <ActionLog entries={state.actionLog} />
          </section>
        </div>
      ) : (
        <section className="panel">
          <p>Raum wird geladen...</p>
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
