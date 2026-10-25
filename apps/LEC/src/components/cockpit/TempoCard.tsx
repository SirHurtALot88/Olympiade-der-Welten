import type { RunRateBands } from "@/lib/cockpit/bands";
import { compact, eur } from "./format";

const SERIES = [
  { key: "revenue", label: "Umsatz", color: "var(--ck-s1)", pick: (b: RunRateBands["bands"][number]) => b.revenuePerMonth },
  { key: "ek", label: "Wareneinsatz", color: "var(--ck-s2)", pick: (b: RunRateBands["bands"][number]) => b.ekPerMonth },
  { key: "dbII", label: "DB II", color: "var(--ck-s3)", pick: (b: RunRateBands["bands"][number]) => b.dbIIPerMonth },
] as const;

/**
 * Tempo: Ø je Monat in drei disjunkten Zeitbaendern, gruppierte Saeulen, drei Serien
 * (validierte Palette, Legende + Direktlabel am Kappenende). Eine Achse (€/Monat).
 */
export function TempoCard({ bands }: { bands: RunRateBands }) {
  const ordered = [...bands.bands].reverse(); // alt -> neu
  const W = 720;
  const H = 230;
  const padL = 52;
  const padR = 12;
  const padT = 14;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const allValues = ordered.flatMap((b) => SERIES.map((s) => s.pick(b)));
  const maxV = Math.max(1, ...allValues);
  const minV = Math.min(0, ...allValues);
  const ticks = niceTicks(minV, maxV, 4);
  const yMax = ticks[ticks.length - 1];
  const yMin = ticks[0];
  const y = (v: number) => padT + ((yMax - v) / (yMax - yMin || 1)) * plotH;
  const groupW = plotW / ordered.length;
  const barW = Math.min(24, (groupW * 0.6) / SERIES.length);
  const gap = 2;
  const groupInner = barW * SERIES.length + gap * (SERIES.length - 1);

  return (
    <section className="ck-card ck-c12" aria-label="Tempo">
      <div className="ck-h">
        <h2>Tempo: Verkauf vs. Wareneinsatz</h2>
        <span className="ck-scope">Ø je Monat · drei Zeitbänder aus 30/90/365 T</span>
      </div>
      <div className="ck-body">
        {!bands.available ? (
          <div className="ck-empty">Kein 30/90/365-Tage-Fenster importiert.</div>
        ) : (
          <>
            <svg className="ck-cols" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gruppierte Säulen: Umsatz, Wareneinsatz und DB II je Monat in drei Zeitbändern">
              {ticks.map((t) => (
                <g key={t}>
                  <line className={t === 0 ? "ck-axis" : "ck-grid"} x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
                  <text x={padL - 8} y={y(t) + 4} textAnchor="end">
                    {compact(t)}
                  </text>
                </g>
              ))}
              {ordered.map((b, gi) => {
                const gx = padL + gi * groupW + (groupW - groupInner) / 2;
                return (
                  <g key={b.key}>
                    {SERIES.map((s, si) => {
                      const v = s.pick(b);
                      const top = y(Math.max(0, v));
                      const bottom = y(Math.min(0, v));
                      const h = Math.max(0, bottom - top);
                      const bx = gx + si * (barW + gap);
                      const r = Math.min(4, h);
                      const path =
                        v >= 0
                          ? `M${bx},${bottom} V${top + r} a${r},${r} 0 0 1 ${r},-${r} H${bx + barW - r} a${r},${r} 0 0 1 ${r},${r} V${bottom} Z`
                          : `M${bx},${top} V${bottom - r} a${r},${r} 0 0 0 ${r},${r} H${bx + barW - r} a${r},${r} 0 0 0 ${r},-${r} V${top} Z`;
                      return (
                        <g key={s.key}>
                          <path d={path} fill={s.color}>
                            <title>{`${b.longLabel} · ${s.label}: Ø ${eur(v)} je Monat`}</title>
                          </path>
                          {/* Direktlabel nur fuer die juengste Gruppe (die Geschichte ist "jetzt"). */}
                          {gi === ordered.length - 1 && (
                            <text className="ck-lbl" x={bx + barW / 2} y={(v >= 0 ? top : bottom) + (v >= 0 ? -5 : 12)} textAnchor="middle" fontSize={10.5}>
                              {compact(v)}
                            </text>
                          )}
                        </g>
                      );
                    })}
                    <text className="ck-cat" x={gx + groupInner / 2} y={H - 12} textAnchor="middle">
                      {b.label}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="ck-legend" aria-label="Legende">
              {SERIES.map((s) => (
                <span key={s.key}>
                  <i style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
              {bands.anyClamped && <span style={{ color: "var(--warn)" }}>Fenster nicht verschachtelt — ein Band wurde auf 0 geklemmt.</span>}
            </div>
            <details className="ck-details">
              <summary>Als Tabelle</summary>
              <table className="ck-table">
                <thead>
                  <tr>
                    <th>Band</th>
                    <th className="r">Umsatz/Mon</th>
                    <th className="r">Ware/Mon</th>
                    <th className="r">DB II/Mon</th>
                    <th className="r">Stk/Mon</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((b) => (
                    <tr key={b.key}>
                      <td>{b.longLabel}</td>
                      <td className="r">{eur(b.revenuePerMonth)}</td>
                      <td className="r">{eur(b.ekPerMonth)}</td>
                      <td className="r">{eur(b.dbIIPerMonth)}</td>
                      <td className="r">{Math.round(b.qtyPerMonth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
        <p className="ck-note">
          Bei der EÜR ist Ware sofort Aufwand: liegt der Wareneinsatz-Balken dauerhaft nah am Umsatz, frisst der Einkauf das Jahresergebnis.
          Band 31–90 T = (W90 − W30)/2, Band 91–365 T = (W365 − W90)/9,2 Monate.
        </p>
      </div>
    </section>
  );
}

function niceTicks(min: number, max: number, count: number): number[] {
  const range = max - min || 1;
  const rough = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}
