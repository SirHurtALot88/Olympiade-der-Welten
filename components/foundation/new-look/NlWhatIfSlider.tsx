"use client";

import { useId, type CSSProperties, type ReactNode } from "react";

/**
 * "Neuer Look" What-if-Slider (FM26-Stil) — flag-gated, rein präsentational.
 *
 * Ein wiederverwendbarer Regler, der eine LESE-Zeit-Prognose live vorschaubt,
 * ohne etwas zu committen: Der Aufrufer berechnet aus dem aktuellen `value` die
 * Vorschau (SP-Zuwachs / Netto-Delta / Risiko) und reicht sie über `previewSlots`
 * (bzw. `children`) herein. Diese Komponente rendert nur den Regler + Labels +
 * den Vorschau-Bereich und ruft `onChange` bei jeder Bewegung — kein Netzwerk,
 * keine Persistenz.
 *
 * Styling: Der Range-Input nutzt bewusst die bereits token-gestylte Klasse
 * `.nl-credits-slider` (siehe Kredite-View). Micro-Layout via Inline-Styles,
 * damit KEIN neuer globals.css-Eintrag nötig ist.
 */
export type NlWhatIfSliderProps = {
  /** Sichtbares Label des Reglers (mit dem Input assoziiert). */
  label: string;
  /** Aktueller Roh-Wert des Reglers (kontrolliert). */
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Menschenlesbare Darstellung des Roh-Werts (Wert-Badge + aria-valuetext-Fallback). */
  formatValue?: (value: number) => string;
  /**
   * Vollständige, sprechende Beschreibung des aktuellen Ergebnisses für
   * `aria-valuetext` (z. B. "Hart · +12,4 SP durch Training · Netto +3,1 SP").
   * Überschreibt `formatValue` für Screenreader.
   */
  valueText?: string;
  /** Die vom Aufrufer aus `value` berechnete Live-Vorschau. */
  previewSlots?: ReactNode;
  /** Alias für `previewSlots`. */
  children?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Optionale diskrete Tick-Beschriftungen unter der Spur (min…max, in Reihenfolge). */
  stops?: string[];
  /** Akzentfarbe für Spur/Accent (default: --nl-accent). */
  accentColor?: string;
  /** Kurzer Hilfetext unter dem Regler. */
  hint?: string;
};

const wrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const headRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "12px",
};

const valueBadgeStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: "14px",
  color: "var(--nl-ink)",
};

const stopsRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "11px",
  color: "var(--nl-mut)",
};

export function NlWhatIfSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  valueText,
  previewSlots,
  children,
  disabled = false,
  id,
  className,
  stops,
  accentColor,
  hint,
}: NlWhatIfSliderProps) {
  const reactId = useId();
  const inputId = id ?? `nl-whatif-${reactId}`;
  const span = max - min;
  const pct = span > 0 ? Math.min(100, Math.max(0, ((value - min) / span) * 100)) : 0;
  const accent = accentColor ?? "var(--nl-accent)";
  const valueLabel = formatValue ? formatValue(value) : String(value);
  const preview = previewSlots ?? children;

  return (
    <div className={["nl-whatif-slider", className ?? ""].filter(Boolean).join(" ")} style={wrapStyle}>
      <div style={headRowStyle}>
        <label htmlFor={inputId} style={{ fontWeight: 600, color: "var(--nl-ink)" }}>
          {label}
        </label>
        <span className="nl-tnum" style={valueBadgeStyle} aria-hidden="true">
          {valueLabel}
        </span>
      </div>

      <input
        id={inputId}
        type="range"
        className="nl-credits-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={valueText ?? valueLabel}
        style={{
          accentColor: accent,
          background: `linear-gradient(90deg, ${accent} ${pct}%, var(--nl-line) ${pct}%)`,
        }}
      />

      {stops && stops.length > 0 ? (
        <div style={stopsRowStyle} aria-hidden="true">
          {stops.map((stop, index) => (
            <span key={`nl-whatif-stop-${index}-${stop}`}>{stop}</span>
          ))}
        </div>
      ) : null}

      {hint ? (
        <small style={{ color: "var(--nl-mut)" }}>{hint}</small>
      ) : null}

      {preview ? (
        <div
          className="nl-whatif-slider-preview"
          style={{ display: "flex", flexDirection: "column", gap: "8px" }}
          aria-live="polite"
        >
          {preview}
        </div>
      ) : null}
    </div>
  );
}

export default NlWhatIfSlider;
