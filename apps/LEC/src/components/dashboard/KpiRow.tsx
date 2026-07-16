"use client";

import type { SaleWindowKey } from "@/lib/parsing/date";
import type { DeadCapital, WindowKpis } from "@/lib/dashboard/viewModel";
import { formatEuro, formatEuroCents, formatPercent } from "@/lib/format";

const WINDOW_ORDER: { key: SaleWindowKey; label: string }[] = [
  { key: "30", label: "30 T" },
  { key: "90", label: "90 T" },
  { key: "365", label: "365 T" },
  { key: "all", label: "Lebenszeit" },
];

interface Props {
  windows: Record<SaleWindowKey, WindowKpis>;
  selected: SaleWindowKey;
  onSelect: (w: SaleWindowKey) => void;
  deadCapital: DeadCapital;
}

export function KpiRow({ windows, selected, onSelect, deadCapital }: Props) {
  const kpi = windows[selected];

  return (
    <>
      <div className="seg" style={{ marginBottom: 16 }}>
        {WINDOW_ORDER.map((w) => (
          <button
            key={w.key}
            type="button"
            className={selected === w.key ? "on" : undefined}
            onClick={() => onSelect(w.key)}
          >
            {w.label}
          </button>
        ))}
      </div>

      <section className="grid-kpi">
        <div className="card kpi">
          <div className="lab">
            Umsatz <span>· {kpi.label}</span>
          </div>
          <div className="val">
            € <span className="num">{formatEuro(kpi.revenue)}</span>
          </div>
          <div className="delta flat">{kpi.qty} Stk verkauft</div>
        </div>

        <div className="card kpi">
          <div className="lab">
            Verkäufe <span>· {kpi.label}</span>
          </div>
          <div className="val">
            <span className="num">{kpi.qty}</span> <small>Stk</small>
          </div>
          <div className="delta flat">Ø € {formatEuroCents(kpi.avgPrice)}</div>
        </div>

        <div className="card kpi">
          <div className="lab" title="Deckungsbeitrag II — nach EK, Versand &amp; eBay-Gebühren">
            Ø Marge DB II
          </div>
          <div className="val">
            <span className="num">{formatPercent(kpi.dbIIPercent)}</span>
            <small>%</small>
          </div>
          <div className="delta flat">Rohmarge DB I ≈ {formatPercent(kpi.dbIPercent)}%</div>
        </div>

        <div className="card kpi" style={{ borderColor: "var(--crit)" }}>
          <div className="lab" style={{ color: "var(--crit)" }}>
            Totes Kapital · Ladenhüter
          </div>
          <div className="val" style={{ color: "var(--crit)" }}>
            <span className="num">{formatPercent(deadCapital.percent)}</span>
            <small>%</small>
          </div>
          <div className="delta flat">
            {deadCapital.count} / {deadCapital.totalArticles} · 0 Verk. in 365 T
          </div>
        </div>
      </section>
    </>
  );
}
