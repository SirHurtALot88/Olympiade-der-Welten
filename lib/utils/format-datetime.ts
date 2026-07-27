/**
 * Shared German (de-DE) date/time formatting with an EXPLICIT `timeZone`.
 *
 * Both players are in Germany, so every human-facing timestamp should read in
 * German wall-clock time (MEZ/MESZ), not whatever timezone the process
 * happens to run in. Passing `timeZone` explicitly (instead of relying on the
 * ambient `TZ`/Intl default) makes the output deterministic on the server,
 * in the browser, and in CI alike, and avoids SSR/client hydration
 * mismatches when the server and browser disagree on their local timezone.
 *
 * NOTE: this only changes how timestamps are *displayed*. Everything that is
 * *stored* stays ISO-8601 UTC (`new Date().toISOString()`) — do not use these
 * helpers for persistence.
 */

export const GERMAN_TIME_ZONE = "Europe/Berlin";

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Full German date+time, e.g. "26.7.2026, 14:00:00". Accepts any
 * `Intl.DateTimeFormatOptions` to override the default fields (the
 * `timeZone` itself always stays `Europe/Berlin` and cannot be overridden).
 */
export function formatGermanDateTime(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return toDate(value).toLocaleString("de-DE", { ...options, timeZone: GERMAN_TIME_ZONE });
}

/** German date only, e.g. "26.7.2026". */
export function formatGermanDate(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  return toDate(value).toLocaleDateString("de-DE", { ...options, timeZone: GERMAN_TIME_ZONE });
}

/**
 * Short "day.month hour:minute" stamp used when baking a timestamp into a
 * generated save name (e.g. "Save 26.07. 14:00"). Defaults to "now".
 */
export function formatGermanSaveTimestamp(value: DateInput = new Date()): string {
  return formatGermanDateTime(value, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
