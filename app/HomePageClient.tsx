"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LobbyCard } from "@/components/LobbyCard";
import { getClientSocket } from "@/lib/socket/client";
import type { RoomOwnershipPreset } from "@/types/events";
import type { RoomErrorPayload, RoomJoinedPayload } from "@/types/events";

const PRESET_OPTIONS: Array<{ value: RoomOwnershipPreset; label: string }> = [
  { value: "chris_1_rest_ai", label: "1 Team für mich, Rest KI" },
  { value: "chris_2_rest_ai", label: "2 Teams für mich, Rest KI" },
  { value: "chris_4_rest_ai", label: "4 Teams für mich, Rest KI" },
  { value: "chris_4_franky_4_rest_ai", label: "4 Teams für mich + 4 Teams für Franky, Rest KI" },
];

function storageKey(roomCode: string) {
  // Runtime rejoin token only. This is not team ownership or write authorization.
  return `oly-seat:${roomCode}`;
}

export default function HomePage({ authEnabled = false }: { authEnabled?: boolean }) {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("Chris");
  const [joinDisplayName, setJoinDisplayName] = useState("Franky");
  const [preset, setPreset] = useState<RoomOwnershipPreset>("chris_1_rest_ai");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [activeSaveId, setActiveSaveId] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<"connecting" | "connected" | "offline">("connecting");
  // Phase-1-Login: wenn eine Session existiert, kommt der Anzeigename von dort statt
  // aus einem frei editierbaren Feld. Ohne Login (isAuthEnabled() aus) liefert
  // /api/auth/session immer {user: null} und dieser Zustand bleibt leer - keine
  // Aenderung am bisherigen Verhalten.
  const [sessionDisplayName, setSessionDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!authEnabled) {
      return undefined;
    }

    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { user: null }))
      .then((payload: { user: { displayName: string } | null }) => {
        if (cancelled || !payload.user) {
          return;
        }
        setSessionDisplayName(payload.user.displayName);
        setDisplayName(payload.user.displayName);
        setJoinDisplayName(payload.user.displayName);
      })
      .catch(() => {
        /* Login ist optional - ohne Session bleibt der freie Name erhalten. */
      });
    return () => {
      cancelled = true;
    };
  }, [authEnabled]);

  useEffect(() => {
    const socket = getClientSocket();

    function handleConnect() {
      setSocketState("connected");
      setError((current) => (current === "Verbindung zum Spiel-Server verloren. Bitte erneut versuchen." ? null : current));
    }

    function handleDisconnect() {
      setSocketState("offline");
      setIsBusy(false);
    }

    function handleConnectError() {
      setSocketState("offline");
      setIsBusy(false);
      setError("Verbindung zum Spiel-Server verloren. Bitte erneut versuchen.");
    }

    function handleJoined(payload: RoomJoinedPayload) {
      localStorage.setItem(storageKey(payload.roomCode), payload.seatToken);
      setIsBusy(false);
      router.push(`/room/${payload.roomCode}`);
    }

    function handleError(payload: RoomErrorPayload) {
      setError(payload.message);
      setIsBusy(false);
    }

    setSocketState(socket.connected ? "connected" : "connecting");
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("roomJoined", handleJoined);
    socket.on("roomError", handleError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("roomJoined", handleJoined);
      socket.off("roomError", handleError);
    };
  }, [router]);

  useEffect(() => {
    if (!isBusy) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setIsBusy(false);
      setError("Keine Antwort vom Spiel-Server. Bitte erneut versuchen.");
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [isBusy]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/singleplayer-state?source=sqlite", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { save?: { saveId?: string } } | null) => {
        if (!cancelled) {
          setActiveSaveId(payload?.save?.saveId ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveSaveId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">Olympiade der Welten</p>
        <h1>Wie möchtest du spielen?</h1>
        <p>Übernimm deine Teams allein gegen die KI, oder spiele gemeinsam mit einem Freund in einem Online-Raum.</p>
        {sessionDisplayName ? <p className="oly-session-line">Angemeldet als {sessionDisplayName}</p> : null}
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="panel oly-solo-card">
        <div className="panel-header">
          <h2>Solo spielen</h2>
        </div>
        <p className="muted">Du steuerst deine Teams allein, die KI übernimmt den Rest der Liga.</p>
        <Link className="primary-button inline-button" href="/foundation">
          Solo spielen
        </Link>
      </section>

      <div className="oly-section-heading">
        <h2>Zu zweit spielen (Online)</h2>
        <p className="muted">Zwei Browser verbinden sich mit demselben Online-Raum und teilen sich die Liga.</p>
      </div>

      <div className="lobby-grid">
        <LobbyCard title="Raum erstellen">
          <div className="form-stack">
            <p className="muted">Du erstellst einen Raum-Code, den du mit deinem Mitspieler teilst.</p>
            <label className="filter-field">
              <span>Dein Anzeigename</span>
              <input
                className="input"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                readOnly={Boolean(sessionDisplayName)}
                title={sessionDisplayName ? "Angemeldet als " + sessionDisplayName : undefined}
              />
            </label>
            <label className="filter-field">
              <span>Team-Verteilung</span>
              <select className="input" value={preset} onChange={(event) => setPreset(event.target.value as RoomOwnershipPreset)}>
                {PRESET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={isBusy || socketState !== "connected" || !displayName.trim()}
              onClick={() => {
                setError(null);
                setIsBusy(true);
                getClientSocket().emit("createRoom", { displayName, preset, saveId: activeSaveId ?? undefined });
              }}
            >
              Raum erstellen
            </button>
          </div>
        </LobbyCard>

        <LobbyCard title="Mit Code beitreten">
          <div className="form-stack">
            <p className="muted">Hast du einen Raum-Code bekommen? Gib ihn hier ein und leg direkt los.</p>
            <label className="filter-field">
              <span>Anzeigename</span>
              <input
                className="input"
                value={joinDisplayName}
                onChange={(event) => setJoinDisplayName(event.target.value)}
                readOnly={Boolean(sessionDisplayName)}
                title={sessionDisplayName ? "Angemeldet als " + sessionDisplayName : undefined}
              />
            </label>
            <label className="filter-field">
              <span>Raum-Code</span>
              <input
                className="input"
                placeholder="z. B. ABCD-1234"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                maxLength={9}
              />
            </label>
            <button
              className="secondary-button"
              type="button"
              disabled={isBusy || socketState !== "connected" || roomCode.trim().length < 4 || !joinDisplayName.trim()}
              onClick={() => {
                setError(null);
                setIsBusy(true);
                getClientSocket().emit("joinRoom", { roomCode, displayName: joinDisplayName });
              }}
            >
              Raum beitreten
            </button>
          </div>
        </LobbyCard>
      </div>
    </main>
  );
}
