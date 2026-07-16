/**
 * Cardmarket-Check — Provider-B-Platzhalter (KONZEPT §7.1): Chris hat keine
 * Cardmarket-API, Preisdaten kommen v1 manuell/halbautomatisch (siehe
 * src/lib/pricing/marketPrice.ts, MarketPriceProvider-Interface). Solange
 * keine Preisdaten hinterlegt sind, zeigt diese Karte bewusst KEINE
 * erfundenen Zahlen, sondern einen klar markierten Platzhalter-Hinweis.
 */
export function CardmarketPlaceholder() {
  return (
    <div className="card">
      <h3>
        <span className="hdot" style={{ background: "var(--market)" }} />
        Cardmarket-Check <span className="r">Provider B · manuell</span>
      </h3>
      <div className="price">
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
            gap: 8,
          }}
        >
          <b style={{ color: "var(--ink)" }}>Noch keine Marktpreis-Daten hinterlegt.</b>
          <span>
            Cardmarket hat keine API für Chris' Account (KONZEPT §7.1) — Preisdaten kommen
            v1 manuell (Produkt-URL bzw. kopierte Preisfelder je Set-Code). Die
            Eingabe-Oberfläche dafür ist noch nicht gebaut (Phase 3 laut Roadmap); das
            Interface <code>MarketPriceProvider</code> (
            <code>src/lib/pricing/marketPrice.ts</code>) ist bereits vorbereitet.
          </span>
        </div>
      </div>
    </div>
  );
}
