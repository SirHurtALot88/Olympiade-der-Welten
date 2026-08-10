/**
 * DIE Rang-Skala für „Bestwert → Schlusslicht" (Muster 2 des UI-Umbaus, Paket F2).
 *
 * Theme-FEST: Gold → good → warn → risk. Vorher stand das Spitzenviertel auf
 * `accent` — mit rotem Team-Theme sahen Rang 1 (accent = Teamrot) und Rang 31
 * (risk = Rot) gleich aus. Bedeutungsfarben dürfen deshalb NIE aus der
 * Teamfarbe kommen: `accent` fliegt aus jeder Skala, die auch `risk` enthält.
 * Gold ist das Medaillen-Token (`--nl-gold`) — themeunabhängig, und „Gold =
 * das Beste" braucht keine Legende.
 *
 * Beide Rang-Färbungen der App laufen hier durch: das Disziplin-Profil
 * (teams-v2, rang-basiert) und die Liga-Perzentil-Chips der Spielerliste
 * (players-table, pool-basiert über `getPoolHeatTone`). EINE Skala, nicht
 * zwei ähnliche.
 */

/** Ton der Rang-Skala. Bewusst OHNE `accent` — siehe Kopfkommentar. */
export type QuartileTone = "gold" | "good" | "warn" | "risk" | "neutral";

/**
 * Ton nach Position im Feld: Rang 1 = Bestwert.
 * Spitzenviertel Gold, dann good/warn/risk je Viertel.
 */
export function getQuartileRankTone(rank: number | null | undefined, fieldSize: number): QuartileTone {
  if (rank == null || !Number.isFinite(rank) || rank < 1 || fieldSize <= 1) {
    return "neutral";
  }
  const ratio = (rank - 1) / (fieldSize - 1);
  if (ratio <= 1 / 4) return "gold";
  if (ratio <= 1 / 2) return "good";
  if (ratio <= 3 / 4) return "warn";
  return "risk";
}

/**
 * Dieselbe Skala für einen Wert innerhalb eines Vergleichspools (höher =
 * besser): der Rang wird gezählt (1 + Anzahl strikt besserer Werte), dann
 * gilt `getQuartileRankTone`. Ein Pool ohne Spreizung (alle gleich, < 2
 * Werte) bewertet nichts — `neutral`, keine Erfindung.
 */
export function getPoolQuartileTone(
  value: number | null | undefined,
  pool: Array<number | null | undefined>,
): QuartileTone {
  if (value == null || !Number.isFinite(value)) {
    return "neutral";
  }
  const numeric = pool.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
  if (numeric.length < 2) {
    return "neutral";
  }
  let min = numeric[0]!;
  let max = numeric[0]!;
  let besser = 0;
  for (const entry of numeric) {
    if (entry > value) besser += 1;
    if (entry < min) min = entry;
    if (entry > max) max = entry;
  }
  if (min === max) {
    return "neutral";
  }
  return getQuartileRankTone(besser + 1, numeric.length);
}
