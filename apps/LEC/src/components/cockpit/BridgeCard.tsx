import type { Bridge } from "@/lib/cockpit/bridge";
import { eur, pct } from "./format";

/**
 * Deckungsbeitrags-Bruecke als horizontaler Waterfall (HTML/CSS, kein JS). Summenbalken (Umsatz,
 * DB I/II/III) in Serie 1, Abzuege in Status-Rot -- jeder Balken traegt Wert + Anteil als Text,
 * Rot ist nie der einzige Traeger der Information.
 */
export function BridgeCard({ bridge, windowLabel }: { bridge: Bridge; windowLabel: string }) {
  const span = bridge.max - bridge.min || 1;
  const x = (v: number) => ((v - bridge.min) / span) * 100;
  const zeroLeft = x(0);
  const hasData = bridge.revenue > 0;

  return (
    <section className="ck-card ck-c7" aria-label="Deckungsbeitrags-Brücke">
      <div className="ck-h">
        <h2>Wo bleibt die Marge?</h2>
        <span className="ck-scope">Deckungsbeitrags-Brücke · {windowLabel}</span>
      </div>
      <div className="ck-body">
        {!hasData ? (
          <div className="ck-empty">Keine Verkäufe im Fenster {windowLabel}.</div>
        ) : (
          <div className="ck-wf" role="img" aria-label={`Brücke von Umsatz ${eur(bridge.revenue)} zu DB III ${eur(bridge.steps[bridge.steps.length - 1].value)}`}>
            {bridge.steps.map((s) => {
              const isTotal = s.kind === "total";
              const left = isTotal ? Math.min(zeroLeft, x(s.value)) : x(Math.min(s.runningAfter, s.runningAfter + s.value));
              const right = isTotal ? Math.max(zeroLeft, x(s.value)) : x(Math.max(s.runningAfter, s.runningAfter + s.value));
              const width = Math.max(0.4, right - left);
              const loss = isTotal && s.value < 0;
              const title = isTotal
                ? `${s.label}: ${eur(s.value)} (${pct(s.shareOfRevenue, 1)} vom Umsatz)`
                : `${s.label}: −${eur(s.value)} (${pct(s.shareOfRevenue, 1)} vom Umsatz)`;
              return (
                <Row key={s.key} title={title}>
                  <div className={`ck-wl${isTotal ? " ck-tot" : ""}`}>{s.label}</div>
                  <div className="ck-wt">
                    <span className="ck-zero" style={{ left: `${zeroLeft}%` }} />
                    <span className={`ck-wb ${isTotal ? "ck-tot" : "ck-neg"}${loss ? " ck-loss" : ""}`} style={{ left: `${left}%`, width: `${width}%` }} />
                  </div>
                  <div className={`ck-wv${isTotal ? " ck-tot" : ""}`}>
                    {isTotal ? eur(s.value) : `−${eur(s.value)}`}
                    <span>{pct(s.shareOfRevenue)}</span>
                  </div>
                </Row>
              );
            })}
          </div>
        )}
        <p className="ck-note">
          DB I = Umsatz − Wareneinsatz · DB II = DB I − eBay − Versand/Verpackung · DB III = DB II − Fixkostenanteil. Alles aus den gespeicherten
          Fenster-Snapshots, Fixkosten shopweit je Stück umgelegt.
        </p>
      </div>
    </section>
  );
}

/** Drei Grid-Zellen mit gemeinsamem Tooltip -- `display: contents`, damit das Raster der Karte greift. */
function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "contents" }} title={title}>
      {children}
    </div>
  );
}
