import type {
  SponsorArchetype,
  SponsorCurveFamily,
  SponsorCurveShape,
  SponsorRarity,
} from "@/lib/data/olyDataTypes";

/**
 * Sponsor curve-shape + rarity catalog (replaces the old star-tier + 3-archetype model).
 *
 * A curve SHAPE decides WHERE a sponsor's fixed Etat sits across the final table (Platz 1..32); the RARITY
 * decides HOW BIG that Etat is. Both are orthogonal to the salary anchor: every payout still scales with the
 * team's salary-anchored base floor (see `getSponsorCurveShapePayout` in sponsor-economy-calibration.ts), so
 * the salary factor stays the dominant driver and a small-wage team never collects an absurd multiple.
 *
 * The 11 shapes are normalized so each pays the SAME total Etat at a given rarity (equal area under the
 * rank→payout curve); they only redistribute it. All monotone-non-increasing (better rank ≥ worse rank, no
 * tanking incentive) and none is Pareto-dominated — each owns a unique win-band and a matching weak-band.
 *
 * `reference` = the 32 per-rank payouts at rarity `magisch` (×1.0) and salaryFactor 1.0 / leagueMin 32, i.e.
 * effectiveBaseFloor 36. `SPONSOR_REFERENCE_BASE_FLOOR` is that anchor; the per-rank multiplier a payout uses
 * is `reference[rank-1] / SPONSOR_REFERENCE_BASE_FLOOR`, then scaled by the live effectiveBaseFloor × rarity.
 */

export const SPONSOR_REFERENCE_BASE_FLOOR = 36;

export type SponsorCurveShapeDef = {
  family: SponsorCurveFamily;
  labelDe: string;
  proDe: string;
  conDe: string;
  /** Per-rank payout at magisch / sf 1.0 (index 0 = Platz 1 … 31 = Platz 32). Σ ≈ 1677, monotone. */
  reference: number[];
};

