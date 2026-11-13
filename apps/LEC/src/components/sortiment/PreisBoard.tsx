"use client";

import type { BoardSortKey } from "@/lib/dashboard/board";
import type { SortimentRow } from "@/lib/dashboard/viewModel";
import { LIFECYCLE_LABEL } from "@/lib/dashboard/lifecycle";
import { boardGap, boardVk, cleanTitle, ebayLinks, formatQty } from "@/lib/dashboard/board";
import { CopyCode } from "./CopyCode";
import { rarityFromTitle } from "@/lib/market/rarity";
import { formatEuroCents, formatPercent } from "@/lib/format";

/**
 * Preis-Board: die Ansicht "Kompakt" des Sortiments. Eine Frage je Zeile — steht der VK dort,
 * wo er bei heutigem Marktwert stehen sollte (25 % bis 33 % Deckungsbeitrag)? Alles andere
 * (Verkaeufe, DB I-III, Klassen) liegt in der Ansicht "Alle Spalten".
 */

type Verdict = "zu_guenstig" | "im_korridor" | "zu_teuer";

const VERDICT: Record<Verdict, { label: string; cls: string; color: string }> = {
  zu_guenstig: { label: "zu günstig", cls: "bd-v-low", color: "var(--warn)" },
  im_korridor: { label: "im Rahmen", cls: "bd-v-ok", color: "var(--good)" },
  zu_teuer: { label: "zu teuer", cls: "bd-v-high", color: "var(--market)" },
};

const eur = (v: number) => `${formatEuroCents(v)} €`;

/** Spanne als Balken: gruenes Band = 25–33 %, Punkt = dein VK, Raute = Marktwert (heutiger EK). */
export function PriceRange({ row }: { row: SortimentRow }) {
  const m = row.market;
  const vk = boardVk(row);
  if (!m || m.targetMin === null || m.targetOpt === null || !(vk > 0)) {
    return <span className="bd-none">{m?.range ? "Seltenheit nicht eindeutig" : "kein Marktwert"}</span>;
  }
  const points = [vk, m.targetMin, m.targetOpt, m.value ?? m.targetMin];
  const lo = Math.min(...points) * 0.88;
  const hi = Math.max(...points) * 1.06;
  const pos = (x: number) => `${Math.max(1, Math.min(99, ((x - lo) / (hi - lo)) * 100))}%`;
  const verdict: Verdict = m.rated ? m.status : "im_korridor";
  const rated = m.rated;
  return (
    <div
      className="bd-range"
      title={`${m.marginReachable ? "Zielspanne" : "Verkaufszone"} ${eur(m.targetMin)} – ${eur(m.targetOpt)} · dein VK ${eur(vk)}${m.value !== null ? ` · Marktwert ${eur(m.value)}` : ""}${
        m.capped ? " · Marktdeckel: teure Karten gehen selten über das 1,5-fache vom Marktwert" : ""
      }`}
    >
      <div className="bd-track">
        <div className="bd-band" style={{ left: pos(m.targetMin), width: `calc(${pos(m.targetOpt)} - ${pos(m.targetMin)})` }} />
        {m.value !== null && <div className="bd-mk" style={{ left: pos(m.value) }} />}
        <div className="bd-me" style={{ left: pos(vk), background: rated ? VERDICT[verdict].color : "var(--faint)" }} />
      </div>
      <div className="bd-rangelabel">
        <b>{m.targetMin === m.targetOpt ? eur(m.targetMin) : `${formatEuroCents(m.targetMin)} – ${eur(m.targetOpt)}`}</b>
        {m.capped && (
          <span className="bd-cap" title="Marktdeckel: teure Karten gehen selten über das 1,5-fache vom Marktwert. Die 25-%-Marge ist dort nicht immer erreichbar.">
            {m.marginReachable ? "Marktdeckel" : "Markt gibt keine 25 % her"}
          </span>
        )}
      </div>
    </div>
  );
}

/** Kleiner Link zum eBay-Angebot (oeffnet in neuem Tab); ohne Artikelnummer die Suche im eigenen Shop. */
export function EbayLink({ row }: { row: SortimentRow }) {
  const l = ebayLinks(row);
  return (
    <a
      className="bd-ebay"
      href={l.view ?? l.search}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={l.view ? "Angebot bei eBay öffnen" : "Im eigenen eBay-Shop suchen (Artikelnummer unbekannt)"}
    >
      eBay ↗
    </a>
  );
}

