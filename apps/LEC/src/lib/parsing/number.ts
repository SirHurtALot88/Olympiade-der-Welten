/**
 * Zahlen-/Waehrungsparser fuer die Billbee/eBay-Rohdaten.
 *
 * Die Exporte mischen Dezimaltrennzeichen: saubere neue Exporte sind deutsch
 * (Komma = Dezimaltrennzeichen, Punkt = Tausendertrennzeichen, z. B.
 * "1.234,56 EUR"), einige (aeltere/gebrochene) Zellen liefern aber
 * Punkt-Dezimalzahlen ohne Tausendertrennung ("3.79"). Excel-Buchhaltungsformat
 * nutzt ausserdem "- 0 EUR" als Darstellung fuer Null.
 *
 * Regeln (siehe docs/enterich-cards/KONZEPT.md Abschnitt 5.3/1.3):
 * - Komma + Punkt gemeinsam -> das letzte Zeichen der beiden ist das
 *   Dezimaltrennzeichen, das andere wird als Tausendertrennzeichen entfernt.
 * - Nur Komma -> Komma ist Dezimaltrennzeichen (deutsche Konvention).
 * - Nur Punkt, ein Vorkommen, genau 2 Nachkommastellen -> Dezimaltrennzeichen
 *   ("3.79" -> 3.79).
 * - Nur Punkt, ein Vorkommen, genau 3 Nachkommastellen -> Tausendertrennzeichen
 *   ("1.234" -> 1234), da Centbetraege in diesen Exporten immer 2-stellig sind.
 * - Mehrere Punkte ohne Komma -> immer Tausendertrennzeichen ("12.345.678").
 */

// Waehrungssymbol Euro (U+20AC), NBSP (U+00A0) und Prozent werden vor dem
// Parsen entfernt. Escapes statt Literalen, damit die Datei reines ASCII bleibt.
const CURRENCY_AND_PERCENT = new RegExp("[€$%]", "g");
const WHITESPACE = new RegExp("[\\s ]+", "g");

export function parseGermanNumber(raw: string | number | null | undefined): number {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : 0;
  }
  if (raw === null || raw === undefined) {
    return 0;
  }

  let cleaned = raw
    .replace(CURRENCY_AND_PERCENT, "")
    .replace(/EUR/gi, "")
    .replace(WHITESPACE, "");

  if (cleaned.length === 0) {
    return 0;
  }

  let sign = 1;
  if (cleaned.startsWith("-")) {
    sign = -1;
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  if (cleaned.length === 0) {
    // reine Vorzeichen-Zelle (Excel-Buchhaltungsformat "- EUR" fuer Null)
    return 0;
  }

  const value = parseCleanedNumber(cleaned);
  if (!Number.isFinite(value)) {
    return 0;
  }
  const signed = sign * value;
  return signed === 0 ? 0 : signed;
}

function parseCleanedNumber(cleaned: string): number {
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      // Komma ist Dezimaltrennzeichen, Punkte sind Tausendergruppen.
      return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
    }
    // Punkt ist Dezimaltrennzeichen, Kommas sind Tausendergruppen.
    return parseFloat(cleaned.replace(/,/g, ""));
  }

  if (hasComma) {
    return parseFloat(cleaned.replace(",", "."));
  }

  if (hasDot) {
    const dotCount = (cleaned.match(/\./g) ?? []).length;
    if (dotCount > 1) {
      return parseFloat(cleaned.replace(/\./g, ""));
    }
    const afterDot = cleaned.split(".")[1] ?? "";
    if (afterDot.length === 3) {
      return parseFloat(cleaned.replace(".", ""));
    }
    return parseFloat(cleaned);
  }

  return parseFloat(cleaned);
}