export const SPONSOR_CURVE_SHAPES: Record<SponsorCurveShape, SponsorCurveShapeDef> = {
  titeljaeger: {
    family: "titel",
    labelDe: "Titeljäger",
    proDe: "Die größte Titelprämie im Pool — die Auszahlung konzentriert sich ganz auf Platz 1.",
    conDe: "Ausgedünnte Mitte; außerhalb der Spitze unauffällig.",
    reference: [85, 78, 78, 78, 66.7, 66.7, 66.7, 66.7, 57.4, 57.4, 57.4, 57.4, 50.3, 50.3, 50.3, 50.3, 45.2, 45.2, 45.2, 45.2, 42.1, 42.1, 42.1, 42.1, 40, 40, 40, 40, 38, 38, 38, 38],
  },
  meisterschale: {
    family: "titel",
    labelDe: "Meisterschale",
    proDe: "Belohnt Platz 1–4 fast gleich stark — mit einem Extra-Bump für den Meister.",
    conDe: "Außerhalb der Top 4 nichts Besonderes.",
    reference: [83.4, 81.3, 81.3, 81.3, 67.1, 67.1, 67.1, 67.1, 56.9, 56.9, 56.9, 56.9, 49.8, 49.8, 49.8, 49.8, 44.7, 44.7, 44.7, 44.7, 41.7, 41.7, 41.7, 41.7, 39.6, 39.6, 39.6, 39.6, 37.6, 37.6, 37.6, 37.6],
  },
  koenigsklasse: {
    family: "titel",
    labelDe: "Königsklasse",
    proDe: "Gleiche Belohnung für jeden CL-Platz (1–4 gleich) — ideal, wenn das Ziel „irgendwie Top 4“ ist.",
    conDe: "Unter den Top 4 der stärkste Abfall der Titel-Familie.",
    reference: [83.9, 83.9, 83.9, 83.9, 68.5, 68.5, 68.5, 68.5, 57.3, 57.3, 57.3, 57.3, 49.1, 49.1, 49.1, 49.1, 44, 44, 44, 44, 40.9, 40.9, 40.9, 40.9, 38.9, 38.9, 38.9, 38.9, 36.8, 36.8, 36.8, 36.8],
  },
  europapokal: {
    family: "europa",
    labelDe: "Europapokal",
    proDe: "Beste Form, um die europäischen Plätze zu erreichen (5.–8.).",
    conDe: "Bescheidener Boden, kein Titel-Jackpot.",
    reference: [77.9, 77.9, 77.9, 77.9, 75, 75, 75, 75, 64.7, 64.7, 64.7, 64.7, 52.5, 52.5, 52.5, 52.5, 44.1, 44.1, 44.1, 44.1, 38.5, 38.5, 38.5, 38.5, 34.7, 34.7, 34.7, 34.7, 31.9, 31.9, 31.9, 31.9],
  },
  conference: {
    family: "europa",
    labelDe: "Conference-Rang",
    proDe: "Belohnt ein breiteres oberes Band bis Platz 12–16 (Geschwister von Europapokal).",
    conDe: "Niedrigere Spitze als Europapokal; im reinen 5.–8.-Rennen unterlegen.",
    reference: [69.6, 69.6, 69.6, 69.6, 69.6, 69.6, 69.6, 69.6, 66.8, 66.8, 66.8, 66.8, 59.2, 59.2, 59.2, 59.2, 47.9, 47.9, 47.9, 47.9, 39.5, 39.5, 39.5, 39.5, 34.8, 34.8, 34.8, 34.8, 32, 32, 32, 32],
  },
  stetig: {
    family: "stetig",
    labelDe: "Stetiger Aufstieg",
    proDe: "Beste Form fürs obere Mittelfeld (11.–12.) — belohnt stetiges kleines Klettern.",
    conDe: "Schwach, sobald man ins untere Mittelfeld abrutscht.",
    reference: [72.1, 72.1, 72.1, 72.1, 72.1, 72.1, 72.1, 72.1, 67.7, 67.7, 67.7, 67.7, 55.2, 55.2, 55.2, 55.2, 47.2, 47.2, 47.2, 47.2, 40.1, 40.1, 40.1, 40.1, 33.8, 33.8, 33.8, 33.8, 31.2, 31.2, 31.2, 31.2],
  },
  mittelfeld: {
    family: "stetig",
    labelDe: "Ambition Mittelfeld",
    proDe: "Beste Form für einen soliden oberen Tabellenplatz (9.–10.).",
    conDe: "Dünn unterhalb der Mitte; gewöhnlicher Boden.",
    reference: [69.1, 69.1, 69.1, 69.1, 69.1, 69.1, 69.1, 69.1, 69.1, 69.1, 66.4, 66.4, 58.3, 58.3, 58.3, 58.3, 48.4, 48.4, 48.4, 48.4, 40.4, 40.4, 40.4, 40.4, 35, 35, 35, 35, 31.4, 31.4, 31.4, 31.4],
  },
  aufsteiger: {
    family: "aufstieg",
    labelDe: "Aufsteiger",
    proDe: "Die klassische Keller-Flucht-Belohnung, am besten in der Lande-Zone 13–16.",
    conDe: "Kein Titel-Upside; Boden mittig — aber nicht der schlechteste.",
    reference: [64, 64, 64, 64, 64, 64, 64, 64, 62.5, 62.5, 62.5, 62.5, 59.3, 59.3, 59.3, 59.3, 52.3, 52.3, 52.3, 52.3, 45.3, 45.3, 45.3, 45.3, 39, 39, 39, 39, 32.8, 32.8, 32.8, 32.8],
  },
  konsolidierung: {
    family: "aufstieg",
    labelDe: "Konsolidierung",
    proDe: "Einzigartig beste Form über das ganze 17.–24.-Band — unteres Mittelfeld mit Luft nach oben.",
    conDe: "Oben (1–8) die schlechteste von allen — eine starke Saison ist verschenkt.",
    reference: [57.8, 57.8, 57.8, 57.8, 57.8, 57.8, 57.8, 57.8, 57.8, 57.8, 57.8, 57.8, 57.8, 57.8, 57.8, 57.8, 57.8, 57.8, 57.8, 57.8, 51.5, 51.5, 51.5, 51.5, 43.4, 43.4, 43.4, 43.4, 35.2, 35.2, 35.2, 35.2],
  },
  sicherheit: {
    family: "sicherheit",
    labelDe: "Sicherheit",
    proDe: "Am besten im Abstiegskampf (25.–28.), hoher verlässlicher Boden.",
    conDe: "Niedrigste Spitze der Mitte; eine gute Saison kaum belohnt.",
    reference: [59.8, 59.8, 59.8, 59.8, 59.8, 59.8, 59.8, 59.8, 57, 57, 57, 57, 54.3, 54.3, 54.3, 54.3, 51.5, 51.5, 51.5, 51.5, 48.7, 48.7, 48.7, 48.7, 46, 46, 46, 46, 42.3, 42.3, 42.3, 42.3],
  },
  klassenerhalt: {
    family: "sicherheit",
    labelDe: "Klassenerhalt",
    proDe: "Höchster garantierter Absolut-Boden im Pool — flache Auszahlung, die selbst bei Platz 32 nicht fällt.",
    conDe: "Die flachste Kurve; fast keine Belohnung fürs Klettern.",
    reference: [62.1, 62.1, 62.1, 62.1, 62.1, 62.1, 59.9, 59.9, 56.6, 56.6, 56.6, 56.6, 53.4, 53.4, 53.4, 53.4, 50.1, 50.1, 50.1, 50.1, 46.8, 46.8, 46.8, 46.8, 44.7, 44.7, 44.7, 44.7, 44.7, 44.7, 44.7, 44.7],
  },
};

export const SPONSOR_CURVE_SHAPE_KEYS = Object.keys(SPONSOR_CURVE_SHAPES) as SponsorCurveShape[];

export type SponsorCurveFamilyDef = { labelDe: string; noteDe: string; order: number };

