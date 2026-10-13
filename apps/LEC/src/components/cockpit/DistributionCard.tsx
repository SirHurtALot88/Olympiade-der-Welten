import type { Distribution } from "@/lib/cockpit/distribution";
import { eur, pct } from "./format";

interface Props<K extends string> {
  title: string;
  scope: string;
  distribution: Distribution<K>;
  /** CSS-Klassen-Praefix fuer die Segmentfarbe ("ck-k" -> ck-k-champion). */
  classPrefix: string;
  note: string;
  /** Zweiter Balken "Umsatzanteil" anzeigen. */
  withRevenue?: boolean;
  linkBase?: string;
}

/**
 * 100 %-Stapelbalken (2 px Surface-Luecke zwischen Segmenten). Farben sind Status/ordinal; die
 * Legende traegt Label + Zahl, das Segment selbst nur die Flaeche -- Farbe ist nie allein.
 */
export function DistributionCard<K extends string>({ title, scope, distribution, classPrefix, note, withRevenue = true, linkBase }: Props<K>) {
  const d = distribution;
  const segs = d.segments.filter((s) => s.count > 0);
  return (
    <section className="ck-card ck-c6" aria-label={title}>
      <div className="ck-h">
        <h2>{title}</h2>
        <span className="ck-scope">{scope}</span>
      </div>
      <div className="ck-body">
        {d.total === 0 ? (
          <div className="ck-empty">Keine Artikel in dieser Auswertung.</div>
        ) : (
          <>
            <div className="ck-stack">
              <div className="ck-sl">
                <span>Artikel</span>
                <span>{d.total.toLocaleString("de-DE")}</span>
              </div>
              <div className="ck-sb" role="img" aria-label={`Anteil Artikel: ${segs.map((s) => `${s.label} ${pct(s.countShare)}`).join(", ")}`}>
                {segs.map((s) => (
                  <i key={s.key} className={`${classPrefix}-${s.key}`} style={{ flexBasis: `${s.countShare * 100}%` }} title={`${s.label}: ${s.count} Artikel (${pct(s.countShare, 1)})`} />
                ))}
              </div>
            </div>
            {withRevenue && (
              <div className="ck-stack">
                <div className="ck-sl">
                  <span>Umsatz 365 T</span>
                  <span>{eur(d.totalRevenue)}</span>
                </div>
                <div className="ck-sb" role="img" aria-label={`Anteil Umsatz: ${segs.map((s) => `${s.label} ${pct(s.revenueShare)}`).join(", ")}`}>
                  {segs
                    .filter((s) => s.revenue > 0)
                    .map((s) => (
                      <i key={s.key} className={`${classPrefix}-${s.key}`} style={{ flexBasis: `${s.revenueShare * 100}%` }} title={`${s.label}: ${eur(s.revenue)} (${pct(s.revenueShare, 1)})`} />
                    ))}
                </div>
              </div>
            )}
            <div className="ck-legend">
              {d.segments.map((s) => (
                <span key={s.key}>
                  <i className={`${classPrefix}-${s.key}`} />
                  {linkBase ? (
                    <a href={`${linkBase}${s.key}`} style={{ textDecoration: "none" }}>
                      {s.label}
                    </a>
                  ) : (
                    s.label
                  )}{" "}
                  <b>{s.count.toLocaleString("de-DE")}</b>
                  {withRevenue && <span style={{ color: "var(--faint)" }}>· {pct(s.revenueShare)} Umsatz</span>}
                </span>
              ))}
            </div>
          </>
        )}
        <p className="ck-note">{note}</p>
      </div>
    </section>
  );
}
