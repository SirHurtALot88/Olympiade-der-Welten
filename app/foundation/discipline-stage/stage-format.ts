// Geteilte Formatierung für die Disziplin-Bühne — vermeidet, dass fmt1/ampel
// in mehreren Dateien auseinanderdriften (z.B. Ampel-Schwellen).

/** Zahl mit max. 1 Nachkommastelle (nachlaufende .0 weg); nullish → "–". */
export function fmt1(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return "–";
  const v = Math.round(x * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Rang → Ampelfarbe (Design-Token). 1-3 gut, 4-10 warn, 11-20 neutral, ab 21 rot. */
export function ampel(rank: number): string {
  if (rank <= 3) return "var(--nl-good)";
  if (rank <= 10) return "var(--nl-warn)";
  if (rank <= 20) return "var(--nl-mut)";
  return "var(--nl-risk)";
}
