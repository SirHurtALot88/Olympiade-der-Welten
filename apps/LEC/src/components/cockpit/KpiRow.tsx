import type { CockpitViewModel } from "@/lib/cockpit/viewModel";
import type { RunRateBand } from "@/lib/cockpit/bands";
import { eur, eurCents, pct, compact } from "./format";

/**
 * KPI-Leiste (COCKPIT_V2_KONZEPT §4 Module 1–5). Die "Sparkline" sind drei Run-Rate-Balken
 * (Ø/Monat in den Baendern 1–30 / 31–90 / 91–365 T) -- ehrlich aus den Fenstern abgeleitet,
 * keine erfundene Tagesreihe. Juengstes Band in Akzent, aeltere in Track-Grau.
 */
export function KpiRow({ vm }: { vm: CockpitViewModel }) {
  const w = vm.current;
  const isAll = vm.window === "all";
  const dbIIPct = w.revenue > 0 ? w.dbII / w.revenue : 0;
  const dbIPct = w.revenue > 0 ? w.dbI / w.revenue : 0;
  const dbIIIPct = w.revenue > 0 ? w.dbIII / w.revenue : 0;
  const gap = vm.ekGap;

  return (
    <section className="ck-kpis" aria-label="Kennzahlen">
      <Tile label="Umsatz" scope={vm.windowLabel} value={eur(w.revenue)} sub={`${w.articlesWithSales} Artikel mit Verkauf`}>
        <Bands bands={vm.bands.bands} pick={(b) => b.revenuePerMonth} unit="€" hide={isAll || !vm.bands.available} />
      </Tile>

      <Tile label="Verkäufe" scope={vm.windowLabel} value={w.qty.toLocaleString("de-DE")} unit="Stk" sub={`Ø VK ${eurCents(w.qty > 0 ? w.revenue / w.qty : 0)}`}>
        <Bands bands={vm.bands.bands} pick={(b) => b.qtyPerMonth} unit="Stk" hide={isAll || !vm.bands.available} />
      </Tile>

      <Tile label="Marge DB II" scope={vm.windowLabel} value={pct(dbIIPct, 1)} sub={`DB I ${pct(dbIPct, 1)} · DB II ${eur(w.dbII)}`}>
        <Bands bands={vm.bands.bands} pick={(b) => b.dbIIPerMonth} unit="€" hide={isAll || !vm.bands.available} />
      </Tile>

      <Tile
        label="Ergebnis DB III"
        scope={vm.windowLabel}
        value={eur(w.dbIII)}
        tone={w.qty === 0 ? undefined : w.dbIII >= 0 ? "good" : "crit"}
        sub={`${pct(dbIIIPct, 1)} vom Umsatz · nach Fixkostenanteil ${eur(w.fixedCostShare)}`}
      >
        <Bands bands={vm.bands.bands} pick={(b) => b.dbIIIPerMonth} unit="€" hide={isAll || !vm.bands.available} allowNegative />
      </Tile>

      <Tile
        label="EK fehlt"
        scope="Datenlücke"
        tone="warn"
        value={gap.missingActive.toLocaleString("de-DE")}
        unit="Artikel"
        sub={`${pct(gap.shareOfActive)} der ${gap.activeTotal.toLocaleString("de-DE")} aktiven · ${pct(gap.shareOfRevenue90)} des 90-T-Umsatzes (${eur(gap.revenue90Missing)})`}
      >
        <div className="ck-sub" style={{ marginTop: 8 }}>
          {gap.missingActiveWithSales90.toLocaleString("de-DE")} davon in 90 T verkauft — dort ist jede Marge eine Phantomzahl.
        </div>
      </Tile>
    </section>
  );
}

function Tile({
  label,
  scope,
  value,
  unit,
  sub,
  tone,
  children,
}: {
  label: string;
  scope: string;
  value: string;
  unit?: string;
  sub: string;
  tone?: "good" | "crit" | "warn";
  children?: React.ReactNode;
}) {
  return (
    <div className={`ck-card ck-tile${tone ? ` ck-${tone}` : ""}`}>
      <div className="ck-lab">
        {label} <span style={{ color: "var(--faint)", fontWeight: 500 }}>· {scope}</span>
      </div>
      <div className="ck-val">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <div className="ck-sub">{sub}</div>
      {children}
    </div>
  );
}

function Bands({
  bands,
  pick,
  unit,
  hide,
  allowNegative,
}: {
  bands: RunRateBand[];
  pick: (b: RunRateBand) => number;
  unit: string;
  hide: boolean;
  allowNegative?: boolean;
}) {
  if (hide) return <div className="ck-sub" style={{ marginTop: 8, color: "var(--faint)" }}>Ø/Monat-Vergleich nur für 30/90/365 T.</div>;
  const values = bands.map(pick);
  const max = Math.max(1e-9, ...values.map((v) => Math.abs(v)));
  // Reihenfolge links→rechts = alt→neu (91–365 · 31–90 · 1–30), damit die Leserichtung "zur Gegenwart" zeigt.
  const ordered = [2, 1, 0];
  return (
    <>
      <div className="ck-bands" aria-label="Ø je Monat in drei Zeitbändern">
        {ordered.map((i) => {
          const v = values[i];
          const h = Math.max(2, (Math.abs(v) / max) * 30);
          const neg = allowNegative && v < 0;
          return (
            <i
              key={bands[i].key}
              className={i === 0 ? "ck-now" : undefined}
              style={{ height: `${h}px`, ...(neg ? { background: "var(--crit)" } : {}) }}
              title={`${bands[i].longLabel}: Ø ${unit === "€" ? eur(v) : `${Math.round(v)} Stk`} je Monat`}
            />
          );
        })}
      </div>
      <div className="ck-bandlab">
        <span>Ø/Mon · 91–365 T</span>
        <span>{unit === "€" ? `€ ${compact(values[0])}` : `${Math.round(values[0])} Stk`} · 30 T</span>
      </div>
    </>
  );
}
