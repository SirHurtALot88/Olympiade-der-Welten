"use client";

import { useMemo } from "react";
import type { MoverItem, SortimentRow } from "@/lib/dashboard/viewModel";
import { cleanTitle } from "@/lib/dashboard/board";
import { AGE_GROUPS, capitalByAge, type CapitalAge } from "@/lib/dashboard/kapitalAlter";
import { formatEuro, formatEuroCents, formatPercent } from "@/lib/format";

const nameOf = (r: { nameRaw: string }) => cleanTitle(r.nameRaw).name || r.nameRaw;
const open = (id: string) => `/sortiment?artikel=${encodeURIComponent(id)}`;
const eur0 = (v: number) => `${formatEuro(v)} €`;

/** Dashboard-Bloecke "Laeuft gut", "Laeuft schlecht", "Muss weg" (UX_KONZEPT_GESAMT.md, Entscheidungen 14.11.). Jede Zeile oeffnet den Drawer. */
export function DashboardBlocks({ rows, moversBad, age }: { rows: SortimentRow[]; moversBad: MoverItem[]; age: CapitalAge }) {
  const data = useMemo(() => {
    const active = rows.filter((r) => r.active && !r.hidden);
    const q = (r: SortimentRow, w: "30" | "90") => r.windows[w]?.qty ?? 0;
    // Laeuft gut: Verkauf in 30 T, Marge nicht negativ; nach Gewinn (Gewinn je Stueck x Stueck 30 T)
    const good = active
      .filter((r) => q(r, "30") > 0 && r.today && r.today.profitPerUnit >= 0)
      .map((r) => ({ r, profit: q(r, "30") * (r.today?.profitPerUnit ?? 0) }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);
    const top = active.filter((r) => r.articleClass === "champion" || r.articleClass === "solide");
    const rev = active.reduce((n, r) => n + (r.revenue365 ?? 0), 0);
    const topShare = rev > 0 ? top.reduce((n, r) => n + (r.revenue365 ?? 0), 0) / rev : 0;
    const soldOutGood = active.filter((r) => r.stock <= 0 && q(r, "90") > 0).length;
    // Laeuft schlecht
    const falling = active.filter((r) => r.articleClass === "faellt_ab" && r.stock > 0).sort((a, b) => (b.revenue365 ?? 0) - (a.revenue365 ?? 0));
    const lossCount = active.filter((r) => !r.ekMissing && r.dbIIPercent < 0 && q(r, "90") > 0).length;
    const cheap = active.filter((r) => r.market?.rated && r.market.status === "zu_guenstig").length;
    // Muss weg: Langsam + Ladenhueter
    const byId = new Map(rows.map((r) => [r.articleId, r]));
    const mustGo = age.items.filter((i) => i.group === "langsam" || i.group === "ladenhueter").slice(0, 5).flatMap((i) => (byId.get(i.articleId) ? [{ r: byId.get(i.articleId)!, i }] : []));
    return { good, top: top.length, topShare, soldOutGood, falling, lossCount, cheap, mustGo };
  }, [rows, age]);

  const lh = age.groups.find((g) => g.key === "ladenhueter")!;
  const slow = age.groups.find((g) => g.key === "langsam")!;
  const maxCap = Math.max(1, age.total);

  return (
    <section className="dash-3">
      <div className="card dash-go">
        <h3>
          <span className="hdot" style={{ background: "var(--good)" }} />
          Läuft gut <span className="r" title="Verkauf in den letzten 30 Tagen, Marge nicht negativ, nach Gewinn (Gewinn je Stück bei heutigem VK und EK mal Stück in 30 Tagen).">Gewinn · 30 Tage</span>
        </h3>
        <div className="dash-sub" title="Klassen Champion und Solide, Anteil am Umsatz der letzten 365 Tage.">
          {data.top} Artikel (Champion + Solide) tragen {formatPercent(data.topShare)} % vom Umsatz 365 T
        </div>
        <div className="movers">
          {data.good.length === 0 && <div className="bd-none">Kein Verkauf mit Gewinn in 30 Tagen.</div>}
          {data.good.map(({ r, profit }) => (
            <a className="mover" key={r.articleId} href={open(r.articleId)} title={r.nameRaw}>
              <div className="nm">{nameOf(r)}</div>
              <div className="rev">€ {formatEuroCents(profit)}</div>
              <div className="meta">
                <span>{r.windows["30"]?.qty ?? 0} Stk</span>
                <span>{r.stock > 0 ? `${r.stock} auf Lager` : "ausverkauft"}</span>
              </div>
            </a>
          ))}
        </div>
        {data.soldOutGood > 0 && (
          <a className="dash-foot" href="/sortiment?aufgabe=nachbestellen" title="Aktive Artikel mit Bestand 0, die in den letzten 90 Tagen verkauft wurden.">
            Ausverkauft, lief gut: {data.soldOutGood} →
          </a>
        )}
      </div>

      <div className="card dash-bad">
        <h3>
          <span className="hdot" style={{ background: "var(--crit)" }} />
          Läuft schlecht <span className="r" title="Verlust: DB II unter 0 in 90 Tagen, nur mit bekanntem EK. Fällt ab: Klasse laut Tempo und Momentum.">Verlust · 90 Tage</span>
        </h3>
        <div className="dash-sub">
          <a href="/sortiment?klasse=faellt_ab">{data.falling.length} fallen ab</a> · {data.lossCount} mit Verlust · <a href="/sortiment?aufgabe=preis">{data.cheap} zu günstig</a>
        </div>
        <div className="movers">
          {moversBad.length === 0 && data.falling.length === 0 && <div className="bd-none">Nichts Auffälliges.</div>}
          {moversBad.slice(0, 3).map((m) => (
            <a className="mover" key={m.articleId} href={open(m.articleId)} title={m.nameRaw}>
              <div className="nm">{nameOf(m)}</div>
              <div className="rev down">−€ {formatEuroCents(Math.abs(m.dbIIEuro))}</div>
              <div className="meta">
                <span>{m.qty} verkauft</span>
                <span>EK € {formatEuroCents(m.ek)}</span>
              </div>
            </a>
          ))}
          {data.falling.slice(0, 2).map((r) => (
            <a className="mover" key={r.articleId} href={open(r.articleId)} title={r.nameRaw}>
              <div className="nm">{nameOf(r)}</div>
              <div className="rev">fällt ab</div>
              <div className="meta">
                <span>{r.windows["90"]?.qty ?? 0} Stk in 90 T</span>
                <span>{r.stock} auf Lager</span>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="card dash-gone">
        <h3>
          <span className="hdot" style={{ background: "var(--warn)" }} />
          Muss weg <span className="r" title="Kapital in aktiven Artikeln mit Bestand und bekanntem EK (Bestand mal EK), nach Alter: Tage seit dem letzten Verkauf; bei nie verkauften das aus der eBay-Nummer geschätzte Mindestalter des Angebots.">Kapital nach Alter</span>
        </h3>
        <div className="dash-sub" title="Ladenhüter = seit über 365 Tagen nichts verkauft.">
          Ladenhüter: {lh.articles} Artikel · <b className="down">{eur0(lh.capital)}</b> gebunden · Langsam (181–365 T): {eur0(slow.capital)}
        </div>
        <div className="age-bar" role="img" aria-label={`Kapital nach Alter: ${age.groups.map((g) => `${g.label} ${eur0(g.capital)}`).join(", ")}`}>
          {age.groups.map((g) => (
            <i key={g.key} className={`age-${g.key}`} style={{ flexBasis: `${(g.capital / maxCap) * 100}%` }} title={`${g.label} (${g.range}): ${eur0(g.capital)} in ${g.articles} Artikeln`} />
          ))}
        </div>
        <div className="age-legend">
          {AGE_GROUPS.map((g) => {
            const x = age.groups.find((a) => a.key === g.key)!;
            return (
              <span key={g.key} title={`${g.label} (${g.range})`}>
                <i className={`age-${g.key}`} /> {g.label} <b>{eur0(x.capital)}</b>
              </span>
            );
          })}
        </div>
        <div className="movers">
          {data.mustGo.length === 0 && <div className="bd-none">Kein Kapital über 180 Tage.</div>}
          {data.mustGo.map(({ r, i }) => (
            <a className="mover" key={r.articleId} href={open(r.articleId)} title={r.nameRaw}>
              <div className="nm">{nameOf(r)}</div>
              <div className="rev">{eur0(i.capital)}</div>
              <div className="meta">
                <span>{r.stock} Stk</span>
                <span>{i.days} T ohne Verkauf</span>
              </div>
            </a>
          ))}
        </div>
        <a className="dash-foot" href="/sortiment?aufgabe=auslisten" title="Alle Artikel mit Maßnahme: Preis senken, Auslaufen lassen oder Auslisten.">
          Alle Maßnahmen →
        </a>
        {(age.withoutEk > 0 || age.unknownAge.articles > 0) && (
          <div className="dash-note">
            {age.withoutEk > 0 && <a href="/sortiment?aufgabe=daten">{age.withoutEk} Artikel mit Bestand ohne EK fehlen</a>}
            {age.withoutEk > 0 && age.unknownAge.articles > 0 && " · "}
            {age.unknownAge.articles > 0 && <span title="Nie verkauft und ohne geschätztes Angebotsalter.">{age.unknownAge.articles} ohne Alter ({eur0(age.unknownAge.capital)})</span>}
          </div>
        )}
      </div>
    </section>
  );
}

export { capitalByAge };
