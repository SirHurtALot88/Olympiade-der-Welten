"use client";

import { useEffect, useState } from "react";
import type { SortimentRow } from "@/lib/dashboard/viewModel";
import { boardVk, cleanTitle, ebayLinks } from "@/lib/dashboard/board";
import { CopyCode } from "./CopyCode";
import { rarityFromTitle } from "@/lib/market/rarity";
import { formatEuroCents, formatPercent } from "@/lib/format";

/** Detail-Fenster zu einem Artikel: Preise, Verkaeufe, Einkauf, Bestand. Rein lesend. */

interface Detail {
  purchases: { date: string; qty: number; unitEk: number; buyShipping: number; source: string }[];
  reports: { from: string; to: string; qtySold: number; revenue: number; avgPrice: number }[];
  market: { avg1: number | null; avg7: number | null; avg30: number | null; trend: number | null; low: number | null; fetchedAt: string } | null;
}

const eur = (v: number | null | undefined) => (v == null ? "—" : `${formatEuroCents(v)} €`);
const day = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const WINDOWS = [
  { key: "30", label: "30 Tage" },
  { key: "90", label: "90 Tage" },
  { key: "365", label: "365 Tage" },
  { key: "all", label: "Gesamt" },
] as const;

export function ArtikelDetail({ row, imageSrc, onClose }: { row: SortimentRow; imageSrc: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setFailed(false);
    fetch(`/api/article-detail/${encodeURIComponent(row.articleId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Detail) => alive && setDetail(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [row.articleId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const m = row.market;
  const clean = cleanTitle(row.nameRaw);
  const rarity = rarityFromTitle(row.nameRaw);
  const vk = boardVk(row);
  const bought = detail?.purchases.reduce((s, p) => s + p.qty, 0) ?? 0;
  const boughtCost = detail?.purchases.reduce((s, p) => s + p.qty * p.unitEk, 0) ?? 0;

  return (
    <div className="bd-dt-back" onClick={onClose}>
      <aside className="bd-dt" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Artikeldetails">
        <button type="button" className="bd-dt-x" onClick={onClose} aria-label="Schließen">
          ×
        </button>
        <header className="bd-dt-head">
          {imageSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageSrc} alt="" className="bd-dt-img" />
          )}
          <div>
            <h3>{clean.name || row.nameRaw}</h3>
            <div className="bd-sub">
              {row.setCode && <CopyCode setCode={row.setCode} withIcon />}
              {rarity && <span className="bd-rar">{rarity}</span>}
              {clean.pack > 1 && <span className="bd-rar bd-pack">{clean.pack}er-Pack</span>}
              {!row.active && <span className="bd-rar">ausgelaufen</span>}
            </div>
            <p className="bd-dt-full">{row.nameRaw}</p>
          </div>
        </header>

        {row.codeName?.mismatch && (
          <div className="bd-dt-warn">
            <b>Name und Set-Code passen nicht zusammen.</b>
            <br />
            Der Code {row.setCode} gehört zu <b>{row.codeName.de ?? row.codeName.en}</b>
            {row.codeName.de && row.codeName.en ? ` (${row.codeName.en})` : ""}. Der Titel nennt einen anderen Namen.
            {row.codeName.hint && (
              <>
                <br />
                Zum Namen im Titel passt: <b>{row.codeName.hint}</b>
              </>
            )}
            <br />
            Eines von beiden ist falsch. Der Marktwert hier gilt für die Karte zum Code. Titel oder Code in Billbee und bei eBay korrigieren.
          </div>
        )}
        <EbayActions row={row} />

        <section className="bd-dt-grid">
          <Stat label="Dein VK" value={vk > 0 ? eur(vk) : "—"} hint={row.listingVkSource === "ebay" ? "live aus eBay" : row.listingVkSource === "billbee" ? "aus Billbee" : undefined} />
          <Stat label="Empfohlen" value={m?.targetMin != null && m.targetOpt != null ? `${formatEuroCents(m.targetMin)} – ${eur(m.targetOpt)}` : "—"} hint={m?.capped ? "mit Marktdeckel" : "25–33 % Marge"} />
          <Stat label="Marktwert" value={m?.value != null ? eur(m.value) : m?.range ? `${formatEuroCents(m.range.min)}–${eur(m.range.max)}` : "—"} hint="Cardmarket Ø 7 Tage" />
          <Stat label="Marge bei Nachkauf" value={m?.margin != null ? `${formatPercent(m.margin)} %` : "—"} />
          <Stat label="Bestand" value={row.stock > 0 ? `${row.stock} Stk` : "—"} hint={row.stockMonthsCover ? `reicht ca. ${row.stockMonthsCover.toFixed(1).replace(".", ",")} Monate` : undefined} />
          <Stat label="Ø EK" value={row.ekMissing ? "fehlt" : eur(row.ek)} hint={row.currentEk != null ? `Liste: ${eur(row.currentEk)}` : undefined} />
        </section>

        <h4>Verkäufe</h4>
        <table className="bd-dt-t">
          <thead>
            <tr>
              <th />
              <th className="r">Stück</th>
              <th className="r">Umsatz</th>
              <th className="r">Ø Preis</th>
            </tr>
          </thead>
          <tbody>
            {WINDOWS.map((w) => {
              const x = row.windows[w.key];
              return (
                <tr key={w.key}>
                  <td>{w.label}</td>
                  <td className="r">{x ? x.qty : "—"}</td>
                  <td className="r">{x ? eur(x.revenue) : "—"}</td>
                  <td className="r">{x ? eur(x.avgPrice) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h4>Ergebnis je Stück</h4>
        <table className="bd-dt-t">
          <tbody>
            <tr><td>DB I (nach Gebühren)</td><td className="r">{eur(row.dbIPerUnit)}</td></tr>
            <tr><td>DB II</td><td className="r">{eur(row.dbIIPerUnit)} · {formatPercent(row.dbIIPercent)} %</td></tr>
            <tr><td>DB III (mit Fixkosten)</td><td className="r">{eur(row.dbIIIPerUnit)} · {formatPercent(row.dbIIIPercent)} %</td></tr>
          </tbody>
        </table>

        <h4>Einkäufe</h4>
        {failed && <p className="bd-none">Details konnten nicht geladen werden.</p>}
        {!detail && !failed && <p className="bd-none">Lädt …</p>}
        {detail && detail.purchases.length === 0 && <p className="bd-none">Keine Einkäufe importiert.</p>}
        {detail && detail.purchases.length > 0 && (
          <>
            <p className="bd-dt-sum">
              {bought} Stk eingekauft für {eur(boughtCost)} · Ø {eur(boughtCost / Math.max(1, bought))}
            </p>
            <table className="bd-dt-t">
              <thead>
                <tr><th>Datum</th><th className="r">Stück</th><th className="r">EK</th><th>Quelle</th></tr>
              </thead>
              <tbody>
                {detail.purchases.map((p, i) => (
                  <tr key={i}>
                    <td>{day(p.date)}</td>
                    <td className="r">{p.qty}</td>
                    <td className="r">{eur(p.unitEk)}</td>
                    <td>{p.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {detail && detail.reports.length > 0 && (
          <>
            <h4>eBay-Verkaufsberichte</h4>
            <table className="bd-dt-t">
              <thead>
                <tr><th>Zeitraum</th><th className="r">Stück</th><th className="r">Ø Preis</th></tr>
              </thead>
              <tbody>
                {detail.reports.map((r, i) => (
                  <tr key={i}>
                    <td>{day(r.from)} – {day(r.to)}</td>
                    <td className="r">{r.qtySold}</td>
                    <td className="r">{eur(r.avgPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="bd-fig-note">Verkaufsdaten liegen nur je Berichtszeitraum vor, nicht je Einzelverkauf.</p>
          </>
        )}

        {detail?.market && (
          <>
            <h4>Cardmarket</h4>
            <table className="bd-dt-t">
              <tbody>
                <tr><td>Tiefstpreis</td><td className="r">{eur(detail.market.low)}</td></tr>
                <tr><td>Ø 1 / 7 / 30 Tage</td><td className="r">{eur(detail.market.avg1)} / {eur(detail.market.avg7)} / {eur(detail.market.avg30)}</td></tr>
                <tr><td>Trend</td><td className="r">{eur(detail.market.trend)}</td></tr>
                <tr><td>Stand</td><td className="r">{day(detail.market.fetchedAt)}</td></tr>
              </tbody>
            </table>
          </>
        )}
      </aside>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bd-dt-stat">
      <span>{label}</span>
      <b>{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function EbayActions({ row }: { row: SortimentRow }) {
  const l = ebayLinks(row);
  return (
    <div className="bd-dt-actions">
      {l.revise && (
        <a className="chip bd-dt-primary" href={l.revise} target="_blank" rel="noopener noreferrer" title="Öffnet das Bearbeiten-Formular des Angebots bei eBay">
          Preis bei eBay ändern ↗
        </a>
      )}
      <a className="chip" href={l.view ?? l.search} target="_blank" rel="noopener noreferrer">
        {l.view ? "Angebot ansehen ↗" : "Im eBay-Shop suchen ↗"}
      </a>
    </div>
  );
}
