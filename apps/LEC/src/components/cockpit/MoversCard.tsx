import type { MoverEntry, Movers } from "@/lib/cockpit/movers";
import { eur, eurCents, pct, shortName } from "./format";

/** Laeuft / Bremst (fensterabhaengig) und Faellt ab (fensterunabhaengig) -- mit Kartenbild oder Platzhalter. */
export function MoversCard({ movers, windowLabel }: { movers: Movers; windowLabel: string }) {
  return (
    <>
      <section className="ck-card ck-c6" aria-label="Läuft">
        <div className="ck-h">
          <h2>Läuft</h2>
          <span className="ck-scope">Top-Umsatz mit positivem DB II · {windowLabel}</span>
        </div>
        <div className="ck-body">
          {movers.running.length === 0 ? <div className="ck-empty">Keine Verkäufe mit positivem DB II im Fenster.</div> : (
            <div className="ck-mv">
              {movers.running.map((e) => (
                <MoverRow key={e.articleId} e={e} value={eur(e.revenue)} tone="good" />
              ))}
            </div>
          )}
          {movers.fading.length > 0 && (
            <>
              <div className="ck-sect">
                <i style={{ background: "var(--warn)" }} /> Fällt ab · 90 T vs. 365 T
              </div>
              <div className="ck-mv">
                {movers.fading.map((e) => (
                  <MoverRow
                    key={e.articleId}
                    e={e}
                    value={eur(e.revenue)}
                    tone="warn"
                    meta={
                      e.velocity
                        ? `Ø ${e.velocity.perMonth90.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Stk/Mon (90 T) vs. ${e.velocity.perMonth365.toLocaleString("de-DE", { maximumFractionDigits: 1 })} (365 T)`
                        : undefined
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="ck-card ck-c6" aria-label="Bremst">
        <div className="ck-h">
          <h2>Bremst</h2>
          <span className="ck-scope">negativster DB II · {windowLabel}</span>
        </div>
        <div className="ck-body">
          {movers.braking.length === 0 ? <div className="ck-empty">Kein Artikel mit negativem DB II im Fenster.</div> : (
            <div className="ck-mv">
              {movers.braking.map((e) => (
                <MoverRow key={e.articleId} e={e} value={`−${eur(Math.abs(e.dbII))}`} tone="crit" />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function MoverRow({ e, value, tone, meta }: { e: MoverEntry; value: string; tone: "good" | "crit" | "warn"; meta?: string }) {
  const q = encodeURIComponent(e.setCode ?? e.nameRaw);
  return (
    <div className="ck-mvr">
      <div className="ck-img" aria-hidden={e.imageUrl ? undefined : true}>
        {e.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.imageUrl} alt="" loading="lazy" width={40} height={56} />
        ) : (
          <span>{e.setCode ?? "—"}</span>
        )}
      </div>
      <div className="ck-nm">
        <a href={`/sortiment?q=${q}`}>{shortName(e.nameRaw)}</a>
      </div>
      <div className="ck-rv">{value}</div>
      <div className="ck-mt">
        <span>{e.qty} Stk</span>
        <span>Ø VK {eurCents(e.qty > 0 ? e.revenue / e.qty : 0)}</span>
        <span>DB II {pct(e.dbIIPercent)}</span>
        {meta && <span>{meta}</span>}
      </div>
      <div className="ck-mb">
        <i className={tone === "crit" ? "ck-neg" : tone === "warn" ? "ck-warn" : undefined} style={{ width: `${Math.max(3, e.relative * 100)}%` }} />
      </div>
    </div>
  );
}
