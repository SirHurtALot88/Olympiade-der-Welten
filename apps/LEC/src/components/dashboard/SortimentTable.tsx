import type { SortimentRow } from "@/lib/dashboard/viewModel";
import { formatEuro, formatEuroCents } from "@/lib/format";

interface Props {
  rows: SortimentRow[];
}

const STATUS_PILL: Record<SortimentRow["priceStatus"], { cls: string; label: string }> = {
  unter_min: { cls: "p-crit", label: "unter MIN" },
  im_korridor: { cls: "p-good", label: "im Korridor" },
  ueber_gut: { cls: "p-mkt", label: "über Markt" },
};

export function SortimentTable({ rows }: Props) {
  const maxVelocity = Math.max(1, ...rows.flatMap((r) => r.velocity));

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h3>
        Sortiment <span className="r">VK vs. Preis-Korridor (MIN 25 % … GUT 35 %)</span>
      </h3>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Artikel</th>
              <th>Velocity 30·90·365</th>
              <th className="r">Umsatz 365 T</th>
              <th className="r">VK</th>
              <th>Preis-Korridor</th>
              <th>Klasse</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pill = STATUS_PILL[row.priceStatus];
              return (
                <tr key={row.articleId}>
                  <td>
                    <div className="artname" title={row.nameRaw}>
                      {row.nameRaw}
                    </div>
                    {row.setCode && <div className="code">{row.setCode}</div>}
                  </td>
                  <td>
                    <MicroVelocity values={row.velocity} max={maxVelocity} />
                  </td>
                  <td className="r num">€ {formatEuro(row.revenue365)}</td>
                  <td className="r num">{row.vk > 0 ? `${formatEuroCents(row.vk)} €` : "—"}</td>
                  <td>
                    <Corridor min={row.corridor.min} good={row.corridor.good} vk={row.vk} />
                  </td>
                  <td style={{ fontSize: 11.5, color: "var(--muted)" }}>{row.classLabel}</td>
                  <td>
                    <span className={`pill ${pill.cls}`}>
                      <span className="dot" />
                      {pill.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MicroVelocity({ values, max }: { values: [number, number, number]; max: number }) {
  return (
    <span className="veloc">
      <span className="micro" title="Velocity 30/90/365 T (gleiche Skala)">
        {values.map((v, i) => (
          <i key={i} style={{ height: `${Math.max(2, (v / max) * 20)}px` }} />
        ))}
      </span>
      <span className="vnums">{values.join(" · ")}</span>
    </span>
  );
}

function Corridor({ min, good, vk }: { min: number; good: number; vk: number }) {
  const rangeMin = min * 0.7;
  const rangeMax = good * 1.25;
  const range = rangeMax - rangeMin || 1;
  const pos = (x: number) => Math.max(0, Math.min(100, ((x - rangeMin) / range) * 100));
  const meColor = vk === 0 ? "var(--faint)" : vk < min ? "var(--crit)" : vk > good ? "var(--market)" : "var(--good)";

  return (
    <div className="corridor">
      <div className="crange">
        <div
          className="band"
          style={{ left: `${pos(min)}%`, width: `${pos(good) - pos(min)}%` }}
        />
        <div className="mn" style={{ left: `${pos(min)}%` }} />
        <div className="gx" style={{ left: `${pos(good)}%` }} />
        {vk > 0 && <div className="me" style={{ left: `${pos(vk)}%`, background: meColor }} />}
      </div>
      <div className="clabels">
        <span>MIN {min.toFixed(2)}</span>
        <span>GUT {good.toFixed(2)}</span>
      </div>
    </div>
  );
}
