"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SyncState {
  configured: boolean;
  running: boolean;
  lastError: string | null;
  lastErrorAt?: string | null;
  lastReport: { finishedAt: string } | null;
}

function ago(iso: string | undefined, now: number): string {
  if (!iso) return "noch nie";
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `vor ${h} Std` : `vor ${Math.floor(h / 24)} Tagen`;
}

/** Billbee-Abgleich von Hand starten (Seitenleiste). Zeigt den Stand und aktualisiert die Seite, sobald der Abruf fertig ist. */
export function UpdateButton() {
  const router = useRouter();
  const [state, setState] = useState<SyncState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const wasRunning = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/billbee/sync", { cache: "no-store" });
      if (!res.ok) return;
      const s = (await res.json()) as SyncState;
      setState(s);
      setNow(Date.now());
      if (wasRunning.current && !s.running) {
        setBusy(false);
        router.refresh();
      }
      wasRunning.current = s.running;
    } catch {
      /* Netz kurz weg: naechster Versuch */
    }
  }, [router]);

  useEffect(() => {
    void load();
    // Beim Laufen oft nachsehen, sonst gelegentlich (Stand "vor X Min" bleibt aktuell)
    const t = setInterval(() => void load(), state?.running || busy ? 3000 : 60_000);
    return () => clearInterval(t);
  }, [load, state?.running, busy]);

  async function start() {
    setBusy(true);
    try {
      await fetch("/api/billbee/sync", { method: "POST" });
    } finally {
      await load();
    }
  }

  if (state && !state.configured) return null;
  const running = state?.running || busy;
  return (
    <div className="upd">
      <button type="button" className="chip" onClick={() => void start()} disabled={running} title="Holt Bestand, Preise und Verkäufe jetzt aus Billbee (sonst automatisch alle 3 Stunden)">
        {running ? "Aktualisiert …" : "↻ Jetzt aktualisieren"}
      </button>
      <span className="upd-stand">
        Stand {ago(state?.lastReport?.finishedAt, now)}
        {state?.lastError && !running ? " · letzter Abruf fehlgeschlagen" : ""}
      </span>
      {state?.lastError && !running && (
        <span className="upd-stand" role="alert" title={state.lastError} style={{ display: "block", color: "var(--crit)", marginTop: 4, whiteSpace: "normal", wordBreak: "break-word" }}>
          Grund{state.lastErrorAt ? ` (${ago(state.lastErrorAt, now)})` : ""}: {state.lastError.length > 160 ? `${state.lastError.slice(0, 160)} …` : state.lastError}
        </span>
      )}
    </div>
  );
}
