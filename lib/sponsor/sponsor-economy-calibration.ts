import prizeMoneyNormalized from "@/references/sheets/prize-money-table.normalized.json";
import type { GameState, SponsorArchetype, SponsorOffer, SponsorOfferComponent, SponsorStarTier } from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamDisplaySalaryTotal, getTeamSponsorBaseReferenceTotal } from "@/lib/sponsor/sponsor-team-salary-display";

const PRIZE_MONEY_NORMALIZED = prizeMoneyNormalized as {
  rows: Array<{ rank: number | null; prizeMoney: number | null }>;
};

export const SPONSOR_BASE_FLOOR_C = 32;

/**
 * Flat Gebäude-Kosten-Ausgleich auf den Sponsor-Sockel PRO TEAM. Die Gebäude verbrauchen liga-weit
 * ~300/Season (~9–10/Team, überwiegend Upgrade-CapEx), was die Mehrsaison-Ökonomie deflationär macht.
 * Deshalb (User-Vorgabe): Sponsor = gehaltsbasierter Sockel + flat ~500/Liga on top → pro Team
 * 500/32 ≈ 15.6 (angehoben von 300→500, um Gebäude-Unterhalt breiter zu decken und den Kreditbedarf
 * an der Quelle zu senken). Flach (NICHT salaryFactor-skaliert), sodass der Ausgleich bei fortschreitender
 * Deflation relativ sogar mehr hilft. ENV-tunebar. Fließt über effectiveBaseFloor konsistent in Angebot
 * UND Settlement (getSponsorPayoutForFinalRankAndTier nutzt denselben Anker).
 */
export const SPONSOR_BUILDING_COST_OFFSET_C = Number(process.env.OLY_SPONSOR_BUILDING_OFFSET_C ?? 15.6) || 15.6;

/**
 * Offset vom Referenz-Gehalt für den Rang-32-Basis-Anker (4.-niedrigstes Gehalt − Buffer). NEGATIV ⇒
 * der Sockel liegt ÜBER dem 4.-niedrigsten Gehalt, sodass die ~4 gehaltsschwächsten Teams strukturell
 * abgesichert sind und ein kleines Plus machen (Design-Regel). Vorher +5, was mit der Gehalts-Inflation
 * (salaryFactor > 1) den Sockel unter die realen Gehälter zog und die Schwächsten ins Minus rutschen ließ.
 */
export const SPONSOR_BASE_SALARY_BUFFER_C = -2;

/**
 * Globale Stauchung der kumulativen Rang-Meilenstein-Leiter im Sponsor-Payout. <1 ⇒ die Spitze (die alle
 * Meilensteine stapelt) zahlt nicht mehr komplett über: sie kappt den Top-Bonus, ohne den Sockel (der die
 * Kleinen absichert) anzutasten. So sinkt die Rang-Spreizung Richtung der funktionierenden Preisgeld-Kurve.
 */
export const SPONSOR_MILESTONE_LADDER_SCALE = 0.6;

/** Meilenstein-Kompression erst ab dieser Basis-Erhöhung über statischer Kalibrierung. */
export const SPONSOR_BASE_ELEVATION_COMPRESSION_THRESHOLD_C = 8;

export const SPONSOR_RANK_MILESTONES = [
  { maxRank: 28, bonusC: 7, label: "Top 28" },
  { maxRank: 24, bonusC: 5, label: "Top 24" },
  { maxRank: 20, bonusC: 6, label: "Top 20" },
  { maxRank: 16, bonusC: 8, label: "Top 16" },
  { maxRank: 12, bonusC: 6, label: "Top 12" },
  { maxRank: 8, bonusC: 12, label: "Top 8" },
  { maxRank: 4, bonusC: 10, label: "Top 4" },
  { maxRank: 1, bonusC: 9, label: "Meister" },
] as const;

export type SponsorRankMilestone = (typeof SPONSOR_RANK_MILESTONES)[number];

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

let prizeMoneyByRankCache: Map<number, number> | null = null;