export function VerdictBadge({ row }: { row: SortimentRow }) {
  const m = row.market;
  // Lange nicht verkauft: statt „zu günstig“ der Lebenszyklus (zu dem Preis kauft ihn niemand)
  if (row.lifecycle) {
    const l = LIFECYCLE_LABEL[row.lifecycle];
    const color = row.lifecycle === "auslisten" ? "var(--crit)" : "var(--warn)";
    return (
      <div className="bd-verdict">
        <span className="bd-pill" title={l.hint} style={{ color, borderColor: color }}>
          <i style={{ background: color }} />
          {l.label}
        </span>
      </div>
    );
  }
  if (!m || !m.rated) return <span className="bd-none">{m ? "ohne Urteil" : "—"}</span>;
  const v = VERDICT[m.status];
  const gap = boardGap(row);
  return (
    <div className="bd-verdict">
      <span className={`bd-pill ${v.cls}`} title={m.provenByDemand && m.soldAt ? `${m.soldAt.qty} Verkäufe in ${m.soldAt.days} Tagen im Schnitt für ${eur(m.soldAt.avg)}: der Markt nimmt den Preis` : undefined}>
        <i />
        {m.provenByDemand ? "verkauft sich so" : v.label}
      </span>
      {gap && gap.target !== null && (
        <span className="bd-delta">
          {gap.euro < 0 ? "↑" : "↓"} auf {eur(gap.target)}
        </span>
      )}
    </div>
  );
}

interface Props {
  rows: SortimentRow[];
  /** Nur im Doppelte-Filter gesetzt: zeigt eBay-Nummer und letzten Verkauf direkt in der Zeile. */
  dupGroups?: Map<string, string>;
  sortKey?: BoardSortKey;
  reversed?: boolean;
  onSort?: (key: BoardSortKey) => void;
  imageVersions: Record<string, string>;
  imageSrc: (articleId: string, version: string) => string;
  onPreview: (p: { src: string; x: number; y: number } | null) => void;
  onOpen: (articleId: string) => void;
}

/** Tage seit dem letzten Verkauf; null ohne Verkauf. */
export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now - t) / 86_400_000));
}

