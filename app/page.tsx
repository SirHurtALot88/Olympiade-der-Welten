"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LobbyCard } from "@/components/LobbyCard";
import { getClientSocket } from "@/lib/socket/client";
import type { RoomOwnershipPreset } from "@/types/events";
import type { RoomErrorPayload, RoomJoinedPayload } from "@/types/events";

function storageKey(roomCode: string) {
  // Runtime rejoin token only. This is not team ownership or write authorization.
  return `oly-seat:${roomCode}`;
}

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("Chris");
  const [joinDisplayName, setJoinDisplayName] = useState("Franky");
  const [preset, setPreset] = useState<RoomOwnershipPreset>("chris_1_rest_ai");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    const socket = getClientSocket();

    function handleJoined(payload: RoomJoinedPayload) {
      localStorage.setItem(storageKey(payload.roomCode), payload.seatToken);
      setIsBusy(false);
      router.push(`/room/${payload.roomCode}`);
    }

    function handleError(payload: RoomErrorPayload) {
      setError(payload.message);
      setIsBusy(false);
    }

    socket.on("roomJoined", handleJoined);
    socket.on("roomError", handleError);

    return () => {
      socket.off("roomJoined", handleJoined);
      socket.off("roomError", handleError);
    };
  }, [router]);

  return (
    <main className="app-shell">
      <header className="hero">
        <p>Oly Umbau App v2 · Online Multiplayer Rooms V1</p>
        <h1>Manager-Room erstellen</h1>
        <p>
          Browser verbinden sich mit einem gemeinsamen Server-Room. Participants besitzen Teams,
          AI bleibt Systemsteuerung, und echte Writes laufen später serverseitig über Services.
        </p>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="lobby-grid">
        <LobbyCard title="Online-Room erstellen">
          <div className="form-stack">
            <p>Host erstellt einen teilbaren Room-Code, z. B. ABCD-1234.</p>
            <label className="filter-field">
              <span>Dein Anzeigename</span>
              <input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <label className="filter-field">
              <span>Ownership-Preset</span>
              <select className="input" value={preset} onChange={(event) => setPreset(event.target.value as RoomOwnershipPreset)}>
                <option value="chris_1_rest_ai">1 Team Chris, Rest AI</option>
                <option value="chris_2_rest_ai">2 Teams Chris, Rest AI</option>
                <option value="chris_4_rest_ai">4 Teams Chris, Rest AI</option>
                <option value="chris_4_franky_4_rest_ai">4 Teams Chris + 4 Teams Franky + Rest AI</option>
              </select>
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={isBusy}
              onClick={() => {
                setError(null);
                setIsBusy(true);
                getClientSocket().emit("createRoom", { displayName, preset });
              }}
            >
              Raum erstellen
            </button>
          </div>
        </LobbyCard>

        <LobbyCard title="Room beitreten">
          <div className="form-stack">
            <p>Franky oder ein anderer Spieler verbindet sich per Room-Code mit demselben Server-Room.</p>
            <label className="filter-field">
              <span>Anzeigename</span>
              <input className="input" value={joinDisplayName} onChange={(event) => setJoinDisplayName(event.target.value)} />
            </label>
            <input
              className="input"
              placeholder="z. B. ABCD-1234"
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              maxLength={9}
            />
            <button
              className="secondary-button"
              type="button"
              disabled={isBusy || roomCode.trim().length < 4}
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

        <LobbyCard title="Server-authoritative Flow">
          <div className="stack">
            <p>Vorbereitet für: Buy/Sell, Facilities, XP, Training, Lineup, Formkarten, Resolve und Season Transition.</p>
            <ul className="foundation-home-news-list">
              <li>Client sendet Requests, keine Direktwrites.</li>
              <li>Server validiert Room, Participant, TeamOwnership, Save/Step und Confirm Token.</li>
              <li>Lokaler Sandbox-Modus bleibt ohne Prisma-Writes.</li>
            </ul>
          </div>
        </LobbyCard>

        <LobbyCard title="Singleplayer Foundation">
          <div className="stack">
            <p>
              Debug-Seite fuer Datenmodell, Saisonstate, Transfermarkt-Testdaten und erste
              KI-Entscheidungen.
            </p>
            <Link className="secondary-button inline-button" href="/foundation">
              Management Core ansehen
            </Link>
          </div>
        </LobbyCard>
      </div>
    </main>
  );
}
