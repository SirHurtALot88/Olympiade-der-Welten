import type { MoverItem } from "@/lib/dashboard/viewModel";
import { formatEuroCents, formatPercent } from "@/lib/format";

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
                {item.ek > 0 ? (
                  <>
                    <span>EK € {formatEuroCents(item.ek)}</span>
                    <span className="up">DB I {formatPercent(item.dbIPercent)}%</span>
                  </>
                ) : (
                  <span style={{ color: "var(--warn)" }} title="Für diesen Artikel ist kein Einkaufspreis hinterlegt, deshalb gibt es keine Marge.">
                    EK fehlt
                  </span>
                )}
              </div>
              <div className="bar">
                <i
                  style={{
                    width: item.ek > 0 ? `${Math.min(100, Math.max(4, item.dbIPercent * 100))}%` : "100%",
                    background: item.ek > 0 ? "var(--good)" : "var(--faint)",
                    opacity: item.ek > 0 ? 1 : 0.35,
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
          Läuft schlecht <span className="r" title="Artikel, die in den letzten 90 Tagen nach Gebühren, Versand und Verpackung Verlust gemacht haben (DB II negativ), nur mit bekanntem EK.">Verlust · 90 Tage</span>
        </h3>
        <div className="movers">
          {bad.length === 0 && <EmptyRow text="Kein Artikel mit Verlust in 90 Tagen." />}
          {bad.map((item) => (
            <a className="mover" key={item.articleId} href={`/sortiment?q=${encodeURIComponent(item.setCode ?? item.nameRaw)}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="nm">{item.nameRaw}</div>
              <div className="rev down">−€ {formatEuroCents(Math.abs(item.dbIIEuro))}</div>
              <div className="meta">
                <span>{item.qty} verkauft</span>
                <span>EK € {formatEuroCents(item.ek)}</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div style={{ padding: "10px 8px", fontSize: 12.5, color: "var(--faint)" }}>{text}</div>;
}
