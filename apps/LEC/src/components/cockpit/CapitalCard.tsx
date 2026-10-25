import type { CapitalFacts } from "@/lib/cockpit/capital";
import type { Planwerte } from "@/lib/cockpit/planwerte";
import { eur } from "./format";

/** Kapital & Tempo: was im Regal liegt, wie schnell es rausgeht, wie schnell Neues reinkommt. */
export function CapitalCard({ capital, planwerte }: { capital: CapitalFacts; planwerte: Planwerte }) {
  const c = capital;
  const rows: { label: string; value: number | null; color: string; hint: string }[] = [
    { label: "Verkaufstempo 30 T", value: c.wareneinsatzPerMonth30, color: "var(--ck-s2)", hint: "Wareneinsatz der letzten 30 Tage (Ø je Monat)" },
    { label: "Verkaufstempo 365 T", value: c.wareneinsatzPerMonth365, color: "var(--ck-s2)", hint: "Wareneinsatz Ø je Monat über 365 Tage" },
    { label: "Einkaufstempo 90 T", value: c.purchasePerMonth90, color: "var(--ck-s1)", hint: "Einkäufe der letzten 90 Tage (Ø je Monat) aus der Einkaufs-Tabelle" },
    { label: "Bisherige Einkaufsrate", value: planwerte.einkaufsrateNormalEurProMonat, color: "var(--faint)", hint: "Planwert, nur Vergleich" },
  ];
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));

  return (
    <section className="ck-card ck-c12" aria-label="Kapital und Tempo">
      <div className="ck-h">
        <h2>Kapital &amp; Tempo</h2>
        <span className="ck-scope">Bestand (Artikelstamm) · Wareneinsatz (Fenster) · Einkäufe (falls importiert)</span>
      </div>
      <div className="ck-body">
        {!c.stockImported ? (
          <div className="ck-empty">Kein Billbee-Artikelstamm importiert — Bestand und gebundenes Kapital sind unbekannt.</div>
        ) : (
          <div className="ck-facts">
            <Fact label="Gebundenes Kapital (EK)" value={eur(c.boundCapitalEk)} sub={`${c.articlesWithKnownCapital.toLocaleString("de-DE")} Artikel mit Bestand und bekanntem EK`} />
            <Fact
              label="Davon nicht bezifferbar"
              value={`${c.articlesStockWithoutEk.toLocaleString("de-DE")}`}
              unit="Artikel"
              sub={`${c.stockUnitsWithoutEk.toLocaleString("de-DE")} Stk auf Lager, EK unbekannt — fehlt oben`}
              tone="warn"
            />
            <Fact label="Potenzieller Umsatz (VK)" value={eur(c.potentialRevenueVk)} sub={`${c.stockUnits.toLocaleString("de-DE")} Stk × Listen-VK`} />
            <Fact
              label="Reichweite"
              value={c.reachMonths === null ? "—" : c.reachMonths.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
              unit={c.reachMonths === null ? undefined : "Monate"}
              sub="gebundenes Kapital ÷ Wareneinsatz je Monat (365 T)"
            />
          </div>
        )}
        <div className="ck-tempo" role="img" aria-label="Verkaufstempo gegen Einkaufstempo in Euro je Monat">
          {rows.map((r) => (
            <div key={r.label} style={{ display: "contents" }} title={`${r.hint}: ${r.value === null ? "keine Daten" : eur(r.value)}`}>
              <div style={{ color: "var(--muted)", fontWeight: 500 }}>
                {r.label}
                {r.label.startsWith("Bisherige") && <span className="ck-plan">Planwert</span>}
              </div>
              <div className="ck-tt">
                {r.value !== null && <i style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />}
              </div>
              <div className="ck-tv">{r.value === null ? "keine Daten" : `${eur(r.value)}/Mon`}</div>
            </div>
          ))}
        </div>
        <p className="ck-note">
          {c.purchasePerMonth90 === null
            ? "Einkäufe liefert derzeit kein Import — das Einkaufstempo bleibt leer, bis ein Cardmarket-/Billbee-Einkaufsexport eingelesen wird. "
            : ""}
          Liegt das Einkaufstempo über dem Verkaufstempo, wächst der Bestand — bei der EÜR mindert jeder Einkauf sofort den Jahresgewinn.
        </p>
      </div>
    </section>
  );
}

function Fact({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub: string; tone?: "warn" }) {
  return (
    <div className="ck-fact" style={tone === "warn" ? { borderColor: "var(--warn)" } : undefined}>
      <div className="ck-fl" style={tone === "warn" ? { color: "var(--warn)" } : undefined}>
        {label}
      </div>
      <div className="ck-fv">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      <div className="ck-fs">{sub}</div>
    </div>
  );
}
