import type {
  SponsorArchetype,
  SponsorCurveFamily,
  SponsorCurveShape,
  SponsorRarity,
} from "@/lib/data/olyDataTypes";
import {
  SPONSOR_CURVE_SHAPE_KEYS,
  SPONSOR_RARITIES,
  SPONSOR_RARITY_KEYS,
  getSponsorCurveFamily,
} from "@/lib/sponsor/sponsor-curve-shapes";
import type { SponsorTeamQualityRank } from "@/lib/sponsor/sponsor-team-quality-rank";

/** ENV-Zahl, die EXPLIZIT 0 erlaubt (0 = Feature aus), im Gegensatz zum "0→fallback"-Muster anderswo. */
function envNum(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Golden-Sponsor-Los (Abschnitt 2.2). Höchstens EIN Slot/Team kann golden werden. Wahrscheinlichkeit ist
 * underdog- (schwache Teams höher) + beliebtheits-gewichtet, mit Cooldown, hart gedeckelt bei P_MAX:
 *   p = clamp(BASE_P + UNDERDOG_W*underdogTerm(qr) + BELIEBTHEIT_W*beliebtheitTerm(v)
 *             − COOLDOWN_PENALTY*hadGoldenLastSeason, 0, P_MAX)
 * Alle Terme ENV-tunebar über OLY_SPONSOR_GOLDEN_*.
 */
export const GOLDEN_BASE_P = envNum("OLY_SPONSOR_GOLDEN_BASE_P", 0.03);
export const GOLDEN_UNDERDOG_W = envNum("OLY_SPONSOR_GOLDEN_UNDERDOG_W", 0.06);
export const GOLDEN_BELIEBTHEIT_W = envNum("OLY_SPONSOR_GOLDEN_BELIEBTHEIT_W", 0.05);
export const GOLDEN_COOLDOWN_PENALTY = envNum("OLY_SPONSOR_GOLDEN_COOLDOWN_PENALTY", 0.05);
export const GOLDEN_P_MAX = envNum("OLY_SPONSOR_GOLDEN_P_MAX", 0.12);

/**
 * Draw weight of the single rarity ONE step above a team's cap in rollSponsorOfferSlate (the "lucky better
 * sponsor" chance). Small vs the in-cap drawWeights (50/30/14/6), so the expected rarity stays near the cap
 * but every team — including the gewöhnlich-capped bottom — occasionally sees a better tier. Beliebtheit lifts
 * it. Set 0 to restore a hard cap.
 */
export const RARITY_OVERCAP_LUCK_WEIGHT = envNum("OLY_SPONSOR_RARITY_OVERCAP_W", 5);

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Schwache Teams → 1, stärkstes Team → 0. Nutzt die Liga-Position (1..teamCount). */
function underdogTerm(leaguePosition: number, teamCount: number): number {
  if (teamCount <= 1) {
    return 0;
  }
  return clamp01((leaguePosition - 1) / (teamCount - 1));
}

/** Beliebtheit ist auf [0.5, 1.5] geclampt, 1.0 = neutral. Nur der positive Überschuss zählt (0..0.5). */
function beliebtheitTerm(beliebtheit?: number | null): number {
  if (beliebtheit == null || !Number.isFinite(beliebtheit)) {
    return 0;
  }
  return clamp01(beliebtheit - 1);
}

export function getGoldenLuckProbability(input: {
  leaguePosition: number;
  teamCount: number;
  beliebtheit?: number | null;
  hadGoldenLastSeason?: boolean;
}): number {
  const p =
    GOLDEN_BASE_P +
    GOLDEN_UNDERDOG_W * underdogTerm(input.leaguePosition, input.teamCount) +
    GOLDEN_BELIEBTHEIT_W * beliebtheitTerm(input.beliebtheit) -
    GOLDEN_COOLDOWN_PENALTY * (input.hadGoldenLastSeason ? 1 : 0);
  return Math.max(0, Math.min(GOLDEN_P_MAX, p));
}

function getStableUnitHash(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

/**
 * Golden-Los für ALLE Teams (generalisiert das frühere Bottom-only-`applyBottomGoldenLuck`). Würfelt
 * underdog-/beliebtheits-gewichtet mit Cooldown, ob GENAU EIN Slot golden wird. Golden ist KEIN eigener
 * Rarity-Sprung — der Slot behält seine rarity; die Rang-Payout-Aufwertung passiert in der Kalibrierung.
 */
function rollGoldenLuck(
  slotCount: number,
  goldenCardSlots: number[],
  input: {
    seasonId: string;
    teamId: string;
    leaguePosition: number;
    teamCount: number;
    beliebtheit?: number | null;
    hadGoldenLastSeason?: boolean;
  },
): { goldenCardSlots: number[] } {
  if (slotCount === 0) {
    return { goldenCardSlots };
  }
  const p = getGoldenLuckProbability({
    leaguePosition: input.leaguePosition,
    teamCount: input.teamCount,
    beliebtheit: input.beliebtheit,
    hadGoldenLastSeason: input.hadGoldenLastSeason,
  });
  if (p <= 0) {
    return { goldenCardSlots };
  }
  const luckRoll = getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-golden-card`);
  if (luckRoll >= p) {
    return { goldenCardSlots };
  }
  const slotIndex = Math.min(
    slotCount - 1,
    Math.floor(getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-golden-slot`) * slotCount),
  );
  const nextGolden = goldenCardSlots.includes(slotIndex) ? goldenCardSlots : [...goldenCardSlots, slotIndex];
  return { goldenCardSlots: nextGolden };
}

