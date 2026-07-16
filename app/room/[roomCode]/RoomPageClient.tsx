"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { describeRoomFlowButton, getRoomFlowStep } from "@/lib/room/room-flow-controller";
import { SocketProvider, useSocket } from "@/lib/socket/socket-context";
import type { RoomErrorPayload, RoomJoinedPayload, RoomOwnershipPreset } from "@/types/events";
import type { OlyRoomState } from "@/types/game";

const PRESET_OPTIONS: Array<{ value: RoomOwnershipPreset; label: string }> = [
  { value: "chris_1_rest_ai", label: "1 Team Chris, Rest KI" },
  { value: "chris_2_rest_ai", label: "2 Teams Chris, Rest KI" },
  { value: "chris_4_rest_ai", label: "4 Teams Chris, Rest KI" },
  { value: "chris_4_franky_4_rest_ai", label: "4 Teams Chris + 4 Teams Franky, Rest KI" },
];

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

function CopyRoomCodeButton({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="secondary-button inline-button"
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(roomCode);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          /* Clipboard kann in manchen Umgebungen fehlen - kein hartes Fehlverhalten. */
        }
      }}
    >
      {copied ? "Kopiert!" : "Code kopieren"}
    </button>
  );
}

function RoomScreen({ roomCode }: { roomCode: string }) {
  const socket = useSocket();
  const [state, setState] = useState<OlyRoomState | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(() => socket.connected);

  useEffect(() => {
    const seatToken = localStorage.getItem(roomStorageKey(roomCode));

    function handleConnect() {
      setIsConnected(true);
      if (seatToken) {
        socket.emit("rejoinRoom", { roomCode, seatToken });
      } else {
        setError("Kein Sitzplatz gefunden. Bitte über die Startseite beitreten.");
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

  const primaryCtaLabel = useMemo(() => {
    if (!state) return "Ins Spiel";
    if (state.multiplayerRoom.status === "lobby") return "Zum Spieltag";
    return "Ins Spiel";
  }, [state]);

  const teamRosterParticipants = state?.roomParticipants.filter((participant) => participant.controlledTeamIds.length > 0) ?? [];

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">Olympiade der Welten</p>
        <h1>Warteraum</h1>
        <p>Teile den Raum-Code mit deinem Mitspieler. Sobald alle bereit sind, geht es gemeinsam ins Spiel.</p>
      </header>

      <div className="room-meta">
        <span className="pill oly-room-code-pill">
          Raum-Code <strong>{roomCode.toUpperCase()}</strong>
        </span>
        <CopyRoomCodeButton roomCode={roomCode.toUpperCase()} />
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
                      <td>{participant.displayName}</td>
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

          {isHost && state.multiplayerRoom.status === "lobby" ? (
            <section className="panel">
              <div className="panel-header">
                <h2>Teams verteilen</h2>
                <p className="muted">Als Host legst du fest, wer welche Teams übernimmt. Der Rest läuft über KI.</p>
              </div>
              <div className="form-stack">
                <label className="filter-field">
                  <span>Verteilung</span>
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
                  {roomFlowButton?.label ?? "Lädt ..."}
                </button>
                <Link className="primary-button inline-button oly-primary-cta" href={foundationHref}>
                  {primaryCtaLabel}
                </Link>
              </div>
            </div>
          </section>
        </div>
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
