"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LobbyCard } from "@/components/LobbyCard";
import { getClientSocket } from "@/lib/socket/client";
import { ROOM_OWNERSHIP_PRESET_IDS } from "@/lib/room/online-room-model";
import type { RoomOwnershipPreset } from "@/types/events";
import type { PlayMode } from "@/lib/data/olyDataTypes";
import type { RoomErrorPayload, RoomJoinedPayload } from "@/types/events";

// PAKET 2 (docs/MULTIPLAYER_MODI_1V1_2V2_PLAN.md, E3): die MENGE der Presets kommt jetzt aus
// `ROOM_OWNERSHIP_PRESET_IDS` (lib/room/online-room-model.ts) -- derselben Quelle, aus der
// `RoomPageClient.tsx` ihre PRESET_OPTIONS baut. Vorher pflegte diese Datei ihre eigene, komplette
// Preset-Liste per Hand (Befund 1.3 im Plan): ein neuer Preset, der nur HIER ergaenzt wurde, blieb
// in der Room-Seite unsichtbar, und umgekehrt. `Record<RoomOwnershipPreset, string>` zwingt bei
// einem kuenftigen Preset zu einer Beschriftung HIER (TS-Fehler sonst) -- die Beschriftung selbst
// darf sich von der in RoomPageClient.tsx unterscheiden (E3 erlaubt das ausdruecklich), die MENGE
// nicht mehr auseinanderlaufen.
const PRESET_LABELS: Record<RoomOwnershipPreset, string> = {
  chris_1_rest_ai: "1 Team für mich, Rest KI",
  chris_2_rest_ai: "2 Teams für mich, Rest KI",
  chris_4_rest_ai: "4 Teams für mich, Rest KI",
  chris_4_franky_4_rest_ai: "4 Teams für mich + 4 Teams für Franky, Rest KI",
  chris_1_franky_1_rest_ai: "1 Team für mich + 1 Team für Franky, Rest KI",
  chris_2_franky_2_rest_ai: "2 Teams für mich + 2 Teams für Franky, Rest KI",
};

const PRESET_OPTIONS: Array<{ value: RoomOwnershipPreset; label: string }> = ROOM_OWNERSHIP_PRESET_IDS.map((value) => ({
  value,
  label: PRESET_LABELS[value],
}));

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
  /**
   * SPIELART des Raums. Steht SENKRECHT zur Team-Verteilung oben: jene sagt, wer wie viele Teams
   * führt, diese, welche Teams es überhaupt gibt (Management 32, Battle 16). Chris' Vorgabe war
   * „battle mode muss in allen modi verfügbar sein also solo und multiplayer" — der Solo-Weg hat
   * seine Auswahl im Neuspiel-Assistenten, das hier ist der Mehrspieler-Weg.
   *
   * Wirkt nur für einen Raum OHNE bestehenden Spielstand. Hängt der Raum an einem echten Save,
   * erbt er dessen Spielart — sie steht dort seit dem Neuspiel fest (siehe `createRoom`,
   * lib/room/room-store.ts), und ein Raum darf sie nicht neu behaupten.
   */
  const [playMode, setPlayMode] = useState<PlayMode>("management");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [activeSaveId, setActiveSaveId] = useState<string | null>(null);
  // Getrennt vom activeSaveId-Wert: erst wenn der Save-Check wirklich beantwortet
  // ist, wissen wir, ob "Weiterspielen" angeboten werden darf. Ohne dieses Flag
  // würde die Karte beim ersten Render (activeSaveId noch null) fälschlich nur
  // "Neues Spiel" zeigen und "Weiterspielen" erst nachträglich einblenden.
  const [soloSaveChecked, setSoloSaveChecked] = useState(false);
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
          setSoloSaveChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveSaveId(null);
          setSoloSaveChecked(true);
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
        <div className="oly-solo-actions">
          {soloSaveChecked && activeSaveId ? (
            <div className="oly-solo-choice">
              <Link className="primary-button inline-button" href="/foundation" data-testid="solo-continue">
                Weiterspielen
              </Link>
              <span className="muted">Lädt deinen aktiven Spielstand und macht dort weiter, wo du aufgehört hast.</span>
            </div>
          ) : null}
          <div className="oly-solo-choice">
            <Link
              className={`${activeSaveId ? "secondary-button" : "primary-button"} inline-button`}
              href="/foundation?view=teamSettings&tab=saves&newGame=1"
              data-testid="solo-new-game"
            >
              Neues Spiel
            </Link>
            <span className="muted">
              Team wählen (z. B. P-S), du steuerst 1 Team, der Rest ist KI — es entsteht ein frischer Spielstand.
            </span>
          </div>
        </div>
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
            {/* Ausgegraut, sobald der Raum an einem bestehenden Save hängt: dort ist die Spielart
                längst entschieden und unveränderlich — eine Auswahl, die nichts bewirkt, wäre eine
                Lüge. Der Server ignoriert das Feld in diesem Fall ohnehin. */}
            <label className="filter-field">
              <span>Spielart</span>
              <select
                className="input"
                value={playMode}
                disabled={Boolean(activeSaveId)}
                data-testid="create-room-playmode"
                title={
                  activeSaveId
                    ? "Der Raum übernimmt die Spielart des bestehenden Spielstands."
                    : "Management: 32 Teams, 10 Spieltage. Battle: 16 Teams, 20 Spieltage, echte Paarungen."
                }
                onChange={(event) => setPlayMode(event.target.value as PlayMode)}
              >
                <option value="management">Management — 32 Teams, 10 Spieltage</option>
                <option value="battle">Battle — 16 Teams, 20 Spieltage</option>
              </select>
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={isBusy || socketState !== "connected" || !displayName.trim()}
              onClick={() => {
                setError(null);
                setIsBusy(true);
                getClientSocket().emit("createRoom", {
                  displayName,
                  preset,
                  saveId: activeSaveId ?? undefined,
                  // NUR im Battle-Modus mitgeschickt: ein Management-Raum sendet denselben
                  // Rumpf wie vor dem Battle-Modus, also kein neues Feld und kein anderer Weg.
                  ...(playMode === "battle" ? { playMode: "battle" as const } : {}),
                });
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