/**
 * Rarity-keyed demand multiplier — replaces the old per-star-tier `getDemandMultiplier`. Baked from the
 * legacy formula (`0.85 + starTier * 0.08`) through the star↔rarity correspondence used everywhere else
 * (gewöhnlich=★2, magisch=★3, selten=★4, legendär=★5), so the resulting numbers are unchanged:
 * gewöhnlich 1.01, magisch 1.09, selten 1.17, legendär 1.25.
 */
export function getDemandMultiplierForRarity(rarity: SponsorRarity): number {
  return 1.01 + SPONSOR_RARITIES[rarity].order * 0.08;
}

// ── Rarity + curve-shape slate roller (new model) ────────────────────────────────────────────────────────

export type SponsorSlateEntry = { curveShape: SponsorCurveShape; rarity: SponsorRarity };
export type SponsorSlateResult = { entries: SponsorSlateEntry[]; goldenCardSlots: number[] };

/** Legacy curve shape → archetype (titel→performance, sicherheit→security, else→identity). */
export function mapCurveShapeToArchetype(curveShape: SponsorCurveShape): SponsorArchetype {
  const family = getSponsorCurveFamily(curveShape);
  if (family === "titel") return "performance";
  if (family === "sicherheit") return "security";
  return "identity";
}

/**
 * Angebots-Slate-Wurf: pro Slot eine RARITY (gedeckelt an der maxRarity des Teams, beliebtheits-gehoben
 * Richtung höherer Rarity) und dazu ein SLATE aus DISTINCT Kurvenformen (höchstens 2 pro Familie).
 * Vollständig deterministisch über getStableUnitHash (kein Math.random). Golden bleibt orthogonal und läuft
 * über denselben Golden-Los-Pfad wie zuvor.
 */