function loadPrizeMoneyByRank(): Map<number, number> {
  if (prizeMoneyByRankCache) {
    return prizeMoneyByRankCache;
  }
  prizeMoneyByRankCache = new Map(
    PRIZE_MONEY_NORMALIZED.rows
      .filter((row) => row.rank != null && row.prizeMoney != null)
      .map((row) => [row.rank as number, row.prizeMoney as number]),
  );
  return prizeMoneyByRankCache;
}

export function getPrizeMoneyReference(rank: number, salaryFactor = 1): number {
  const boundedRank = Math.min(32, Math.max(1, Math.round(rank)));
  const prize = loadPrizeMoneyByRank().get(boundedRank) ?? 0;
  return round1(prize * salaryFactor);
}

/**
 * Archetyp-Kreuzungs-Tabellen (WAVE 1). Security ist "sicher": hoher garantierter Sockel (base > 1),
 * aber gedämpfte Rang-Upside (milestone < performance). Performance ist das Gegenteil: schlanker Sockel
 * (base < 1), dafür die steilste Meilenstein-Leiter (milestone ≫ 1). Identity liegt neutral in der Mitte.
 * Diese ZWEI Tabellen sind die EINZIGE Quelle der Archetyp-Differenzierung und werden IDENTISCH von
 * getSponsorPayoutForFinalRankAndTier (Settlement) UND buildOfferCashAmounts (Anzeige) genutzt — dadurch
 * ist die Anzeige exakt das Settlement. ENV-tunebar analog zu den übrigen OLY_SPONSOR_*-Knobs.
 *
 * Hinweis zu ARCHETYPE_MILESTONE_MULT.security: konzeptionell wäre ~0.62 (deutlich unter performance)
 * wünschenswert, damit security "wenig Upside" hat. Der Balance-Test "preserves payout spread between
 * bottom and championship security offers" verlangt aber weiterhin top/bottom > 1.65 für REINE security-
 * Angebote. Da der auf 1.12 angehobene Sockel den Rang-32-Boden (bottom) hebt, komprimiert sich die
 * security-Eigenspreizung; um den 1.65-Boden zu halten, muss die security-Meilenstein-Leiter höher liegen
 * als der ursprünglich geschätzte 0.7 (rechnerisches Minimum ~0.95). 0.97 hält den Spread-Test mit Marge
 * UND lässt performance an der Spitze weiterhin klar vor security (Kreuzung). ENV: OLY_SPONSOR_ARCH_MS_*.
 */
export const SPONSOR_ARCHETYPE_BASE_MULT: Record<SponsorArchetype, number> = {
  security: Number(process.env.OLY_SPONSOR_ARCH_BASE_SECURITY ?? 1.08) || 1.08,
  identity: Number(process.env.OLY_SPONSOR_ARCH_BASE_IDENTITY ?? 1.0) || 1.0,
  performance: Number(process.env.OLY_SPONSOR_ARCH_BASE_PERFORMANCE ?? 0.9) || 0.9,
};

export const SPONSOR_ARCHETYPE_MILESTONE_MULT: Record<SponsorArchetype, number> = {
  security: Number(process.env.OLY_SPONSOR_ARCH_MS_SECURITY ?? 0.5) || 0.5,
  identity: Number(process.env.OLY_SPONSOR_ARCH_MS_IDENTITY ?? 1.0) || 1.0,
  performance: Number(process.env.OLY_SPONSOR_ARCH_MS_PERFORMANCE ?? 1.45) || 1.45,
};

export function getArchetypeBaseMultiplier(archetype: SponsorArchetype): number {
  return SPONSOR_ARCHETYPE_BASE_MULT[archetype] ?? 1;
}

export function getArchetypeMilestoneMultiplier(archetype: SponsorArchetype): number {
  return SPONSOR_ARCHETYPE_MILESTONE_MULT[archetype] ?? 1;
}

