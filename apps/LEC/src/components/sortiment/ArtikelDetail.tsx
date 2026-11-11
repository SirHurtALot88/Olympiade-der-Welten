"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SortimentRow } from "@/lib/dashboard/viewModel";
import { boardVk, cardmarketLink, cleanTitle, ebayLinks } from "@/lib/dashboard/board";
import { CopyCode } from "./CopyCode";
import { rarityFromTitle } from "@/lib/market/rarity";
import { formatEuroCents, formatPercent } from "@/lib/format";

/** Detail-Fenster zu einem Artikel: Preise, Verkaeufe, Einkauf, Bestand. Rein lesend. */

interface Detail {
  purchases: { date: string; qty: number; unitEk: number; buyShipping: number; source: string }[];
  sales: { soldAt: string; qty: number; unitPrice: number }[];
  reports: { from: string; to: string; qtySold: number; revenue: number; avgPrice: number }[];
  priceLog: { at: string; before: number; after: number }[];
  stockLog: { at: string; before: number; after: number }[];
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
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function setHidden(hidden: boolean) {
    setBusy(true);
    try {
      const r = await fetch(`/api/article-hide/${encodeURIComponent(row.articleId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hidden }),
      });
      if (r.ok) {
        router.refresh();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

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
  const consumed = new Map<object, number>();
  const movements = detail
    ? [
        ...detail.sales.map((x) => ({ at: x.soldAt, kind: "Verkauf", delta: -x.qty, note: row.currentEk != null && row.currentEk > 0 ? `EK ca. ${eur(row.currentEk)} je Stück` : "" })),
        ...detail.purchases.map((p) => ({ at: p.date, kind: "Einkauf", delta: p.qty, note: `gekauft zu ${eur(p.unitEk)} EK je Stück · ${p.source}` })),
        // Bestandsaenderungen laut Billbee nur, soweit Verkaeufe sie NICHT schon erklaeren (Zugang, Korrektur, Schwund).
        ...detail.stockLog
          .map((m) => {
            const delta = m.after - m.before;
            if (delta >= 0) return { at: m.at, kind: "Zugang (Einkauf/Korrektur)", delta, note: `Bestand ${m.before} → ${m.after}${row.currentEk != null && delta > 0 ? ` · ca. ${eur(delta * row.currentEk)} zum aktuellen EK` : ""}` };
            // Verkaeufe, die den Abgang erklaeren (3 Tage davor bis 1 Tag danach), werden verbraucht; nur der Rest bleibt "Abgang".
            const at = new Date(m.at).getTime();
            let rest = -delta;
            for (const x of detail.sales) {
              if (rest <= 0) break;
              const t = new Date(x.soldAt).getTime();
              if (t > at + 86_400_000 || t < at - 3 * 86_400_000 || consumed.get(x) === x.qty) continue;
              const take = Math.min(rest, x.qty - (consumed.get(x) ?? 0));
              consumed.set(x, (consumed.get(x) ?? 0) + take);
              rest -= take;
            }
            return rest > 0 ? { at: m.at, kind: "Abgang laut Billbee", delta: -rest, note: `Bestand ${m.before} → ${m.after}, nicht durch Verkäufe erklärt` } : null;
          })
          .filter((x): x is { at: string; kind: string; delta: number; note: string } => x !== null),
      ]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 25)
    : [];
  const lastChange = detail?.priceLog[0] ?? null;
    const soldSinceChange = lastChange && detail ? detail.sales.filter((x) => x.soldAt >= lastChange.at).reduce((sum, x) => sum + x.qty, 0) : 0;
  const chg = lastChange && detail ? (() => {
    const t0 = new Date(lastChange.at).getTime();
    const daysSince = Math.max(1, (Date.now() - t0) / 86_400_000);
    const before = detail.sales.filter((x) => { const t = new Date(x.soldAt).getTime(); return t < t0 && t >= t0 - 60 * 86_400_000; }).reduce((s, x) => s + x.qty, 0);
    const after = detail.sales.filter((x) => new Date(x.soldAt).getTime() >= t0).reduce((s, x) => s + x.qty, 0);
    return daysSince >= 7 ? { before: (before / 60) * 30, after: (after / daysSince) * 30, daysSince: Math.round(daysSince) } : null;
  })() : null;
  const lastSale = detail?.sales[0] ? Math.max(0, Math.floor((Date.now() - new Date(detail.sales[0].soldAt).getTime()) / 86_400_000)) : null;
  const mk = detail?.market;
  const lastSalePrice = detail?.sales[0] ?? null;
  const marketDir = mk && mk.avg7 != null && mk.avg30 != null && mk.avg30 > 0 ? (mk.avg7 > mk.avg30 * 1.05 ? { label: "↑ Markt steigt", tone: "good" as Tone } : mk.avg7 < mk.avg30 * 0.95 ? { label: "↓ Markt fällt", tone: "warn" as Tone } : { label: "→ Markt stabil", tone: undefined }) : null;
  const vkTone: Tone = !m?.rated ? undefined : m.status === "im_korridor" ? "good" : m.status === "zu_guenstig" ? "warn" : "info";
  const w30 = row.windows["30"]?.qty ?? 0;
  const w90 = row.windows["90"]?.qty ?? 0;
  const prev60 = w90 - w30;
  const trend: { label: string; tone: Tone } | null =
    w90 < 3 ? null : w30 / 30 > (prev60 / 60) * 1.25 ? { label: "↑ Verkäufe steigen", tone: "good" } : w30 / 30 < (prev60 / 60) * 0.75 ? { label: "↓ Verkäufe lassen nach", tone: "warn" } : { label: "→ stabil", tone: undefined };
  const noSale90 = row.stock > 0 && w90 === 0;
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
            {row.codeName.usedCode ? (
              <>
                Der Marktwert gilt für <b>{row.codeName.usedCode}</b>, den eindeutigen Code zum Namen (der Name wird als richtig angenommen).
              </>
            ) : (
              <>Es gibt keinen eindeutigen Code zum Namen, darum steht hier kein Marktwert und kein Urteil.</>
            )}
            <br />
            Den Code in Billbee und bei eBay korrigieren.
          </div>
        )}
        <EbayActions row={row} hidden={row.hidden === true} busy={busy} onToggleHidden={() => setHidden(row.hidden !== true)} />

        <section className="bd-dt-grid">
          <Stat tone={vkTone} label="Dein VK" value={vk > 0 ? eur(vk) : "—"} hint={row.listingVkSource === "ebay" ? "aus eBay (Stand des letzten Shop-Abrufs)" : row.listingVkSource === "billbee" ? "aus Billbee" : undefined} />
          <Stat label="Empfohlen" value={m?.targetMin != null && m.targetOpt != null ? `${formatEuroCents(m.targetMin)} – ${eur(m.targetOpt)}` : "—"} hint={m?.capped ? "mit Marktdeckel" : "25–33 % Marge"} />
          <Stat label="Marktwert" value={m?.value != null ? eur(m.value) : m?.range ? `${formatEuroCents(m.range.min)}–${eur(m.range.max)}` : "—"} hint="Ø aus Trend, 1, 7, 30 Tage und letztem EK" />
          <Stat
            tone={m?.margin == null ? undefined : m.margin < 0 ? "crit" : m.margin < 0.25 ? "warn" : "good"}
            label="Marge Nachkauf"
            value={m?.margin != null ? `${formatPercent(m.margin)} %` : "—"}
            hint={m?.value != null ? `Nachkauf zum Marktwert ${eur(m.value)}${row.ranks?.marge ? ` · Platz #${row.ranks.marge}/${row.ranks.total}` : ""}` : undefined}
          />
          <Stat tone={noSale90 ? "crit" : row.stockMonthsCover && row.stockMonthsCover > 12 ? "warn" : undefined} label="Bestand" value={row.stock > 0 ? `${row.stock} Stk` : "—"} hint={noSale90 ? "kein Verkauf in 90 Tagen" : row.stockMonthsCover ? `reicht ca. ${row.stockMonthsCover.toFixed(1).replace(".", ",")} Monate` : undefined} />
          <Stat tone={row.ekMissing ? "warn" : undefined} label="Ø EK" value={row.ekMissing ? "fehlt" : eur(row.ek)} hint={row.currentEk != null ? `Liste: ${eur(row.currentEk)}` : undefined} />
        </section>

        {m?.soldAt && (
          <p className={m.provenByDemand ? "bd-dt-good" : "bd-dt-note"}>
            <b>
              {m.soldAt.qty} {m.soldAt.qty === 1 ? "Verkauf" : "Verkäufe"} in {m.soldAt.days} Tagen im Schnitt für {eur(m.soldAt.avg)}
            </b>{" "}
            – {m.provenByDemand ? "der Markt nimmt diesen Preis, das Urteil „zu teuer“ entfällt." : "Preis wird gezahlt."}
          </p>
        )}

        {detail && (
          <p className="bd-dt-note">
            {lastChange ? (
              <>
                <b>Letzte VK-Änderung am {day(lastChange.at)}:</b> {eur(lastChange.before)} → {eur(lastChange.after)}
                {lastChange.after > lastChange.before ? " (erhöht)" : " (gesenkt)"} · seitdem {soldSinceChange} {soldSinceChange === 1 ? "Verkauf" : "Verkäufe"}.
                {chg && (
                  <>
                    {" "}
                    Tempo: {chg.before.toFixed(1).replace(".", ",")} Stk/Monat in den 60 Tagen davor, {chg.after.toFixed(1).replace(".", ",")} Stk/Monat in den {chg.daysSince} Tagen danach
                    {chg.before > 0 && chg.after < chg.before * 0.6 ? " – Absatz eingebrochen." : chg.before > 0 && chg.after >= chg.before * 0.9 ? " – Absatz gehalten." : "."}
                  </>
                )}
              </>
            ) : (
              <>Noch keine VK-Änderung erfasst – Billbee liefert keine Preishistorie, die App schreibt Änderungen ab jetzt bei jedem Abgleich mit.</>
            )}
            {lastSalePrice && vk > 0 && Math.abs(lastSalePrice.unitPrice - vk) > 0.01 && (
              <>
                {" "}
                Letzter Verkauf am {day(lastSalePrice.soldAt)} zu {eur(lastSalePrice.unitPrice)}, dein VK heute {eur(vk)}.
              </>
            )}
          </p>
        )}

        {row.today && (
          <Group id="heute" title="Was ein Verkauf heute bringt">
            <section className="bd-dt-grid today">
              <Stat
                tone={row.today.profitPerUnit < 0 ? "crit" : row.today.marginPct < 0.25 ? "warn" : "good"}
                label="Gewinn je Stück"
                value={`${eur(row.today.profitPerUnit)} · ${formatPercent(row.today.marginPct)} %`}
                hint={`${row.listingVk ? "heutiger VK" : "Ø-VK, kein Listenpreis"}, aktueller EK, vor Fixkosten`}
              />
              <Stat
                tone={row.today.perMonth != null && row.today.perMonth < 0 ? "crit" : undefined}
                label="Gewinn je Monat"
                value={row.today.perMonth != null ? eur(row.today.perMonth) : "—"}
                hint={row.perMonth ? `${row.perMonth.toFixed(1).replace(".", ",")} Stk/Monat${row.ranks?.gewinnMonat ? ` · Platz #${row.ranks.gewinnMonat}/${row.ranks.total}` : ""}` : "kein Absatz"}
              />
              <Stat
                label="Gebundenes Kapital"
                value={row.today.capitalBound != null ? eur(row.today.capitalBound) : "—"}
                hint={row.today.inStock != null ? `Bestand ergibt ${eur(row.today.inStock)} Gewinn` : undefined}
              />
              <Stat
                label="Max. EK für 25 %"
                value={row.today.maxEk25 != null ? eur(row.today.maxEk25) : "—"}
                hint={lastSale != null ? `letzter Verkauf vor ${lastSale} Tagen` : undefined}
                tone={lastSale != null && row.stock > 0 && lastSale > 90 ? "crit" : undefined}
              />
            </section>
          </Group>
        )}

        <Group id="verkaeufe" title="Verkäufe" extra={trend ? <span className={`bd-dt-trend${trend.tone ? ` ${trend.tone}` : ""}`}>{trend.label}</span> : null}>
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
                  <td className="r">{x ? x.qty : "—"}<RankTag n={row.ranks?.windows[w.key]?.qty} total={row.ranks?.total} /></td>
                  <td className="r">{x ? eur(x.revenue) : "—"}<RankTag n={row.ranks?.windows[w.key]?.revenue} total={row.ranks?.total} /></td>
                  <td className="r">{x ? eur(x.avgPrice) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </Group>

        {detail?.market && (
          <Group id="cardmarket" title="Cardmarket" extra={marketDir ? <span className={`bd-dt-trend${marketDir.tone ? ` ${marketDir.tone}` : ""}`}>{marketDir.label}</span> : null}>
            <table className="bd-dt-t">
              <tbody>
                <tr><td>Tiefstpreis</td><td className="r">{eur(detail.market.low)}</td></tr>
                <tr><td>Ø 1 / 7 / 30 Tage</td><td className="r">{eur(detail.market.avg1)} / {eur(detail.market.avg7)} / {eur(detail.market.avg30)}</td></tr>
                <tr><td>Trend</td><td className="r">{eur(detail.market.trend)}</td></tr>
                <tr><td>Stand</td><td className="r">{day(detail.market.fetchedAt)}</td></tr>
              </tbody>
            </table>
          </Group>
        )}

        <Group id="ergebnis" title="Ergebnis je Stück (historischer Schnitt)" defaultOpen={false}>
        <table className="bd-dt-t">
          <tbody>
            <tr><td>DB I (nach Wareneinsatz)</td><td className="r">{eur(row.dbIPerUnit)}</td></tr>
            <tr><td>DB II</td><td className="r">{eur(row.dbIIPerUnit)} · {formatPercent(row.dbIIPercent)} %</td></tr>
            <tr><td>DB III (mit Fixkosten)</td><td className="r">{eur(row.dbIIIPerUnit)} · {formatPercent(row.dbIIIPercent)} %</td></tr>
          </tbody>
        </table>
        </Group>

        {detail && detail.sales.length > 0 && (
          <Group id="letzte" title="Letzte Verkäufe" extra={<span className="bd-dt-trend"><span style={{ color: "var(--good)" }}>● 90 T</span> <span style={{ color: "var(--warn)" }}>● 365 T</span> <span style={{ color: "var(--crit)" }}>● älter</span></span>}>
            <table className="bd-dt-t">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th className="r">Stück</th>
                  <th className="r">Preis je Stück</th>
                </tr>
              </thead>
              <tbody>
                {detail.sales.slice(0, 15).map((x, i) => {
                  const age = (Date.now() - new Date(x.soldAt).getTime()) / 86_400_000;
                  const tone = age <= 90 ? "age-green" : age <= 365 ? "age-yellow" : "age-red";
                  return (
                    <tr key={i} className={tone} title={age <= 90 ? "in den letzten 90 Tagen" : age <= 365 ? "vor 91 bis 365 Tagen" : "vor mehr als 365 Tagen"}>
                      <td>{day(x.soldAt)}</td>
                      <td className="r">{x.qty}</td>
                      <td className="r">{eur(x.unitPrice)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {detail.sales.length > 15 && <p className="bd-fig-note">Die letzten 15 von {detail.sales.length} geladenen Verkäufen.</p>}
          </Group>
        )}

        <Group id="bewegungen" title="Warenbewegungen">
        {detail && movements.length === 0 && <p className="bd-none">Noch keine Bewegungen. Startbestand: {row.stock} Stk – Änderungen werden ab dem nächsten Billbee-Abgleich festgehalten.</p>}
        {movements.length > 0 && (
          <>
            <table className="bd-dt-t">
              <thead>
                <tr><th>Datum</th><th>Art</th><th className="r">Menge</th><th style={{ paddingLeft: 16 }}>Preis / Detail</th></tr>
              </thead>
              <tbody>
                {movements.map((x, i) => (
                  <tr key={i}>
                    <td>{day(x.at)}</td>
                    <td>{x.kind}</td>
                    <td className="r" style={{ whiteSpace: "nowrap", color: x.delta > 0 ? "var(--good)" : undefined }}>{x.delta > 0 ? "+" : "−"}{Math.abs(x.delta)} Stk</td>
                    <td style={{ paddingLeft: 16 }}>{x.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="bd-fig-note">Verkäufe stammen aus Billbee. Bestandsänderungen schreibt die App bei jedem Billbee-Abgleich selbst mit (Billbee liefert keine Lagerhistorie) und zeigt sie nur, soweit Verkäufe sie nicht erklären. Einkäufe gibt es nur, wenn sie importiert wurden.</p>
          </>
        )}
        </Group>

        <Group id="einkaeufe" title="Einkäufe">
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
        </Group>

        {detail && detail.reports.length > 0 && (
          <Group id="berichte" title="eBay-Verkaufsberichte" defaultOpen={false}>
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
          </Group>
        )}

      </aside>
    </div>
  );
}

/** Einklappbare Gruppe im Drawer; der Zustand bleibt je Gruppe im Browser gespeichert (localStorage). */
function Group({ id, title, extra, defaultOpen = true, children }: { id: string; title: string; extra?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const key = `lec.drawer.${id}`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const v = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      return v === "1" ? true : v === "0" ? false : defaultOpen;
    } catch {
      return defaultOpen;
    }
  });
  function toggle() {
    setOpen((o) => {
      try {
        window.localStorage.setItem(key, o ? "0" : "1");
      } catch {
        /* ohne Speicher bleibt es bei der Sitzung */
      }
      return !o;
    });
  }
  return (
    <section className="bd-grp">
      <button type="button" className="bd-grp-h" onClick={toggle} aria-expanded={open}>
        <span className="bd-grp-caret">{open ? "▾" : "▸"}</span>
        {title}
        {extra}
      </button>
      {open && children}
    </section>
  );
}

/** Platz unter allen aktiven Artikeln, klein neben der Zahl: #359/1000. */
function RankTag({ n, total }: { n?: number | null; total?: number }) {
  if (!n || !total) return null;
  return (
    <small className="bd-rank" title={`Platz ${n} von ${total} aktiven Artikeln`}>
      #{n}/{total}
    </small>
  );
}

type Tone = "good" | "warn" | "crit" | "info" | undefined;

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: Tone }) {
  return (
    <div className={`bd-dt-stat${tone ? ` ${tone}` : ""}`} title={hint}>
      <span>{label}</span>
      <b>{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function EbayActions({ row, hidden, busy, onToggleHidden }: { row: SortimentRow; hidden: boolean; busy: boolean; onToggleHidden: () => void }) {
  const l = ebayLinks(row);
  const cm = cardmarketLink(row, cleanTitle(row.nameRaw).pack);
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
      {cm && (
        <a className="chip" href={cm} target="_blank" rel="noopener noreferrer" title="Sucht die Karte bei Cardmarket (Sprache der Karte, ab NM)">
          Bei Cardmarket ansehen ↗
        </a>
      )}
      <button type="button" className="chip" onClick={onToggleHidden} disabled={busy} title={hidden ? "Artikel wieder in die Listen aufnehmen" : "Artikel aus allen Listen ausblenden (Daten bleiben erhalten)"}>
        {hidden ? "Wieder einblenden" : "Ausblenden"}
      </button>
    </div>
  );
}
