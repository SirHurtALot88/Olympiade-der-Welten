import type { RankItem } from "@/lib/dashboard/topFlop";

interface Props {
  title: string;
  subtitle: string;
  /** CSS-Variable fuer Punkt/Balkenfarbe, z. B. "--good", "--crit", "--warn", "--accent". */
  accentVar: string;
  items: RankItem[];
  emptyText: string;
  /** Zusatzzeile unter der Ueberschrift (z. B. "≈ € 4.200 gebunden · 812 Artikel"). */
  headerNote?: string;
}

/** Generische Rangliste (4 Instanzen auf /top-flop): Top-Seller, Margen-Champions, Low-Runner, Ladenhüter. */
export function RankList({ title, subtitle, accentVar, items, emptyText, headerNote }: Props) {
  const maxBar = Math.max(1, ...items.map((i) => i.barValue));
  const color = `var(${accentVar})`;

  return (
    <div className="card">
      <h3>
        <span className="hdot" style={{ background: color }} />
        {title} <span className="r">{subtitle}</span>
      </h3>
      {headerNote && (
        <div style={{ padding: "0 16px 8px", fontSize: 12, color: "var(--muted)" }}>{headerNote}</div>
      )}
      <div className="ranklist">
        {items.length === 0 && (
          <div style={{ padding: "10px 8px", fontSize: 12.5, color: "var(--faint)" }}>{emptyText}</div>
        )}
        {items.map((item, i) => (
          <a
            key={item.articleId}
            className="rankrow"
            href={`/sortiment?q=${encodeURIComponent(item.setCode ?? item.nameRaw)}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="rk">{i + 1}</div>
            <div className="nm">
              {item.nameRaw}
              {item.fallingBadge && <span className="rank-badge">▼ fällt ab</span>}
              {item.setCode && <div className="code">{item.setCode}</div>}
            </div>
            <div className="val">{item.valueLabel}</div>
            <div className="meta">
              {item.meta.map((m, mi) => (
                <span key={mi}>{m}</span>
              ))}
            </div>
            <div className="rbar">
              <i style={{ width: `${Math.min(100, Math.max(3, (item.barValue / maxBar) * 100))}%`, background: color }} />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
