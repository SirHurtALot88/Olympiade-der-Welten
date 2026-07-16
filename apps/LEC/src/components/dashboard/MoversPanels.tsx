import type { MoverItem } from "@/lib/dashboard/viewModel";
import { formatEuro, formatEuroCents, formatPercent } from "@/lib/format";

interface Props {
  good: MoverItem[];
  bad: MoverItem[];
}

export function MoversPanels({ good, bad }: Props) {
  return (
    <section className="grid-2">
      <div className="card">
        <h3>
          <span className="hdot" style={{ background: "var(--good)" }} />
          Läuft gerade gut <span className="r">Top-Bewegung · 30 Tage</span>
        </h3>
        <div className="movers">
          {good.length === 0 && <EmptyRow text="Noch keine Verkäufe im 30-Tage-Fenster." />}
          {good.map((item) => (
            <div className="mover" key={item.articleId}>
              <div className="nm">{item.nameRaw}</div>
              <div className="rev">€ {formatEuroCents(item.revenue)}</div>
              <div className="meta">
                <span>{item.qty} Stk</span>
                <span>EK € {formatEuroCents(item.ek)}</span>
                <span className="up">DB I {formatPercent(item.dbIPercent)}%</span>
              </div>
              <div className="bar">
                <i
                  style={{
                    width: `${Math.min(100, Math.max(4, item.dbIPercent * 100))}%`,
                    background: "var(--good)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>
          <span className="hdot" style={{ background: "var(--crit)" }} />
          Läuft schlecht / bindet Kapital <span className="r">Lebenszeit-DB II · Verlust</span>
        </h3>
        <div className="movers">
          {bad.length === 0 && <EmptyRow text="Keine Verlust-Artikel gefunden." />}
          {bad.map((item) => (
            <div className="mover" key={item.articleId}>
              <div className="nm">{item.nameRaw}</div>
              <div className="rev down">{formatPercent(item.dbIIPercent)}%</div>
              <div className="meta">
                <span>{item.qty} verkauft</span>
                <span className="down">DB II negativ</span>
              </div>
              <div className="bar">
                <i
                  style={{
                    width: `${Math.min(100, Math.max(4, Math.abs(item.dbIIPercent) * 100))}%`,
                    background: "var(--crit)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "2px 16px 12px", fontSize: 11, color: "var(--faint)" }}>
          Bar = Verlusttiefe (gleiche Skala). Umsatz-Summe der gezeigten Artikel: €{" "}
          {formatEuro(bad.reduce((s, i) => s + i.revenue, 0))}.
        </div>
      </div>
    </section>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div style={{ padding: "10px 8px", fontSize: 12.5, color: "var(--faint)" }}>{text}</div>;
}
