import type { BulletGuardrail } from "@/lib/cockpit/guardrails";
import type { Planwerte } from "@/lib/cockpit/planwerte";
import { eur } from "./format";

/**
 * Leitplanken als Bullet Graphs (Few): dicker Ist-Balken, duenne Marken, graue/ getoente
 * Kontextbaender. Alle Marken sind PLANWERTE aus src/lib/cockpit/planwerte.ts (gekennzeichnet),
 * nichts davon ist in der Oberflaeche einstellbar.
 */
export function GuardrailsCard({ guardrails, planwerte }: { guardrails: BulletGuardrail[]; planwerte: Planwerte }) {
  return (
    <section className="ck-card ck-c5" aria-label="Leitplanken">
      <div className="ck-h">
        <h2>Leitplanken {planwerte.planjahr}</h2>
        <span className="ck-scope">
          rollierend 365 T vs. Planwerte<span className="ck-plan">Planwert</span>
        </span>
      </div>
      <div className="ck-body">
        {guardrails.map((g) => (
          <Bullet key={g.key} g={g} />
        ))}
        <p className="ck-note">
          Planwerte (Gewinnprognose {eur(planwerte.gewinnPrognoseFinanzamtEur)}, Zielkorridor {eur(planwerte.gewinnZielkorridorEur.von)}–
          {eur(planwerte.gewinnZielkorridorEur.bis)}, Arbeitsgrenze {eur(planwerte.umsatzArbeitsgrenzeEur)}, § 19-Grenze{" "}
          {eur(planwerte.kleinunternehmerGrenzeEur)}, Warenbudget {eur(planwerte.warenbudgetNovDezEur)}) werden per Code gepflegt, nicht hier.
        </p>
      </div>
    </section>
  );
}

function Bullet({ g }: { g: BulletGuardrail }) {
  const span = g.axisMax - g.axisMin || 1;
  const x = (v: number) => Math.max(0, Math.min(100, ((v - g.axisMin) / span) * 100));
  const zero = x(0);
  const value = g.value;
  const markerTitle = g.markers.map((m) => `${m.label} ${eur(m.value)}`).join(" · ");

  return (
    <div className="ck-bullet">
      <div className="ck-bh">
        <b>{g.title}</b>
        <span className={`ck-bv ck-${g.tone}`}>{value === null ? "—" : eur(value)}</span>
      </div>
      <div className="ck-bt" role="img" aria-label={`${g.title}: ${value === null ? "keine Daten" : eur(value)}; ${markerTitle}`} title={markerTitle}>
        {g.bands.map((b, i) => {
          const from = Number.isFinite(b.from) ? b.from : g.axisMin;
          const to = Number.isFinite(b.to) ? b.to : g.axisMax;
          const l = x(from);
          const r = x(to);
          if (r <= l) return null;
          return <span key={i} className={`ck-band ck-${b.tone}`} style={{ left: `${l}%`, width: `${r - l}%` }} title={b.label} />;
        })}
        {g.axisMin < 0 && <span className="ck-zero" style={{ left: `${zero}%` }} />}
        {value !== null && (
          <span
            className={`ck-ist${value < 0 ? " ck-neg" : ""}`}
            style={value >= 0 ? { left: `${zero}%`, width: `${x(value) - zero}%` } : { left: `${x(value)}%`, width: `${zero - x(value)}%` }}
            title={`Ist ${eur(value)}`}
          />
        )}
        {g.markers.map((m, i) => (
          <span key={m.label} className={`ck-mk${i > 0 ? " ck-thin" : ""}`} style={{ left: `${x(m.value)}%` }} title={`${m.label}: ${eur(m.value)}`} />
        ))}
      </div>
      <div className="ck-bl">
        {g.markers.map((m) => (
          <span key={m.label}>
            <i />
            {m.label} {eur(m.value)}
          </span>
        ))}
      </div>
      <div className="ck-basis">{value === null && g.emptyHinweis ? `${g.emptyHinweis} ` : ""}{g.basisHinweis}</div>
    </div>
  );
}
