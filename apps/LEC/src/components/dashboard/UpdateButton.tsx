"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SyncState {
  configured: boolean;
  running: boolean;
  lastError: string | null;
  lastErrorAt?: string | null;
  progress?: { percent: number; label: string } | null;
  lastReport: { finishedAt: string; products?: number; orders?: number; sales?: number } | null;
}

interface Toast {
  kind: "ok" | "fehler";
  title: string;
  text: string;
}

function ago(iso: string | undefined, now: number): string {
  if (!iso) return "noch nie";
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `vor ${h} Std` : `vor ${Math.floor(h / 24)} Tagen`;
}

const nf = (n: number | undefined) => (n ?? 0).toLocaleString("de-DE");

/** Billbee-Abgleich von Hand starten (Seitenleiste): Statusleiste mit Prozent, Meldung bei Erfolg oder Fehler (mit Grund). */
export function UpdateButton() {
  const router = useRouter();
  const [state, setState] = useState<SyncState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const wasRunning = useRef(false);
  const userStarted = useRef(false);

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
        // Meldung nur, wenn dieser Abruf hier per Knopf gestartet wurde
        if (userStarted.current) {
          userStarted.current = false;
          if (s.lastError) {
            setToast({ kind: "fehler", title: "Aktualisierung fehlgeschlagen", text: s.lastError });
          } else {
            const r = s.lastReport;
            setToast({
              kind: "ok",
              title: "Aktualisiert",
              text: r ? `${nf(r.products)} Artikel, ${nf(r.orders)} Bestellungen, ${nf(r.sales)} Verkäufe geladen.` : "Daten aus Billbee geladen.",
            });
          }
        }
      }
      wasRunning.current = s.running;
    } catch {
      /* Netz kurz weg: naechster Versuch */
    }
  }, [router]);

  useEffect(() => {
    void load();
    // Beim Laufen oft nachsehen (Prozent), sonst gelegentlich (Stand "vor X Min" bleibt aktuell)
    const t = setInterval(() => void load(), state?.running || busy ? 1000 : 60_000);
    return () => clearInterval(t);
  }, [load, state?.running, busy]);

  // Erfolgsmeldung verschwindet von selbst, Fehler bleibt bis zum Schliessen
  useEffect(() => {
    if (toast?.kind !== "ok") return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  async function start() {
    userStarted.current = true;
    setToast(null);
    setBusy(true);
    try {
      const res = await fetch("/api/billbee/sync", { method: "POST" });
      if (!res.ok && res.status !== 202) {
        userStarted.current = false;
        setBusy(false);
        setToast({ kind: "fehler", title: "Aktualisierung nicht gestartet", text: res.status === 409 ? "Billbee ist noch nicht verbunden (Einstellungen)." : `Der Server antwortet mit HTTP ${res.status}.` });
      }
    } catch (e) {
      userStarted.current = false;
      setBusy(false);
      setToast({ kind: "fehler", title: "Aktualisierung nicht gestartet", text: e instanceof Error ? e.message : "Keine Verbindung zum Server." });
    } finally {
      await load();
    }
  }

  if (state && !state.configured) return null;
  const running = state?.running || busy;
  const pct = state?.progress?.percent ?? 0;
  return (
    <div className="upd">
      <button type="button" className="chip" onClick={() => void start()} disabled={running} title="Holt Bestand, Preise und Verkäufe jetzt aus Billbee (sonst automatisch alle 3 Stunden)">
        {running ? `Aktualisiert … ${pct} %` : "↻ Jetzt aktualisieren"}
      </button>
      {running && (
        <div className="upd-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Fortschritt der Aktualisierung">
          <div className="upd-bar-fill" style={{ width: `${Math.max(3, pct)}%` }} />
        </div>
      )}
      <span className="upd-stand">
        {running ? (state?.progress?.label ?? "Starte …") : `Stand ${ago(state?.lastReport?.finishedAt, now)}`}
        {state?.lastError && !running ? " · letzter Abruf fehlgeschlagen" : ""}
      </span>
      {state?.lastError && !running && (
        <span className="upd-stand" role="alert" title={state.lastError} style={{ display: "block", color: "var(--crit)", marginTop: 4, whiteSpace: "normal", wordBreak: "break-word" }}>
          Grund{state.lastErrorAt ? ` (${ago(state.lastErrorAt, now)})` : ""}: {state.lastError.length > 160 ? `${state.lastError.slice(0, 160)} …` : state.lastError}
        </span>
      )}
      {toast && (
        <div className={`upd-toast upd-toast-${toast.kind}`} role={toast.kind === "fehler" ? "alert" : "status"}>
          <button type="button" className="upd-toast-x" onClick={() => setToast(null)} aria-label="Meldung schließen">
            ×
          </button>
          <b>{toast.kind === "ok" ? "✓ " : "⚠ "}{toast.title}</b>
          <span>{toast.kind === "fehler" ? `Grund: ${toast.text}` : toast.text}</span>
        </div>
      )}
    </div>
  );
}
