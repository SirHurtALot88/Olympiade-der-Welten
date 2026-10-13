"use client";

import { useCallback, useEffect, useState } from "react";

interface Status {
  configured: boolean;
  running: boolean;
  lastError: string | null;
  lastReport: {
    products: number;
    deactivated: number;
    orders: number;
    windows: { window: string; articles: number; units: number }[];
    finishedAt: string;
  } | null;
}

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Billbee-Abruf (src/lib/billbee/): Artikelstamm, Bestand, Verkäufe. Läuft von selbst; der Knopf stößt nur einen Lauf an. */
export function BillbeeSyncCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/billbee/sync", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stand nicht abrufbar.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!status?.running) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [status?.running, load]);

  async function start() {
    setError(null);
    try {
      const res = await fetch("/api/billbee/sync", { method: "POST" });
      if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status}`);
      setStatus(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Start fehlgeschlagen.");
    }
  }

  const r = status?.lastReport;
  return (
    <div className="card" style={{ padding: "15px 16px 16px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Billbee: Artikel, Bestand und Verkäufe</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, lineHeight: 1.5 }}>
        Holt Artikelstamm (Bestand, VK, EK) und die Bestellungen der letzten 365 Tage direkt aus Billbee und rechnet die Fenster 30, 90 und
        365 Tage neu. Läuft beim Start und alle 3 Stunden. Die Datei-Importe bleiben als Rückfall.
      </div>

      {status && !status.configured && (
        <div style={{ fontSize: 12, marginBottom: 10 }}>
          Noch nicht eingerichtet: auf dem Server fehlen <code>BILLBEE_API_KEY</code>, <code>BILLBEE_USER</code> und <code>BILLBEE_PASSWORD</code>.
        </div>
      )}

      {status?.running && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Läuft … (die Seite kann offen bleiben)</div>}

      {r && !status?.running && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.6 }}>
          Letzter Lauf {fmtTime(r.finishedAt)}: {r.products.toLocaleString("de-DE")} Artikel, {r.orders.toLocaleString("de-DE")} Bestellungen
          {r.deactivated > 0 ? `, ${r.deactivated} als ausgelaufen markiert` : ""}.
          <br />
          {r.windows.map((w) => `${w.window} Tage: ${w.units.toLocaleString("de-DE")} Stück bei ${w.articles.toLocaleString("de-DE")} Artikeln`).join(" · ")}
        </div>
      )}

      {(error || status?.lastError) && (
        <div className="down" style={{ fontSize: 12, marginBottom: 10 }}>
          {error ?? status?.lastError}
        </div>
      )}

      {status?.configured && (
        <button type="button" className="chip" onClick={() => void start()} disabled={status.running}>
          Jetzt aktualisieren
        </button>
      )}
    </div>
  );
}
