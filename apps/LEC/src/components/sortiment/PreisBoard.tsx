"use client";

import type { SortimentRow } from "@/lib/dashboard/viewModel";
import { boardGap, boardVk, cleanTitle, ebayLinks } from "@/lib/dashboard/board";
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
  imageVersions: Record<string, string>;
  imageSrc: (articleId: string, version: string) => string;
  onPreview: (p: { src: string; x: number; y: number } | null) => void;
  onOpen: (articleId: string) => void;
}

export function PreisBoard({ rows, imageVersions, imageSrc, onPreview, onOpen }: Props) {
  return (
    <div className="bd-wrap">
      <table className="bd">
        <thead>
          <tr>
            <th>Artikel</th>
            <th className="r">Dein VK</th>
            <th>Empfohlener VK</th>
            <th className="r">Marktwert</th>
            <th className="r" title="Deckungsbeitrags-Marge, die dein heutiger VK bringt, wenn du die Karte jetzt zum Marktwert nachkaufst">
              Marge
            </th>
            <th>Urteil</th>
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
                <td>
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
                <td data-label="Dein VK" className="r bd-vk" title={row.listingVkSource === "ebay" ? "Aktueller Angebotspreis aus deinem eBay-Shop" : row.listingVkSource === "billbee" ? "Aus dem Billbee-Artikelstamm (bei eBay nicht gelistet)" : undefined}>
                  {boardVk(row) > 0 ? eur(boardVk(row)) : "—"}
                  {row.listingVkSource === "ebay" && <span className="vksrc" />}
                  <EbayLink row={row} />
                </td>
                <td data-label="Empfohlener VK">
                  <PriceRange row={row} />
                </td>
                <td data-label="Marktwert" className="r bd-num" title={m ? marketTitle(m) : undefined}>
                  {m?.value != null ? eur(m.value) : m?.range ? `${formatEuroCents(m.range.min)}–${formatEuroCents(m.range.max)} €` : <span className="bd-none">—</span>}
                </td>
                <td
                  data-label="Marge bei Nachkauf"
                  className="r bd-num"
                  style={{ color: m?.margin == null ? undefined : m.margin < 0 ? "var(--crit)" : m.margin < 0.25 ? "var(--warn)" : "var(--good)" }}
                >
                  {m?.margin != null ? `${formatPercent(m.margin)} %` : <span className="bd-none">—</span>}
                </td>
                <td data-label="Urteil">
                  <VerdictBadge row={row} />
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="bd-empty">
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
  if (m.how === "seltenheit") return "Cardmarket-7-Tage-Schnitt der Variante mit der Seltenheit aus deinem Titel";
  if (m.how === "einzige_variante") return "Cardmarket-7-Tage-Schnitt (die Karte hat im Set nur eine Variante)";
  return "Cardmarket-7-Tage-Schnitt";
}
