"use client";

import { useCallback, useEffect, useState } from "react";

interface Report {
  pages: number;
  emptyPages: number[];
  listings: number;
  matchedBy: { item_id: number; name: number; alias: number; set_code: number };
  downloaded: number;
  unchanged: number;
  failed: { articleId: string; source: string; error: string }[];
  unmatchedSample: string[];
  unmatchedCount: number;
  fallbackMissSample: string[];
  fallbackMissCount: number;
  finishedAt: string;
}

interface Status {
  running: boolean;
  startedAt: string | null;
  lastReport: Report | null;
  lastError: string | null;
  counts: { total: number; withImage: number; ebay: number; ygo: number };
}

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/**
 * Kartenbilder: eigene eBay-Fotos zuerst, YGOPRODeck als Rueckfall
 * (src/lib/images/). Ein Lauf dauert gut anderthalb Minuten und laeuft im
 * Hintergrund; die Karte fragt waehrenddessen alle drei Sekunden nach.
 */
export function ImageSyncCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/images/sync", { cache: "no-store" });
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

  async function start(force: boolean) {
    setError(null);
    try {
      const res = await fetch("/api/images/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Start fehlgeschlagen.");
    }
  }

  const c = status?.counts;
  const r = status?.lastReport;
  const pct = c && c.total > 0 ? Math.round((c.withImage / c.total) * 100) : 0;

  return (
    <div className="card" style={{ padding: "15px 16px 16px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Kartenbilder</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, lineHeight: 1.5 }}>
        Zuerst deine eigenen Fotos aus dem eBay-Shop, für alles, was dort gerade nicht gelistet ist, das Kartenbild von
        YGOPRODeck über den Set-Code. Jedes Bild wird einmal geladen und auf dem Server abgelegt. Nach jedem Import laufen
        neue Artikel automatisch nach.
      </div>

      {c && (
        <div style={{ fontSize: 12.5, marginBottom: 10 }}>
          <b>{c.withImage.toLocaleString("de-DE")}</b> von {c.total.toLocaleString("de-DE")} Artikeln mit Bild ({pct} %) ·{" "}
          eBay {c.ebay.toLocaleString("de-DE")} · YGOPRODeck {c.ygo.toLocaleString("de-DE")}
        </div>
      )}

      {status?.running && (
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
          Läuft seit {status.startedAt ? fmtTime(status.startedAt) : "eben"} … (rund 2 Minuten, die Seite kann offen bleiben)
        </div>
      )}

      {r && !status?.running && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.6 }}>
          Letzter Lauf {fmtTime(r.finishedAt)}: {r.listings} eBay-Angebote auf {r.pages} Seiten gelesen
          {r.emptyPages.length > 0 && <span className="down"> ({r.emptyPages.length} Seiten blieben leer — später erneut laufen lassen)</span>}.
          <br />
          Zugeordnet: {r.matchedBy.item_id} über eBay-Nummer, {r.matchedBy.name} über Namen, {r.matchedBy.alias} über Alias,{" "}
          {r.matchedBy.set_code} über YGOPRODeck. Neu geladen {r.downloaded}, unverändert {r.unchanged}
          {r.failed.length > 0 && <span className="down">, fehlgeschlagen {r.failed.length}</span>}.
          {r.unmatchedCount > 0 && (
            <details style={{ marginTop: 4 }}>
              <summary>{r.unmatchedCount} eBay-Angebote ohne passenden Artikel</summary>
              <ul style={{ margin: "4px 0 0 16px" }}>
                {r.unmatchedSample.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </details>
          )}
          {r.fallbackMissCount > 0 && (
            <details style={{ marginTop: 4 }}>
              <summary>{r.fallbackMissCount} Set-Codes, die auch YGOPRODeck nicht kennt</summary>
              <div style={{ marginTop: 4 }}>{r.fallbackMissSample.join(", ")}</div>
            </details>
          )}
        </div>
      )}

      {(error || status?.lastError) && (
        <div className="down" style={{ fontSize: 12, marginBottom: 10 }}>
          {error ?? status?.lastError}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="chip" disabled={!status || status.running} onClick={() => start(false)} style={{ padding: "8px 16px" }}>
          {status?.running ? "Läuft …" : "Bilder holen"}
        </button>
        <button
          type="button"
          className="chip"
          disabled={!status || status.running}
          onClick={() => start(true)}
          title="Alle Bilder neu laden, auch vorhandene"
          style={{ padding: "8px 16px" }}
        >
          Alle neu laden
        </button>
      </div>
    </div>
  );
}