export function rollSponsorOfferSlate(input: {
  seasonId: string;
  teamId: string;
  qualityRank: SponsorTeamQualityRank;
  slotCount?: number;
  beliebtheit?: number | null;
  hadGoldenLastSeason?: boolean;
  teamCount?: number;
}): SponsorSlateResult {
  // Guard: es gibt nur SPONSOR_CURVE_SHAPE_KEYS.length distinkte Kurvenformen. Fragt ein Aufrufer mehr Slots
  // an, könnten wir nie so viele DISTINCT-Formen liefern und würden stillschweigend weniger Einträge zurückgeben.
  // Deshalb den effektiven slotCount hart auf die Anzahl verfügbarer Formen deckeln. Das Spiel nutzt 5 (< 11),
  // daher ist das rein defensiv — das slotCount=5-Verhalten bleibt unverändert.
  const requestedSlotCount = input.slotCount ?? 5;
  const slotCount = Math.min(requestedSlotCount, SPONSOR_CURVE_SHAPE_KEYS.length);
  const teamCount = input.teamCount ?? 32;

  // Cap: keine Rarity über der maxRarity des Teams. (targetRarity liegt darunter und bleibt der Normalfall
  // dank drawWeight; der Cap begrenzt nur die Obergrenze.)
  const maxRarity = input.qualityRank.maxRarity;
  const maxOrder = SPONSOR_RARITIES[maxRarity].order;
  const beliebtheitLift = beliebtheitTerm(input.beliebtheit);

  // Rarity pro Slot: gewichteter Zug (drawWeight). Der maxRarity-Deckel ist der NORMALFALL, aber wie die
  // frühere Sterne-Varianz darf SELTEN eine Rarity EINE Stufe ÜBER dem Deckel gezogen werden (kleines
  // "Glücks"-Gewicht, beliebtheits-gehoben). Ohne diese Über-Deckel-Chance säße die schwache Liga-Hälfte
  // (maxRarity gewöhnlich) permanent auf reinen gewöhnlich-Slates ohne jede Loot-Varianz — genau die Teams,
  // die der Rebalance schützen soll. ENV-tunebar über OLY_SPONSOR_RARITY_OVERCAP_W.
  const rarities: SponsorRarity[] = [];
  const candidates = SPONSOR_RARITY_KEYS.filter((r) => SPONSOR_RARITIES[r].order <= maxOrder);
  const weights = candidates.map(
    (r) => SPONSOR_RARITIES[r].drawWeight * (1 + beliebtheitLift * SPONSOR_RARITIES[r].order * 0.15),
  );
  const overCapRarity = SPONSOR_RARITY_KEYS.find((r) => SPONSOR_RARITIES[r].order === maxOrder + 1);
  if (overCapRarity) {
    candidates.push(overCapRarity);
    weights.push(RARITY_OVERCAP_LUCK_WEIGHT * (1 + beliebtheitLift));
  }
  const weightTotal = weights.reduce((sum, w) => sum + w, 0);
  for (let slot = 0; slot < slotCount; slot += 1) {
    const roll = getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-rarity:${slot}`) * weightTotal;
    let acc = 0;
    let picked: SponsorRarity = candidates[candidates.length - 1] ?? maxRarity;
    for (let i = 0; i < candidates.length; i += 1) {
      acc += weights[i]!;
      if (roll < acc) {
        picked = candidates[i]!;
        break;
      }
    }
    rarities.push(picked);
  }

  // Kurven-Slate: distinct Formen, höchstens 2 pro Familie. Deterministische Reihenfolge (hash-sortiert),
  // greedy einsammeln; falls das (mit ≤2/Familie) nicht reicht, auf 3/Familie lockern.
  const orderedShapes = [...SPONSOR_CURVE_SHAPE_KEYS].sort(
    (a, b) =>
      getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-curve:${a}`) -
      getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-curve:${b}`),
  );
  const collectShapes = (maxPerFamily: number, seed: SponsorCurveShape[]): SponsorCurveShape[] => {
    const chosen = [...seed];
    const familyCount = new Map<SponsorCurveFamily, number>();
    for (const shape of chosen) {
      const fam = getSponsorCurveFamily(shape);
      familyCount.set(fam, (familyCount.get(fam) ?? 0) + 1);
    }
    for (const shape of orderedShapes) {
      if (chosen.length >= slotCount) break;
      if (chosen.includes(shape)) continue;
      const fam = getSponsorCurveFamily(shape);
      if ((familyCount.get(fam) ?? 0) >= maxPerFamily) continue;
      chosen.push(shape);
      familyCount.set(fam, (familyCount.get(fam) ?? 0) + 1);
    }
    return chosen;
  };
  let shapes = collectShapes(2, []);
  if (shapes.length < slotCount) {
    shapes = collectShapes(3, shapes);
  }
  shapes = shapes.slice(0, slotCount);

  const entries: SponsorSlateEntry[] = shapes.map((curveShape, i) => ({
    curveShape,
    rarity: rarities[i] ?? maxRarity,
  }));

  // Golden bleibt orthogonal zur Rarity: derselbe Golden-Los-Pfad (Wahrscheinlichkeit + Seeds), höchstens
  // EIN goldener Slot.
  const golden = rollGoldenLuck(
    slotCount,
    [],
    {
      seasonId: input.seasonId,
      teamId: input.teamId,
      leaguePosition: input.qualityRank.leaguePosition,
      teamCount,
      beliebtheit: input.beliebtheit,
      hadGoldenLastSeason: input.hadGoldenLastSeason,
    },
  );

  return { entries, goldenCardSlots: golden.goldenCardSlots };
}
