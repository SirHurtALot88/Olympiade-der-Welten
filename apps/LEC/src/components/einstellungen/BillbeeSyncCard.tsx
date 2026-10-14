"use client";

import { useCallback, useEffect, useState } from "react";

interface Status {
  configured: boolean;
  source: string | null;
  running: boolean;
  lastError: string | null;
  lastReport: {
    products: number;
    deactivated: number;
    orders: number;
    windows: { window: string; articles: number; units: number }[];
    diagnostics?: {
      duplicates: number;
      fractionalItems: number;
      fractionalSamples: { name: string; qty: number; order: string | null }[];
      top: { name: string; units: number; orders: number; maxLine: number }[];
    };
    finishedAt: string;
  } | null;
}

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Billbee-Abruf (src/lib/billbee/): Artikelstamm, Bestand, Verkäufe. Läuft von selbst; der Knopf stößt nur einen Lauf an. */
export function BillbeeSyncCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ user: "", password: "", apiKey: "" });
  const [saving, setSaving] = useState(false);

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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/billbee/credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      setForm({ user: "", password: "", apiKey: "" });
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  const r = status?.lastReport;
  const showForm = status !== null && (!status.configured || editing);
  const input = { width: "100%", padding: "8px 10px", marginTop: 4, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel2)", color: "inherit", font: "inherit" } as const;
  return (
    <div className="card" style={{ padding: "15px 16px 16px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Billbee: Artikel, Bestand und Verkäufe</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, lineHeight: 1.5 }}>
        Holt Artikelstamm (Bestand, VK, EK) und die Bestellungen der letzten 365 Tage direkt aus Billbee und rechnet die Fenster 30, 90 und
        365 Tage neu. Läuft beim Start und alle 3 Stunden. Die Datei-Importe bleiben als Rückfall.
      </div>

      {showForm && (
        <form onSubmit={save} autoComplete="off" style={{ display: "grid", gap: 10, marginBottom: 12, fontSize: 12 }}>
          <div style={{ color: "var(--muted)", lineHeight: 1.5 }}>
            Einmal eintragen, danach holt die App die Daten selbst. Die Werte werden vor dem Speichern bei Billbee geprüft, verschlüsselt abgelegt
            und nie wieder angezeigt.
          </div>
          <label>
            Billbee-Login (E-Mail)
            <input style={input} type="email" required autoComplete="off" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} />
          </label>
          <label>
            API-Passwort (Billbee: Einstellungen, Billbee API)
            <input style={input} type="password" required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          <label>
            API-Schlüssel (aus der Mail von Billbee)
            <input style={input} type="password" required autoComplete="new-password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="chip" disabled={saving}>
              {saving ? "Prüfe …" : "Speichern und testen"}
            </button>
            {editing && (
              <button type="button" className="chip" onClick={() => setEditing(false)}>
                Abbrechen
              </button>
            )}
          </div>
        </form>
      )}
      {status?.configured && !editing && (
        <div style={{ fontSize: 12, marginBottom: 10 }}>
          <b className="up">Verbunden</b>
          {status.source === "env" ? " (über die Server-Umgebung)" : ""}
          {status.source === "app" && (
            <>
              {" · "}
              <button type="button" className="chip" onClick={() => setEditing(true)}>
                Zugang ändern
              </button>
            </>
          )}
        </div>
      )}

      {status?.running && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Läuft … (die Seite kann offen bleiben)</div>}

      {r && !status?.running && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.6 }}>
          Letzter Lauf {fmtTime(r.finishedAt)}: {r.products.toLocaleString("de-DE")} Artikel, {r.orders.toLocaleString("de-DE")} Bestellungen
          {r.deactivated > 0 ? `, ${r.deactivated} als ausgelaufen markiert` : ""}.
          <br />
          {r.windows.map((w) => `${w.window} Tage: ${w.units.toLocaleString("de-DE")} Stück bei ${w.articles.toLocaleString("de-DE")} Artikeln`).join(" · ")}
          {r.diagnostics && (
            <>
              <br />
              Datenprüfung: {r.diagnostics.duplicates} doppelt gelieferte Bestellungen entfernt, {r.diagnostics.fractionalItems} Positionen mit gebrochener Menge.
              {r.diagnostics.fractionalSamples.length > 0 && (
                <> Beispiele: {r.diagnostics.fractionalSamples.map((s) => `${s.name} (${s.qty}x, Bestellung ${s.order})`).join("; ")}.</>
              )}
              <br />
              Meistverkauft (365 T): {r.diagnostics.top.map((t) => `${t.name}: ${t.units} Stück in ${t.orders} Bestellungen (max. ${t.maxLine} je Position)`).join(" · ")}
            </>
          )}
        </div>
      )}

      {(error || status?.lastError) && (
        <div className="down" style={{ fontSize: 12, marginBottom: 10 }}>
          {error ?? status?.lastError}
        </div>
      )}

      {status?.configured && !editing && (
        <button type="button" className="chip" onClick={() => void start()} disabled={status.running}>
          Jetzt aktualisieren
        </button>
      )}
    </div>
  );
}
