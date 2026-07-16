import type { ImportSummary } from "./types";

export function ImportSummaryCard({ summary }: { summary: ImportSummary }) {
  const matchPct = Math.round(summary.matchRate * 100);
  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <h3 style={{ padding: "0 0 12px" }}>
        <span className="hdot" style={{ background: "var(--good)" }} />
        Import erfolgreich
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Stat label="Kartenartikel" value={String(summary.cardArticleCount)} />
        <Stat label="Matching-Quote" value={`${matchPct} %`} />
        <Stat label="Ungematcht" value={String(summary.reviewItemsOpen)} tone="warn" />
        <Stat label="Fenster aktualisiert" value={summary.windowsReplaced.join(" · ") || "—"} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
        {summary.windows.map((w) => (
          <div key={w.fileName} style={{ display: "flex", gap: 10, color: "var(--muted)" }}>
            <span className="pill p-mkt" style={{ flex: "none" }}>
              {w.window === "all" ? "Lebenszeit" : `${w.window} T`}
            </span>
            <span>
              {w.fileName} · {w.windowFrom} – {w.windowTo} · {w.rowCount} Zeilen
            </span>
          </div>
        ))}
        {summary.ebay && (
          <div style={{ display: "flex", gap: 10, color: "var(--muted)" }}>
            <span className="pill p-mkt" style={{ flex: "none" }}>
              eBay
            </span>
            <span>
              {summary.ebay.fileName} · {summary.ebay.rowCount} Zeilen
              {summary.ebay.subscriptionFee !== null &&
                ` · Abo-Gebühr ${summary.ebay.subscriptionFee.toFixed(2)} € (Fixkosten)`}
            </span>
          </div>
        )}
        {summary.billbeeArtikel && (
          <div style={{ display: "flex", gap: 10, color: "var(--muted)" }}>
            <span className="pill p-good" style={{ flex: "none" }}>
              Artikelstamm
            </span>
            <span>
              {summary.billbeeArtikel.fileName} · {summary.billbeeArtikel.rowCount} Zeilen ·{" "}
              {summary.billbeeArtikel.activeCount} aktiv gesetzt (Bestand + VK/EK aktualisiert)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="pcell">
      <div className="k">{label}</div>
      <div className="v" style={tone === "warn" ? { color: "var(--warn)" } : undefined}>
        {value}
      </div>
    </div>
  );
}
