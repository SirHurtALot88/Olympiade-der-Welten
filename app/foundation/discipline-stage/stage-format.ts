// Geteilte Formatierung für die Disziplin-Bühne — vermeidet, dass fmt1/ampel
// in mehreren Dateien auseinanderdriften (z.B. Ampel-Schwellen).

/** Zahl mit max. 1 Nachkommastelle (nachlaufende .0 weg); nullish → "–". */
export function fmt1(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return "–";
  const v = Math.round(x * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/**
 * Rang → Ampelfarbe (Design-Token). Top-10 klar grün→gelb→rot,
 * 11-20 neutral-grau, 21-32 gedämpft (abgeschlagen).
 *   1-3   grün   (Podest-Nähe)
 *   4-7   gelb   (oberes Mittelfeld)
 *   8-10  rot    (unteres Top-10)
 *   11-20 grau   (Mittelfeld)
 *   21-32 dunkelgrau/gedämpft
 */
export function ampel(rank: number): string {
  if (rank <= 3) return "var(--nl-good)";
  if (rank <= 7) return "var(--nl-warn)";
  if (rank <= 10) return "var(--nl-risk)";
  if (rank <= 20) return "var(--nl-mut)";
  return "var(--nl-mut-2, var(--nl-mut))";
}
