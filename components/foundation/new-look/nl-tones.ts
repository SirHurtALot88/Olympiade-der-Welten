/**
 * New-Look Ton-Vokabular ("Neuer Look" Design-System).
 *
 * Achsen-Töne (pow/spe/men/soc) tragen die Spiel-Identität,
 * semantische Töne (good/warn/risk) sind bewusst vom Akzent getrennt.
 * `gold` ist die Spitzen-Stufe der Rang-Skala „Bestwert → Schlusslicht"
 * (lib/foundation/quartile-tone.ts) — themefest, nie die Teamfarbe.
 * `elite` ist das Gegenstück für WERT-Skalen (Depth-Chart ab Rating 80):
 * ebenfalls themefest, aber hellblau statt gold. Chris' Entscheidung — Gold
 * lag dort zu nah an `warn` der Stufe darunter, und `accent` scheidet aus,
 * weil es die Vereinsfarbe trägt.
 * Alle Farben kommen aus den `--nl-*` Tokens in `app/globals.css`
 * und greifen nur unterhalb von `.is-new-look`.
 */
export type NlTone =
  | "pow"
  | "spe"
  | "men"
  | "soc"
  | "accent"
  | "gold"
  | "elite"
  | "good"
  | "warn"
  | "risk"
  | "neutral";

export type NlAxisKey = "pow" | "spe" | "men" | "soc";

/** CSS-Klasse, die `--nl-tone` auf die passende Token-Farbe setzt. */
export function nlToneClass(tone: NlTone | undefined | null): string {
  return `nl-tone-${tone ?? "neutral"}`;
}

/**
 * Direkte Token-Referenz mit Fallback-Farbe, damit SVG-Primitives
 * auch außerhalb von `.is-new-look` (z. B. in Isolation/Storybook)
 * sinnvoll rendern.
 */
export const NL_TONE_VAR: Record<NlTone, string> = {
  pow: "var(--nl-pow, #ff6b6b)",
  spe: "var(--nl-spe, #57d08a)",
  men: "var(--nl-men, #5b9bff)",
  soc: "var(--nl-soc, #e6b455)",
  accent: "var(--nl-accent, #5b9bff)",
  gold: "var(--nl-gold, #f6c750)",
  elite: "var(--nl-elite, #5b9bff)",
  good: "var(--nl-good, #4cc56b)",
  warn: "var(--nl-warn, #e0a53a)",
  risk: "var(--nl-risk, #e5615a)",
  neutral: "var(--nl-mut, #93a3bd)",
};

export const NL_AXIS_LABELS: Record<NlAxisKey, string> = {
  pow: "POW",
  spe: "SPE",
  men: "MEN",
  soc: "SOC",
};

/** Zahlformat (de-DE), null-sicher. */
export function formatNlNumber(value: number | null | undefined, maximumFractionDigits = 1): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  // Clamp a magnitude that rounds to zero so we never render a stray "-0".
  const normalized = Math.round(value * 10 ** maximumFractionDigits) === 0 ? 0 : value;
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits }).format(normalized);
}

/** Vorzeichenbehaftetes Zahlformat ("+4,2" / "-4,2" / "0"), null-sicher. */
export function formatNlSignedNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNlNumber(value, digits)}`;
}

/**
 * Trend-Ton aus einem Saison-Delta — DIESELBE Quelle wie der Delta-Chip daneben.
 *
 * Chris' Screenshot-Befund (Team-Seite): die Cash-Sparkline war fest auf `good`
 * verdrahtet und leuchtete grün, während Cash von 91,3 auf 2,5 Mio fiel und der
 * Delta-Chip daneben korrekt rot war. Bedeutungsfarbe muss Bedeutung tragen:
 * steigt das Delta → good, fällt es → risk, kein Delta/±0 → neutral.
 */
export function nlTrendToneFromDelta(delta: number | null | undefined): NlTone {
  if (delta == null || !Number.isFinite(delta) || delta === 0) {
    return "neutral";
  }
  return delta > 0 ? "good" : "risk";
}

/** Vorzeichenbehaftetes Prozentformat ("+4%" / "-4%" / "0%"), null-sicher. */
export function formatNlSignedPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNlNumber(value, 0)}%`;
}
