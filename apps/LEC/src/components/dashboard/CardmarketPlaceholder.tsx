/**
 * Cardmarket-Check — Mini-Teaser (KONZEPT §7.1 / PAGES_CONCEPT §3): die volle
 * Erfassungs-/Vergleichsseite lebt jetzt unter `/marktpreise`. Diese
 * Dashboard-Karte zeigt nur einen kurzen Stand + Link dorthin ("Top 4 + Alle
 * ansehen"-Prinzip). Solange NICHTS erfasst ist, bleibt der Platzhalter-Hinweis
 * (keine erfundenen Zahlen).
 */
export function CardmarketPlaceholder({ count }: { count: number }) {
  return (
    <div className="card">
      <h3>
        <span className="hdot" style={{ background: "var(--market)" }} />
        Cardmarket-Check <span className="r">Provider B · manuell</span>
      </h3>
      <div className="price">
        {count === 0 ? (
          <div
            style={{
              background: "var(--panel2)",
              border: "1px dashed var(--border)",
              borderRadius: "var(--r-sm)",
              padding: "18px 16px",
              fontSize: 12.5,
              color: "var(--muted)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <b style={{ color: "var(--ink)" }}>Noch keine Marktpreis-Daten hinterlegt.</b>
            <span>
              Cardmarket hat keine API für Chris' Account (KONZEPT §7.1) — Preisdaten werden manuell
              erfasst (Produkt-URL bzw. kopierte Preisfelder je Set-Code).
            </span>
            <a href="/marktpreise" className="chip c-mkt" style={{ alignSelf: "flex-start", textDecoration: "none" }}>
              Jetzt erfassen →
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="pcell" style={{ alignSelf: "flex-start" }}>
              <div className="k">Erfasste Artikel</div>
              <div className="v">{count}</div>
            </div>
            <a href="/marktpreise" className="chip c-mkt" style={{ alignSelf: "flex-start", textDecoration: "none" }}>
              Alle ansehen →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
