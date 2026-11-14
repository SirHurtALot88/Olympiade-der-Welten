"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatEuroCents } from "@/lib/format";
import type { FirstSale, OutOfStock, PriceEffect, SaleVsMarketSummary } from "@/lib/dashboard/kennzahlen";

export interface KennzahlenData {
  saleVsMarket: SaleVsMarketSummary;
  priceEffects: PriceEffect[];
  outOfStock: OutOfStock;
  firstSale: FirstSale;
  historyPoints: number;
}
export interface LossRow {
  id: string;
  at: string;
  kind: string;
  qty: number;
  unitEk: number | null;
  note: string | null;
}

const eur = (v: number | null | undefined) => (v == null ? "—" : `${formatEuroCents(v)} €`);
const de1 = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: 1 });
const day = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const VERDICT: Record<PriceEffect["verdict"], string> = { schneller: "läuft seitdem schneller", langsamer: "läuft seitdem langsamer", unveraendert: "ohne erkennbare Wirkung", zu_wenig_daten: "zu wenig Verkäufe für ein Urteil" };
const KIND: Record<string, string> = { retoure: "Retoure", reklamation: "Reklamation", beschaedigt: "Beschädigt", verloren: "Verloren" };

/** Kennzahlen, die Billbee nicht liefert (TODO.md Punkte 2 bis 5), im Drawer unter dem Artikel. */
export function ArtikelKennzahlen({ k }: { k: KennzahlenData }) {
  const m = k.saleVsMarket;
  const o = k.outOfStock;
  return (
    <table className="bd-dt-t bd-dt-kv">
      <tbody>
        <tr>
          <td>Verkaufspreis gegen Markt</td>
          <td className="r">
            {m.matched === 0
              ? k.historyPoints === 0
                ? "Verlauf beginnt mit dem nächsten Marktabruf"
                : "kein Verkauf mit Marktstand davor"
              : `${m.avgDiffPct! >= 0 ? "+" : ""}${de1(m.avgDiffPct!)} % (${m.matched} von ${m.total} Verkäufen) · ${eur(m.leftOnTable)} unter Markt`}
          </td>
        </tr>
        <tr>
          <td>Tage ohne Bestand</td>
          <td className="r">
            {Math.round(o.daysOut)} von {Math.round(o.daysOut + o.daysIn)} Tagen ({Math.round(o.outShare * 100)} %)
            {o.missedUnits !== null && o.missedUnits >= 0.5 ? ` · ca. ${de1(o.missedUnits)} Stk verpasst` : ""}
          </td>
        </tr>
        <tr>
          <td>Tempo mit Bestand</td>
          <td className="r">{o.perMonthInStock === null ? "—" : `${de1(o.perMonthInStock)} Stk/Monat`}</td>
        </tr>
        <tr>
          <td>Bis zum ersten Verkauf</td>
          <td className="r">{k.firstSale.waiting ? `noch keiner, seit ${k.firstSale.days} Tagen in LEC erfasst` : `${k.firstSale.days} Tage nach der Erfassung in LEC`}</td>
        </tr>
        {k.priceEffects.length === 0 ? (
          <tr>
            <td>Wirkung von Preisänderungen</td>
            <td className="r">keine Änderung ab 10 % mit 14 Tagen Nachlauf</td>
          </tr>
        ) : (
          k.priceEffects.slice(0, 3).map((e) => (
            <tr key={e.at}>
              <td>
                Preis {day(e.at)}: {eur(e.before)} → {eur(e.after)} ({e.pct >= 0 ? "+" : ""}
                {Math.round(e.pct)} %)
              </td>
              <td className="r">
                {VERDICT[e.verdict]} · vorher {de1(e.perMonthBefore)} → nachher {de1(e.perMonthAfter)} Stk/Monat
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

/** Retouren, Reklamationen und Schwund erfassen (TODO.md Punkt 6); bewertet wird zum aktuellen EK. */
export function SchwundBlock({ articleId, losses, lossCost }: { articleId: string; losses: LossRow[]; lossCost: number }) {
  const [kind, setKind] = useState("retoure");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    try {
      const r = await fetch(url, init);
      if (r.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="bd-dt-note" style={{ marginTop: 0 }}>
        Erfasste Verluste insgesamt: <b>{eur(lossCost)}</b> (zum EK bewertet). Sie ändern den Bestand nicht, den führt Billbee.
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
        <select className="chip" value={kind} onChange={(e) => setKind(e.target.value)} disabled={busy} aria-label="Art">
          {Object.entries(KIND).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input className="chip" type="number" min={1} max={999} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(999, Number(e.target.value) || 1)))} style={{ width: 64 }} aria-label="Stück" />
        <input className="chip" type="text" placeholder="Notiz (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} style={{ flex: 1, minWidth: 120 }} />
        <button
          type="button"
          className="chip bd-dt-primary"
          disabled={busy}
          onClick={() =>
            call(`/api/article-loss/${encodeURIComponent(articleId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, qty, note }) }).then(() => setNote(""))
          }
        >
          Erfassen
        </button>
      </div>
      {losses.length > 0 && (
        <table className="bd-dt-t bd-dt-kv">
          <tbody>
            {losses.map((l) => (
              <tr key={l.id}>
                <td>
                  {day(l.at)} · {KIND[l.kind] ?? l.kind} · {l.qty} Stk{l.note ? ` · ${l.note}` : ""}
                </td>
                <td className="r">
                  {l.unitEk != null ? eur(l.unitEk * l.qty) : "EK unbekannt"}{" "}
                  <button type="button" className="chip" disabled={busy} onClick={() => call(`/api/article-loss/${encodeURIComponent(articleId)}?lossId=${encodeURIComponent(l.id)}`, { method: "DELETE" })} title="Eintrag löschen">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
