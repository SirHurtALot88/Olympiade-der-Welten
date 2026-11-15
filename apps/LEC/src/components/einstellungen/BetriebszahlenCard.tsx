"use client";

import { YEAR_FACTS, feeYearChecks, yearMetrics } from "@/lib/pricing/betriebszahlen";
import type { CostSettingsValues } from "@/lib/pricing/costSettings";
import { formatEuro, formatEuroCents } from "@/lib/format";

const eur0 = (v: number | null) => (v === null ? "—" : `${formatEuro(v)} €`);
const eur2 = (v: number | null) => (v === null ? "—" : `${formatEuroCents(v)} €`);
const num = (v: number | null) => (v === null ? "—" : v.toLocaleString("de-DE"));
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")} %`);
const dec = (v: number | null) => (v === null ? "—" : v.toFixed(2).replace(".", ","));

/** Betriebszahlen je Jahr (Einkauf, Verkauf, Verpackung/Versand) und die eBay-Gebuehren-Gegenprobe inkl. Shop-Abo. Zahlen von Chris, siehe betriebszahlen.ts. */
export function BetriebszahlenCard({ settings }: { settings: CostSettingsValues }) {
  const metrics = YEAR_FACTS.map((f) => ({ f, m: yearMetrics(f) }));
  const checks = feeYearChecks(YEAR_FACTS, settings);

  const rows: { label: string; hint: string; cell: (f: (typeof YEAR_FACTS)[number], m: ReturnType<typeof yearMetrics>) => string; bold?: boolean }[] = [
    { label: "Einkäufe", hint: "Einkaufsbestellungen laut Lexoffice-Belegen.", cell: (f) => num(f.purchaseOrders) },
    { label: "Einkaufssumme", hint: "Summe der Einkäufe (EK). 2026 bis 31.10.", cell: (f) => eur0(f.purchaseSum), bold: true },
    { label: "Ø Einkauf", hint: "Einkaufssumme geteilt durch Einkaufsbestellungen.", cell: (_f, m) => eur2(m.purchaseAvg) },
    { label: "Einkauf in % vom Umsatz", hint: "Einkaufssumme geteilt durch eBay-Umsatz. Einkäufe sind nicht der Wareneinsatz: Lageraufbau oder -abbau verzerrt einzelne Jahre. 2026: Umsatz auf den Zeitraum bis 31.10. gekürzt.", cell: (_f, m) => pct(m.purchaseQuote) },
    { label: "Verkäufe", hint: "Bestellungen laut Billbee (Auftragsdatum). 2026 bis 14.11.", cell: (f) => num(f.salesOrders) },
    { label: "Umsatz eBay", hint: "Gesamtumsatz laut eBay „Prüfen Sie Ihren Umsatz“. 2023 aus den Veränderungsraten zurückgerechnet.", cell: (f) => eur0(f.revenueEbay), bold: true },
    { label: "Stück", hint: "Verkaufte Stückzahl laut eBay. 2023 zurückgerechnet.", cell: (f) => num(f.pieces) },
    { label: "Ø Warenkorb", hint: "Billbee-Umsatz geteilt durch Bestellungen.", cell: (_f, m) => eur2(m.basket) },
    { label: "Artikel je Bestellung", hint: "Stück (eBay) geteilt durch Bestellungen (Billbee).", cell: (_f, m) => dec(m.itemsPerOrder) },
    { label: "Verpackung + Versand", hint: "Lexoffice „Kosten für Verpackung und Transport“ (Porto, Ausland, Einschreiben, Taschen, Toploader). 2026 bis 14.10. plus 65 € Taschen.", cell: (f) => eur0(f.packagingShipping) },
    { label: "… je Bestellung", hint: "Verpackung und Versand geteilt durch Verkaufsbestellungen.", cell: (_f, m) => eur2(m.packagingPerOrder) },
    { label: "… in % vom Umsatz", hint: "Verpackung und Versand geteilt durch eBay-Umsatz.", cell: (_f, m) => pct(m.packagingQuote) },
    { label: "Rest nach Kosten", hint: "eBay-Umsatz minus eBay-Verkaufskosten, Einkäufe, Verpackung und Versand. Grob: ohne übrige Fixkosten, Lager und Privatverkäufe.", cell: (_f, m) => eur0(m.rest), bold: true },
  ];

  return (
    <div className="card" style={{ padding: "15px 16px 16px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Betriebszahlen je Jahr</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Von dir genannt (Lexoffice, Billbee, eBay). Mit der Maus auf einen Namen kommt die Erklärung.</div>
      <div style={{ overflowX: "auto" }}>
        <table className="bd-dt-t" style={{ minWidth: 480, fontSize: 12 }}>
          <thead>
            <tr>
              <th />
              {metrics.map(({ f }) => (
                <th key={f.year} className="r" title={f.partialUntil ? `Teiljahr, Verkauf bis ${f.partialUntil}${f.purchaseUntil ? `, Einkauf bis ${f.purchaseUntil}` : ""}` : f.derived ? "teilweise zurückgerechnet" : undefined}>
                  {f.year}
                  {f.partialUntil ? "*" : f.derived ? "°" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} style={r.bold ? { fontWeight: 700 } : undefined}>
                <td title={r.hint}>{r.label}</td>
                {metrics.map(({ f, m }) => (
                  <td key={f.year} className="r">
                    {r.cell(f, m)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 6 }}>* Teiljahr (Verkauf bis 14.11., Einkauf bis 31.10.). ° aus Veränderungsraten zurückgerechnet.</div>

      <div style={{ fontSize: 12.5, fontWeight: 700, margin: "16px 0 4px" }}>eBay-Verkaufskosten: Modell gegen eBay</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Modell = Provision + Anzeigen + Fixgebühr + Shop-Abo ({eur0(settings.fixedYearlyEbayShop)}). eBay-Werte weichen von der EÜR ab (Verschiebungen, Privatverkäufe).</div>
      <table className="bd-dt-t" style={{ minWidth: 0 }}>
        <thead>
          <tr>
            <th>Jahr</th>
            <th className="r" title="Provision und Anzeigen auf den Umsatz plus Fixgebühr je Bestellung, aus den Kostensätzen">Modell</th>
            <th className="r">+ Shop-Abo</th>
            <th className="r">eBay</th>
            <th className="r">Abweichung</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.year}>
              <td>{c.year}</td>
              <td className="r">{eur0(c.modelFees)}</td>
              <td className="r">{eur0(c.modelTotal)} ({pct(c.modelTotal / c.revenue)})</td>
              <td className="r">{eur0(c.actual)} ({pct(c.actual / c.revenue)})</td>
              <td className="r">{c.diff >= 0 ? "+" : "−"}{eur0(Math.abs(c.diff))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
