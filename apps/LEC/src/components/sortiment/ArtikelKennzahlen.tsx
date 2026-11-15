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
const day = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const KIND: Record<string, string> = { retoure: "Retoure", reklamation: "Reklamation", beschaedigt: "Beschädigt", verloren: "Verloren" };

/** Retouren, Reklamationen und Schwund erfassen (TODO.md Punkt 6); bewertet wird zum aktuellen EK. */
export function SchwundBlock({ articleId, losses }: { articleId: string; losses: LossRow[]; lossCost: number }) {
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
      <div className="bd-loss-form">
        <select className="chip" value={kind} onChange={(e) => setKind(e.target.value)} disabled={busy} aria-label="Art">
          {Object.entries(KIND).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input className="chip" type="number" min={1} max={999} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(999, Number(e.target.value) || 1)))} style={{ width: 64 }} aria-label="Stück" />
        <input className="chip" type="text" placeholder="Notiz" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} style={{ flex: 1, minWidth: 120 }} />
        <button
          type="button"
          className="chip"
          title="Speichert den Verlust mit dem heutigen EK."
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
                  {l.unitEk != null ? eur(l.unitEk * l.qty) : <span title="Beim Erfassen war kein EK hinterlegt, der Verlust zählt mit 0 €.">EK fehlt</span>}{" "}
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