export const SPONSOR_CURVE_FAMILIES: Record<SponsorCurveFamily, SponsorCurveFamilyDef> = {
  titel: { labelDe: "Titel / Podest", noteDe: "Boom-or-bust — höchste Spitze", order: 0 },
  europa: { labelDe: "Europa", noteDe: "Oberes Mittelfeld / europäische Plätze", order: 1 },
  stetig: { labelDe: "Stetig", noteDe: "Solides Mittelfeld", order: 2 },
  aufstieg: { labelDe: "Aufstieg", noteDe: "Keller-Flucht — Boden mittig", order: 3 },
  sicherheit: { labelDe: "Sicherheit", noteDe: "Höchster Boden, niedrigste Spitze", order: 4 },
};

export type SponsorRarityDef = {
  labelDe: string;
  /** Etat multiplier vs magisch (the ×1.0 reference). Bounded 0.90..1.15 (owner-set), salary-anchored. */
  etatFactor: number;
  /** Diablo-style loot color (grey/blue/yellow/orange) for the sponsor list. */
  colorHex: string;
  /** Relative draw weight (higher = more common). Modulated at draw time by commercial rating / beliebtheit. */
  drawWeight: number;
  order: number;
};

/** Rarity draw weights are ENV-tunable; defaults: common most likely, legendary rare. */
const RARITY_WEIGHT = {
  gewöhnlich: Number(process.env.OLY_SPONSOR_RARITY_W_COMMON ?? 50) || 50,
  magisch: Number(process.env.OLY_SPONSOR_RARITY_W_MAGIC ?? 30) || 30,
  selten: Number(process.env.OLY_SPONSOR_RARITY_W_RARE ?? 14) || 14,
  legendär: Number(process.env.OLY_SPONSOR_RARITY_W_LEGENDARY ?? 6) || 6,
};

export const SPONSOR_RARITIES: Record<SponsorRarity, SponsorRarityDef> = {
  gewöhnlich: { labelDe: "Gewöhnlich", etatFactor: Number(process.env.OLY_SPONSOR_RARITY_F_COMMON ?? 0.9) || 0.9, colorHex: "#98a2ab", drawWeight: RARITY_WEIGHT.gewöhnlich, order: 0 },
  magisch: { labelDe: "Magisch", etatFactor: Number(process.env.OLY_SPONSOR_RARITY_F_MAGIC ?? 1.0) || 1.0, colorHex: "#4f9be0", drawWeight: RARITY_WEIGHT.magisch, order: 1 },
  selten: { labelDe: "Selten", etatFactor: Number(process.env.OLY_SPONSOR_RARITY_F_RARE ?? 1.07) || 1.07, colorHex: "#e0b83a", drawWeight: RARITY_WEIGHT.selten, order: 2 },
  legendär: { labelDe: "Legendär", etatFactor: Number(process.env.OLY_SPONSOR_RARITY_F_LEGENDARY ?? 1.15) || 1.15, colorHex: "#e07f2e", drawWeight: RARITY_WEIGHT.legendär, order: 3 },
};

export const SPONSOR_RARITY_KEYS = Object.keys(SPONSOR_RARITIES) as SponsorRarity[];

export function getSponsorRarityEtatFactor(rarity: SponsorRarity): number {
  return SPONSOR_RARITIES[rarity]?.etatFactor ?? 1;
}

export function getSponsorCurveFamily(shape: SponsorCurveShape): SponsorCurveFamily {
  return SPONSOR_CURVE_SHAPES[shape]?.family ?? "stetig";
}

/**
 * Per-rank payout multiplier of a shape relative to the reference base floor, i.e. `reference[rank]/36`.
 * `getSponsorCurveShapePayout` (in calibration) multiplies this by the live salary-anchored effectiveBaseFloor
 * and the rarity Etat factor. Rank is clamped to 1..32.
 */
export function getSponsorCurveShapeRankMultiplier(shape: SponsorCurveShape, finalRank: number): number {
  const def = SPONSOR_CURVE_SHAPES[shape] ?? SPONSOR_CURVE_SHAPES.sicherheit;
  const boundedRank = Math.min(32, Math.max(1, Math.round(finalRank)));
  return def.reference[boundedRank - 1]! / SPONSOR_REFERENCE_BASE_FLOOR;
}

// ── Migration mappers (old star tier / archetype → rarity / curve shape) ────────────────────────────────

/**
 * Legacy-save migration ONLY: deterministic legacy map ★1..★5 → rarity (4 buckets). ★2 folds into
 * gewöhnlich, keeping legendär for ★5. The star-tier system itself is gone; this mapper exists purely so
 * pre-rarity save blobs (which still carry a raw numeric star tier) migrate to a rarity on load.
 */
export function mapStarTierToRarity(starTier: number | null | undefined): SponsorRarity {
  const t = typeof starTier === "number" ? starTier : 3;
  if (t >= 5) return "legendär";
  if (t >= 4) return "selten";
  if (t >= 3) return "magisch";
  return "gewöhnlich";
}

/** Legacy archetype → a representative curve shape (security=floor, performance=upside, identity=neutral). */
export function mapArchetypeToCurveShape(archetype: SponsorArchetype | null | undefined): SponsorCurveShape {
  if (archetype === "security") return "sicherheit";
  if (archetype === "performance") return "titeljaeger";
  return "aufsteiger";
}
