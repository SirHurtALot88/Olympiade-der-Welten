import type {
  SponsorArchetype,
  SponsorCurveFamily,
  SponsorCurveShape,
  SponsorRarity,
  SponsorStarTier,
} from "@/lib/data/olyDataTypes";
import { getStarTierMilestoneMultiplier } from "@/lib/sponsor/sponsor-economy-calibration";
import {
  SPONSOR_CURVE_SHAPE_KEYS,
  SPONSOR_RARITIES,
  SPONSOR_RARITY_KEYS,
  getSponsorCurveFamily,
  mapStarTierToRarity,
} from "@/lib/sponsor/sponsor-curve-shapes";
import type { SponsorTeamQualityRank } from "@/lib/sponsor/sponsor-team-quality-rank";

export type SponsorTierRollResult = {
  tiers: SponsorStarTier[];
  /** Golden luck: at most one slot per team may become golden (premium_elite / golden-card flavor). */
  goldenCardSlots: number[];
};

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
 * Sterne-Varianz (weicher Bias um den Cap). Der beliebtheits-gehobene Cap bleibt der Normalfall; SELTEN
 * hebt ein kleines Team einen Slot über seinen Cap (bis 5★, UP), und ein großes Team drückt gelegentlich
 * einen Slot auf 1–2★ (DOWN). ENV-tunebar; via OLY_SPONSOR_STAR_VARIANCE_OFF komplett deterministisch
 * abschaltbar (für Balance-Tests, die exakte Sterne erwarten).
 */
export const GOLDEN_STAR_VARIANCE_UP_P = envNum("OLY_SPONSOR_GOLDEN_STAR_VARIANCE_UP_P", 0.08);
export const GOLDEN_STAR_VARIANCE_DOWN_P = envNum("OLY_SPONSOR_GOLDEN_STAR_VARIANCE_DOWN_P", 0.12);

/**
 * Draw weight of the single rarity ONE step above a team's cap in rollSponsorOfferSlate (the "lucky better
 * sponsor" chance). Small vs the in-cap drawWeights (50/30/14/6), so the expected rarity stays near the cap
 * but every team — including the gewöhnlich-capped bottom — occasionally sees a better tier. Beliebtheit lifts
 * it. Set 0 to restore a hard cap.
 */
export const RARITY_OVERCAP_LUCK_WEIGHT = envNum("OLY_SPONSOR_RARITY_OVERCAP_W", 5);

/** Zur Laufzeit gelesen (nicht als Modul-Konstante), damit Tests die Varianz deterministisch abschalten können. */
function isStarVarianceOff(): boolean {
  const flag = process.env.OLY_SPONSOR_STAR_VARIANCE_OFF;
  return flag === "1" || flag === "true";
}

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

function clampTier(tier: number, maxTier: SponsorStarTier): SponsorStarTier {
  return Math.min(maxTier, Math.max(1, Math.round(tier))) as SponsorStarTier;
}

function rollClusteredTier(input: {
  seasonId: string;
  teamId: string;
  slotIndex: number;
  targetTier: SponsorStarTier;
  maxTier: SponsorStarTier;
}): SponsorStarTier {
  const roll = getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-tier:${input.slotIndex}`);
  let tier = input.targetTier;
  if (roll < 0.10 && tier < input.maxTier) {
    tier = clampTier(tier + 1, input.maxTier);
  } else if (roll < 0.28 && tier > 1) {
    tier = clampTier(tier - 1, input.maxTier);
  } else if (roll < 0.38 && tier > 2) {
    tier = clampTier(tier - 1, input.maxTier);
  }
  return clampTier(tier, input.maxTier);
}

function applyTopChampionCluster(
  tiers: SponsorStarTier[],
  input: { seasonId: string; teamId: string; targetTier: SponsorStarTier; maxTier: SponsorStarTier },
): SponsorStarTier[] {
  if (input.maxTier < 5 || input.targetTier < 4) {
    return tiers;
  }
  const adjusted = [...tiers];
  for (let slotIndex = 0; slotIndex < adjusted.length; slotIndex += 1) {
    const roll = getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-elite:${slotIndex}`);
    if (roll < 0.72) {
      adjusted[slotIndex] = 5;
    } else if (roll < 0.94) {
      adjusted[slotIndex] = clampTier(4, input.maxTier);
    }
  }
  return adjusted.map((tier) => clampTier(tier, input.maxTier));
}

/**
 * Golden-Los für ALLE Teams (generalisiert das frühere Bottom-only-`applyBottomGoldenLuck`). Würfelt
 * underdog-/beliebtheits-gewichtet mit Cooldown, ob GENAU EIN Slot golden wird. Golden ist KEIN eigener
 * Stern — der Slot behält seinen starTier; die Rang-Payout-Aufwertung passiert in der Kalibrierung.
 */
