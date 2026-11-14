"use client";

import { SchwundBlock, type KennzahlenData, type LossRow } from "./ArtikelKennzahlen";
import { SORTIMENT_LABEL } from "@/lib/dashboard/lifecycle";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SortimentRow } from "@/lib/dashboard/viewModel";
import { boardVk, cardmarketLink, cleanTitle, ebayLinks } from "@/lib/dashboard/board";
import { CopyCode } from "./CopyCode";
import { rarityFromTitle } from "@/lib/market/rarity";
import { conditionOf } from "@/lib/market/condition";
import { formatEuroCents, formatPercent } from "@/lib/format";
import { monthlyBars, salesPattern, type PriceEffect } from "@/lib/dashboard/kennzahlen";

/** Detail-Fenster zu einem Artikel: Preise, Verkaeufe, Einkauf, Bestand. Rein lesend. */

interface Detail {
  kennzahlen: KennzahlenData | null;
  losses: LossRow[];
  lossCost: number;
  purchases: { date: string; qty: number; unitEk: number; buyShipping: number; source: string }[];
  sales: { soldAt: string; qty: number; unitPrice: number }[];
  reports: { from: string; to: string; qtySold: number; revenue: number; avgPrice: number }[];
  priceLog: { at: string; before: number; after: number }[];
  stockLog: { at: string; before: number; after: number }[];
  ekLog: { at: string; before: number; after: number }[];
  market: { avg1: number | null; avg7: number | null; avg30: number | null; trend: number | null; low: number | null; fetchedAt: string } | null;
}

const eur = (v: number | null | undefined) => (v == null ? "—" : `${formatEuroCents(v)} €`);
const day = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const dm = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
const de1 = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: 1 });
const WINDOWS = [
  { key: "30", label: "30 T" },
  { key: "90", label: "90 T" },
  { key: "365", label: "365 T" },
  { key: "all", label: "Gesamt" },
] as const;
const PRICE_VERDICT: Record<PriceEffect["verdict"], string> = { schneller: "seitdem schneller", langsamer: "seitdem langsamer", unveraendert: "ohne Wirkung", zu_wenig_daten: "zu wenig Daten" };
const MOVE_KIND = { zugang: "Zugang", abgang: "Abgang ungeklärt", abgleich: "Abgleich", einkauf: "Einkauf" } as const;