export function PreisBoard({ rows, dupGroups, sortKey, reversed, onSort, imageVersions, imageSrc, onPreview, onOpen }: Props) {
  const head = (key: BoardSortKey, label: React.ReactNode, cls?: string, title?: string) => (
    <th className={`${cls ?? ""}${onSort ? " bd-th-sort" : ""}`.trim()} title={title} onClick={onSort ? () => onSort(key) : undefined} aria-sort={sortKey === key ? (reversed ? "ascending" : "descending") : undefined}>
      {label}
      {sortKey === key && <span className="bd-sort-arrow">{reversed ? "▲" : "▼"}</span>}
    </th>
  );
  return (
    <div className="bd-wrap">
      <table className="bd">
        <thead>
          <tr>
            {head("name", "Artikel")}
            {head("bestand", "Bestand", "r", "Lagerbestand in Stück")}
            {head("verkaeufe", "Verkäufe", "r", "Verkaufte Stück in 365 Tagen (darunter 90 Tage)")}
            {head("letzterVerkauf", "Letzter Verkauf", "r", "Vor wie vielen Tagen zuletzt verkauft (grün bis 90 Tage, gelb bis 365, rot älter)")}
            {head("ek", "Ø EK", "r", "Durchschnittlicher Einkaufspreis je Stück laut Verkäufen (365 T)")}
            {head("avgvk", "Ø VK", "r", "Durchschnittlicher Verkaufspreis je Stück (365 T)")}
            {head("vk", "Dein VK", "r")}
            {head("abweichung", "Empfohlener VK", undefined, "Sortiert nach der größten Abweichung deines VK von der Zielspanne")}
            {head("marktwert", "Marktwert", "r")}
            {head("marge", "Marge", "r", "Deckungsbeitrags-Marge, die dein heutiger VK bringt, wenn du die Karte jetzt zum Marktwert nachkaufst")}
            {head("abweichung", "Urteil")}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const m = row.market;
            const rarity = rarityFromTitle(row.nameRaw);
            const clean = cleanTitle(row.nameRaw);
            const v = imageVersions[row.articleId];
            return (
              <tr key={row.articleId} onClick={() => onOpen(row.articleId)}>
                <td className="bd-c-art">
                  <div className="bd-art">
                    {v ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="bd-thumb"
                        src={imageSrc(row.articleId, v)}
                        alt=""
                        loading="lazy"
                        onMouseEnter={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          onPreview({ src: e.currentTarget.src, x: r.right + 12, y: Math.max(8, Math.min(r.top - 60, window.innerHeight - 390)) });
                        }}
                        onMouseLeave={() => onPreview(null)}
                      />
                    ) : (
                      <span className="bd-thumb bd-thumb-none" />
                    )}
                    <div className="bd-arttext">
                      <div className="bd-name" title={row.nameRaw}>
                        {clean.name || row.nameRaw}
                      </div>
                      <div className="bd-sub">
                        {row.setCode && <CopyCode setCode={row.setCode} />}
                        {rarity && <span className="bd-rar">{rarity}</span>}
                        {clean.pack > 1 && <span className="bd-rar bd-pack">{clean.pack}er-Pack</span>}
                        {clean.edition && <span className="bd-ed">{clean.edition}</span>}
                        {!row.active && <span className="bd-rar">ausgelaufen</span>}
                        {row.ebayEndedAt && <span className="bd-rar" title={`Seit ${row.ebayEndedAt.slice(0, 10)} nicht mehr im eBay-Shop`}>bei eBay beendet</span>}
                        {dupGroups?.has(row.articleId) && (
                          <span className="bd-rar" title={row.nameRaw}>
                            Doppelt? · Bestand {row.stock} · eBay {row.ebayItemId ?? "–"} · {row.lastSoldAt ? `letzter Verkauf vor ${daysSince(row.lastSoldAt)} T` : "nie verkauft"}
                          </span>
                        )}
                        {row.codeName?.mismatch && (
                          <span
                            className="bd-rar bd-namewarn"
                            title={`Name und Set-Code passen nicht zusammen. Der Code ${row.setCode} gehört zu: ${row.codeName.de ?? row.codeName.en}${row.codeName.de && row.codeName.en ? ` (${row.codeName.en})` : ""}.${row.codeName.hint ? ` Zum Namen im Titel passt: ${row.codeName.hint}.` : ""} ${row.codeName.usedCode ? `Der Marktwert gilt für ${row.codeName.usedCode} (Name wird als richtig angenommen).` : "Ohne eindeutigen Code kein Marktwert."} Code in Billbee und bei eBay korrigieren.`}
                          >
                            Code ≠ Name
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td data-label="Bestand" className="r bd-num bd-c-stock">
                  {row.stock > 0 ? formatQty(row.stock) : <span className="bd-none">0</span>}
                  {row.reorderDue && (
                    <small
                      className="bd-reorder"
                      title={row.reorderReason === "mindestbestand" ? `Bestand ${row.stock} liegt auf oder unter dem Mindestbestand ${row.minStock} (aus Billbee)${row.reorderQty ? `, Soll ${row.desiredStock}: ${row.reorderQty} Stk fehlen` : ""}` : row.reorderReason === "ausverkauft" ? "Ausverkauft, der Artikel verkauft sich" : "Bestand reicht nur noch etwa 1,5 Monate"}
                    >
                      nachbestellen
                    </small>
                  )}
                </td>
                <td data-label="Verkäufe 365 T" className="r bd-num bd-c-sales" title="Verkäufe in 365 Tagen, darunter in 90 Tagen">
                  {formatQty(row.windows["365"]?.qty ?? 0)}
                  <small className="bd-sub90"> · 90 T: {formatQty(row.windows["90"]?.qty ?? 0)}</small>
                </td>
                <td data-label="Letzter Verkauf" className="r bd-num bd-c-last">
                  {(() => {
                    const d = daysSince(row.lastSoldAt);
                    if (d === null) return <span className="bd-none">—</span>;
                    return <span style={{ color: d <= 90 ? "var(--good)" : d <= 365 ? "var(--warn)" : "var(--crit)" }}>{d === 0 ? "heute" : `vor ${d} Tagen`}</span>;
                  })()}
                </td>
                <td data-label="Ø EK" className="r bd-num bd-c-ek">
                  {row.ek > 0 ? eur(row.ek) : <span className="bd-none">—</span>}
                  {(() => {
                    // Wie aktuell ist der EK? Letzte EK-Aenderung (Billbee) oder letzter Einkauf, farbig in Tagen
                    const d = daysSince(row.lastEkAt);
                    if (d === null) return null;
                    return (
                      <small className="bd-pchg" title="Letzte EK-Änderung oder letzter Einkauf (grün bis 30 Tage = sehr aktuell, gelb bis 90, rot älter)" style={{ display: "block", color: d <= 30 ? "var(--good)" : d <= 90 ? "var(--warn)" : "var(--crit)" }}>
                        {d === 0 ? "EK heute" : `EK vor ${d} T`}
                      </small>
                    );
                  })()}
                </td>
                <td data-label="Ø VK" className="r bd-num bd-c-avg">
                  {row.avgVkRealized > 0 ? eur(row.avgVkRealized) : <span className="bd-none">—</span>}
                </td>
                <td data-label="Dein VK" className="r bd-vk bd-c-vk" title={row.listingVkSource === "ebay" ? "eBay-Shoppreis (Rückfall, wenn Billbee keinen VK hat)" : row.listingVkSource === "billbee" ? "Aus dem Billbee-Artikelstamm" : undefined}>
                  {boardVk(row) > 0 ? eur(boardVk(row)) : "—"}
                  {row.listingVkSource === "ebay" && <span className="vksrc" />}
                  <EbayLink row={row} />
                  {(() => {
                    // Letzte Preisanpassung: nur wenn aufgezeichnet (Billbee- und eBay-Shop-Abgleich), farbig in Tagen
                    const d = daysSince(row.lastPriceChangeAt);
                    if (d === null) return null;
                    return (
                      <small className="bd-pchg" title="Letzte aufgezeichnete Preisänderung (grün bis 30 Tage, gelb bis 90, rot älter)" style={{ display: "block", color: d <= 30 ? "var(--good)" : d <= 90 ? "var(--warn)" : "var(--crit)" }}>
                        {d === 0 ? "Preis heute geändert" : `Preis vor ${d} T geändert`}
                      </small>
                    );
                  })()}
                </td>
                <td data-label="Empfohlener VK" className="bd-c-rec">
                  <PriceRange row={row} />
                </td>
                <td data-label="Marktwert" className="r bd-num bd-c-mk" title={m ? marketTitle(m) : undefined}>
                  {m?.value != null ? eur(m.value) : m?.range ? `${formatEuroCents(m.range.min)}–${formatEuroCents(m.range.max)} €` : <span className="bd-none">—</span>}
                </td>
                <td
                  data-label="Marge bei Nachkauf"
                  className="r bd-num bd-c-margin"
                  style={{ color: m?.margin == null ? undefined : m.margin < 0 ? "var(--crit)" : m.margin < 0.25 ? "var(--warn)" : "var(--good)" }}
                >
                  {m?.margin != null ? `${formatPercent(m.margin)} %` : <span className="bd-none">—</span>}
                </td>
                <td data-label="Urteil" className="bd-c-verdict">
                  <VerdictBadge row={row} />
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="bd-empty">
                Keine Artikel für diese Auswahl.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function marketTitle(m: NonNullable<SortimentRow["market"]>): string {
  if (m.range) return `${m.range.variants} Varianten im Set, die Seltenheit lässt sich nicht eindeutig zuordnen — Spanne statt Einzelwert`;
  if (m.how === "seltenheit") return "Mittelwert (Cardmarket-Trend, Ø 1/7/30 Tage, letzter EK) der Variante mit der Seltenheit aus deinem Titel";
  if (m.how === "einzige_variante") return "Mittelwert aus Cardmarket und letztem EK (die Karte hat im Set nur eine Variante)";
  return "Mittelwert aus Cardmarket-Trend, Ø 1/7/30 Tage und letztem EK";
}