function rollGoldenLuck(
  tiers: SponsorStarTier[],
  goldenCardSlots: number[],
  input: {
    seasonId: string;
    teamId: string;
    leaguePosition: number;
    teamCount: number;
    beliebtheit?: number | null;
    hadGoldenLastSeason?: boolean;
  },
): { tiers: SponsorStarTier[]; goldenCardSlots: number[] } {
  if (tiers.length === 0) {
    return { tiers, goldenCardSlots };
  }
  const p = getGoldenLuckProbability({
    leaguePosition: input.leaguePosition,
    teamCount: input.teamCount,
    beliebtheit: input.beliebtheit,
    hadGoldenLastSeason: input.hadGoldenLastSeason,
  });
  if (p <= 0) {
    return { tiers, goldenCardSlots };
  }
  const luckRoll = getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-golden-card`);
  if (luckRoll >= p) {
    return { tiers, goldenCardSlots };
  }
  const slotIndex = Math.min(
    tiers.length - 1,
    Math.floor(getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-golden-slot`) * tiers.length),
  );
  const nextGolden = goldenCardSlots.includes(slotIndex) ? goldenCardSlots : [...goldenCardSlots, slotIndex];
  return { tiers, goldenCardSlots: nextGolden };
}

/**
 * Sterne-Varianz: der harte Cap wird zum weichen Bias. UP (kleine Teams, Cap < 5) hebt SELTEN einen Slot
 * +1..+2 ÜBER den Cap bis 5★; bevorzugt den golden-Slot (der die Obergrenze nutzen darf). DOWN (große
 * Teams, Cap ≥ 4) drückt gelegentlich einen Nicht-golden-Slot auf 1–2★. Deterministisch (hash-basiert),
 * via OLY_SPONSOR_STAR_VARIANCE_OFF abschaltbar.
 */
function applyStarVariance(
  tiers: SponsorStarTier[],
  input: {
    seasonId: string;
    teamId: string;
    maxTier: SponsorStarTier;
    goldenSlot: number | null;
  },
): SponsorStarTier[] {
  if (isStarVarianceOff() || tiers.length === 0) {
    return tiers;
  }
  const adjusted = [...tiers];
  const slotCount = adjusted.length;

  if (input.maxTier < 5) {
    // Golden-Slot darf die Varianz-OBERGRENZE (bis 5★) nutzen — die "golden card" ist ein Premium-Angebot,
    // deshalb greift beim golden-Slot der größere Sprung (+2..+4 über Cap), sobald das Team golden ist.
    if (input.goldenSlot != null) {
      const gRoll = getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-star-var-golden-up`);
      const amount = gRoll < 0.5 ? 2 : gRoll < 0.8 ? 3 : 4;
      adjusted[input.goldenSlot] = clampTier(input.maxTier + amount, 5);
    }
    // Nicht-golden-Slots: SELTEN +1..+2 über den Cap (bis 5★).
    const upRoll = getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-star-var-up`);
    if (upRoll < GOLDEN_STAR_VARIANCE_UP_P) {
      const slot = Math.min(
        slotCount - 1,
        Math.floor(getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-star-var-up-slot`) * slotCount),
      );
      if (slot !== input.goldenSlot) {
        const amount = getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-star-var-up-amt`) < 0.5 ? 1 : 2;
        // Absichtlich ÜBER den Cap (bis 5★) — clampTier(., 5), NICHT maxTier.
        adjusted[slot] = clampTier(input.maxTier + amount, 5);
      }
    }
  }

  if (input.maxTier >= 4) {
    const downRoll = getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-star-var-down`);
    if (downRoll < GOLDEN_STAR_VARIANCE_DOWN_P) {
      const slot = Math.min(
        slotCount - 1,
        Math.floor(getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-star-var-down-slot`) * slotCount),
      );
      // Der golden-Slot wird nicht heruntergedrückt (er nutzt die Obergrenze).
      if (slot !== input.goldenSlot) {
        adjusted[slot] = (
          getStableUnitHash(`${input.seasonId}:${input.teamId}:sponsor-star-var-down-amt`) < 0.5 ? 1 : 2
        ) as SponsorStarTier;
      }
    }
  }

  return adjusted.map((tier) => clampTier(tier, 5));
}

export function rollSponsorStarTiers(input: {
  seasonId: string;
  teamId: string;
  qualityRank: SponsorTeamQualityRank;
  slotCount?: number;
  /** Fortgeschriebene Beliebtheit (1.0 neutral) — hebt die Golden-Wahrscheinlichkeit. */
  beliebtheit?: number | null;
  /** Cooldown: Team hatte in der Vorsaison bereits einen golden Slot. */
  hadGoldenLastSeason?: boolean;
  /** Liga-Größe für den underdogTerm (Default 32). */
  teamCount?: number;
}): SponsorTierRollResult {
  const slotCount = input.slotCount ?? 3;
  const maxTier = input.qualityRank.maxStarTier;
  const targetTier = clampTier(input.qualityRank.targetStarTier, maxTier);
  const teamCount = input.teamCount ?? 32;

  let tiers = Array.from({ length: slotCount }, (_, slotIndex) =>
    rollClusteredTier({
      seasonId: input.seasonId,
      teamId: input.teamId,
      slotIndex,
      targetTier,
      maxTier,
    }),
  );

  if (input.qualityRank.qualityRank <= 4 && targetTier >= 4 && maxTier >= 4) {
    tiers = applyTopChampionCluster(tiers, {
      seasonId: input.seasonId,
      teamId: input.teamId,
      targetTier,
      maxTier,
    });
  }

  // Golden-Los ZUERST bestimmen, damit der golden-Slot die Varianz-Obergrenze nutzen kann.
  const golden = rollGoldenLuck(tiers, [], {
    seasonId: input.seasonId,
    teamId: input.teamId,
    leaguePosition: input.qualityRank.leaguePosition,
    teamCount,
    beliebtheit: input.beliebtheit,
    hadGoldenLastSeason: input.hadGoldenLastSeason,
  });
  const goldenSlot = golden.goldenCardSlots.length > 0 ? golden.goldenCardSlots[0]! : null;

  tiers = applyStarVariance(golden.tiers, {
    seasonId: input.seasonId,
    teamId: input.teamId,
    maxTier,
    goldenSlot,
  });

  return { tiers, goldenCardSlots: golden.goldenCardSlots };
}

