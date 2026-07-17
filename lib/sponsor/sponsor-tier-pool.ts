import type { SponsorStarTier } from "@/lib/data/olyDataTypes";
import { getStarTierMilestoneMultiplier } from "@/lib/sponsor/sponsor-economy-calibration";
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