/** @deprecated WAVE 1: Archetyp-Split läuft jetzt über SPONSOR_ARCHETYPE_BASE_MULT / getArchetypeBaseMultiplier. */
export function getArchetypeBaseShare(archetype: SponsorArchetype): number {
  if (archetype === "security") return 0.65;
  if (archetype === "identity") return 0.55;
  return 0.35;
}

export function getTotalMilestoneBonusC(salaryFactor = 1): number {
  return round1(SPONSOR_RANK_MILESTONES.reduce((sum, milestone) => sum + milestone.bonusC, 0) * salaryFactor);
}

export function getRankMilestoneBonus(finalRank: number | null | undefined, salaryFactor = 1): number {
  if (finalRank == null || !Number.isFinite(finalRank)) {
    return 0;
  }
  const boundedRank = Math.min(32, Math.max(1, Math.round(finalRank)));
  let total = 0;
  for (const milestone of SPONSOR_RANK_MILESTONES) {
    if (boundedRank <= milestone.maxRank) {
      total += milestone.bonusC;
    }
  }
  return round1(total * salaryFactor);
}

export function getUnlockedMilestones(finalRank: number | null | undefined): SponsorRankMilestone[] {
  if (finalRank == null || !Number.isFinite(finalRank)) {
    return [];
  }
  const boundedRank = Math.min(32, Math.max(1, Math.round(finalRank)));
  return SPONSOR_RANK_MILESTONES.filter((milestone) => boundedRank <= milestone.maxRank);
}

export function getSponsorPayoutForFinalRank(finalRank: number | null | undefined, salaryFactor = 1): number {
  const base = round1(SPONSOR_BASE_FLOOR_C * salaryFactor);
  const milestoneBonus = getRankMilestoneBonus(finalRank, salaryFactor);
  return round1(base + milestoneBonus);
}

export function getNextMilestoneRank(startRank: number | null | undefined): number {
  const rank = startRank ?? 32;
  const next = SPONSOR_RANK_MILESTONES.find((milestone) => milestone.maxRank < rank);
  return next?.maxRank ?? 1;
}

export function buildMilestoneRankLabel(): string {
  return SPONSOR_RANK_MILESTONES.map((milestone) => `${milestone.label} (+${milestone.bonusC} C)`).join(" · ");
}

/** @deprecated WAVE 1: Archetyp-Split läuft jetzt über SPONSOR_ARCHETYPE_MILESTONE_MULT / getArchetypeMilestoneMultiplier. */
export function getArchetypeRankShare(archetype: SponsorArchetype): number {
  return round1(1 - getArchetypeBaseShare(archetype));
}

export const SPONSOR_TIER_BASE_MULT: Record<SponsorStarTier, number> = {
  1: 0.9,
  2: 0.94,
  3: 0.97,
  4: 0.99,
  5: 1,
};

/** Low-star sponsors unlock far less of the Gewinnstufen ladder (big jumps 1★→5★). */
export const SPONSOR_TIER_MILESTONE_MULT: Record<SponsorStarTier, number> = {
  1: 0.28,
  2: 0.48,
  3: 0.66,
  4: 0.82,
  5: 1,
};

export function getStarTierBaseMultiplier(starTier: SponsorStarTier): number {
  return SPONSOR_TIER_BASE_MULT[starTier] ?? 1;
}

export function getStarTierMilestoneMultiplier(starTier: SponsorStarTier): number {
  return SPONSOR_TIER_MILESTONE_MULT[starTier] ?? 1;
}

export function getRewardMultiplierForTier(starTier: SponsorStarTier): number {
  return getStarTierMilestoneMultiplier(starTier);
}

export { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";

export function getLeagueMinimumSalaryTotal(gameState: GameState): number {
  const overviewSalaries = buildTeamSeasonOverviewRows({ gameState })
    .map((row) => getTeamDisplaySalaryTotal(gameState, row.teamId))
    .filter((value) => value > 0);
  if (overviewSalaries.length === 0) {
    return SPONSOR_BASE_FLOOR_C;
  }
  return round1(Math.min(...overviewSalaries));
}

/**
 * Viertniedrigste Team-Referenz (4. von unten), Basis = Gehalt + Gebäude-Unterhalt.
 * Gebäude-Kosten schlagen so 1:1 auf die Sponsoren-Basis durch (salary factor 1.0 Anker).
 */
export function getLeagueFourthFromLowestSalaryTotal(gameState: GameState): number {
  const salaries = buildTeamSeasonOverviewRows({ gameState })
    .map((row) => getTeamSponsorBaseReferenceTotal(gameState, row.teamId))
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  if (salaries.length === 0) {
    return SPONSOR_BASE_FLOOR_C;
  }
  const index = Math.min(3, salaries.length - 1);
  return round1(salaries[index] ?? salaries[0]!);
}

/** Mindest-Basis für Rang 32: Gehalt des 4.-niedrigsten Teams − Buffer, mind. statischer Floor (unskaliert). */
export function getSponsorRank32BaseAnchorSalary(gameState: GameState): number {
  const referenceSalary = getLeagueFourthFromLowestSalaryTotal(gameState);
  return round1(Math.max(SPONSOR_BASE_FLOOR_C, referenceSalary - SPONSOR_BASE_SALARY_BUFFER_C));
}

export type SponsorEconomyAnchors = {
  effectiveBaseFloor: number;
  milestonePool: number;
  milestoneScale: number;
};

export function resolveSponsorEconomyAnchors(salaryFactor: number, baseAnchorSalary: number): SponsorEconomyAnchors {
  const scaledStaticFloor = round1(SPONSOR_BASE_FLOOR_C * salaryFactor);
  const scaledAnchor = round1(baseAnchorSalary * salaryFactor);
  const salaryBasedFloor = round1(Math.max(scaledStaticFloor, scaledAnchor));
  const fullMilestoneBonus = getTotalMilestoneBonusC(salaryFactor);
  // baseElevation/Kompression aus dem gehaltsbasierten Sockel berechnen (VOR dem Gebäude-Offset), damit
  // der flache Offset nicht die Milestone-Kompression verzerrt.
  const baseElevation = Math.max(0, salaryBasedFloor - scaledStaticFloor);
  const elevationAboveThreshold = Math.max(0, baseElevation - SPONSOR_BASE_ELEVATION_COMPRESSION_THRESHOLD_C);
  const compressionFactor =
    elevationAboveThreshold <= 0 || fullMilestoneBonus <= 0
      ? 1
      : Math.max(0.12, 1 - elevationAboveThreshold / (fullMilestoneBonus + elevationAboveThreshold));
  const milestonePool = round1(fullMilestoneBonus * compressionFactor);
  const milestoneScale = fullMilestoneBonus > 0 ? milestonePool / fullMilestoneBonus : 0;
  // Flat Gebäude-Kosten-Ausgleich zuletzt auf den Sockel — deckt den ~300/Liga-Gebäude-Drain (User-Vorgabe).
  const effectiveBaseFloor = round1(salaryBasedFloor + SPONSOR_BUILDING_COST_OFFSET_C);
  return { effectiveBaseFloor, milestonePool, milestoneScale };
}

export function getScaledRankMilestoneBonus(
  finalRank: number | null | undefined,
  salaryFactor: number,
  leagueMinSalary: number,
): number {
  const { milestoneScale } = resolveSponsorEconomyAnchors(salaryFactor, leagueMinSalary);
  return round1(getRankMilestoneBonus(finalRank, salaryFactor) * milestoneScale);
}

/**
 * Umverteilung nach Team-Stärke (quality rank) zum SCHUTZ der schwachen Teams — hält die Top5/Bottom5-
 * Schere (MW+Cash) unter ~2×. Zwei Hebel:
 *  - milestoneScale: schwache Teams etwas mehr Rang-Upside (klein, ±BALANCE_C), aber sie erreichen die
 *    Milestones ohnehin kaum → der eigentliche Schutz läuft über den Sockel.
 *  - baseScale: die WICHTIGE Größe — schwache Teams bekommen einen deutlich höheren GARANTIERTEN Sockel
 *    (bis +BASE_PROTECT_C), starke einen Abschlag. Da der Sockel unabhängig von der Platzierung fließt,
 *    stützt das die Bottom-5-Einnahmen jede Season und bremst ihre Erosion (Schere öffnet nicht auf 2.4×).
 * ENV-tunebar zum Kalibrieren gegen das Schere-Ziel.
 */
const SPONSOR_QUALITY_BASE_PROTECT_C = Number(process.env.OLY_SPONSOR_WEAK_BASE_PROTECT ?? 0.2) || 0.2;
const SPONSOR_QUALITY_MILESTONE_BALANCE_C = Number(process.env.OLY_SPONSOR_WEAK_MS_BALANCE ?? 0.1) || 0.1;
export function getQualityRebalanceProfile(teamQualityRank: number | null | undefined): {
  milestoneScale: number;
  baseScale: number;
} {
  if (teamQualityRank == null || !Number.isFinite(teamQualityRank)) {
    return { milestoneScale: 1, baseScale: 1 };
  }
  const t = (teamQualityRank - 16.5) / 15.5;
  const clamped = Math.max(-1, Math.min(1, t)); // rank 1 → -1 (stark), rank 32 → +1 (schwach)
  return {
    milestoneScale: round1(1 + clamped * SPONSOR_QUALITY_MILESTONE_BALANCE_C),
    baseScale: round1(1 + clamped * SPONSOR_QUALITY_BASE_PROTECT_C),
  };
}

function applyQualityRebalanceToPayout(input: {
  base: number;
  milestoneBonus: number;
  teamQualityRank?: number | null;
}) {
  const profile = getQualityRebalanceProfile(input.teamQualityRank);
  return {
    base: round1(input.base * profile.baseScale),
    milestoneBonus: round1(input.milestoneBonus * profile.milestoneScale),
  };
}

/**
 * Feed 2 (TEIL A) — erwartungs-relative Meilenstein-Leiter für den performance-Archetyp. Belohnt
 * `overRankSteps = expectedRank − finalRank` (positiv = besser als erwartet). Ein UNTERES Team, das
 * seine Kaderstärke-Erwartung übertrifft, zahlt so schon bei WENIGEN Rang-Anstiegen gut — unabhängig
 * vom absoluten Endrang. ENV-tunebar (Sockel-Schutz Bottom-5 bleibt davon unberührt, siehe unten).
 */
export const SPONSOR_EXPECT_STEP_C = Number(process.env.OLY_SPONSOR_EXPECT_STEP_C ?? 4) || 4;
export const SPONSOR_EXPECT_MAX_STEPS = Number(process.env.OLY_SPONSOR_EXPECT_MAX_STEPS ?? 8) || 8;

export function getExpectationRelativeMilestoneBonus(
  finalRank: number | null | undefined,
  expectedRank: number | null | undefined,
  salaryFactor = 1,
): number {
  if (finalRank == null || expectedRank == null || !Number.isFinite(finalRank) || !Number.isFinite(expectedRank)) {
    return 0;
  }
  const overRankSteps = Math.round(expectedRank) - Math.round(finalRank);
  const rewardedSteps = Math.max(0, Math.min(SPONSOR_EXPECT_MAX_STEPS, overRankSteps));
  return round1(rewardedSteps * SPONSOR_EXPECT_STEP_C * salaryFactor);
}

export function getSponsorPayoutForFinalRankAndTier(
  finalRank: number | null | undefined,
  salaryFactor: number,
  starTier: SponsorStarTier,
  leagueMinSalary = SPONSOR_BASE_FLOOR_C,
  archetype: SponsorArchetype = "security",
  teamQualityRank?: number | null,
  expectedRank?: number | null,
): number {
  const { effectiveBaseFloor, milestoneScale } = resolveSponsorEconomyAnchors(salaryFactor, leagueMinSalary);
  // Archetyp-Kreuzung (WAVE 1): base UND milestone laufen über dieselben Tabellen — KEIN security-Sonderpfad
  // mehr. Security bekommt einen hohen Sockel (base 1.12) aber gedämpfte Upside, performance umgekehrt.
  const rawBase = round1(
    effectiveBaseFloor * getArchetypeBaseMultiplier(archetype) * getStarTierBaseMultiplier(starTier),
  );

  // Feed 2: für performance MIT bekannter Erwartung ersetzt die erwartungs-relative Leiter den statischen
  // Rang-Milestone-Bump. Ohne expectedRank bleibt das Verhalten byte-identisch zu vorher (Rückwärtskompat,
  // Wave-1-Tests unberührt).
  const useExpectationLadder =
    archetype === "performance" && expectedRank != null && Number.isFinite(expectedRank);
  const rawMilestoneBase = useExpectationLadder
    ? getExpectationRelativeMilestoneBonus(finalRank, expectedRank, salaryFactor)
    : getRankMilestoneBonus(finalRank, salaryFactor);
  const rawMilestone = round1(
    rawMilestoneBase *
      milestoneScale *
      SPONSOR_MILESTONE_LADDER_SCALE *
      getStarTierMilestoneMultiplier(starTier) *
      getArchetypeMilestoneMultiplier(archetype),
  );

  if (useExpectationLadder) {
    // Der statische getQualityRebalanceProfile-MILESTONE-Bump wird durch die Erwartung ERSETZT; der
    // baseScale-SOCKEL-SCHUTZ (Bottom-5) bleibt zwingend erhalten.
    const base = round1(rawBase * getQualityRebalanceProfile(teamQualityRank).baseScale);
    return round1(base + rawMilestone);
  }

  const { base, milestoneBonus } = applyQualityRebalanceToPayout({
    base: rawBase,
    milestoneBonus: rawMilestone,
    teamQualityRank,
  });
  return round1(base + milestoneBonus);
}

export function buildOfferCashAmounts(input: {
  archetype: SponsorArchetype;
  salaryFactor: number;
  starTier: SponsorStarTier;
  leagueMinSalary?: number;
  teamQualityRank?: number | null;
}): { baseCash: number; rankCash: number; specialCash: number; totalAtMaxRank: number } {
  const leagueMinSalary = input.leagueMinSalary ?? SPONSOR_BASE_FLOOR_C;
  const { effectiveBaseFloor, milestonePool } = resolveSponsorEconomyAnchors(input.salaryFactor, leagueMinSalary);
  const baseMult = getStarTierBaseMultiplier(input.starTier);
  const milestoneMult = getStarTierMilestoneMultiplier(input.starTier);
  // Anzeige==Settlement (WAVE 1): identische Archetyp-Tabellen wie getSponsorPayoutForFinalRankAndTier.
  // rawBase = Sockel-Anteil, rawRank = Meilenstein-Anteil bei Rang 1 (getRankMilestoneBonus(1)*milestoneScale
  // = milestonePool). Summe rawBase*baseScale + rawRank*milestoneScale == Settlement bei Rang 1.
  const rawBase = round1(effectiveBaseFloor * getArchetypeBaseMultiplier(input.archetype) * baseMult);
  const rawRank = round1(
    milestonePool * SPONSOR_MILESTONE_LADDER_SCALE * milestoneMult * getArchetypeMilestoneMultiplier(input.archetype),
  );

  const rebalance = getQualityRebalanceProfile(input.teamQualityRank);
  let rankCash = round1(rawRank * rebalance.milestoneScale);
  // Schwachen-Schutz: der garantierte Sockel wird für schwache Teams angehoben (baseScale), für starke
  // gekürzt — hält die Bottom-5 wirtschaftlich oben und die Schere unter Ziel. Muss zur Settlement-Seite
  // (applyQualityRebalanceToPayout) passen, die denselben baseScale anwendet.
  let baseCash = round1(rawBase * rebalance.baseScale);

  if (input.archetype === "security") {
    // Bottom-Schutz: der GARANTIERTE Sockel-Floor (effectiveBaseFloor) bleibt eine harte Untergrenze für
    // den "sicheren" Typ. Da ARCHETYPE_BASE_MULT.security = 1.12 > 1 liegt, bindet dieser Floor faktisch
    // nie, sichert die schwächsten Teams aber archetyp-eindeutig ab (bewusst an security gekoppelt).
    baseCash = round1(Math.max(baseCash, effectiveBaseFloor * rebalance.baseScale));
  }

  const totalAtMaxRank = round1(
    getSponsorPayoutForFinalRankAndTier(
      1,
      input.salaryFactor,
      input.starTier,
      leagueMinSalary,
      input.archetype,
      input.teamQualityRank,
    ),
  );
  const specialCash = round1(totalAtMaxRank * 0.04);
  return { baseCash, rankCash, specialCash, totalAtMaxRank };
}

/** @deprecated Use getRankMilestoneBonus for Gewinnstufen settlement */
export function getTieredRankPayoutFraction(currentRank: number, target: number): number {
  if (currentRank <= target) {
    return 1;
  }
  if (currentRank <= target + 3) {
    return 0.5;
  }
  if (currentRank <= target + 6) {
    return 0.25;
  }
  return 0;
}

export function estimateExpectedPayout(
  offer: SponsorOffer,
  powerRank: number | null,
  leagueMinSalary?: number,
): number {
  const baseComponent = offer.components.find((component) => component.kind === "base");
  const starTier = offer.starTier ?? 2;
  const baseMult = getStarTierBaseMultiplier(starTier);
  const baseCash = baseComponent?.rewardCash ?? 0;
  // WAVE 1: baseCash = effectiveBaseFloor * ARCHETYPE_BASE_MULT * starTierBaseMult (* baseScale). Dividiert
  // man durch (FLOOR * starTierBaseMult * ARCHETYPE_BASE_MULT), fällt der Sockel als ~einheitlicher Faktor
  // heraus — konsistent über alle Archetypen (löst die frühere share-basierte Sonderfall-Inferenz ab).
  const archetypeBaseMult = getArchetypeBaseMultiplier(offer.archetype);
  const inferredFactor =
    baseMult > 0 && archetypeBaseMult > 0
      ? baseCash / (SPONSOR_BASE_FLOOR_C * baseMult * archetypeBaseMult)
      : 1;
  const salaryFactor = inferredFactor > 0 ? inferredFactor : 1;
  const resolvedLeagueMin =
    leagueMinSalary ??
    (offer.archetype === "security"
      ? round1(baseCash / Math.max(0.01, getStarTierBaseMultiplier(starTier) * archetypeBaseMult))
      : SPONSOR_BASE_FLOOR_C * salaryFactor);
  const targetTotal = getSponsorPayoutForFinalRankAndTier(
    powerRank,
    salaryFactor,
    starTier,
    resolvedLeagueMin,
    offer.archetype,
    offer.teamQualityRank,
  );
  let expected = round1(Math.max(baseCash, targetTotal));
  for (const component of offer.components) {
    if (component.kind === "improvement") {
      expected += component.rewardCash * 0.2;
    } else if (component.kind === "special") {
      expected += component.rewardCash * 0.12;
    }
  }
  return round1(expected);
}

export function estimateSettlementPayout(
  offer: SponsorOffer,
  finalRank: number | null,
  salaryFactor = 1,
): number {
  const baseComponent = offer.components.find((component) => component.kind === "base");
  const rankComponent = offer.components.find((component) => component.kind === "rank");
  const base = baseComponent?.rewardCash ?? 0;
  const rankCash = rankComponent?.rewardCash ?? 0;
  const totalMilestone = getTotalMilestoneBonusC(salaryFactor);
  const unlocked = getRankMilestoneBonus(finalRank, salaryFactor);
  const rankPayout = totalMilestone > 0 ? round1(rankCash * (unlocked / totalMilestone)) : 0;
  let extra = 0;
  for (const component of offer.components) {
    if (component.kind === "improvement" || component.kind === "special") {
      extra += component.rewardCash * (component.kind === "special" ? 0.12 : 0.2);
    }
  }
  return round1(base + rankPayout + extra);
}