/** @deprecated Use rollSponsorStarTiers().tiers */
export function rollSponsorStarTierList(input: Parameters<typeof rollSponsorStarTiers>[0]): SponsorStarTier[] {
  return rollSponsorStarTiers(input).tiers;
}

export function getRewardMultiplier(starTier: SponsorStarTier) {
  return getStarTierMilestoneMultiplier(starTier);
}

export function getDemandMultiplier(starTier: SponsorStarTier) {
  return 0.85 + starTier * 0.08;
}

export function getDemandProfile(starTier: SponsorStarTier): "safe" | "balanced" | "ambitious" | "elite" {
  if (starTier >= 5) return "elite";
  if (starTier >= 4) return "ambitious";
  if (starTier >= 2) return "balanced";
  return "safe";
}

// ── Rarity + curve-shape slate roller (new model) ────────────────────────────────────────────────────────

export type SponsorSlateEntry = { curveShape: SponsorCurveShape; rarity: SponsorRarity };
export type SponsorSlateResult = { entries: SponsorSlateEntry[]; goldenCardSlots: number[] };

/** Legacy rarity → star tier (for the transition: gewöhnlich→2, magisch→3, selten→4, legendär→5). */
export function mapRarityToStarTier(rarity: SponsorRarity): SponsorStarTier {
  switch (rarity) {
    case "legendär":
      return 5;
    case "selten":
      return 4;
    case "magisch":
      return 3;
    default:
      return 2;
  }
}

/** Legacy curve shape → archetype (titel→performance, sicherheit→security, else→identity). */
export function mapCurveShapeToArchetype(curveShape: SponsorCurveShape): SponsorArchetype {
  const family = getSponsorCurveFamily(curveShape);
  if (family === "titel") return "performance";
  if (family === "sicherheit") return "security";
  return "identity";
}

/**
 * Neuer Angebots-Slate-Wurf (ersetzt den Sterne-Wurf): pro Slot eine RARITY (gedeckelt am maxStarTier→Rarity,
 * beliebtheits-gehoben Richtung höherer Rarity) und dazu ein SLATE aus DISTINCT Kurvenformen (höchstens 2 pro
 * Familie). Vollständig deterministisch über getStableUnitHash (kein Math.random). Golden bleibt orthogonal
 * und läuft über denselben Golden-Los-Pfad wie rollSponsorStarTiers.
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

  // Cap: keine Rarity über dem maxStarTier→Rarity-Deckel des Teams. (targetStarTier→Rarity liegt darunter und
  // bleibt der Normalfall dank drawWeight; der Cap begrenzt nur die Obergrenze.)
  const maxRarity = mapStarTierToRarity(input.qualityRank.maxStarTier);
  const maxOrder = SPONSOR_RARITIES[maxRarity].order;
  const beliebtheitLift = beliebtheitTerm(input.beliebtheit);

  // Rarity pro Slot: gewichteter Zug (drawWeight). Der maxStarTier→Rarity-Deckel ist der NORMALFALL, aber wie
  // die frühere Sterne-Varianz darf SELTEN eine Rarity EINE Stufe ÜBER dem Deckel gezogen werden (kleines
  // "Glücks"-Gewicht, beliebtheits-gehoben). Ohne diese Über-Deckel-Chance säße die schwache Liga-Hälfte
  // (maxStarTier ≤ 2 → Deckel gewöhnlich) permanent auf reinen gewöhnlich-Slates ohne jede Loot-Varianz —
  // genau die Teams, die der Rebalance schützen soll. ENV-tunebar über OLY_SPONSOR_RARITY_OVERCAP_W.
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

  // Golden bleibt orthogonal zur Rarity: derselbe Golden-Los-Pfad (Wahrscheinlichkeit + Seeds) wie
  // rollSponsorStarTiers, höchstens EIN goldener Slot. Die Dummy-Tier-Liste liefert nur die Slot-Anzahl.
  const golden = rollGoldenLuck(
    Array.from({ length: slotCount }, () => 2 as SponsorStarTier),
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
