/**
 * New-Look Ton-Vokabular ("Neuer Look" Design-System).
 *
 * Achsen-Töne (pow/spe/men/soc) tragen die Spiel-Identität,
 * semantische Töne (good/warn/risk) sind bewusst vom Akzent getrennt.
 * Alle Farben kommen aus den `--nl-*` Tokens in `app/globals.css`
 * und greifen nur unterhalb von `.is-new-look`.
 */
export type NlTone =
  | "pow"
  | "spe"
  | "men"
  | "soc"
  | "accent"
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
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits }).format(value);
}