export function ArtikelDetail({ row, imageSrc, onClose }: { row: SortimentRow; imageSrc: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const [snoozeDays, setSnoozeDays] = useState(90);
  async function setSnooze(days: number | null) {
    setBusy(true);
    try {
      const r = await fetch(`/api/article-reorder/${encodeURIComponent(row.articleId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ days }),
      });
      if (r.ok) {
        router.refresh();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  async function setDelist(marked: boolean) {
    setBusy(true);
    try {
      const r = await fetch(`/api/article-delist/${encodeURIComponent(row.articleId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ marked }),
      });
      if (r.ok) {
        router.refresh();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

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
  const k = detail?.kennzahlen ?? null;
  const sales = detail?.sales ?? [];
  const mk = detail?.market ?? null;
  const lastSale = sales[0] ?? null;
  const lastSaleDays = lastSale ? Math.max(0, Math.floor((Date.now() - new Date(lastSale.soldAt).getTime()) / 86_400_000)) : null;
  const w30 = row.windows["30"]?.qty ?? 0;
  const w90 = row.windows["90"]?.qty ?? 0;
  const prev60 = w90 - w30;
  const trend: { label: string; tone: Tone } | null =
    w90 < 3 ? null : w30 / 30 > (prev60 / 60) * 1.25 ? { label: "↑ steigen", tone: "good" } : w30 / 30 < (prev60 / 60) * 0.75 ? { label: "↓ lassen nach", tone: "warn" } : { label: "→ stabil", tone: undefined };
  const marketDir = mk && mk.avg7 != null && mk.avg30 != null && mk.avg30 > 0 ? (mk.avg7 > mk.avg30 * 1.05 ? { label: "↑ steigt", tone: "good" as Tone } : mk.avg7 < mk.avg30 * 0.95 ? { label: "↓ fällt", tone: "warn" as Tone } : { label: "→ stabil", tone: undefined }) : null;
  const noSale90 = row.stock > 0 && w90 === 0;
  const pattern = salesPattern(sales);
  const bars = monthlyBars(sales);
  const maxBar = Math.max(1, ...bars.map((b) => b.qty));

  // Lagerbewegungen ohne Verkaeufe: Zugaenge, Einkaeufe, nicht durch Verkaeufe erklaerte Abgaenge (Zuordnung: 3 Tage davor bis 1 Tag danach)
  const consumed = new Map<object, number>();
  type Move = { at: string; kind: (typeof MOVE_KIND)[keyof typeof MOVE_KIND]; delta: number; note: string; tip: string };
  const moves: Move[] = detail
    ? [
        ...detail.purchases.map((p): Move => ({ at: p.date, kind: MOVE_KIND.einkauf, delta: p.qty, note: `${eur(p.unitEk)} · ${p.source}`, tip: "Importierter Einkauf: EK je Stück und Quelle." })),
        ...detail.stockLog
          .map((s): Move | null => {
            const delta = s.after - s.before;
            if (delta === 0) return { at: s.at, kind: MOVE_KIND.abgleich, delta, note: `${s.before} → ${s.after}`, tip: "Billbee-Abgleich ohne Mengenänderung." };
            if (delta > 0) return { at: s.at, kind: MOVE_KIND.zugang, delta, note: `${s.before} → ${s.after}`, tip: `Bestand laut Billbee gestiegen (Einkauf oder Korrektur)${row.currentEk != null ? `, ca. ${eur(delta * row.currentEk)} zum aktuellen EK` : ""}.` };
            const at = new Date(s.at).getTime();
            let rest = -delta;
            for (const x of detail.sales) {
              if (rest <= 0) break;
              const t = new Date(x.soldAt).getTime();
              if (t > at + 86_400_000 || t < at - 3 * 86_400_000 || consumed.get(x) === x.qty) continue;
              const take = Math.min(rest, x.qty - (consumed.get(x) ?? 0));
              consumed.set(x, (consumed.get(x) ?? 0) + take);
              rest -= take;
            }
            return rest > 0 ? { at: s.at, kind: MOVE_KIND.abgang, delta: -rest, note: `${s.before} → ${s.after}`, tip: "Bestand laut Billbee gesunken, ohne passenden Verkauf (3 Tage davor bis 1 Tag danach)." } : null;
          })
          .filter((x): x is Move => x !== null),
      ]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 25)
    : [];
  const bought = detail?.purchases.reduce((s, p) => s + p.qty, 0) ?? 0;
  const boughtCost = detail?.purchases.reduce((s, p) => s + p.qty * p.unitEk, 0) ?? 0;

  // Letzte Preisaenderung grob (60 Tage davor gegen die Tage danach): nur fuer den Hover der Zeile "Preis"
  const lastChange = detail?.priceLog[0] ?? null;
  const chg =
    lastChange && detail
      ? (() => {
          const t0 = new Date(lastChange.at).getTime();
          const daysSince = Math.max(1, (Date.now() - t0) / 86_400_000);
          const before = detail.sales.filter((x) => { const t = new Date(x.soldAt).getTime(); return t < t0 && t >= t0 - 60 * 86_400_000; }).reduce((s, x) => s + x.qty, 0);
          const after = detail.sales.filter((x) => new Date(x.soldAt).getTime() >= t0).reduce((s, x) => s + x.qty, 0);
          return daysSince >= 7 ? { before: (before / 60) * 30, after: (after / daysSince) * 30, daysSince: Math.round(daysSince), sold: after } : null;
        })()
      : null;
  const effect = k?.priceEffects[0] ?? null;

  // Entscheidungszeile
  const priceWord = !m?.rated ? "kein Urteil" : m.status === "im_korridor" ? "passt" : m.status === "zu_guenstig" ? "zu günstig" : "zu teuer";
  const priceTone: Tone = !m?.rated ? undefined : m.status === "im_korridor" ? "good" : m.status === "zu_guenstig" ? "warn" : "info";
  const sortimentTone: Tone = !row.sortiment ? undefined : row.sortiment.status === "auslisten" ? "crit" : row.sortiment.status === "behalten" ? "good" : "warn";
  const reorderTip =
    row.reorderReason === "mindestbestand"
      ? `Bestand ${row.stock} liegt auf oder unter dem Mindestbestand ${row.minStock}.${row.stockMonthsCover ? ` Reichweite ca. ${de1(row.stockMonthsCover)} Monate.` : ""}`
      : row.reorderReason === "ausverkauft"
        ? "Ausverkauft, der Artikel verkauft sich."
        : `Reichweite nur noch ca. ${de1(row.stockMonthsCover ?? 0)} Monate.`;

  const ageDot = (iso: string) => {
    const age = (Date.now() - new Date(iso).getTime()) / 86_400_000;
    return age <= 90 ? "var(--good)" : age <= 365 ? "var(--warn)" : "var(--crit)";
  };

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
            <h3 title={`Titel in Billbee: ${row.nameRaw}`}>{clean.name || row.nameRaw}</h3>
            <div className="bd-sub">
              {row.setCode && <CopyCode setCode={row.setCode} withIcon />}
              {rarity && <span className="bd-rar">{rarity}</span>}
              <span className="bd-rar" title="Zustand laut Titel">{m?.condition ?? conditionOf(row.nameRaw)}</span>
              {clean.pack > 1 && <span className="bd-rar bd-pack">{clean.pack}er-Pack</span>}
              {!row.active && <span className="bd-rar">ausgelaufen</span>}
            </div>
          </div>
        </header>

        {row.codeName?.mismatch && (
          <div
            className="bd-dt-warn"
            title={`Der Titel nennt einen anderen Namen.${row.codeName.hint ? ` Zum Namen im Titel passt: ${row.codeName.hint}.` : ""} ${
              row.codeName.usedCode ? `Der Marktwert gilt für ${row.codeName.usedCode}, den eindeutigen Code zum Namen (der Name wird als richtig angenommen).` : "Es gibt keinen eindeutigen Code zum Namen, darum steht hier kein Marktwert und kein Urteil."
            }`}
          >
            <b>Code {row.setCode} gehört zu {row.codeName.de ?? row.codeName.en}.</b>
            <br />
            In Billbee und bei eBay korrigieren.
          </div>
        )}
        <EbayActions row={row} hidden={row.hidden === true} busy={busy} onToggleHidden={() => setHidden(row.hidden !== true)} onToggleDelist={() => setDelist(!row.delistMarkedAt)} />

        <section className="bd-dec" aria-label="Entscheidung">
          <div className={`bd-dec-f${priceTone ? ` ${priceTone}` : ""}`} title={m?.targetMin != null && m.targetOpt != null ? `Dein VK ${eur(vk)} gegen die Zielspanne ${eur(m.targetMin)} – ${eur(m.targetOpt)}. Zu günstig liegt unter, zu teuer über der Spanne.${m.soldAt ? ` ${m.soldAt.qty} ${m.soldAt.qty === 1 ? "Verkauf" : "Verkäufe"} in ${m.soldAt.days} Tagen im Schnitt für ${eur(m.soldAt.avg)}.${m.provenByDemand ? " Der Markt nimmt diesen Preis, das Urteil „zu teuer“ entfällt." : ""}` : ""}` : undefined}>
            <span>Preis</span>
            <b>{priceWord}</b>
            {m?.soldAt && <small>{m.provenByDemand ? "vom Markt bestätigt" : "wird gezahlt"}</small>}
          </div>
          <div className={`bd-dec-f${row.reorderDue ? " crit" : ""}`} title={row.reorderDue ? reorderTip : row.reorderSkipReason ?? undefined}>
            <span>Lager</span>
            {row.reorderDue ? (
              <>
                <b>{row.reorderQty ?? 1} Stk nachbestellen</b>
                <div className="bd-dec-act">
                  <button type="button" className="chip" disabled={busy} onClick={() => void setSnooze(snoozeDays)} title="Du hast den Artikel geprüft und willst ihn jetzt nicht nachbestellen: er verschwindet für die gewählte Zeit aus „Nachbestellen fällig“ und den Empfehlungen.">
                    Zurückstellen
                  </button>
                  <select value={snoozeDays} onChange={(e) => setSnoozeDays(Number(e.target.value))} aria-label="Zurückstellen für">
                    <option value={30}>30 T</option>
                    <option value={60}>60 T</option>
                    <option value={90}>90 T</option>
                    <option value={180}>180 T</option>
                  </select>
                </div>
              </>
            ) : row.reorderSnoozedUntil ? (
              <>
                <b>zurückgestellt bis {day(row.reorderSnoozedUntil)}</b>
                <div className="bd-dec-act">
                  <button type="button" className="chip" disabled={busy} onClick={() => void setSnooze(null)} title="Nachbestellen ist bis zum Datum ausgesetzt. „Aktivieren“ nimmt den Artikel wieder in die Empfehlungen.">
                    Aktivieren
                  </button>
                </div>
              </>
            ) : (
              <b>{row.reorderSkipReason ? "kein Nachkauf" : row.stock > 0 ? (row.stockMonthsCover ? `reicht ${de1(row.stockMonthsCover)} Monate` : `${row.stock} Stk, kein Tempo`) : "kein Bestand"}</b>
            )}
          </div>
          <div className={`bd-dec-f${sortimentTone ? ` ${sortimentTone}` : ""}`} title={row.sortiment ? `${row.sortiment.reason}${row.daysAtPrice != null ? ` Seit ${row.daysAtPrice} Tagen am aktuellen Preis.` : ""}` : undefined}>
            <span>Sortiment</span>
            <b>{row.sortiment ? SORTIMENT_LABEL[row.sortiment.status] : "—"}</b>
          </div>
        </section>

        <section className="bd-dt-grid">
          <Stat
            label="Dein VK"
            value={vk > 0 ? eur(vk) : "—"}
            sub={row.listingVkSource === "ebay" ? "aus eBay" : row.listingVkSource === "billbee" ? "aus Billbee" : undefined}
            info={row.listingVkSource === "ebay" ? "Preis aus eBay, Stand des letzten Shop-Abrufs." : row.listingVkSource === "billbee" ? "Preis aus dem Billbee-Artikelstamm." : undefined}
          />
          <Stat
            label="Zielspanne"
            value={m?.targetMin != null && m.targetOpt != null ? `${formatEuroCents(m.targetMin)} – ${eur(m.targetOpt)}` : "—"}
            sub={m?.staleDiscount ? `−${Math.round(m.staleDiscount * 100)} % Ladenhüter` : m?.capped ? "mit Marktdeckel" : m?.dynamicVk != null ? `dynamisch ${eur(m.dynamicVk)}` : undefined}
            info={[
              "Spanne für 25 bis 33 % Marge auf deinen EK. Preise auf ,99 setzen.",
              m?.capped ? "Oben begrenzt durch den Marktwert." : null,
              m?.staleDiscount ? `Um ${Math.round(m.staleDiscount * 100)} % gesenkt, weil seit ${m.daysSinceSale} Tagen kein Verkauf.` : null,
              m?.dynamicVk != null ? `Dynamischer VK ${eur(m.dynamicVk)}: ${m.dynamicNote ?? ""}.` : null,
            ].filter(Boolean).join(" ")}
          />
          <Stat
            label="Marktwert"
            value={m?.value != null ? eur(m.value) : m?.range ? `${formatEuroCents(m.range.min)}–${eur(m.range.max)}` : "—"}
            sub={m?.conditionFactor && m.conditionFactor < 1 ? `${m.condition} · ${Math.round(m.conditionFactor * 100)} % von NM` : "Cardmarket"}
            info={`Durchschnitt aus Trend, Ø 1, 7 und 30 Tage, ab (zählt doppelt) und letztem EK.${m?.conditionFactor && m.conditionFactor < 1 ? ` Zustand ${m.condition}: ${Math.round(m.conditionFactor * 100)} % vom NM-Preis (EX 85, GD 70, LP 60, PL 45, Poor 30 %).` : ""}`}
          />
          <Stat
            tone={m?.margin == null ? undefined : m.margin < 0 ? "crit" : m.margin < 0.25 ? "warn" : "good"}
            label="Marge Nachkauf"
            value={m?.margin != null ? `${formatPercent(m.margin)} %` : "—"}
            sub={row.ranks?.marge ? `Platz #${row.ranks.marge}` : undefined}
            info={m?.value != null ? `Marge deines VK, wenn du die Karte zum Marktwert ${eur(m.value)} nachkaufst.${row.ranks?.marge ? ` Platz ${row.ranks.marge} von ${row.ranks.total} aktiven Artikeln.` : ""} Unter 25 % gelb, unter 0 rot.` : undefined}
          />
          <Stat
            tone={row.today ? (row.today.profitPerUnit < 0 ? "crit" : row.today.marginPct < 0.25 ? "warn" : "good") : undefined}
            label="Gewinn/Stück"
            value={row.today ? `${eur(row.today.profitPerUnit)} · ${formatPercent(row.today.marginPct)} %` : "—"}
            sub="vor Fixkosten"
            info={`Heutiger VK minus eBay-Gebühren, Versand und Verpackung minus aktueller EK.${row.today && !row.listingVk ? " Gerechnet mit dem Ø-VK, weil kein Listenpreis vorliegt." : ""}`}
          />
          <Stat
            tone={row.today?.perMonth != null && row.today.perMonth < 0 ? "crit" : undefined}
            label="Gewinn/Monat"
            value={row.today?.perMonth != null ? eur(row.today.perMonth) : "—"}
            sub={row.perMonth ? `${de1(row.perMonth)} Stk/Monat${row.ranks?.gewinnMonat ? ` · #${row.ranks.gewinnMonat}` : ""}` : "kein Absatz"}
            info={`Gewinn je Stück mal Verkaufstempo.${row.ranks?.gewinnMonat ? ` Platz ${row.ranks.gewinnMonat} von ${row.ranks.total} aktiven Artikeln.` : ""}`}
          />
          <Stat
            tone={row.reorderDue || noSale90 ? "crit" : row.stockMonthsCover && row.stockMonthsCover > 12 ? "warn" : undefined}
            label="Bestand"
            value={row.stock > 0 ? `${row.stock} Stk` : "0 Stk"}
            sub={row.stockMonthsCover ? `reicht ${de1(row.stockMonthsCover)} Monate` : row.stock > 0 ? (noSale90 ? "kein Verkauf in 90 T" : "kein Verkaufstempo") : undefined}
            info={`Bestand geteilt durch Verkaufstempo.${row.minStock ? ` Mindestbestand ${row.minStock}${row.desiredStock ? `, Soll ${row.desiredStock}` : ""} laut Billbee.` : ""}`}
          />
          <Stat
            tone={row.ekMissing ? "warn" : undefined}
            label="Ø EK"
            value={row.ekMissing ? "fehlt" : eur(row.ek)}
            sub={row.lastEkAt ? `seit ${Math.max(0, Math.floor((Date.now() - Date.parse(row.lastEkAt)) / 86_400_000))} T unverändert` : undefined}
            info={row.ekMissing ? "Kein EK hinterlegt, Gewinn und Marge können nicht gerechnet werden." : `Durchschnittlicher Einkaufspreis je Stück.${row.currentEk != null ? ` EK laut Billbee-Liste: ${eur(row.currentEk)}.` : ""}${row.lastEkAt ? ` Zuletzt vor ${Math.max(0, Math.floor((Date.now() - Date.parse(row.lastEkAt)) / 86_400_000))} Tagen geändert oder gekauft.` : ""}`}
          />
        </section>
        {failed && <p className="bd-none">Details konnten nicht geladen werden.</p>}
        {!detail && !failed && <p className="bd-none">Lädt …</p>}

        {detail?.market && (
          <Group id="markt" title="Markt" info={`Cardmarket-Preise vom ${day(detail.market.fetchedAt)}. Steigt oder fällt: Ø 7 Tage liegt mehr als 5 % über oder unter Ø 30 Tage.`} extra={<>{marketDir && <span className={`bd-dt-trend${marketDir.tone ? ` ${marketDir.tone}` : ""}`}>{marketDir.label}</span>}<span className="bd-grp-x">Stand {dm(detail.market.fetchedAt)}</span></>}>
            <table className="bd-dt-t">
              <tbody>
                <Row label="ab ×2" tip="Günstigstes Angebot bei Cardmarket. Zählt doppelt im Marktwert, wenn plausibel." value={eur(detail.market.low)} warn />
                <Row label="Ø 1 / 7 / 30 Tage" tip="Durchschnittlicher Verkaufspreis bei Cardmarket der letzten 1, 7 und 30 Tage." value={`${eur(detail.market.avg1)} / ${eur(detail.market.avg7)} / ${eur(detail.market.avg30)}`} />
                <Row label="Trend" tip="Trendpreis laut Cardmarket." value={eur(detail.market.trend)} />
                {k && (
                  <Row
                    label="Verkauft gegen Markt"
                    tip={`Dein Verkaufspreis gegen den Marktstand am Verkaufstag, gemittelt über die Verkäufe mit bekanntem Marktstand.${k.saleVsMarket.matched > 0 ? ` Unter Markt verschenkt: ${eur(k.saleVsMarket.leftOnTable)}.` : ""} ${k.saleVsMarket.matched === 0 ? (k.historyPoints === 0 ? "Der Marktverlauf wird erst seit dem 13.11.2026 je Abruf gespeichert." : "Kein Verkauf, vor dem schon ein Marktstand gespeichert war.") : ""}`}
                    value={k.saleVsMarket.matched === 0 ? (k.historyPoints === 0 ? "ab nächstem Abruf" : "noch kein Vergleich") : `${k.saleVsMarket.avgDiffPct! >= 0 ? "+" : ""}${de1(k.saleVsMarket.avgDiffPct!)} % · ${k.saleVsMarket.matched} von ${k.saleVsMarket.total}`}
                  />
                )}
              </tbody>
            </table>
          </Group>
        )}

        <Group id="verkaeufe" title="Verkäufe" info={`Tempo der letzten 30 Tage gegen die 60 Tage davor; ab 25 % Unterschied steigt oder fällt es.${lastSaleDays != null ? ` Letzter Verkauf vor ${lastSaleDays} Tagen.` : ""}`} extra={<>{trend && <span className={`bd-dt-trend${trend.tone ? ` ${trend.tone}` : ""}`}>{trend.label}</span>}{lastSale && <span className={`bd-grp-x${lastSaleDays != null && lastSaleDays > 90 && row.stock > 0 ? " crit" : ""}`}>zuletzt {day(lastSale.soldAt)} · {eur(lastSale.unitPrice)}</span>}</>}>
          {bars.some((b) => b.qty > 0) && (
            <svg className="bd-bars" viewBox="0 0 240 44" role="img" aria-label="Verkaufte Stück je Monat, letzte 12 Monate" preserveAspectRatio="none">
              {bars.map((b, i) => (
                <g key={b.label}>
                  <title>{`${b.label}: ${b.qty} Stk`}</title>
                  <rect x={i * 20 + 2} y={40 - (b.qty / maxBar) * 36} width={16} height={Math.max(b.qty > 0 ? 2 : 0.8, (b.qty / maxBar) * 36)} rx={2} className={b.qty > 0 ? "bd-bar" : "bd-bar0"} />
                </g>
              ))}
            </svg>
          )}
          <table className="bd-dt-t bd-dt-sales">
            <thead>
              <tr>
                <th />
                <th className="r" title="Verkaufte Stück, dahinter der Platz unter allen aktiven Artikeln.">Stück</th>
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
          {detail && (
            <table className="bd-dt-t">
              <tbody>
                {effect ? (
                  <Row
                    label={`Preis ${dm(effect.at)}: ${eur(effect.before)} → ${eur(effect.after)} (${effect.pct >= 0 ? "+" : ""}${Math.round(effect.pct)} %)`}
                    tip={`Tempo vorher ${de1(effect.perMonthBefore)}, nachher ${de1(effect.perMonthAfter)} Stk/Monat (Änderungen ab 10 % mit 14 Tagen Nachlauf).${chg ? ` Grob: ${de1(chg.before)} Stk/Monat in den 60 Tagen davor, ${de1(chg.after)} in den ${chg.daysSince} Tagen danach.` : ""}`}
                    value={`${PRICE_VERDICT[effect.verdict]}${chg ? ` · ${chg.sold} ${chg.sold === 1 ? "Verkauf" : "Verkäufe"}` : ""}`}
                  />
                ) : (
                  <Row
                    label="Preis"
                    tip="Billbee liefert keine Preishistorie; die App schreibt Änderungen bei jedem Abgleich mit. Bewertet werden Änderungen ab 10 % mit 14 Tagen Nachlauf."
                    value={lastChange ? `${dm(lastChange.at)}: ${eur(lastChange.before)} → ${eur(lastChange.after)}` : "noch keine Änderung erfasst"}
                  />
                )}
                {k && (
                  <Row
                    label="Erster Verkauf"
                    tip="Tage von der Erfassung des Artikels in LEC bis zum ersten Verkauf."
                    value={k.firstSale.waiting ? `noch keiner (${k.firstSale.days} T)` : `nach ${k.firstSale.days} Tagen`}
                  />
                )}
                {pattern.avgGapDays !== null && (
                  <Row
                    label="Rhythmus"
                    tip="Ø Abstand zwischen zwei Verkaufstagen und längste Pause, aus den Einzelverkäufen. Ehrlicher als Stück je Monat bei seltenen Verkäufen."
                    value={`alle ${Math.round(pattern.avgGapDays)} T · längste Pause ${pattern.longestGapDays} T`}
                  />
                )}
                {pattern.count > 0 && (
                  <Row
                    label="Menge je Verkauf"
                    tip="Wie viele Verkäufe nur eine Karte enthielten und wie viele mehrere (zählt nur die Zeile dieses Artikels)."
                    value={`${pattern.singles}× einzeln${pattern.multi > 0 ? ` · ${pattern.multi}× mehrere` : ""}`}
                  />
                )}
              </tbody>
            </table>
          )}
          {sales.length > 0 && (
            <details className="bd-sub-det">
              <summary title="Verkäufe aus Billbee, neueste zuerst. Farbe: grün bis 90 Tage, gelb bis 365 Tage, rot älter.">Einzelverkäufe ({sales.length})</summary>
              <table className="bd-dt-t">
                <thead>
                  <tr><th>Datum</th><th className="r">Stück</th><th className="r" title="Verkaufspreis je Stück; EK je Stück ca. ${row.currentEk != null ? eur(row.currentEk) : '—'}">Preis</th></tr>
                </thead>
                <tbody>
                  {sales.slice(0, 25).map((x, i) => (
                    <tr key={i}>
                      <td><i className="bd-dot" style={{ background: ageDot(x.soldAt) }} />{day(x.soldAt)}</td>
                      <td className="r">{x.qty}</td>
                      <td className="r">{eur(x.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sales.length > 25 && <p className="bd-fig-note">Die letzten 25 von {sales.length} geladenen Verkäufen.</p>}
            </details>
          )}
          {detail && detail.reports.length > 0 && (
            <details className="bd-sub-det">
              <summary title="Aus den importierten eBay-Berichten. Die Daten liegen nur je Berichtszeitraum vor, nicht je Einzelverkauf.">eBay-Berichte ({detail.reports.length})</summary>
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
            </details>
          )}
        </Group>

        <Group id="ergebnis" title="Ergebnis" defaultOpen={false} info="Heute: gerechnet mit heutigem VK und aktuellem EK. Historisch: Schnitt der tatsächlichen Verkäufe.">
          <table className="bd-dt-t">
            <tbody>
              <tr className="bd-dt-sub"><td colSpan={2}>heute</td></tr>
              <Row label="Gebundenes Kapital" tip={`Bestand mal aktueller EK.`} value={row.today?.capitalBound != null ? eur(row.today.capitalBound) : "—"} />
              <Row label="Gewinn im Bestand" tip="Bestand mal Gewinn je Stück." value={row.today?.inStock != null ? eur(row.today.inStock) : "—"} />
              <Row label="Max. EK für 25 %" tip="Höchster Einkaufspreis, bei dem der heutige VK nach Gebühren und Versand noch 25 % Marge lässt." value={row.today?.maxEk25 != null ? eur(row.today.maxEk25) : "—"} />
              <tr className="bd-dt-sub"><td colSpan={2}>historisch</td></tr>
              <Row label="DB I" tip="Deckungsbeitrag I: Verkaufspreis minus Wareneinsatz (EK), je Stück im historischen Schnitt." value={eur(row.dbIPerUnit)} />
              <Row label="DB II" tip="Deckungsbeitrag II: DB I minus eBay-Gebühren, Versand und Verpackung. Prozent vom Umsatz." value={`${eur(row.dbIIPerUnit)} · ${formatPercent(row.dbIIPercent)} %`} />
              <Row label="DB III" tip="Deckungsbeitrag III: DB II minus anteilige Fixkosten. Prozent vom Umsatz." value={`${eur(row.dbIIIPerUnit)} · ${formatPercent(row.dbIIIPercent)} %`} />
            </tbody>
          </table>
        </Group>

        <Group id="lager" title="Lager" defaultOpen={false} info="Bestandsänderungen schreibt die App bei jedem Billbee-Abgleich selbst mit (Billbee liefert keine Lagerhistorie). Einkäufe gibt es nur, wenn sie importiert wurden.">
          {k && (
            <table className="bd-dt-t">
              <tbody>
                <Row
                  label="Ohne Bestand"
                  tip="Tage mit Bestand 0 seit der Erfassung. Verpasst: Tempo mit Bestand mal Tage ohne Bestand, geteilt durch 30."
                  value={`${Math.round(k.outOfStock.daysOut)} von ${Math.round(k.outOfStock.daysOut + k.outOfStock.daysIn)} T${k.outOfStock.missedUnits !== null && k.outOfStock.missedUnits >= 0.5 ? ` · ${de1(k.outOfStock.missedUnits)} Stk verpasst` : ""}`}
                />
                <Row label="Tempo mit Bestand" tip="Verkäufe je Monat, gerechnet nur über die Tage, an denen Bestand da war." value={k.outOfStock.perMonthInStock === null ? "—" : `${de1(k.outOfStock.perMonthInStock)} Stk/Monat`} />
              </tbody>
            </table>
          )}
          {detail && (
            <>
              <p className="bd-dt-sum" title="Summe der importierten Einkäufe dieses Artikels.">
                {detail.purchases.length === 0 ? "Keine Einkäufe importiert" : `Eingekauft: ${bought} Stk · ${eur(boughtCost)} · Ø ${eur(boughtCost / Math.max(1, bought))}`}
              </p>
              {moves.length === 0 ? (
                <p className="bd-none" title="Änderungen werden ab dem nächsten Billbee-Abgleich festgehalten.">Noch keine Bewegungen · Start {row.stock} Stk</p>
              ) : (
                <table className="bd-dt-t">
                  <thead>
                    <tr><th>Datum</th><th>Art</th><th className="r">Stück</th><th className="r">Bestand</th></tr>
                  </thead>
                  <tbody>
                    {moves.map((x, i) => (
                      <tr key={i} title={x.tip}>
                        <td>{day(x.at)}</td>
                        <td>{x.kind}</td>
                        <td className="r" style={{ color: x.delta > 0 ? "var(--good)" : undefined }}>{x.delta === 0 ? "±0" : `${x.delta > 0 ? "+" : "−"}${Math.abs(x.delta)}`}</td>
                        <td className="r">{x.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {detail.ekLog.length > 0 && (
                <details className="bd-sub-det">
                  <summary title="Änderungen des Einkaufspreises laut Billbee-Liste.">EK-Verlauf ({detail.ekLog.length})</summary>
                  <table className="bd-dt-t">
                    <tbody>
                      {detail.ekLog.map((c, i) => (
                        <tr key={i}>
                          <td>{day(c.at)}</td>
                          <td className="r">{eur(c.before)} → {eur(c.after)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </>
          )}
        </Group>

        {detail && (
          <Group id="schwund" title="Schwund & Retouren" defaultOpen={false} info="Retouren, Reklamationen, beschädigte und verlorene Karten, bewertet zum EK. Die Einträge ändern den Bestand nicht, den führt Billbee." extra={<span className="bd-grp-x">{detail.losses.length > 0 ? `${detail.losses.length} · ` : ""}{eur(detail.lossCost)}</span>}>
            <SchwundBlock articleId={row.articleId} losses={detail.losses} lossCost={detail.lossCost} />
          </Group>
        )}
      </aside>
    </div>
  );
}

/** Tabellenzeile mit kurzer Beschriftung; die Erklaerung steht im Hover. */
function Row({ label, tip, value, warn }: { label: string; tip?: string; value: string; warn?: boolean }) {
  return (
    <tr title={tip}>
      <td className={warn ? "bd-warn-b" : undefined}>{label}</td>
      <td className={`r${warn ? " bd-warn-b" : ""}`}>{value}</td>
    </tr>
  );
}

/** Einklappbare Gruppe im Drawer; der Zustand bleibt je Gruppe im Browser gespeichert (localStorage), gelesen erst nach dem ersten Rendern. */
function Group({ id, title, info, extra, defaultOpen = true, children }: { id: string; title: string; info?: string; extra?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const key = `lec.drawer.${id}`;
  const [open, setOpen] = useState<boolean>(defaultOpen);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(key);
      if (v === "1") setOpen(true);
      else if (v === "0") setOpen(false);
    } catch {
      /* ohne Speicher bleibt der Standard */
    }
  }, [key]);
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
      <button type="button" className="bd-grp-h" onClick={toggle} aria-expanded={open} title={info}>
        <span className="bd-grp-caret">{open ? "▾" : "▸"}</span>
        {title}
        {extra}
      </button>
      {open && children}
    </section>
  );
}

/** Platz unter allen aktiven Artikeln, klein neben der Zahl: #359. */
function RankTag({ n, total }: { n?: number | null; total?: number }) {
  if (!n || !total) return null;
  return (
    <small className="bd-rank" title={`Platz ${n} von ${total} aktiven Artikeln`}>
      #{n}
    </small>
  );
}

type Tone = "good" | "warn" | "crit" | "info" | undefined;

/** Kachel: Titel, Zahl, kurzer Untertext. `info` steht im Hover, auf Geraeten ohne Maus hinter dem kleinen "?". */
function Stat({ label, value, sub, info, tone }: { label: string; value: string; sub?: string; info?: string; tone?: Tone }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`bd-dt-stat${tone ? ` ${tone}` : ""}`} title={info}>
      <span>
        {label}
        {info && (
          <button type="button" className="bd-info" aria-label={`Erklärung zu ${label}`} onClick={() => setOpen((o) => !o)}>
            ?
          </button>
        )}
      </span>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
      {open && info && <em className="bd-info-text">{info}</em>}
    </div>
  );
}

function EbayActions({ row, hidden, busy, onToggleHidden, onToggleDelist }: { row: SortimentRow; hidden: boolean; busy: boolean; onToggleHidden: () => void; onToggleDelist: () => void }) {
  const l = ebayLinks(row);
  const cm = cardmarketLink(row, cleanTitle(row.nameRaw).pack);
  return (
    <div className="bd-dt-actions">
      {l.revise && (
        <a className="chip bd-dt-primary" href={l.revise} target="_blank" rel="noopener noreferrer" title="Öffnet das Bearbeiten-Formular des Angebots bei eBay.">
          Preis ändern ↗
        </a>
      )}
      <a className="chip" href={l.manage} target="_blank" rel="noopener noreferrer" title="Öffnet deine aktiven eBay-Angebote (Seller Hub), gefiltert auf diese Karte. Dort kannst du das Angebot beenden.">
        Beenden ↗
      </a>
      <a className="chip" href={l.view ?? l.search} target="_blank" rel="noopener noreferrer" title={l.view ? "Zeigt das Angebot bei eBay." : "Kein Angebot hinterlegt: sucht die Karte in deinem eBay-Shop."}>
        {l.view ? "Angebot ↗" : "eBay-Suche ↗"}
      </a>
      {cm && (
        <a className="chip" href={cm} target="_blank" rel="noopener noreferrer" title="Sucht die Karte bei Cardmarket (Sprache der Karte, ab NM).">
          Cardmarket ↗
        </a>
      )}
      <button
        type="button"
        className={`chip${row.delistMarkedAt ? " on" : ""}`}
        onClick={onToggleDelist}
        disabled={busy}
        title={
          row.delistMarkedAt
            ? "Markierung zurücknehmen."
            : `Karte zum Auslisten vormerken, damit du sie später im Ordner findest (Filter „Zum Auslisten markiert“)${row.ordner ? ` · ${row.ordner}` : ""}.`
        }
      >
        {row.delistMarkedAt ? "✓ Vorgemerkt" : "Auslisten vormerken"}
      </button>
      <button type="button" className="chip" onClick={onToggleHidden} disabled={busy} title={hidden ? "Artikel wieder in die Listen aufnehmen." : "Artikel aus allen Listen ausblenden (Daten bleiben erhalten)."}>
        {hidden ? "Wieder einblenden" : "Ausblenden"}
      </button>
    </div>
  );
}
