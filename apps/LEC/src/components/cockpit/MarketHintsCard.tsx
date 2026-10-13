import type { MarketHintEntry, MarketHints } from "@/lib/cockpit/marketHints";
import { dateDe, eur, eurCents, pct, shortName } from "./format";

/**
 * Preis-Hinweise aus dem automatischen Cardmarket-Marktwert: Zaehlung nach Chris' Formel
 * (VK = EK × 3 + 0,99, Untergrenze 4,99) plus die fuenf Artikel mit dem groessten €-Hebel je
 * Richtung. Reine Anzeige -- bewertet wird in `buildMarketComparisonRow`, wie auf /marktpreise.
 */
export function MarketHintsCard({ market }: { market: MarketHints }) {
  const m = market;
  return (
    <section className="ck-card ck-c12" aria-label="Preis-Hinweise Cardmarket">
      <div className="ck-h">
        <h2>Preis-Hinweise Cardmarket</h2>
        <span className="ck-scope">
          Marktwert je Karte vs. Formel VK = EK × 3 + 0,99 · Abruf {dateDe(m.latestFetch)}
        </span>
      </div>
      <div className="ck-body">
        {m.withQuote === 0 ? (
          <div className="ck-empty">Noch kein Cardmarket-Marktwert abgerufen — die Preisliste wird automatisch nach dem Import geladen.</div>
        ) : (
          <>
            <div className="ck-facts" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
              <Fact label="Zu günstig" value={m.tooCheap} tone="crit" sub={`≈ ${eur(m.tooCheapEffect)} liegen gelassen (Lücke × Bestand/90-T-Absatz)`} />
              <Fact label="Im Korridor" value={m.inCorridor} tone="good" sub="±15 % um den Formel-VK" />
              <Fact label="Zu teuer" value={m.tooExpensive} tone="warn" sub="über Formel-VK — Markt gefallen oder Preis zu hoch" />
              <Fact label="EK über Markt" value={m.ekAboveMarket} tone="warn" sub="eigener EK > 150 % des Marktwerts" />
              <Fact
                label="Abdeckung"
                value={`${pct(m.coverage)}`}
                sub={`${m.withQuote.toLocaleString("de-DE")} Artikel mit Marktwert · ${m.ambiguous} mehrdeutig · ${m.stale} älter als 30 T`}
              />
            </div>
            <div className="ck-grid" style={{ marginTop: 14, marginBottom: 0 }}>
              <HintList title="Größter Hebel · zu günstig" entries={m.topTooCheap} tone="crit" />
              <HintList title="Größter Hebel · zu teuer" entries={m.topTooExpensive} tone="warn" />
            </div>
          </>
        )}
        <p className="ck-note">
          Marktwert = Cardmarket-Trend (sonst 30-T-Schnitt) × Packgröße; mehrdeutige Zuordnungen werden nur bewertet, wenn das Urteil für jede
          Variante gilt. Keine erfundenen Preise: ohne Marktwert kein Urteil.
        </p>
      </div>
    </section>
  );
}

function Fact({ label, value, sub, tone }: { label: string; value: number | string; sub: string; tone?: "good" | "warn" | "crit" }) {
  const color = tone === "good" ? "var(--good)" : tone === "warn" ? "var(--warn)" : tone === "crit" ? "var(--crit)" : undefined;
  return (
    <div className="ck-fact">
      <div className="ck-fl">{label}</div>
      <div className="ck-fv" style={color ? { color } : undefined}>
        {typeof value === "number" ? value.toLocaleString("de-DE") : value}
        {typeof value === "number" && <small>Artikel</small>}
      </div>
      <div className="ck-fs">{sub}</div>
    </div>
  );
}

function HintList({ title, entries, tone }: { title: string; entries: MarketHintEntry[]; tone: "crit" | "warn" }) {
  const top = entries[0]?.effect ?? 0;
  return (
    <div className="ck-c6">
      <div className="ck-sect">
        <i style={{ background: tone === "crit" ? "var(--crit)" : "var(--warn)" }} /> {title}
      </div>
      {entries.length === 0 ? (
        <div className="ck-empty">Kein Artikel in dieser Richtung.</div>
      ) : (
        <div className="ck-mv">
          {entries.map((e) => (
            <div className="ck-mvr" key={e.articleId}>
              <div className="ck-img" aria-hidden={e.imageUrl ? undefined : true}>
                {e.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.imageUrl} alt="" loading="lazy" width={40} height={56} />
                ) : (
                  <span>{e.setCode ?? "—"}</span>
                )}
              </div>
              <div className="ck-nm">
                <a href={`/marktpreise?q=${encodeURIComponent(e.setCode ?? e.nameRaw)}`}>{shortName(e.nameRaw)}</a>
              </div>
              <div className="ck-rv">{eur(e.effect)}</div>
              <div className="ck-mt">
                <span>VK {eurCents(e.ownVk)}</span>
                <span>Formel {eurCents(e.formulaVk)}</span>
                <span>Markt {eurCents(e.marketValue)}</span>
                <span>
                  {e.deltaPercent > 0 ? "+" : ""}
                  {pct(e.deltaPercent)} · Hebel {e.lever} Stk
                </span>
              </div>
              <div className="ck-mb">
                <i className={tone === "crit" ? "ck-neg" : "ck-warn"} style={{ width: `${top > 0 ? Math.max(3, (e.effect / top) * 100) : 3}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
