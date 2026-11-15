"use client";

import { useCallback, useEffect, useState } from "react";

interface OrderHit {
  nr: string;
  at: string;
  state: number | null;
  excluded: boolean;
  lines: { name: string; qty: number; unitPrice: number; article: boolean }[];
}
interface OrderCheckResult {
  checked: boolean;
  found?: number;
  hits?: OrderHit[];
  message?: string;
  error?: string;
  lastRun?: string;
}

interface Status {
  configured: boolean;
  source: string | null;
  running: boolean;
  lastError: string | null;
  lastReport: {
    products: number;
    deactivated: number;
    orders: number;
    ebayItemIds?: number;
    recent?: { newestOrderAt: string | null; days: { day: string; orders: number; states: Record<string, number> }[] };
    duplicateMasters?: number;
    minStockCount?: number;
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
        Holt Artikelstamm (Bestand, VK, EK) und alle Bestellungen direkt aus Billbee und rechnet die Fenster 30, 90, 365 Tage und
        die gesamte Historie neu. Läuft beim Start und alle 3 Stunden. Die Datei-Importe bleiben als Rückfall.
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
          {r.ebayItemIds !== undefined && <> eBay-Artikelnummern aus Billbee: {r.ebayItemIds.toLocaleString("de-DE")}.</>}
          {r.minStockCount !== undefined && <> Mindestbestand aus Billbee bei {r.minStockCount.toLocaleString("de-DE")} Artikeln gepflegt.</>}
          {(r.duplicateMasters ?? 0) > 0 && <> {r.duplicateMasters} Stammartikel mit gleichem Namen zusammengefasst.</>}
          <br />
          {r.windows.map((w) => `${w.window} Tage: ${w.units.toLocaleString("de-DE")} Stück bei ${w.articles.toLocaleString("de-DE")} Artikeln`).join(" · ")}
          {r.diagnostics && (
            <>
              <br />
              Datenprüfung: {r.diagnostics.duplicates} doppelt gelieferte Bestellungen entfernt, {r.diagnostics.fractionalItems} Positionen mit gebrochener Menge.
              {r.diagnostics.fractionalSamples.length > 0 && (
                <> Beispiele: {r.diagnostics.fractionalSamples.map((s) => `${s.name} (${s.qty}x, Bestellung ${s.order})`).join("; ")}.</>
              )}
              {r.recent && (
                <>
                  <br />
                  Bestellungen letzte Tage: {r.recent.days.map((d) => `${d.day}: ${d.orders} (${Object.entries(d.states).map(([s, n]) => `Status ${s}: ${n}`).join(", ")})`).join(" · ")}
                  {r.recent.newestOrderAt && <> · jüngste Bestellung {new Date(r.recent.newestOrderAt).toLocaleString("de-DE")}</>}
                </>
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

      {status?.configured && !editing && <OrderCheck />}
    </div>
  );
}


/** "Bestellung prüfen": fehlt ein Verkauf in der Seite, zeigt das, ob Billbee die Bestellung geliefert hat und was mit ihren Positionen geschah. */
function OrderCheck() {
  const [nr, setNr] = useState("");
  const [res, setRes] = useState<OrderCheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  async function check() {
    if (nr.trim().length < 3) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/billbee/order?nr=${encodeURIComponent(nr.trim())}`, { cache: "no-store" });
      setRes((await r.json()) as OrderCheckResult);
    } catch {
      setRes({ checked: false, message: "Keine Verbindung zum Server." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ marginTop: 14, fontSize: 12.5 }}>
      <b>Bestellung prüfen</b>{" "}
      <span style={{ color: "var(--faint)" }}>(Fehlt ein Verkauf? Bestellnummer aus Billbee eingeben, zum Beispiel 16-15356-57206)</span>
      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        <input value={nr} onChange={(e) => setNr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void check()} placeholder="Bestellnummer" style={{ minWidth: 220 }} aria-label="Bestellnummer" />
        <button type="button" className="chip" onClick={() => void check()} disabled={busy || nr.trim().length < 3}>
          Prüfen
        </button>
      </div>
      {res && (
        <div style={{ marginTop: 8, lineHeight: 1.5 }}>
          {res.message && <div className={res.checked ? "down" : undefined}>{res.message}</div>}
          {res.error && <div className="down">{res.error}</div>}
          {res.hits?.map((h) => (
            <div key={h.nr} style={{ marginTop: 6 }}>
              <b>{h.nr}</b> · {new Date(h.at).toLocaleString("de-DE")} · Status {h.state ?? "?"}
              {h.excluded ? <span className="down"> · Status zählt nicht (z. B. storniert): wird nicht als Verkauf gespeichert</span> : <span> · geliefert, zählt als Verkauf</span>}
              <ul style={{ margin: "4px 0 0 18px" }}>
                {h.lines.map((l, i) => (
                  <li key={i}>
                    {l.qty} × {l.name} · {l.unitPrice.toFixed(2).replace(".", ",")} €{" "}
                    {l.article ? "· Artikel gefunden" : <span className="down">· kein Artikel mit diesem Namen: Position wird nicht gespeichert (Name in Billbee passt nicht zum Artikelstamm)</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
