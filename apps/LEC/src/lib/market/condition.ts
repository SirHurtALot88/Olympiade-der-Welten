/**
 * Kartenzustand und Preisabschlag (Chris, 13.11.2026): Der Cardmarket-Preisfuehrer kennt keinen Zustandsfilter, seine Preise
 * gelten fuer NM. Ist eine Karte EX, GD, LP, PL oder Poor, waere der Marktwert sonst zu hoch.
 *
 * Reihenfolge bei Cardmarket: Mint > Near Mint > Excellent > Good > Light Played > Played > Poor.
 * Die Faktoren sind Richtwerte (Anteil vom NM-Preis), bewusst in einer Tabelle, damit Chris sie anpassen kann.
 */
export type CardCondition = "NM" | "EX" | "GD" | "LP" | "PL" | "PO";

export const CONDITION_FACTOR: Record<CardCondition, number> = {
  NM: 1,
  EX: 0.85,
  GD: 0.75,
  LP: 0.65,
  PL: 0.5,
  PO: 0.35,
};

const WORDS: [RegExp, CardCondition][] = [
  [/\b(?:poor|po|hp|heavily\s+played|heavy\s+played)\b/i, "PO"],
  [/\b(?:light(?:ly)?\s+played|slightly\s+played|lp|sp)\b/i, "LP"],
  [/\b(?:moderately\s+played|mp|pl)\b/i, "PL"],
  [/\b(?:good|gd)\b/i, "GD"],
  [/\b(?:excellent|ex)\b/i, "EX"],
  // "Played" ohne Zusatz heisst bei Cardmarket Played (PL); steht zuletzt, damit "Light Played" vorher greift
  [/\bplayed\b/i, "PL"],
];

/** Zustand aus dem Artikeltitel; ohne Angabe gilt NM. */
export function conditionOf(title: string): CardCondition {
  for (const [re, c] of WORDS) if (re.test(title)) return c;
  return "NM";
}

export function conditionFactor(title: string): number {
  return CONDITION_FACTOR[conditionOf(title)];
}
