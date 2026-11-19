"use client";

import {
  MINDEST_NOTEN,
  type WeitereFilter,
} from "@/lib/market/transfermarkt-weitere-filter";
import { TRANSFERMARKT_ATTRIBUTE_KEYS, TRANSFERMARKT_ATTRIBUTE_META } from "@/lib/market/transfermarkt-attribute-filter";
import type { MarktAchse } from "@/lib/market/transfermarkt-sicht";

const FARBEN: { achse: MarktAchse; label: string; farbe: string }[] = [
  { achse: "pow", label: "POW rot", farbe: "#ff7a6e" },
  { achse: "spe", label: "SPE grün", farbe: "#5fd68a" },
  { achse: "men", label: "MEN blau", farbe: "#6fb0ff" },
  { achse: "soc", label: "SOC gelb", farbe: "#f3cf5a" },
];

function zahl(wert: string): number | null {
  if (wert.trim() === "") return null;
  const n = Number(wert.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const feld = { width: "calc(5 * var(--u))", height: "calc(1.8 * var(--u))", padding: "0 calc(.4 * var(--u))", borderRadius: "calc(.3 * var(--u))", border: "1px solid var(--linie-2)", background: "var(--flaeche-2)", color: "var(--tinte)" } as const;

/** Die aufklappbaren Standardfilter des Transfermarkts: Marktwert, Gehalt, Value, Kartenfarbe, Mindestnote je Attribut. */
export default function WeitereFilterPanel({ filter, onChange }: { filter: WeitereFilter; onChange: (f: WeitereFilter) => void }) {
  return (
    <div className="fl" style={{ flexWrap: "wrap", whiteSpace: "normal", overflow: "visible", rowGap: "calc(.4 * var(--u))" }} data-testid="tm-weitere-panel">
      <span className="gk">Kartenfarbe</span>
      {FARBEN.map((f) => {
        const an = filter.farben.includes(f.achse);
        return (
          <button
            type="button"
            key={f.achse}
            className={`fc${an ? " an" : ""}`}
            style={an ? undefined : { color: f.farbe, borderColor: f.farbe }}
            title="Klassen dieser Formkarten-Farbe"
            onClick={() => onChange({ ...filter, farben: an ? filter.farben.filter((x) => x !== f.achse) : [...filter.farben, f.achse] })}
          >
            {f.label}
          </button>
        );
      })}
      <span className="gk">Marktwert</span>
      <input style={feld} inputMode="decimal" placeholder="von" aria-label="Marktwert mindestens" value={filter.mwMin ?? ""} onChange={(e) => onChange({ ...filter, mwMin: zahl(e.target.value) })} />
      <input style={feld} inputMode="decimal" placeholder="bis" aria-label="Marktwert höchstens" value={filter.mwMax ?? ""} onChange={(e) => onChange({ ...filter, mwMax: zahl(e.target.value) })} />
      <span className="gk">Gehalt/Saison bis</span>
      <input style={feld} inputMode="decimal" placeholder="max" aria-label="Gehalt höchstens" value={filter.gehaltMax ?? ""} onChange={(e) => onChange({ ...filter, gehaltMax: zahl(e.target.value) })} />
      <span className="gk" title="Value = Marktwert ÷ Gehalt">Value ab</span>
      <input style={feld} inputMode="decimal" placeholder="min" aria-label="Value mindestens" value={filter.valueMin ?? ""} onChange={(e) => onChange({ ...filter, valueMin: zahl(e.target.value) })} />
      <span className="sp" />
      <span className="gk" style={{ flexBasis: "100%" }}>Mindestnote je Attribut (nur sichtbare Werte)</span>
      {TRANSFERMARKT_ATTRIBUTE_KEYS.map((key) => {
        const meta = TRANSFERMARKT_ATTRIBUTE_META[key];
        const wert = filter.attributMin[key];
        return (
          <label key={key} style={{ display: "inline-flex", alignItems: "center", gap: "calc(.25 * var(--u))" }} title={`${meta.label}: Mindestnote`}>
            <small>{meta.abbr}</small>
            <select
              aria-label={`${meta.label} Mindestnote`}
              value={wert ?? ""}
              style={{ ...feld, width: "calc(4 * var(--u))", padding: 0 }}
              onChange={(e) => {
                const attributMin = { ...filter.attributMin };
                if (e.target.value === "") delete attributMin[key];
                else attributMin[key] = Number(e.target.value);
                onChange({ ...filter, attributMin });
              }}
            >
              <option value="">–</option>
              {MINDEST_NOTEN.map((n) => (
                <option key={n.index} value={n.index}>≥ {n.label}</option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
